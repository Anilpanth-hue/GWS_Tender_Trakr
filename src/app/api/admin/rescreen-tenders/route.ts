import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * POST /api/admin/rescreen-tenders
 *
 * Re-runs keyword screening on all tenders that haven't had a human decision yet.
 * Safe to call multiple times — only touches l1_decision = 'pending' tenders.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 });
  }

  const { screenTender, DEFAULT_CONFIG } = await import('@/lib/screening/rules');
  const { query: getConfig } = await import('@/lib/db');

  // Load DB screening config (same as the scraper uses)
  let config = DEFAULT_CONFIG;
  try {
    const rows = await getConfig<{ setting_value: string }>(
      "SELECT setting_value FROM scrape_settings WHERE setting_key = 'screening_config' LIMIT 1"
    );
    if (rows[0]?.setting_value) {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(rows[0].setting_value) };
    }
  } catch { /* use default */ }

  // Fetch all pending tenders (no human decision yet)
  const tenders = await query<{
    id: number;
    title: string;
    tender_no: string;
    issued_by: string;
    estimated_value: number | null;
    estimated_value_raw: string;
    due_date: string | null;
    published_date: string | null;
    location: string;
    category: string;
    detail_url: string;
    source_session: string;
    l1_status: string;
    l1_analysis_source: string;
  }>(
    `SELECT id, title, tender_no, issued_by, estimated_value, estimated_value_raw,
            due_date, published_date, location, category, detail_url, source_session,
            l1_status, l1_analysis_source
     FROM tenders
     WHERE l1_decision = 'pending'`
  );

  let requalified = 0, rerejected = 0, unchanged = 0;

  for (const t of tenders) {
    // Only re-screen tenders that were keyword-screened (not AI-analysed from documents)
    // AI-analysed tenders already have a proper content-based result — leave them alone.
    if (t.l1_analysis_source === 'documents') {
      unchanged++;
      continue;
    }

    const raw = {
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
      sourceSession: t.source_session as 'manual',
    };

    const result = screenTender(raw, config);

    if (result.status === t.l1_status) {
      unchanged++;
      continue;
    }

    await execute(
      `UPDATE tenders
       SET l1_status = ?, l1_qualification_reasons = ?, l1_exclusion_reason = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        result.status,
        JSON.stringify(result.status === 'qualified' ? result.qualificationReasons : []),
        result.exclusionReason,
        t.id,
      ]
    );

    if (result.status === 'qualified') requalified++;
    else rerejected++;
  }

  return NextResponse.json<ApiResponse>({
    message: `Re-screening complete. ${requalified} newly qualified, ${rerejected} re-rejected, ${unchanged} unchanged.`,
    data: { requalified, rerejected, unchanged, total: tenders.length },
  });
}
