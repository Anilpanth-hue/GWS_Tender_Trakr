import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import type { ApiResponse, ScrapeRun } from '@/types';

export async function GET() {
  try {
    const runs = await query<Record<string, unknown>>(
      'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 50'
    );

    const mapped: ScrapeRun[] = runs.map(r => ({
      id: r.id as number,
      session: r.session as ScrapeRun['session'],
      status: r.status as ScrapeRun['status'],
      totalFound: r.total_found as number,
      totalQualified: r.total_qualified as number,
      totalRejected: r.total_rejected as number,
      errorMessage: r.error_message as string | null,
      startedAt: r.started_at as string,
      completedAt: r.completed_at as string | null,
    }));

    return NextResponse.json<ApiResponse<ScrapeRun[]>>({ data: mapped });
  } catch {
    return NextResponse.json<ApiResponse>({ error: 'Failed to fetch scrape runs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { session?: string };
    const session = body.session || 'manual';

    const { scrapeAllTenders, fetchTenderDocuments, getBrowserInstance, closeBrowser } =
      await import('@/lib/scraper/tender247');
    const { screenTender, DEFAULT_CONFIG } = await import('@/lib/screening/rules');

    // Get credentials + scrape settings
    const settingRows = await query<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM scrape_settings WHERE setting_key IN (?, ?, ?)',
      ['tender247_email', 'tender247_password', 'scrape_max_tenders']
    );
    const settings: Record<string, string> = {};
    for (const s of settingRows) settings[s.setting_key] = s.setting_value;

    const maxTenders = parseInt(settings.scrape_max_tenders || '100', 10);

    // Create run record
    const result = await execute(
      'INSERT INTO scrape_runs (session, status) VALUES (?, ?)',
      [session, 'running']
    );
    const scrapeRunId = result.insertId;

    // Run in background
    (async () => {
      try {
        // Step 1: Scrape listing page (respect max tenders limit from settings)
        const rawTenders = await scrapeAllTenders(
          settings.tender247_email,
          settings.tender247_password,
          session as 'manual',
          maxTenders
        );

        let qualified = 0, rejected = 0;

        // Step 2: Screen each tender and save to DB
        const qualifiedTenders: Array<{ id: number; detailUrl: string }> = [];

        for (const raw of rawTenders) {
          const [existing] = await query<{ id: number }>(
            'SELECT id FROM tenders WHERE tender_no = ?',
            [raw.tenderNo]
          );
          if (existing) continue;

          const screening = screenTender(raw, DEFAULT_CONFIG);
          if (screening.status === 'qualified') qualified++;
          else rejected++;

          const insertResult = await execute(
            `INSERT INTO tenders
               (scrape_run_id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
                due_date, published_date, location, category, detail_url, source_session,
                l1_status, l1_qualification_reasons, l1_exclusion_reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              scrapeRunId, raw.title, raw.tenderNo, raw.issuedBy,
              raw.estimatedValue, raw.estimatedValueRaw, raw.dueDate, raw.publishedDate,
              raw.location, raw.category, raw.detailUrl, raw.sourceSession,
              screening.status, JSON.stringify(screening.qualificationReasons), screening.exclusionReason,
            ]
          );

          // Queue qualified tenders for document download
          if (screening.status === 'qualified' && raw.detailUrl) {
            qualifiedTenders.push({ id: insertResult.insertId, detailUrl: raw.detailUrl });
          }
        }

        // Step 3: Download documents for qualified tenders
        // Uses the SAME browser session (already logged in) — no new T247 login needed
        if (qualifiedTenders.length > 0) {
          const browser = getBrowserInstance();
          if (browser) {
            console.log(`[Scrape] Downloading documents for ${qualifiedTenders.length} qualified tenders...`);
            for (const { id: tenderId, detailUrl } of qualifiedTenders) {
              try {
                const docs = await fetchTenderDocuments(browser, tenderId, detailUrl);

                // Save summary PDF record
                if (docs.pdfFileName && docs.pdfPublicPath) {
                  await execute(
                    `INSERT INTO tender_documents (tender_id, file_name, file_path, doc_type, file_size)
                     VALUES (?, ?, ?, 'summary_pdf', ?)
                     ON DUPLICATE KEY UPDATE file_path = VALUES(file_path), file_size = VALUES(file_size)`,
                    [tenderId, docs.pdfFileName, docs.pdfPublicPath, docs.pdfFileSize]
                  );
                }

                // Save "Download All Documents" URL
                if (docs.fullDocsUrl) {
                  await execute(
                    `INSERT INTO tender_documents (tender_id, file_name, download_url, doc_type)
                     VALUES (?, 'All Tender Documents', ?, 'full_docs_zip')
                     ON DUPLICATE KEY UPDATE download_url = VALUES(download_url)`,
                    [tenderId, docs.fullDocsUrl]
                  );
                }
              } catch (err) {
                console.warn(`[Scrape] Doc fetch failed for tender #${tenderId}:`, (err as Error).message);
              }
            }
            console.log('[Scrape] Document download phase complete');
          }
        }

        await execute(
          `UPDATE scrape_runs SET status = 'completed', total_found = ?, total_qualified = ?, total_rejected = ?, completed_at = NOW() WHERE id = ?`,
          [rawTenders.length, qualified, rejected, scrapeRunId]
        );
      } catch (err) {
        await execute(
          `UPDATE scrape_runs SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
          [(err as Error).message, scrapeRunId]
        );
      } finally {
        await closeBrowser();
      }
    })();

    return NextResponse.json<ApiResponse<{ scrapeRunId: number }>>({
      data: { scrapeRunId },
      message: `Scrape started (run #${scrapeRunId}). Check scrape runs for status.`,
    });
  } catch (err) {
    console.error('[API /scrape] Error:', err);
    return NextResponse.json<ApiResponse>({ error: 'Failed to start scrape' }, { status: 500 });
  }
}
