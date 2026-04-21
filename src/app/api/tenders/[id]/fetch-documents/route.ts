import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, execute } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * POST /api/tenders/[id]/fetch-documents
 * Manually trigger document download for a specific tender.
 * Uses loginBrowser() from the scraper — same login flow as a full scrape.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tender = await queryOne<{ id: number; detail_url: string; tender_no: string }>(
      'SELECT id, detail_url, tender_no FROM tenders WHERE id = ?',
      [id]
    );

    if (!tender) {
      return NextResponse.json<ApiResponse>({ error: 'Tender not found' }, { status: 404 });
    }

    if (!tender.detail_url) {
      return NextResponse.json<ApiResponse>(
        { error: 'No detail URL for this tender — cannot fetch documents' },
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

    const email = settings.tender247_email;
    const password = settings.tender247_password;

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { error: 'T247 credentials not configured in Settings' },
        { status: 400 }
      );
    }

    // Run in background — return immediately, let the download proceed async
    (async () => {
      try {
        console.log(`[FetchDocs] Starting for tender #${id} (T247-${tender.tender_no}) URL: ${tender.detail_url}`);

        const { loginBrowser, fetchTenderDocuments, closeBrowser } = await import('@/lib/scraper/tender247');

        // Login using the same function as the full scraper
        const browser = await loginBrowser(email, password);
        console.log(`[FetchDocs] Logged in. Fetching documents…`);

        try {
          const docs = await fetchTenderDocuments(browser, tender.id, tender.detail_url);

          if (docs.pdfFileName && docs.pdfPublicPath) {
            await execute(
              `INSERT INTO tender_documents (tender_id, file_name, file_path, doc_type, file_size)
               VALUES (?, ?, ?, 'summary_pdf', ?)
               ON DUPLICATE KEY UPDATE file_path = VALUES(file_path), file_size = VALUES(file_size)`,
              [id, docs.pdfFileName, docs.pdfPublicPath, docs.pdfFileSize]
            );
            console.log(`[FetchDocs] ✓ PDF saved for tender #${id}: ${docs.pdfFileName}`);
          } else {
            console.warn(`[FetchDocs] No PDF for tender #${id}`);
          }

          if (docs.fullDocsUrl) {
            await execute(
              `INSERT INTO tender_documents (tender_id, file_name, download_url, doc_type)
               VALUES (?, 'All Tender Documents', ?, 'full_docs_zip')
               ON DUPLICATE KEY UPDATE download_url = VALUES(download_url)`,
              [id, docs.fullDocsUrl]
            );
            console.log(`[FetchDocs] ✓ Full-docs URL saved for tender #${id}`);
          }
        } finally {
          await closeBrowser();
        }
      } catch (err) {
        console.error(`[FetchDocs] Failed for tender #${id}:`, (err as Error).message);
      }
    })();

    return NextResponse.json<ApiResponse>({
      message: 'Document fetch started. Refresh the page in ~45 seconds.',
    });
  } catch (err) {
    console.error('[API /fetch-documents] Error:', err);
    return NextResponse.json<ApiResponse>(
      { error: (err as Error).message || 'Failed to start document fetch' },
      { status: 500 }
    );
  }
}
