import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import type { ApiResponse, Tender } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonColumn(val: unknown): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return null;
}

function mapTender(row: Record<string, unknown>): Tender {
  return {
    id: row.id as number,
    title: row.title as string,
    tenderNo: row.tender_no as string,
    issuedBy: row.issued_by as string,
    estimatedValue: row.estimated_value as number | null,
    estimatedValueRaw: row.estimated_value_raw as string,
    dueDate: row.due_date as string | null,
    publishedDate: row.published_date as string | null,
    location: row.location as string,
    category: row.category as string,
    detailUrl: row.detail_url as string,
    tenderOverview: parseJsonColumn(row.tender_overview),
    sourceSession: row.source_source_session as Tender['sourceSession'] ?? (row.source_session as Tender['sourceSession']),
    scrapeRunId: row.scrape_run_id as number,
    l1Status: row.l1_status as Tender['l1Status'],
    l1QualificationReasons: parseJsonColumn(row.l1_qualification_reasons) ?? [],
    l1ExclusionReason: row.l1_exclusion_reason as string | null,
    l1ScopeOfWork: (row.l1_scope_of_work as string) || null,
    l1AnalysisSource: (row.l1_analysis_source as 'documents' | 'metadata_only') || 'metadata_only',
    l1Decision: row.l1_decision as Tender['l1Decision'],
    l1DecisionReason: row.l1_decision_reason as string | null,
    l1DecisionBy: row.l1_decision_by as string | null,
    l1DecisionAt: row.l1_decision_at as string | null,
    l2Analyzed: Boolean(row.l2_analyzed),
    l2Analysis: parseJsonColumn(row.l2_analysis),
    ownerEmail: (row.owner_email as string) || null,
    ownerAssignedAt: (row.owner_assigned_at as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * POST /api/tenders/fetch-single
 * Body: { t247Id: string }
 *
 * Full synchronous pipeline:
 *   login → scrape detail page → L1 screen → save to DB →
 *   download PDF + capture ZIP URL → save documents
 *
 * Tender is saved with l1_decision = 'pending' so user reviews it
 * in the Tenders (L1) screen before it goes to L2 Analysis.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { t247Id?: string };
    const t247Id = (body.t247Id || '').trim();

    if (!t247Id || !/^\d+$/.test(t247Id)) {
      return NextResponse.json<ApiResponse>({
        error: 'Invalid T247 ID — must be a numeric Tender247 ID (e.g. 98884609)',
      }, { status: 400 });
    }

    // ── Already exists? ───────────────────────────────────────────────────────
    const existing = await queryOne<Record<string, unknown>>(
      'SELECT * FROM tenders WHERE tender_no = ?',
      [t247Id]
    );
    if (existing) {
      return NextResponse.json<ApiResponse<{ tender: Tender; isNew: boolean }>>({
        data: { tender: mapTender(existing), isNew: false },
        message: `Tender #${t247Id} already exists in the database.`,
      });
    }

    // ── Credentials ───────────────────────────────────────────────────────────
    const settingRows = await query<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM scrape_settings WHERE setting_key IN (?, ?)',
      ['tender247_email', 'tender247_password']
    );
    const settings: Record<string, string> = {};
    for (const s of settingRows) settings[s.setting_key] = s.setting_value;

    if (!settings.tender247_email || !settings.tender247_password) {
      return NextResponse.json<ApiResponse>({
        error: 'Tender247 credentials not configured. Please set them in Settings.',
      }, { status: 400 });
    }

    // ── Import scraper, screening, AI ─────────────────────────────────────────
    const { scrapeSingleTenderById, closeBrowser } = await import('@/lib/scraper/tender247');
    const { screenTender, DEFAULT_CONFIG } = await import('@/lib/screening/rules');
    const { analyzeL1 } = await import('@/lib/ai/l1-analyze');

    // ── Step 1: Scrape tender detail page ─────────────────────────────────────
    console.log(`[fetch-single] Scraping T247 #${t247Id}…`);
    const { rawTender, overview } = await scrapeSingleTenderById(
      settings.tender247_email,
      settings.tender247_password,
      t247Id
    );

    // Browser no longer needed — documents are fetched at L2 time, not here
    await closeBrowser();

    // ── Step 2: Keyword pre-filter (instant gate) ─────────────────────────────
    const screening = screenTender(rawTender, DEFAULT_CONFIG);
    console.log(`[fetch-single] Keyword pre-filter: ${screening.status}`);

    // ── Step 3: AI L1 on T247 detail page summary ─────────────────────────────
    // The overview already has structured fields (EMD, contract period, scope,
    // eligibility) scraped directly from the T247 AI Summary section.
    const overviewText = [
      `Tender No: ${t247Id}`,
      overview.estimatedCost    && `Estimated Cost: ${overview.estimatedCost}`,
      overview.emdValue         && `EMD Value: ${overview.emdValue}`,
      overview.completionPeriod && `Completion Period: ${overview.completionPeriod}`,
      overview.siteLocation     && `Site Location: ${overview.siteLocation}`,
      overview.msmeExemption    && `MSME Exemption: ${overview.msmeExemption}`,
      overview.startupExemption && `Startup Exemption: ${overview.startupExemption}`,
      overview.jvConsortium     && `JV / Consortium: ${overview.jvConsortium}`,
      overview.eligibilityCriteria && `\nEligibility Criteria:\n${overview.eligibilityCriteria}`,
      overview.fullSummaryText  && `\nScope / AI Summary:\n${overview.fullSummaryText}`,
    ].filter(Boolean).join('\n');

    const docContents: Array<{ type: 'pdf_base64' | 'text'; content: string }> =
      overviewText ? [{ type: 'text', content: overviewText }] : [];

    const l1Result = await analyzeL1(rawTender.title, `Tender No: ${t247Id}`, docContents, screening);
    console.log(`[fetch-single] AI L1: ${l1Result.status} (confidence: ${l1Result.confidence})`);

    // Merge AI findings into the structured overview (T247 fields take priority)
    const tenderOverview = {
      ...overview,
      emdValue:         overview.emdValue         || (l1Result.emdAmount      !== 'Not mentioned' ? l1Result.emdAmount      : ''),
      completionPeriod: overview.completionPeriod || (l1Result.contractPeriod !== 'Not mentioned' ? l1Result.contractPeriod : ''),
      eligibilityCriteria: overview.eligibilityCriteria || (l1Result.eligibilitySummary !== 'Not mentioned' ? l1Result.eligibilitySummary : ''),
      fullSummaryText:  l1Result.scopeOfWork || overview.fullSummaryText || '',
    };

    // ── Step 4: Create scrape_run record ──────────────────────────────────────
    const runResult = await execute(
      `INSERT INTO scrape_runs (session, status, total_found, total_qualified, total_rejected, completed_at)
       VALUES ('manual', 'completed', 1, ?, ?, NOW())`,
      [l1Result.status === 'qualified' ? 1 : 0, l1Result.status === 'rejected' ? 1 : 0]
    );
    const scrapeRunId = runResult.insertId;

    // ── Step 5: Save tender (decision = pending, user reviews in L1) ──────────
    const insertResult = await execute(
      `INSERT INTO tenders
         (scrape_run_id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
          due_date, published_date, location, category, detail_url, source_session,
          l1_status, l1_qualification_reasons, l1_exclusion_reason,
          l1_scope_of_work, l1_analysis_source,
          tender_overview, l1_decision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        scrapeRunId,
        rawTender.title, rawTender.tenderNo, rawTender.issuedBy,
        rawTender.estimatedValue, rawTender.estimatedValueRaw,
        rawTender.dueDate, rawTender.publishedDate,
        rawTender.location, rawTender.category,
        rawTender.detailUrl, rawTender.sourceSession,
        l1Result.status,
        JSON.stringify(l1Result.status === 'qualified' ? l1Result.qualificationReasons : []),
        l1Result.rejectionReason,
        l1Result.scopeOfWork || null,
        l1Result.analysisSource,
        JSON.stringify(tenderOverview),
      ]
    );
    const tenderId = insertResult.insertId;
    console.log(`[fetch-single] Saved tender #${tenderId}`);

    // ── Return tender ─────────────────────────────────────────────────────────
    const savedRow = await queryOne<Record<string, unknown>>(
      'SELECT * FROM tenders WHERE id = ?', [tenderId]
    );

    return NextResponse.json<ApiResponse<{ tender: Tender; isNew: boolean }>>({
      data: { tender: mapTender(savedRow!), isNew: true },
      message: `Tender "${rawTender.title}" fetched. AI L1: ${l1Result.status} (${l1Result.confidence} confidence). Review in the Tenders screen.`,
    });

  } catch (err) {
    console.error('[API /tenders/fetch-single] Error:', err);
    return NextResponse.json<ApiResponse>({
      error: (err as Error).message || 'Failed to fetch tender',
    }, { status: 500 });
  }
}
