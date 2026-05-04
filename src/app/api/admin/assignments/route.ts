import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import type { ApiResponse, BidStatus } from '@/types';

export interface AssignmentRow {
  id: number;
  title: string;
  tenderNo: string;
  issuedBy: string;
  estimatedValueRaw: string;
  dueDate: string | null;
  l1Decision: string;
  l1DecisionReason: string | null;
  l2Analyzed: boolean;
  ownerEmail: string;
  ownerAssignedAt: string;
  ownerName: string | null;
  // Bid tracking
  bidStatus: BidStatus | null;
  bidStatusUpdatedAt: string | null;
  rejectedReason: string | null;
  bidEvaluatedRemark: string | null;
  bidDroppedReason: string | null;
  bidParticipatedRemark: string | null;
  awardRemark: string | null;
  l1Bidder: string | null;
  l1Price: string | null;
  l2Bidder: string | null;
  l2Price: string | null;
  l3Bidder: string | null;
  l3Price: string | null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json<ApiResponse>({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await query<Record<string, unknown>>(
    `SELECT t.id, t.title, t.tender_no, t.issued_by, t.estimated_value_raw,
            t.due_date, t.l1_decision, t.l1_decision_reason, t.l2_analyzed,
            t.owner_email, t.owner_assigned_at,
            t.bid_status, t.bid_status_updated_at,
            t.rejected_reason, t.bid_evaluated_remark, t.bid_dropped_reason,
            t.bid_participated_remark, t.award_remark,
            t.l1_bidder, t.l1_price, t.l2_bidder, t.l2_price, t.l3_bidder, t.l3_price,
            u.name AS owner_name
     FROM tenders t
     LEFT JOIN users u ON LOWER(u.email) = LOWER(t.owner_email)
     WHERE LOWER(t.assigned_by_email) = ?
     ORDER BY t.owner_assigned_at DESC`,
    [session.user.email.toLowerCase()]
  );

  const data: AssignmentRow[] = rows.map(r => ({
    id: r.id as number,
    title: r.title as string,
    tenderNo: r.tender_no as string,
    issuedBy: r.issued_by as string,
    estimatedValueRaw: (r.estimated_value_raw as string) || '—',
    dueDate: (r.due_date as string) || null,
    l1Decision: (r.l1_decision as string) || 'pending',
    l1DecisionReason: (r.l1_decision_reason as string) || null,
    l2Analyzed: Boolean(r.l2_analyzed),
    ownerEmail: r.owner_email as string,
    ownerAssignedAt: r.owner_assigned_at as string,
    ownerName: (r.owner_name as string) || null,
    bidStatus: (r.bid_status as BidStatus) || null,
    bidStatusUpdatedAt: (r.bid_status_updated_at as string) || null,
    rejectedReason: (r.rejected_reason as string) || null,
    bidEvaluatedRemark: (r.bid_evaluated_remark as string) || null,
    bidDroppedReason: (r.bid_dropped_reason as string) || null,
    bidParticipatedRemark: (r.bid_participated_remark as string) || null,
    awardRemark: (r.award_remark as string) || null,
    l1Bidder: (r.l1_bidder as string) || null,
    l1Price: (r.l1_price as string) || null,
    l2Bidder: (r.l2_bidder as string) || null,
    l2Price: (r.l2_price as string) || null,
    l3Bidder: (r.l3_bidder as string) || null,
    l3Price: (r.l3_price as string) || null,
  }));

  return NextResponse.json<ApiResponse<AssignmentRow[]>>({ data });
}