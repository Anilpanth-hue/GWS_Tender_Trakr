import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import type { ApiResponse, Tender } from '@/types';

/** mysql2 returns JSON columns as already-parsed objects — no JSON.parse needed */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonColumn(val: unknown): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return val;           // already parsed by mysql2
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tender = await queryOne<Record<string, unknown>>(
      'SELECT * FROM tenders WHERE id = ?',
      [id]
    );

    if (!tender) {
      return NextResponse.json<ApiResponse>({ error: 'Tender not found' }, { status: 404 });
    }

    const mapped: Tender = {
      id: tender.id as number,
      title: tender.title as string,
      tenderNo: tender.tender_no as string,
      issuedBy: tender.issued_by as string,
      estimatedValue: tender.estimated_value as number | null,
      estimatedValueRaw: tender.estimated_value_raw as string,
      dueDate: tender.due_date as string | null,
      publishedDate: tender.published_date as string | null,
      location: tender.location as string,
      category: tender.category as string,
      detailUrl: tender.detail_url as string,
      tenderOverview: parseJsonColumn(tender.tender_overview),
      sourceSession: tender.source_session as Tender['sourceSession'],
      scrapeRunId: tender.scrape_run_id as number,
      l1Status: tender.l1_status as Tender['l1Status'],
      l1QualificationReasons: parseJsonColumn(tender.l1_qualification_reasons) ?? [],
      l1ExclusionReason: tender.l1_exclusion_reason as string | null,
      l1Decision: tender.l1_decision as Tender['l1Decision'],
      l1DecisionReason: tender.l1_decision_reason as string | null,
      l1DecisionBy: tender.l1_decision_by as string | null,
      l1DecisionAt: tender.l1_decision_at as string | null,
      l2Analyzed: Boolean(tender.l2_analyzed),
      l2Analysis: parseJsonColumn(tender.l2_analysis),
      createdAt: tender.created_at as string,
      updatedAt: tender.updated_at as string,
    };

    return NextResponse.json<ApiResponse<Tender>>({ data: mapped });
  } catch (err) {
    console.error('[API /tenders/[id]] Error:', err);
    return NextResponse.json<ApiResponse>({ error: 'Failed to fetch tender' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      l1Decision?: string;
      l1DecisionReason?: string;
      l1DecisionBy?: string;
    };

    if (!body.l1Decision) {
      return NextResponse.json<ApiResponse>({ error: 'l1Decision is required' }, { status: 400 });
    }

    if (!['accepted', 'rejected', 'pending'].includes(body.l1Decision)) {
      return NextResponse.json<ApiResponse>({ error: 'Invalid decision value' }, { status: 400 });
    }

    await execute(
      `UPDATE tenders
       SET l1_decision = ?, l1_decision_reason = ?, l1_decision_by = ?, l1_decision_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [body.l1Decision, body.l1DecisionReason || null, body.l1DecisionBy || null, id]
    );

    return NextResponse.json<ApiResponse>({ message: 'Decision updated successfully' });
  } catch (err) {
    console.error('[API /tenders/[id]] PATCH Error:', err);
    return NextResponse.json<ApiResponse>({ error: 'Failed to update decision' }, { status: 500 });
  }
}
