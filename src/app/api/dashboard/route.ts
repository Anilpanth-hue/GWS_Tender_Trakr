import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ApiResponse, ScrapeRun } from '@/types';

export interface DashboardStats {
  totalTenders: number;
  qualifiedTenders: number;
  rejectedTenders: number;
  pendingDecision: number;
  acceptedL1: number;
  rejectedL1: number;
  l2Analyzed: number;
  todayFound: number;
  recentRuns: ScrapeRun[];
}

export async function GET() {
  try {
    // Single query for all tender counts
    const [counts] = await query<{
      total: number;
      qualified: number;
      rejected: number;
      pending_decision: number;
      accepted_l1: number;
      rejected_l1: number;
      l2_analyzed: number;
    }>(`
      SELECT
        COUNT(*)                                                                         AS total,
        SUM(l1_status  = 'qualified')                                                   AS qualified,
        SUM(l1_status  = 'rejected')                                                    AS rejected,
        SUM(l1_status  = 'qualified' AND (l1_decision = 'pending' OR l1_decision IS NULL)) AS pending_decision,
        SUM(l1_decision = 'accepted')                                                   AS accepted_l1,
        SUM(l1_decision = 'rejected')                                                   AS rejected_l1,
        SUM(l2_analyzed = 1)                                                            AS l2_analyzed
      FROM tenders
    `);

    // Recent scrape runs (limit 6 for dashboard widget + 10 for chart)
    const runs = await query<Record<string, unknown>>(
      'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 10'
    );

    const recentRuns: ScrapeRun[] = runs.map(r => ({
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

    const stats: DashboardStats = {
      totalTenders:     Number(counts?.total            || 0),
      qualifiedTenders: Number(counts?.qualified        || 0),
      rejectedTenders:  Number(counts?.rejected         || 0),
      pendingDecision:  Number(counts?.pending_decision || 0),
      acceptedL1:       Number(counts?.accepted_l1      || 0),
      rejectedL1:       Number(counts?.rejected_l1      || 0),
      l2Analyzed:       Number(counts?.l2_analyzed      || 0),
      todayFound:       recentRuns[0]?.totalFound        || 0,
      recentRuns,
    };

    return NextResponse.json<ApiResponse<DashboardStats>>({ data: stats });
  } catch (err) {
    console.error('[API /dashboard] Error:', err);
    return NextResponse.json<ApiResponse>({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
