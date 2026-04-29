import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ApiResponse, PaginatedResponse, Tender } from '@/types';

/** mysql2 returns JSON columns as already-parsed objects — no JSON.parse needed */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonColumn(val: unknown): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const l1Status = searchParams.get('l1Status');
    const l1Decision = searchParams.get('l1Decision');
    const search = searchParams.get('search');
    const session = searchParams.get('session');
    const dueDateFrom = searchParams.get('dueDateFrom');
    const dueDateTo = searchParams.get('dueDateTo');

    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (l1Status) {
      conditions.push('t.l1_status = ?');
      values.push(l1Status);
    }
    if (l1Decision) {
      conditions.push('t.l1_decision = ?');
      values.push(l1Decision);
    }
    if (session) {
      conditions.push('t.source_session = ?');
      values.push(session);
    }
    if (search) {
      conditions.push('(t.title LIKE ? OR t.issued_by LIKE ? OR t.tender_no LIKE ?)');
      const like = `%${search}%`;
      values.push(like, like, like);
    }
    if (dueDateFrom) {
      conditions.push('t.due_date >= ?');
      values.push(dueDateFrom);
    }
    if (dueDateTo) {
      conditions.push('t.due_date <= ?');
      values.push(dueDateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult] = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM tenders t ${where}`,
      values
    );
    const total = countResult?.total || 0;

    const tenders = await query<Record<string, unknown>>(
      `SELECT t.*, sr.session as run_session, sr.started_at as run_started_at
       FROM tenders t
       LEFT JOIN scrape_runs sr ON t.scrape_run_id = sr.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    );

    const mapped = tenders.map(t => ({
      id: t.id,
      title: t.title,
      tenderNo: t.tender_no,
      issuedBy: t.issued_by,
      estimatedValue: t.estimated_value,
      estimatedValueRaw: t.estimated_value_raw,
      dueDate: t.due_date,
      publishedDate: t.published_date,
      location: t.location,
      category: t.category,
      detailUrl: t.detail_url,
      tenderOverview: parseJsonColumn(t.tender_overview),
      sourceSession: t.source_session,
      scrapeRunId: t.scrape_run_id,
      l1Status: t.l1_status,
      l1QualificationReasons: parseJsonColumn(t.l1_qualification_reasons) ?? [],
      l1ExclusionReason: t.l1_exclusion_reason,
      l1ScopeOfWork: (t.l1_scope_of_work as string) || null,
      l1AnalysisSource: (t.l1_analysis_source as 'documents' | 'metadata_only') || 'metadata_only',
      l1Decision: t.l1_decision,
      l1DecisionReason: t.l1_decision_reason,
      l1DecisionBy: t.l1_decision_by,
      l1DecisionAt: t.l1_decision_at,
      l2Analyzed: Boolean(t.l2_analyzed),
      l2Analysis: parseJsonColumn(t.l2_analysis),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    const response: PaginatedResponse<Tender> = {
      data: mapped as Tender[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Tender>>>({ data: response });
  } catch (err) {
    console.error('[API /tenders] Error:', err);
    return NextResponse.json<ApiResponse>({ error: 'Failed to fetch tenders' }, { status: 500 });
  }
}
