import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import cron from 'node-cron';
import mysql from 'mysql2/promise';
import { scrapeAllTenders, closeBrowser } from '@/lib/scraper/tender247';
import { screenTender, DEFAULT_CONFIG } from '@/lib/screening/rules';
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
      qualifyKeywords: (configMap.qualify_keywords as string[]) || DEFAULT_CONFIG.qualifyKeywords,
      keyAuthorities: (configMap.key_authorities as string[]) || DEFAULT_CONFIG.keyAuthorities,
      keyCommodities: (configMap.key_commodities as string[]) || DEFAULT_CONFIG.keyCommodities,
      excludeOrganizations: (configMap.exclude_organizations as string[]) || DEFAULT_CONFIG.excludeOrganizations,
      excludeCategories: (configMap.exclude_categories as string[]) || DEFAULT_CONFIG.excludeCategories,
      minValueLakhs: ((configMap.min_value_lakhs as { value: number })?.value) || DEFAULT_CONFIG.minValueLakhs,
      highValueThresholdCrores: ((configMap.high_value_crores as { value: number })?.value) || DEFAULT_CONFIG.highValueThresholdCrores,
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
    const scrapeEnabled = settings.scrape_enabled !== 'false';

    if (!scrapeEnabled) {
      console.log('[Scraper Server] Scraping is disabled. Skipping.');
      await db.end();
      return;
    }

    const email = settings.tender247_email;
    const password = settings.tender247_password;

    // Create scrape run record
    const [result] = await db.execute(
      'INSERT INTO scrape_runs (session, status) VALUES (?, ?)',
      [session, 'running']
    );
    scrapeRunId = (result as mysql.ResultSetHeader).insertId;
    console.log(`[Scraper Server] Created scrape run #${scrapeRunId}`);

    // Scrape tenders
    const rawTenders = await scrapeAllTenders(email, password, session);
    console.log(`[Scraper Server] Scraped ${rawTenders.length} raw tenders`);

    // Load screening config
    const screeningConfig = await getScreeningConfig(db);

    let totalQualified = 0;
    let totalRejected = 0;

    // Screen and save each tender
    for (const raw of rawTenders) {
      // Check if already exists (by tender number)
      const [existing] = await db.execute(
        'SELECT id FROM tenders WHERE tender_no = ?',
        [raw.tenderNo]
      );

      if ((existing as unknown[]).length > 0) {
        console.log(`[Scraper Server] Skipping duplicate: ${raw.tenderNo}`);
        continue;
      }

      const screening = screenTender(raw, screeningConfig);

      if (screening.status === 'qualified') totalQualified++;
      else totalRejected++;

      await db.execute(
        `INSERT INTO tenders (
          scrape_run_id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
          due_date, published_date, location, category, detail_url, source_session,
          l1_status, l1_qualification_reasons, l1_exclusion_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scrapeRunId,
          raw.title,
          raw.tenderNo,
          raw.issuedBy,
          raw.estimatedValue,
          raw.estimatedValueRaw,
          raw.dueDate,
          raw.publishedDate,
          raw.location,
          raw.category,
          raw.detailUrl,
          raw.sourceSession,
          screening.status,
          JSON.stringify(screening.qualificationReasons),
          screening.exclusionReason,
        ]
      );
    }

    // Update scrape run
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
  }
}

// ── Cron Schedules ────────────────────────────────────────────────────────────

// Morning scrape: 6:00 AM daily
cron.schedule('0 6 * * *', () => runScrape('morning'), { timezone: 'Asia/Kolkata' });

// Afternoon scrape: 1:00 PM daily
cron.schedule('0 13 * * *', () => runScrape('afternoon'), { timezone: 'Asia/Kolkata' });

// Live scrape: Every 2 hours during business hours (8am - 8pm)
cron.schedule('0 8-20/2 * * *', () => runScrape('live'), { timezone: 'Asia/Kolkata' });

console.log('[Scraper Server] Started. Schedules:');
console.log('  - Morning scrape: 6:00 AM IST');
console.log('  - Afternoon scrape: 1:00 PM IST');
console.log('  - Live scrape: Every 2 hours (8AM–8PM IST)');

// Allow manual trigger via CLI: npm run dev:scraper -- manual
if (process.argv[2] === 'manual') {
  console.log('[Scraper Server] Manual trigger detected. Running now...');
  runScrape('manual').then(() => {
    closeBrowser();
    process.exit(0);
  });
}

process.on('SIGINT', async () => {
  console.log('\n[Scraper Server] Shutting down...');
  await closeBrowser();
  process.exit(0);
});
