import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import cron from 'node-cron';
import mysql from 'mysql2/promise';
import { scrapeAllTenders, fetchTenderDocuments, getBrowserInstance, closeBrowser } from '@/lib/scraper/tender247';
import { screenTender, DEFAULT_CONFIG } from '@/lib/screening/rules';
import { downloadFile, readFileForAI } from '@/lib/pdf/extract';
import { analyzeL1 } from '@/lib/ai/l1-analyze';
import type { ScrapeSession, ScreeningConfig } from '@/types';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'tender_trakr',
};

async function getDb() {
  return mysql.createConnection(DB_CONFIG);
}

async function getSettings(db: mysql.Connection): Promise<Record<string, string>> {
  const [rows] = await db.execute('SELECT setting_key, setting_value FROM scrape_settings');
  const settings: Record<string, string> = {};
  for (const row of rows as Array<{ setting_key: string; setting_value: string }>) {
    settings[row.setting_key] = row.setting_value;
  }
  return settings;
}

async function getScreeningConfig(db: mysql.Connection): Promise<ScreeningConfig> {
  try {
    const [rows] = await db.execute('SELECT config_key, config_value FROM screening_config');
    const configMap: Record<string, unknown> = {};
    for (const row of rows as Array<{ config_key: string; config_value: string }>) {
      configMap[row.config_key] = JSON.parse(row.config_value);
    }
    return {
      qualifyKeywords:         (configMap.qualify_keywords as string[])          || DEFAULT_CONFIG.qualifyKeywords,
      keyAuthorities:          (configMap.key_authorities as string[])            || DEFAULT_CONFIG.keyAuthorities,
      keyCommodities:          (configMap.key_commodities as string[])            || DEFAULT_CONFIG.keyCommodities,
      excludeOrganizations:    (configMap.exclude_organizations as string[])      || DEFAULT_CONFIG.excludeOrganizations,
      excludeCategories:       (configMap.exclude_categories as string[])         || DEFAULT_CONFIG.excludeCategories,
      minValueLakhs:           ((configMap.min_value_lakhs as { value: number })?.value) || DEFAULT_CONFIG.minValueLakhs,
      highValueThresholdCrores:((configMap.high_value_crores as { value: number })?.value) || DEFAULT_CONFIG.highValueThresholdCrores,
    };
  } catch {
    console.warn('[Scraper Server] Could not load screening config from DB, using defaults');
    return DEFAULT_CONFIG;
  }
}

async function runScrape(session: ScrapeSession) {
  console.log(`\n[Scraper Server] ====== Starting ${session} scrape ======`);
  const db = await getDb();
  let scrapeRunId: number | null = null;

  try {
    const settings = await getSettings(db);
    if (settings.scrape_enabled === 'false') {
      console.log('[Scraper Server] Scraping disabled. Skipping.');
      await db.end();
      return;
    }

    const email    = settings.tender247_email;
    const password = settings.tender247_password;

    const [runRes] = await db.execute('INSERT INTO scrape_runs (session, status) VALUES (?, ?)', [session, 'running']);
    scrapeRunId = (runRes as mysql.ResultSetHeader).insertId;
    console.log(`[Scraper Server] Created scrape run #${scrapeRunId}`);

    // ── Phase 1: Scrape listing ──────────────────────────────────────────────
    const rawTenders = await scrapeAllTenders(email, password, session);
    console.log(`[Scraper Server] Scraped ${rawTenders.length} raw tenders`);

    const screeningConfig = await getScreeningConfig(db);
    let totalQualified = 0, totalRejected = 0;

    type DocQueueItem = {
      id: number; detailUrl: string; tenderNo: string; title: string;
      keywordResult: ReturnType<typeof screenTender>;
    };
    const docQueue: DocQueueItem[] = [];

    // ── Phase 2: Fast keyword pre-filter + save all tenders ─────────────────
    for (const raw of rawTenders) {
      const [existing] = await db.execute('SELECT id FROM tenders WHERE tender_no = ?', [raw.tenderNo]);
      if ((existing as unknown[]).length > 0) continue;

      const keywordResult = screenTender(raw, screeningConfig);

      const [ins] = await db.execute(
        `INSERT INTO tenders (
           scrape_run_id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
           due_date, published_date, location, category, detail_url, source_session,
           l1_status, l1_qualification_reasons, l1_exclusion_reason, l1_analysis_source
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'metadata_only')`,
        [
          scrapeRunId, raw.title, raw.tenderNo, raw.issuedBy,
          raw.estimatedValue, raw.estimatedValueRaw, raw.dueDate, raw.publishedDate,
          raw.location, raw.category, raw.detailUrl, raw.sourceSession,
          keywordResult.status, JSON.stringify(keywordResult.qualificationReasons), keywordResult.exclusionReason,
        ]
      );
      const tenderId = (ins as mysql.ResultSetHeader).insertId;

      if (keywordResult.status === 'qualified' && raw.detailUrl) {
        docQueue.push({ id: tenderId, detailUrl: raw.detailUrl, tenderNo: raw.tenderNo, title: raw.title, keywordResult });
      } else {
        totalRejected++;
      }
    }

    // ── Phase 3: Doc fetch + download + AI L1 for keyword-qualified tenders ─
    const browser = getBrowserInstance();
    if (browser && docQueue.length > 0) {
      console.log(`[Scraper Server] Doc fetch + AI L1 for ${docQueue.length} keyword-qualified tenders…`);

      for (const { id: tenderId, detailUrl, tenderNo, title, keywordResult } of docQueue) {
        try {
          // 3a. Fetch document links
          const docResult = await fetchTenderDocuments(browser, tenderId, detailUrl);

          for (const doc of docResult.documents) {
            await db.execute(
              `INSERT INTO tender_documents (tender_id, file_name, download_url, doc_type) VALUES (?, ?, ?, ?)`,
              [tenderId, doc.label, doc.url, doc.docType]
            ).catch(() => {});
          }

          // 3b. Download docs and read content for AI
          const docContents: Array<{ type: 'pdf_base64' | 'text'; content: string }> = [];

          for (const doc of docResult.documents.slice(0, 3)) {
            if (!doc.url) continue;
            const localPath = await downloadFile(doc.url, tenderId, doc.label);
            if (!localPath) continue;

            await db.execute(
              `UPDATE tender_documents SET file_path = ? WHERE tender_id = ? AND file_name = ? LIMIT 1`,
              [localPath.replace(process.cwd() + '/public', ''), tenderId, doc.label]
            ).catch(() => {});

            const content = readFileForAI(localPath);
            if (content) docContents.push(content);
          }

          // 3c. AI L1 analysis
          const tenderMeta = `Tender No: ${tenderNo}`;
          const l1Result = await analyzeL1(title, tenderMeta, docContents, keywordResult);

          // 3d. Build overview from AI L1 result
          const overview = {
            t247Id: tenderNo, orgTenderId: '', estimatedCost: '', documentFees: '',
            emdValue:          l1Result.emdAmount !== 'Not mentioned' ? l1Result.emdAmount : '',
            completionPeriod:  l1Result.contractPeriod !== 'Not mentioned' ? l1Result.contractPeriod : '',
            siteLocation: '', contactPerson: '', contactAddress: '',
            quantity: '', msmeExemption: '', startupExemption: '', jvConsortium: '',
            performanceBankGuarantee: '', hardCopySubmission: '',
            eligibilityCriteria: l1Result.eligibilitySummary !== 'Not mentioned' ? l1Result.eligibilitySummary : '',
            pqcSummary:        l1Result.eligibilitySummary !== 'Not mentioned' ? l1Result.eligibilitySummary : '',
            fullSummaryText:   l1Result.scopeOfWork || '',
            fetchedAt:         new Date().toISOString(),
          };

          // 3e. Update tender
          await db.execute(
            `UPDATE tenders SET
               l1_status = ?, l1_qualification_reasons = ?, l1_exclusion_reason = ?,
               l1_scope_of_work = ?, l1_analysis_source = ?, tender_overview = ?
             WHERE id = ?`,
            [
              l1Result.status,
              JSON.stringify(l1Result.status === 'qualified' ? l1Result.qualificationReasons : []),
              l1Result.rejectionReason,
              l1Result.scopeOfWork || null,
              l1Result.analysisSource,
              JSON.stringify(overview),
              tenderId,
            ]
          );

          if (l1Result.status === 'qualified') totalQualified++;
          else totalRejected++;

          console.log(`[Scraper Server] #${tenderId} AI L1: ${l1Result.status} (${l1Result.analysisSource}, ${l1Result.confidence})`);

        } catch (err) {
          console.warn(`[Scraper Server] Doc/AI L1 failed for #${tenderId}:`, (err as Error).message);
          totalQualified++; // keyword said qualified — keep it
        }
      }
    } else {
      totalQualified += docQueue.length;
    }

    await db.execute(
      `UPDATE scrape_runs SET status = 'completed', total_found = ?, total_qualified = ?, total_rejected = ?, completed_at = NOW() WHERE id = ?`,
      [rawTenders.length, totalQualified, totalRejected, scrapeRunId]
    );
    console.log(`[Scraper Server] Done. Found: ${rawTenders.length}, Qualified: ${totalQualified}, Rejected: ${totalRejected}`);

  } catch (err) {
    console.error('[Scraper Server] Error during scrape:', err);
    if (scrapeRunId) {
      await db.execute(
        `UPDATE scrape_runs SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
        [(err as Error).message, scrapeRunId]
      );
    }
  } finally {
    await db.end();
    await closeBrowser();
  }
}

// ── Cron Schedules ─────────────────────────────────────────────────────────────
cron.schedule('0 6 * * *',      () => runScrape('morning'),   { timezone: 'Asia/Kolkata' });
cron.schedule('0 13 * * *',     () => runScrape('afternoon'), { timezone: 'Asia/Kolkata' });
cron.schedule('0 8-20/2 * * *', () => runScrape('live'),      { timezone: 'Asia/Kolkata' });

console.log('[Scraper Server] Started. Schedules:');
console.log('  - Morning:   6:00 AM IST');
console.log('  - Afternoon: 1:00 PM IST');
console.log('  - Live:      Every 2 hours (8AM–8PM IST)');
console.log('  Pipeline: keyword pre-filter → doc fetch → AI L1 (documents-first)');

if (process.argv[2] === 'manual') {
  console.log('[Scraper Server] Manual trigger detected. Running now…');
  runScrape('manual').then(() => process.exit(0));
}

process.on('SIGINT', async () => {
  console.log('\n[Scraper Server] Shutting down…');
  await closeBrowser();
  process.exit(0);
});