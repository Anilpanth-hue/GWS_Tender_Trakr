import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, execute } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * POST /api/tenders/[id]/fetch-documents
 * Logs into T247, captures document links from the detail page,
 * downloads each file to disk, and saves the local path.
 * The L2 page then serves files from our own /public/documents/ directory.
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
        { error: 'No detail URL stored for this tender — cannot fetch documents' },
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

    const email    = settings.tender247_email;
    const password = settings.tender247_password;

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { error: 'T247 credentials not configured in Settings' },
        { status: 400 }
      );
    }

    console.log(`[FetchDocs] Starting for tender #${id} (T247-${tender.tender_no})`);

    const { loginBrowser, fetchTenderDocuments, closeBrowser } = await import('@/lib/scraper/tender247');
    const { downloadFile } = await import('@/lib/pdf/extract');

    const browser = await loginBrowser(email, password);
    let savedCount = 0;

    try {
      const result = await fetchTenderDocuments(browser, tender.id, tender.detail_url);

      if (result.documents.length === 0) {
        console.warn(`[FetchDocs] No documents found for tender #${id}`);
        return NextResponse.json({
          message: 'No documents found on the tender page.',
          diag: result.diag ?? null,
        });
      }

      // Delete old documents so we start fresh
      await execute('DELETE FROM tender_documents WHERE tender_id = ?', [id]);

      for (const doc of result.documents) {
        // Local path = already downloaded by CDP; HTTP URL = legacy T247 URL
        const isLocalPath = doc.url?.startsWith('/documents/');
        const isValidDocUrl = doc.url && (
          isLocalPath ||
          (doc.url.startsWith('http') &&
           /\.(pdf|zip|doc|docx|xls|xlsx)(\?|$)|documents?\.tender247|download|s3\./i.test(doc.url))
        );

        if (!isValidDocUrl) {
          console.warn(`[FetchDocs] Skipping invalid URL for "${doc.label}": ${doc.url?.substring(0, 80)}`);
          continue;
        }

        // Insert document row
        const ins = await execute(
          `INSERT INTO tender_documents (tender_id, file_name, download_url, file_path, doc_type)
           VALUES (?, ?, ?, ?, ?)`,
          [id, doc.label, isLocalPath ? '' : doc.url, isLocalPath ? doc.url : null, doc.docType]
        ).catch(err => {
          console.warn(`[FetchDocs] Insert skipped for "${doc.label}":`, err.message);
          return null;
        });

        if (!ins) continue;
        savedCount++;

        if (isLocalPath) {
          // File already on disk — nothing more to do
          console.log(`[FetchDocs] Saved local file "${doc.label}" → ${doc.url}`);
        } else if (doc.docType !== 'full_docs_zip') {
          // Legacy HTTP URL path — try to download via Node (may fail if cookies required)
          const localPath = await downloadFile(doc.url, tender.id, doc.label);
          if (localPath) {
            const publicPath = localPath.replace(process.cwd() + '\\public', '').replace(/\\/g, '/');
            await execute(
              `UPDATE tender_documents SET file_path = ? WHERE id = ?`,
              [publicPath, ins.insertId]
            ).catch(() => {});
            console.log(`[FetchDocs] Downloaded "${doc.label}" → ${publicPath}`);
          }
        }
      }

      console.log(`[FetchDocs] ✓ Saved ${savedCount} document(s) for tender #${id}`);

      return NextResponse.json<ApiResponse>({
        message: `Found and saved ${savedCount} document${savedCount !== 1 ? 's' : ''}.`,
      });

    } finally {
      await closeBrowser();
    }

  } catch (err) {
    console.error('[API /fetch-documents] Error:', err);
    return NextResponse.json<ApiResponse>(
      { error: (err as Error).message || 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
