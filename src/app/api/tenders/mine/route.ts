import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import type { ApiResponse, Tender } from '@/types';

function parseJsonColumn<T>(val: unknown): T | null {
  if (!val) return null;
  if (typeof val === 'object') return val as T;
  try { return JSON.parse(val as string) as T; } catch { return null; }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json<ApiResponse>({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();

    const rows = await query<Record<string, unknown>>(
      `SELECT id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
              due_date, published_date, location, category, detail_url, source_session,
              scrape_run_id, tender_overview, l1_status, l1_qualification_reasons,
              l1_exclusion_reason, l1_scope_of_work, l1_analysis_source,
              l1_decision, l1_decision_reason, l1_decision_by, l1_decision_at,
              l2_analyzed, l2_analysis,
              owner_email, owner_assigned_at, assigned_by_email, assigned_by_name,
              bid_status, bid_status_updated_at, bid_status_updated_by,
              rejected_reason, bid_evaluated_remark, bid_dropped_reason,
              bid_participated_remark, award_remark,
              l1_bidder, l1_price, l2_bidder, l2_price, l3_bidder, l3_price,
              created_at, updated_at
       FROM tenders
       WHERE LOWER(owner_email) = ?
       ORDER BY owner_assigned_at DESC`,
      [email]
    );

    const tenders: Tender[] = rows.map(t => ({
      id: t.id as number,
      title: t.title as string,
      tenderNo: t.tender_no as string,
      issuedBy: t.issued_by as string,
      estimatedValue: t.estimated_value as number | null,
      estimatedValueRaw: t.estimated_value_raw as string,
      dueDate: t.due_date as string | null,
      publishedDate: t.published_date as string | null,
      location: t.location as string,
      category: t.category as string,
      detailUrl: t.detail_url as string,
      sourceSession: t.source_session as Tender['sourceSession'],
      fetchRunId: t.scrape_run_id as number,
      tenderOverview: parseJsonColumn(t.tender_overview),
      l1Status: t.l1_status as Tender['l1Status'],
      l1QualificationReasons: parseJsonColumn(t.l1_qualification_reasons) ?? [],
      l1ExclusionReason: t.l1_exclusion_reason as string | null,
      l1ScopeOfWork: (t.l1_scope_of_work as string) || null,
      l1AnalysisSource: (t.l1_analysis_source as 'documents' | 'metadata_only') || 'metadata_only',
      l1Decision: t.l1_decision as Tender['l1Decision'],
      l1DecisionReason: t.l1_decision_reason as string | null,
      l1DecisionBy: t.l1_decision_by as string | null,
      l1DecisionAt: t.l1_decision_at as string | null,
      l2Analyzed: Boolean(t.l2_analyzed),
      l2Analysis: parseJsonColumn(t.l2_analysis),
      ownerEmail: (t.owner_email as string) || null,
      ownerAssignedAt: (t.owner_assigned_at as string) || null,
      assignedByEmail: (t.assigned_by_email as string) || null,
      assignedByName: (t.assigned_by_name as string) || null,
      bidStatus: (t.bid_status as Tender['bidStatus']) || null,
      bidStatusUpdatedAt: (t.bid_status_updated_at as string) || null,
      bidStatusUpdatedBy: (t.bid_status_updated_by as string) || null,
      rejectedReason: (t.rejected_reason as string) || null,
      bidEvaluatedRemark: (t.bid_evaluated_remark as string) || null,
      bidDroppedReason: (t.bid_dropped_reason as string) || null,
      bidParticipatedRemark: (t.bid_participated_remark as string) || null,
      awardRemark: (t.award_remark as string) || null,
      l1Bidder: (t.l1_bidder as string) || null,
      l1Price: (t.l1_price as string) || null,
      l2Bidder: (t.l2_bidder as string) || null,
      l2Price: (t.l2_price as string) || null,
      l3Bidder: (t.l3_bidder as string) || null,
      l3Price: (t.l3_price as string) || null,
      createdAt: t.created_at as string,
      updatedAt: t.updated_at as string,
    }));

    return NextResponse.json<ApiResponse<Tender[]>>({ data: tenders });
  } catch (err) {
    console.error('[GET /api/tenders/mine]', err);
    return NextResponse.json<ApiResponse>(
      { error: (err as Error).message || 'Failed to fetch your tenders' },
      { status: 500 }
    );
  }
}