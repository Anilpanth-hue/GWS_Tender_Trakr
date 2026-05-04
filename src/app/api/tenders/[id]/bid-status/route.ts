import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import type { ApiResponse, BidStatus } from '@/types';

const VALID_TRANSITIONS: Record<string, BidStatus[]> = {
  assigned:         ['bid_evaluated', 'rejected'],
  bid_evaluated:    ['bid_participated', 'bid_dropped'],
  bid_participated: ['tender_awarded', 'not_awarded'],
};

const REMARK_LABEL: Record<string, string> = {
  rejected:        'Rejection reason',
  bid_evaluated:   'Remark',
  bid_dropped:     'Drop reason',
  bid_participated:'Remark',
  tender_awarded:  'Remark',
  not_awarded:     'Remark',
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json<ApiResponse>({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as {
    status?: string;
    remark?: string;
    // L1/L2/L3 bidder info (only when filling award details)
    l1Bidder?: string; l1Price?: string;
    l2Bidder?: string; l2Price?: string;
    l3Bidder?: string; l3Price?: string;
  };

  const tender = await queryOne<Record<string, unknown>>(
    'SELECT id, owner_email, bid_status FROM tenders WHERE id = ?', [id]
  );
  if (!tender) return NextResponse.json<ApiResponse>({ error: 'Tender not found' }, { status: 404 });

  const isAdmin = session.user.role === 'admin';
  const isOwner = (tender.owner_email as string)?.toLowerCase() === session.user.email.toLowerCase();

  // Special case: admin filling L1/L2/L3 bidder details on an awarded tender
  if (body.status === 'fill_bidders') {
    if (!isAdmin) return NextResponse.json<ApiResponse>({ error: 'Only admins can fill bidder details' }, { status: 403 });
    if (tender.bid_status !== 'tender_awarded') {
      return NextResponse.json<ApiResponse>({ error: 'Bidder details can only be filled after Tender Awarded status' }, { status: 400 });
    }
    await execute(
      `UPDATE tenders SET l1_bidder=?, l1_price=?, l2_bidder=?, l2_price=?, l3_bidder=?, l3_price=?, updated_at=NOW() WHERE id=?`,
      [body.l1Bidder||null, body.l1Price||null, body.l2Bidder||null, body.l2Price||null, body.l3Bidder||null, body.l3Price||null, id]
    );
    return NextResponse.json<ApiResponse>({ message: 'Bidder details saved.' });
  }

  // Only owner or admin can update bid status
  if (!isOwner && !isAdmin) {
    return NextResponse.json<ApiResponse>({ error: 'Only the assigned person or an admin can update bid status' }, { status: 403 });
  }

  const newStatus = body.status as BidStatus;
  const currentStatus = (tender.bid_status as string) || 'assigned';
  const allowed = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    return NextResponse.json<ApiResponse>({
      error: `Cannot move from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ')}`,
    }, { status: 400 });
  }

  // Reason is mandatory only for terminal (rejection-type) transitions
  const terminalStatuses: BidStatus[] = ['rejected', 'bid_dropped', 'not_awarded'];
  if (terminalStatuses.includes(newStatus) && !body.remark?.trim()) {
    return NextResponse.json<ApiResponse>({
      error: `${REMARK_LABEL[newStatus] || 'Reason'} is required.`,
    }, { status: 400 });
  }

  // Build update SQL based on the new status
  const remarkCol: Record<BidStatus, string> = {
    assigned:         '',
    rejected:         'rejected_reason',
    bid_evaluated:    'bid_evaluated_remark',
    bid_dropped:      'bid_dropped_reason',
    bid_participated: 'bid_participated_remark',
    tender_awarded:   'award_remark',
    not_awarded:      'award_remark',
  };

  const col = remarkCol[newStatus];
  await execute(
    `UPDATE tenders SET bid_status=?, ${col}=?, bid_status_updated_at=NOW(), bid_status_updated_by=?, updated_at=NOW() WHERE id=?`,
    [newStatus, body.remark?.trim() || null, session.user.email, id]
  );

  return NextResponse.json<ApiResponse>({ message: `Status updated to "${newStatus}".` });
}