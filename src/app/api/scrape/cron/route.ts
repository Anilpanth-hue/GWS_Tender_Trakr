import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import type { SingleTenderResult } from '@/lib/scraper/tender247';

type TenderOverview = SingleTenderResult['overview'];

/**
 * GET /api/scrape/cron?secret=<CRON_SECRET>
 *
 * Called by the server's Linux cron job — no user session required.
 * Authenticated via CRON_SECRET env var.
 * Skips silently if a scrape run is already in progress.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Skip if a scrape run is already running
    const [running] = await query<{ id: number }>(
      "SELECT id FROM scrape_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1"
    );
    if (running) {
      console.log('[Cron] Scrape already in progress — skipping this tick');
      return NextResponse.json({ message: 'Scrape already running — skipped.' });
    }

    const settingRows = await query<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM scrape_settings WHERE setting_key IN (?, ?, ?)',
      ['tender247_email', 'tender247_password', 'scrape_max_tenders']
    );
    const settings: Record<string, string> = {};
    for (const s of settingRows) settings[s.setting_key] = s.setting_value;

    if (!settings.tender247_email || !settings.tender247_password) {
      console.error('[Cron] T247 credentials not configured');
      return NextResponse.json({ error: 'T247 credentials not configured' }, { status: 500 });
    }

    const maxTenders = parseInt(settings.scrape_max_tenders || '200', 10);

    const result = await execute(
      'INSERT INTO scrape_runs (session, status) VALUES (?, ?)',
      ['scheduled', 'running']
    );
    const fetchRunId = result.insertId;

    console.log(`[Cron] Starting scheduled run #${fetchRunId} (max ${maxTenders})`);

    // Fire-and-forget background pipeline — mirrors /api/scrape POST exactly
    (async () => {
      try {
        const { fetchAllTenders, fetchDetailPageData, getBrowserInstance, closeBrowser } =
          await import('@/lib/scraper/tender247');
        const { screenTender, DEFAULT_CONFIG } = await import('@/lib/screening/rules');
        const { analyzeL1 } = await import('@/lib/ai/l1-analyze');

        function buildOverviewText(overview: TenderOverview, tenderNo: string): string {
          const lines: string[] = [`Tender No: ${tenderNo}`];
          if (overview.estimatedCost)   lines.push(`Estimated Cost: ${overview.estimatedCost}`);
          if (overview.emdValue)        lines.push(`EMD Value: ${overview.emdValue}`);
          if (overview.completionPeriod) lines.push(`Completion Period: ${overview.completionPeriod}`);
          if (overview.siteLocation)    lines.push(`Site Location: ${overview.siteLocation}`);
          if (overview.eligibilityCriteria) lines.push(`\nEligibility Criteria:\n${overview.eligibilityCriteria}`);
          if (overview.pqcSummary && overview.pqcSummary !== overview.eligibilityCriteria)
            lines.push(`\nPre-Qualification:\n${overview.pqcSummary}`);
          if (overview.fullSummaryText) lines.push(`\nScope / AI Summary:\n${overview.fullSummaryText}`);
          return lines.join('\n');
        }

        const rawTenders = await fetchAllTenders(
          settings.tender247_email, settings.tender247_password,
          'manual', maxTenders
        );

        let qualified = 0, rejected = 0;
        const docQueue: Array<{ id: number; detailUrl: string; tenderNo: string; keywordResult: ReturnType<typeof screenTender> }> = [];

        for (const raw of rawTenders) {
          const keywordResult = screenTender(raw, DEFAULT_CONFIG);

          const insertResult = await execute(
            `INSERT IGNORE INTO tenders
               (scrape_run_id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
                due_date, published_date, location, category, detail_url, source_session,
                l1_status, l1_qualification_reasons, l1_exclusion_reason, l1_analysis_source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'metadata_only')`,
            [
              fetchRunId, raw.title, raw.tenderNo, raw.issuedBy,
              raw.estimatedValue, raw.estimatedValueRaw, raw.dueDate, raw.publishedDate,
              raw.location, raw.category, raw.detailUrl, raw.sourceSession,
              keywordResult.status,
              JSON.stringify(keywordResult.qualificationReasons),
              keywordResult.exclusionReason,
            ]
          );

          if (!insertResult.insertId) continue; // duplicate — skip

          if (raw.listingEmdValue) {
            await execute(
              'UPDATE tenders SET tender_overview = ? WHERE id = ?',
              [JSON.stringify({ emdValue: raw.listingEmdValue, fetchedAt: new Date().toISOString() }), insertResult.insertId]
            );
          }

          if (keywordResult.status === 'qualified' && raw.detailUrl) {
            docQueue.push({ id: insertResult.insertId, detailUrl: raw.detailUrl, tenderNo: raw.tenderNo, keywordResult });
          } else {
            rejected++;
          }
        }

        const browser = getBrowserInstance();
        if (browser && docQueue.length > 0) {
          for (const { id: tenderId, detailUrl, tenderNo, keywordResult } of docQueue) {
            try {
              const overview = await fetchDetailPageData(browser, detailUrl, tenderNo);
              const labeledText = buildOverviewText(overview, tenderNo);
              const docContents: Array<{ type: 'pdf_base64' | 'text'; content: string }> =
                labeledText ? [{ type: 'text', content: labeledText }] : [];

              const titleRow = await query<{ title: string }>('SELECT title FROM tenders WHERE id = ?', [tenderId]);
              const l1Result = await analyzeL1(
                titleRow[0]?.title ?? '',
                `Tender No: ${tenderNo}`,
                docContents,
                keywordResult
              );

              const tenderOverview = {
                ...overview,
                emdValue:            overview.emdValue         || (l1Result.emdAmount      !== 'Not mentioned' ? l1Result.emdAmount      : ''),
                completionPeriod:    overview.completionPeriod || (l1Result.contractPeriod !== 'Not mentioned' ? l1Result.contractPeriod : ''),
                eligibilityCriteria: overview.eligibilityCriteria || (l1Result.eligibilitySummary !== 'Not mentioned' ? l1Result.eligibilitySummary : ''),
                fullSummaryText:     l1Result.scopeOfWork || overview.fullSummaryText || '',
              };

              await execute(
                `UPDATE tenders SET
                   l1_status = ?, l1_qualification_reasons = ?, l1_exclusion_reason = ?,
                   l1_scope_of_work = ?, l1_analysis_source = ?,
                   tender_overview = ?
                 WHERE id = ?`,
                [
                  l1Result.status,
                  JSON.stringify(l1Result.status === 'qualified' ? l1Result.qualificationReasons : []),
                  l1Result.rejectionReason,
                  l1Result.scopeOfWork || null,
                  l1Result.analysisSource,
                  JSON.stringify(tenderOverview),
                  tenderId,
                ]
              );

              if (l1Result.status === 'qualified') qualified++;
              else rejected++;
            } catch (err) {
              console.warn(`[Cron] Detail/AI L1 failed for #${tenderId}:`, (err as Error).message);
              qualified++;
            }
          }
        } else {
          qualified += docQueue.length;
        }

        await execute(
          `UPDATE scrape_runs SET status='completed', total_found=?, total_qualified=?, total_rejected=?, completed_at=NOW() WHERE id=?`,
          [rawTenders.length, qualified, rejected, fetchRunId]
        );
        console.log(`[Cron] Run #${fetchRunId} done — found:${rawTenders.length} qualified:${qualified} rejected:${rejected}`);

      } catch (err) {
        console.error('[Cron] Run failed:', err);
        await execute(
          `UPDATE scrape_runs SET status='failed', error_message=?, completed_at=NOW() WHERE id=?`,
          [(err as Error).message, fetchRunId]
        );
      } finally {
        const { closeBrowser } = await import('@/lib/scraper/tender247');
        await closeBrowser();
      }
    })();

    return NextResponse.json({
      message: `Scheduled run #${fetchRunId} started (max ${maxTenders} tenders).`,
      runId: fetchRunId,
    });

  } catch (err) {
    console.error('[Cron] Unexpected error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
