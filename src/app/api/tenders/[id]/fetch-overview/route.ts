import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, query } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * POST /api/tenders/[id]/fetch-overview
 * Scrapes the Tender247 detail page for a list-scraped tender and saves the
 * overview (including fullSummaryText / EMD / contract period) to the DB.
 * Used to load the description on-demand in the preview panel.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tender = await queryOne<{
      id: number;
      detail_url: string;
      tender_no: string;
      tender_overview: string | null;
      due_date: string | null;
      estimated_value_raw: string | null;
    }>(
      'SELECT id, detail_url, tender_no, tender_overview, due_date, estimated_value_raw FROM tenders WHERE id = ?',
      [id]
    );

    if (!tender) {
      return NextResponse.json<ApiResponse>({ error: 'Tender not found' }, { status: 404 });
    }

    if (!tender.detail_url) {
      return NextResponse.json<ApiResponse>(
        { error: 'No detail URL for this tender' },
        { status: 400 }
      );
    }

    // Get credentials
    const settingRows = await query<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM scrape_settings WHERE setting_key IN (?, ?)',
      ['tender247_email', 'tender247_password']
    );
    const settings: Record<string, string> = {};
    for (const s of settingRows) settings[s.setting_key] = s.setting_value;

    if (!settings.tender247_email || !settings.tender247_password) {
      return NextResponse.json<ApiResponse>(
        { error: 'Tender247 credentials not configured in Settings' },
        { status: 400 }
      );
    }

    const { scrapeOverviewByDetailUrl, closeBrowser } = await import('@/lib/scraper/tender247');

    let result;
    try {
      result = await scrapeOverviewByDetailUrl(
        settings.tender247_email,
        settings.tender247_password,
        tender.detail_url,
        tender.tender_no
      );
    } finally {
      await closeBrowser();
    }

    const { overview, dueDate: newDueDate, estimatedCostRaw: newValueRaw } = result;

    // Detect corrigendum / date extension
    const oldDueDate = tender.due_date?.split('T')[0] ?? null;
    const dateChanged = newDueDate && oldDueDate && newDueDate !== oldDueDate;
    const changes: string[] = [];
    if (dateChanged) changes.push(`Due date: ${oldDueDate} → ${newDueDate}`);

    // Build UPDATE — always refresh overview; update date/value only when they changed
    const updateFields: string[] = ['tender_overview = ?'];
    const updateValues: unknown[] = [JSON.stringify(overview)];
    if (dateChanged && newDueDate) {
      updateFields.push('due_date = ?');
      updateValues.push(newDueDate);
    }
    if (newValueRaw && newValueRaw !== tender.estimated_value_raw) {
      updateFields.push('estimated_value_raw = ?');
      updateValues.push(newValueRaw);
      changes.push(`Value: ${tender.estimated_value_raw} → ${newValueRaw}`);
    }
    updateValues.push(id);

    await execute(
      `UPDATE tenders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const message = changes.length > 0
      ? `Corrigendum detected — ${changes.join('; ')}`
      : 'Overview refreshed. No changes detected.';

    console.log(`[fetch-overview] #${id}: ${message}`);

    return NextResponse.json<ApiResponse<{ overview: typeof overview; changes: string[] }>>({
      data: { overview, changes },
      message,
    });

  } catch (err) {
    console.error('[API /fetch-overview] Error:', err);
    return NextResponse.json<ApiResponse>(
      { error: (err as Error).message || 'Failed to fetch overview' },
      { status: 500 }
    );
  }
}