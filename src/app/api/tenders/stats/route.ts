import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET() {
  try {
    const statusRows = await query<{ l1_status: string; cnt: number }>(
      'SELECT l1_status, COUNT(*) as cnt FROM tenders GROUP BY l1_status'
    );
    const decisionRows = await query<{ l1_decision: string; cnt: number }>(
      `SELECT l1_decision, COUNT(*) as cnt FROM tenders WHERE l1_status = 'qualified' GROUP BY l1_decision`
    );

    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.l1_status] = Number(r.cnt);

    const byDecision: Record<string, number> = {};
    for (const r of decisionRows) byDecision[r.l1_decision] = Number(r.cnt);

    return NextResponse.json<ApiResponse<{
      qualified: number; autoRejected: number;
      pendingReview: number; accepted: number; manualRejected: number;
    }>>({
      data: {
        qualified:      byStatus.qualified  || 0,
        autoRejected:   byStatus.rejected   || 0,
        pendingReview:  byDecision.pending  || 0,
        accepted:       byDecision.accepted || 0,
        manualRejected: byDecision.rejected || 0,
      },
    });
  } catch (err) {
    console.error('[API /tenders/stats] Error:', err);
    return NextResponse.json<ApiResponse>({ error: 'Failed' }, { status: 500 });
  }
}
