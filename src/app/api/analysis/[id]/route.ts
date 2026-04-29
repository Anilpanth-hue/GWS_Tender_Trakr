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

    // Find any downloaded PDF document (individual_doc or summary_pdf)
    const docRows = await query<{ file_path: string | null; doc_type: string }>(
      `SELECT file_path, doc_type
       FROM tender_documents
       WHERE tender_id = ? AND file_path IS NOT NULL
       ORDER BY FIELD(doc_type,'summary_pdf','individual_doc','full_docs_zip'), created_at ASC`,
      [id]
    );

    let pdfPath: string | null = null;
    for (const row of docRows) {
      if (!row.file_path) continue;
      const abs = path.resolve(process.cwd(), 'public', row.file_path.replace(/^\//, ''));
      if (abs.endsWith('.pdf') && require('fs').existsSync(abs)) {
        pdfPath = abs;
        console.log(`[Analysis] Using PDF from disk: ${pdfPath}`);
        break;
      }
    }
    if (!pdfPath) console.log('[Analysis] No PDF on disk — using structured text from tender overview.');

    // Build rich fallback text from stored tender_overview (EMD, eligibility, scope, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let overviewText = '';
    try {
      const ov = typeof tender.tender_overview === 'string'
        ? JSON.parse(tender.tender_overview as string)
        : tender.tender_overview as Record<string, string> | null;
      if (ov) {
        const lines: string[] = [];
        if (ov.estimatedCost)      lines.push(`Estimated Cost: ${ov.estimatedCost}`);
        if (ov.emdValue)           lines.push(`EMD: ${ov.emdValue}`);
        if (ov.documentFees)       lines.push(`Document Fees: ${ov.documentFees}`);
        if (ov.completionPeriod)   lines.push(`Completion Period: ${ov.completionPeriod}`);
        if (ov.siteLocation)       lines.push(`Site Location: ${ov.siteLocation}`);
        if (ov.msmeExemption)      lines.push(`MSME Exemption: ${ov.msmeExemption}`);
        if (ov.startupExemption)   lines.push(`Startup Exemption: ${ov.startupExemption}`);
        if (ov.jvConsortium)       lines.push(`JV / Consortium: ${ov.jvConsortium}`);
        if (ov.reverseAuction)     lines.push(`Reverse Auction: ${ov.reverseAuction}`);
        if (ov.hardCopySubmission) lines.push(`Hard Copy Submission: ${ov.hardCopySubmission}`);
        if (ov.performanceBankGuarantee) lines.push(`Performance Bank Guarantee: ${ov.performanceBankGuarantee}`);
        if (ov.contactPerson)      lines.push(`Contact Person: ${ov.contactPerson}`);
        if (ov.contactAddress)     lines.push(`Contact Address: ${ov.contactAddress}`);
        if (ov.eligibilityCriteria) lines.push(`\nEligibility / PQC Criteria:\n${ov.eligibilityCriteria}`);
        if (ov.pqcSummary && ov.pqcSummary !== ov.eligibilityCriteria) lines.push(`Pre-Qualification Summary:\n${ov.pqcSummary}`);
        if (ov.fullSummaryText)    lines.push(`\nScope / AI Summary:\n${ov.fullSummaryText}`);
        overviewText = lines.join('\n');
      }
    } catch { /* ignore parse errors */ }

    const fallbackText = [
      `Title: ${tender.title}`,
      `Issued by: ${tender.issued_by}`,
      `Location: ${tender.location}`,
      `Estimated Value: ${tender.estimated_value_raw}`,
      `Due Date: ${tender.due_date}`,
      overviewText,
    ].filter(Boolean).join('\n');

    // Run Gemini AI analysis
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
