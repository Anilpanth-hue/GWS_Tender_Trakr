import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { queryOne, query, execute } from '@/lib/db';
import { analyzeTenderL2 } from '@/lib/ai/analyze-tender';
import type { ApiResponse, TenderL2Analysis } from '@/types';

export async function POST(
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

    if (tender.l1_status === 'rejected' && tender.l1_decision !== 'accepted') {
      return NextResponse.json<ApiResponse>(
        { error: 'L2 analysis requires the tender to be qualified or accepted at L1' },
        { status: 400 }
      );
    }

    console.log(`[Analysis] L2 for tender #${id}: ${String(tender.title).substring(0, 80)}`);

    // Find the summary PDF downloaded during scraping (no T247 needed)
    const docRows = await query<{ file_path: string | null; download_url: string | null; doc_type: string }>(
      `SELECT file_path, download_url, doc_type
       FROM tender_documents
       WHERE tender_id = ?
       ORDER BY created_at ASC`,
      [id]
    );

    const summaryPdfRow = docRows.find(d => d.doc_type === 'summary_pdf');
    let pdfPath: string | null = null;

    if (summaryPdfRow?.file_path) {
      // file_path is stored as /documents/{id}/filename.pdf (public-relative)
      // Resolve to absolute path for fs.readFileSync
      pdfPath = path.resolve(process.cwd(), 'public', summaryPdfRow.file_path.replace(/^\//, ''));
      console.log(`[Analysis] Using PDF from disk: ${pdfPath}`);
    } else {
      console.log('[Analysis] No PDF found in tender_documents — will use text fallback. Trigger a scrape first to download documents.');
    }

    // Fallback text if no PDF exists yet
    const fallbackText = [
      `Title: ${tender.title}`,
      `Issued by: ${tender.issued_by}`,
      `Location: ${tender.location}`,
      `Estimated Value: ${tender.estimated_value_raw}`,
      `Due Date: ${tender.due_date}`,
    ].join('\n');

    // Run Gemini AI analysis — no T247, no Puppeteer
    console.log('[Analysis] Running Gemini AI analysis...');
    const analysis = await analyzeTenderL2(
      tender.title as string,
      pdfPath,
      fallbackText
    );

    // Save analysis to DB
    await execute(
      'UPDATE tenders SET l2_analyzed = TRUE, l2_analysis = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(analysis), id]
    );

    console.log(`[Analysis] Done. GWS Score: ${analysis.gwsRelevanceScore}/10, Action: ${analysis.recommendedAction}`);

    return NextResponse.json<ApiResponse<TenderL2Analysis>>({
      data: analysis,
      message: `Analysis complete — GWS Relevance: ${analysis.gwsRelevanceScore}/10`,
    });
  } catch (err) {
    console.error('[API /analysis/[id]] Error:', err);
    return NextResponse.json<ApiResponse>(
      { error: (err as Error).message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
