import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryOne, query, execute } from '@/lib/db';
import { analyzeTenderL2 } from '@/lib/ai/analyze-tender';
import type { ApiResponse, TenderL2Analysis } from '@/types';

/**
 * Recursively find all PDFs inside a directory AND extract any nested ZIPs found along the way.
 * T247 ZIPs often contain a second ZIP which holds the actual tender PDF.
 */
async function findPdfsInDirRecursive(dir: string, depth = 0): Promise<string[]> {
  const results: string[] = [];
  if (!fs.existsSync(dir) || depth > 4) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findPdfsInDirRecursive(full, depth + 1));
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      results.push(full);
    } else if (entry.name.toLowerCase().endsWith('.zip')) {
      // Nested ZIP — extract it and recurse
      const nestedExtractDir = full.slice(0, -4) + '_extracted';
      try {
        const extractZip = (await import('extract-zip')).default;
        await extractZip(full, { dir: nestedExtractDir });
        console.log(`[Analysis] Extracted nested ZIP: ${entry.name}`);
        results.push(...await findPdfsInDirRecursive(nestedExtractDir, depth + 1));
      } catch (e) {
        console.warn(`[Analysis] Failed to extract nested ZIP ${entry.name}:`, (e as Error).message);
      }
    }
  }
  return results;
}

/** Returns true if the text is a T247 AI meta-response rather than actual criteria */
function isGarbageText(text: string): boolean {
  if (!text || text.length < 10) return true;
  const isMetaResponse = /your request|please specify|once you specify|i am unable to|cannot extract/i.test(text);
  const hasRealData = /turnover|experience|crore|lakh|certificate|registration|iso|pf|esi|gst|rs.|₹/i.test(text);
  return isMetaResponse && !hasRealData;
}

/**
 * Resolve a stored file_path to an absolute disk path, handling two forms:
 *  (a) /documents/100/file.zip  — correct public-relative path
 *  (b) /opt/apps/.../public/documents/100/file.zip  — absolute path (Windows path bug)
 */
function resolveFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  // If it already looks like a public-relative path, just join with cwd/public
  if (normalized.startsWith('/documents/') || normalized.startsWith('documents/')) {
    return path.resolve(process.cwd(), 'public', normalized.replace(/^\//, ''));
  }
  // Absolute path — extract the part after /public/
  const pubIdx = normalized.indexOf('/public/');
  if (pubIdx !== -1) {
    return path.resolve(process.cwd(), 'public', normalized.slice(pubIdx + '/public/'.length));
  }
  // Fallback: try to join directly (may not exist)
  return path.resolve(process.cwd(), 'public', normalized.replace(/^\//, ''));
}

/** Returns true only if the file on disk starts with %PDF magic bytes */
function isRealPdf(filePath: string): boolean {
  try {
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.toString('ascii') === '%PDF';
  } catch { return false; }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json<ApiResponse>({ error: 'Unauthorized' }, { status: 401 });
  }

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

    const docRows = await query<{ file_path: string | null; doc_type: string }>(
      `SELECT file_path, doc_type
       FROM tender_documents
       WHERE tender_id = ? AND file_path IS NOT NULL
       ORDER BY FIELD(doc_type,'full_docs_zip','individual_doc','summary_pdf'), created_at ASC`,
      [id]
    );

    const realPdfPaths: string[] = []; // All real PDFs collected across all sources
    let t247JsonPath: string | null = null; // T247 JSON fallback (lowest priority)

    // Pass 1: individual PDF files directly stored on disk
    for (const row of docRows) {
      if (!row.file_path) continue;
      const abs = resolveFilePath(row.file_path);
      if (!abs.endsWith('.pdf') || !fs.existsSync(abs)) continue;
      if (isRealPdf(abs)) {
        realPdfPaths.push(abs);
        console.log(`[Analysis] Found real PDF: ${path.basename(abs)}`);
      } else {
        t247JsonPath = t247JsonPath ?? abs;
        console.log(`[Analysis] Skipping T247 JSON (fake .pdf): ${path.basename(abs)}`);
      }
    }

    // Pass 2: extract ALL PDFs from every ZIP (including nested folders)
    for (const row of docRows) {
      if (!row.file_path) continue;
      const abs = resolveFilePath(row.file_path);
      if (!abs.endsWith('.zip') || !fs.existsSync(abs)) continue;

      const extractDir = abs.slice(0, -4) + '_extracted';
      try {
        const extractZip = (await import('extract-zip')).default;
        await extractZip(abs, { dir: extractDir });
        // Recursively extract nested ZIPs and collect all PDFs
        const pdfs = await findPdfsInDirRecursive(extractDir);
        console.log(`[Analysis] ZIP extracted: found ${pdfs.length} PDF(s) inside ${path.basename(abs)}`);
        for (const p of pdfs) {
          console.log(`  → ${path.relative(extractDir, p)} (${Math.round(fs.statSync(p).size / 1024)}KB)`);
          realPdfPaths.push(p);
        }
      } catch (e) {
        console.warn(`[Analysis] ZIP extraction failed for ${path.basename(abs)}:`, (e as Error).message);
      }
    }

    // Pass 3: T247 JSON fallback if we have no real PDFs at all
    const allDocPaths: string[] = realPdfPaths.length > 0
      ? realPdfPaths
      : (t247JsonPath ? [t247JsonPath] : []);

    if (allDocPaths.length === 0) {
      console.log('[Analysis] No documents on disk — using structured text from tender overview.');
    } else {
      console.log(`[Analysis] Total document paths to analyse: ${allDocPaths.length}`);
    }

    // Build rich fallback text from stored tender_overview
    let overviewText = '';
    try {
      const ov = typeof tender.tender_overview === 'string'
        ? JSON.parse(tender.tender_overview as string)
        : tender.tender_overview as Record<string, string> | null;
      if (ov) {
        const lines: string[] = [];

        // ── PRIORITY: PQC / Eligibility content goes FIRST — Gemini reads top-down ──
        if (ov.eligibilityCriteria && !isGarbageText(ov.eligibilityCriteria))
          lines.push(`\n=== ELIGIBILITY / PRE-QUALIFICATION CRITERIA (PQC) ===\n${ov.eligibilityCriteria}`);
        if (ov.pqcSummary && ov.pqcSummary !== ov.eligibilityCriteria && !isGarbageText(ov.pqcSummary))
          lines.push(`=== PRE-QUALIFICATION SUMMARY ===\n${ov.pqcSummary}`);

        // PQC-relevant AI Summary fields — split out first for prominence
        if (ov.aiSummaryFields && typeof ov.aiSummaryFields === 'object') {
          const pqcRx = /eligib|pre.qualif|turnover|experience|technical|financial|pqc|qualification/i;
          const pqcFields = Object.entries(ov.aiSummaryFields as Record<string, string>)
            .filter(([k, v]) => pqcRx.test(k) && v && String(v).trim().length > 0)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n');
          if (pqcFields) lines.push(`=== T247 PQC FIELDS ===\n${pqcFields}`);

          const otherFields = Object.entries(ov.aiSummaryFields as Record<string, string>)
            .filter(([k, v]) => !pqcRx.test(k) && v && String(v).trim().length > 0)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n');
          if (otherFields) lines.push(`\n=== T247 AI SUMMARY ===\n${otherFields}`);
        }

        // ── Structured overview metadata ──
        if (ov.estimatedCost)            lines.push(`Estimated Cost: ${ov.estimatedCost}`);
        if (ov.emdValue)                 lines.push(`EMD: ${ov.emdValue}`);
        if (ov.documentFees)             lines.push(`Document Fees: ${ov.documentFees}`);
        if (ov.completionPeriod)         lines.push(`Completion Period: ${ov.completionPeriod}`);
        if (ov.siteLocation)             lines.push(`Site Location: ${ov.siteLocation}`);
        if (ov.msmeExemption)            lines.push(`MSME Exemption: ${ov.msmeExemption}`);
        if (ov.startupExemption)         lines.push(`Startup Exemption: ${ov.startupExemption}`);
        if (ov.jvConsortium)             lines.push(`JV / Consortium: ${ov.jvConsortium}`);
        if (ov.reverseAuction)           lines.push(`Reverse Auction: ${ov.reverseAuction}`);
        if (ov.hardCopySubmission)       lines.push(`Hard Copy Submission: ${ov.hardCopySubmission}`);
        if (ov.performanceBankGuarantee) lines.push(`Performance Bank Guarantee: ${ov.performanceBankGuarantee}`);
        if (ov.contactPerson)            lines.push(`Contact Person: ${ov.contactPerson}`);
        if (ov.contactAddress)           lines.push(`Contact Address: ${ov.contactAddress}`);
        if (ov.fullSummaryText)          lines.push(`\n=== SCOPE / AI SUMMARY ===\n${ov.fullSummaryText}`);

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

    console.log('[Analysis] Running Gemini AI analysis...');
    const analysis = await analyzeTenderL2(
      tender.title as string,
      allDocPaths,   // array of ALL document paths
      fallbackText
    );

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
