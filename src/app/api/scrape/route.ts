import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import type { ApiResponse, ScrapeRun } from '@/types';

function buildOverviewText(
  overview: {
    estimatedCost?: string; emdValue?: string; completionPeriod?: string;
    siteLocation?: string; eligibilityCriteria?: string; pqcSummary?: string;
    fullSummaryText?: string; msmeExemption?: string; startupExemption?: string;
    jvConsortium?: string; reverseAuction?: string; hardCopySubmission?: string;
    performanceBankGuarantee?: string;
  },
  tenderNo: string
): string {
  const lines: string[] = [`Tender No: ${tenderNo}`];
  if (overview.estimatedCost)         lines.push(`Estimated Cost: ${overview.estimatedCost}`);
  if (overview.emdValue)              lines.push(`EMD Value: ${overview.emdValue}`);
  if (overview.completionPeriod)      lines.push(`Completion Period: ${overview.completionPeriod}`);
  if (overview.siteLocation)          lines.push(`Site Location: ${overview.siteLocation}`);
  if (overview.msmeExemption)         lines.push(`MSME Exemption: ${overview.msmeExemption}`);
  if (overview.startupExemption)      lines.push(`Startup Exemption: ${overview.startupExemption}`);
  if (overview.jvConsortium)          lines.push(`JV / Consortium: ${overview.jvConsortium}`);
  if (overview.reverseAuction)        lines.push(`Reverse Auction: ${overview.reverseAuction}`);
  if (overview.performanceBankGuarantee) lines.push(`Performance Bank Guarantee: ${overview.performanceBankGuarantee}`);
  if (overview.hardCopySubmission)    lines.push(`Hard Copy Required: ${overview.hardCopySubmission}`);
  if (overview.eligibilityCriteria)
    lines.push(`\nEligibility Criteria:\n${overview.eligibilityCriteria}`);
  if (overview.pqcSummary && overview.pqcSummary !== overview.eligibilityCriteria)
    lines.push(`\nPre-Qualification:\n${overview.pqcSummary}`);
  if (overview.fullSummaryText)
    lines.push(`\nScope / AI Summary:\n${overview.fullSummaryText}`);
  return lines.join('\n');
}

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

    const { scrapeAllTenders, scrapeDetailPageData, getBrowserInstance, closeBrowser } =
      await import('@/lib/scraper/tender247');
    const { screenTender, DEFAULT_CONFIG } = await import('@/lib/screening/rules');
    const { analyzeL1 } = await import('@/lib/ai/l1-analyze');

    const settingRows = await query<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM scrape_settings WHERE setting_key IN (?, ?, ?)',
      ['tender247_email', 'tender247_password', 'scrape_max_tenders']
    );
    const settings: Record<string, string> = {};
    for (const s of settingRows) settings[s.setting_key] = s.setting_value;

    const maxTenders = parseInt(settings.scrape_max_tenders || '100', 10);

    const result = await execute('INSERT INTO scrape_runs (session, status) VALUES (?, ?)', [session, 'running']);
    const scrapeRunId = result.insertId;

    // Run full pipeline in background
    (async () => {
      try {
        // ── Phase 1: Scrape listing ─────────────────────────────────────────────
        const rawTenders = await scrapeAllTenders(
          settings.tender247_email, settings.tender247_password,
          session as 'manual', maxTenders
        );

        let qualified = 0, rejected = 0;
        const docQueue: Array<{ id: number; detailUrl: string; tenderNo: string; keywordResult: ReturnType<typeof screenTender> }> = [];

        // ── Phase 2: Fast keyword pre-filter + save all tenders ─────────────────
        for (const raw of rawTenders) {
          const [existing] = await query<{ id: number }>('SELECT id FROM tenders WHERE tender_no = ?', [raw.tenderNo]);
          if (existing) continue;

          const keywordResult = screenTender(raw, DEFAULT_CONFIG);

          const insertResult = await execute(
            `INSERT INTO tenders
               (scrape_run_id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
                due_date, published_date, location, category, detail_url, source_session,
                l1_status, l1_qualification_reasons, l1_exclusion_reason, l1_analysis_source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'metadata_only')`,
            [
              scrapeRunId, raw.title, raw.tenderNo, raw.issuedBy,
              raw.estimatedValue, raw.estimatedValueRaw, raw.dueDate, raw.publishedDate,
              raw.location, raw.category, raw.detailUrl, raw.sourceSession,
              keywordResult.status,
              JSON.stringify(keywordResult.qualificationReasons),
              keywordResult.exclusionReason,
            ]
          );

          if (keywordResult.status === 'qualified' && raw.detailUrl) {
            // Queue for doc fetch + AI L1
            docQueue.push({ id: insertResult.insertId, detailUrl: raw.detailUrl, tenderNo: raw.tenderNo, keywordResult });
          } else {
            rejected++;
          }
        }

        // ── Phase 3: Scrape T247 AI Summary + AI L1 for keyword-qualified tenders ─
        // Visits each detail page (logged-in browser), reads the structured AI
        // summary section (EMD, contract period, scope, eligibility), then sends
        // that clean labeled text to Gemini for L1 screening — no PDF download needed.
        const browser = getBrowserInstance();
        if (browser && docQueue.length > 0) {
          console.log(`[Scrape] Detail page scrape + AI L1 for ${docQueue.length} keyword-qualified tenders…`);

          for (const { id: tenderId, detailUrl, tenderNo, keywordResult } of docQueue) {
            try {
              // 3a. Visit detail page, extract T247 AI Summary (structured fields)
              const overview = await scrapeDetailPageData(browser, detailUrl, tenderNo);

              // 3b. Format as clean labeled text for Gemini
              const labeledText = buildOverviewText(overview, tenderNo);
              const docContents: Array<{ type: 'pdf_base64' | 'text'; content: string }> =
                labeledText ? [{ type: 'text', content: labeledText }] : [];

              // 3c. Run AI L1 on the structured text
              const titleRow = await query<{ title: string }>('SELECT title FROM tenders WHERE id = ?', [tenderId]);
              const l1Result = await analyzeL1(
                titleRow[0]?.title ?? '',
                `Tender No: ${tenderNo}`,
                docContents,
                keywordResult
              );

              // 3d. Merge AI result with already-structured overview fields.
              // T247 fields take priority; AI fills in anything missing.
              const tenderOverview = {
                ...overview,
                emdValue:         overview.emdValue         || (l1Result.emdAmount      !== 'Not mentioned' ? l1Result.emdAmount      : ''),
                completionPeriod: overview.completionPeriod || (l1Result.contractPeriod !== 'Not mentioned' ? l1Result.contractPeriod : ''),
                eligibilityCriteria: overview.eligibilityCriteria || (l1Result.eligibilitySummary !== 'Not mentioned' ? l1Result.eligibilitySummary : ''),
                fullSummaryText:  l1Result.scopeOfWork || overview.fullSummaryText || '',
              };

              // 3e. Update tender with AI L1 result + full overview
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

              console.log(`[Scrape] #${tenderId} AI L1: ${l1Result.status} (confidence: ${l1Result.confidence})`);

            } catch (err) {
              // Detail page or AI failure — keyword result already saved, count as qualified
              console.warn(`[Scrape] Detail/AI L1 failed for #${tenderId}:`, (err as Error).message);
              qualified++;
            }
          }
        } else {
          qualified += docQueue.length;
        }

        await execute(
          `UPDATE scrape_runs SET status = 'completed', total_found = ?, total_qualified = ?, total_rejected = ?, completed_at = NOW() WHERE id = ?`,
          [rawTenders.length, qualified, rejected, scrapeRunId]
        );
        console.log(`[Scrape] Run #${scrapeRunId} complete — found: ${rawTenders.length}, qualified: ${qualified}, rejected: ${rejected}`);

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
      message: `Scrape started (run #${scrapeRunId}). Keyword pre-filter → doc fetch → AI L1 running in background.`,
    });
  } catch (err) {
    console.error('[API /scrape] Error:', err);
    return NextResponse.json<ApiResponse>({ error: 'Failed to start scrape' }, { status: 500 });
  }
}