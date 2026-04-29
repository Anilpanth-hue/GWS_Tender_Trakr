import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

/**
 * Download a file from a URL to disk.
 * Returns the local file path, or null if download failed.
 */
export async function downloadFile(
  url: string,
  tenderId: number,
  label: string
): Promise<string | null> {
  try {
    const dir = path.resolve(process.cwd(), 'public', 'documents', String(tenderId));
    fs.mkdirSync(dir, { recursive: true });

    // Sanitise label into a safe filename
    const safeName = label.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 60);
    const ext = url.includes('.pdf') ? '.pdf' : url.includes('.zip') ? '.zip' : '.bin';
    const dest = path.join(dir, `${safeName}${ext}`);

    await new Promise<void>((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      const req = client.get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow one redirect
          file.close();
          downloadFile(res.headers.location, tenderId, label).then(() => resolve()).catch(reject);
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      });
      req.on('error', (err) => { file.close(); fs.unlink(dest, () => {}); reject(err); });
      req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')); });
    });

    const stat = fs.statSync(dest);
    if (stat.size < 100) {
      fs.unlinkSync(dest);
      return null; // Empty or near-empty file — useless
    }

    return dest;
  } catch (err) {
    console.warn(`[PDF] Download failed for tender #${tenderId} "${label}":`, (err as Error).message);
    return null;
  }
}

/**
 * Read a downloaded file and return its content as base64 (for PDF) or text (for JSON/other).
 * Returns { type, content } where type is 'pdf_base64' | 'text'.
 */
export function readFileForAI(filePath: string): { type: 'pdf_base64' | 'text'; content: string } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length < 50) return null;

    const header = buf.slice(0, 4).toString('ascii');

    if (header === '%PDF') {
      return { type: 'pdf_base64', content: buf.toString('base64') };
    }

    // Try to parse as T247 JSON summary
    try {
      const text = buf.toString('utf8');
      const json = JSON.parse(text) as { Data?: Record<string, unknown>[] };
      const item = json.Data?.[0] ?? (json as Record<string, unknown>);
      return { type: 'text', content: formatT247Json(item) };
    } catch {
      // Raw text fallback
      return { type: 'text', content: buf.toString('utf8').substring(0, 8000) };
    }
  } catch (err) {
    console.warn('[PDF] readFileForAI error:', (err as Error).message);
    return null;
  }
}

const T247_LABELS: Record<string, string> = {
  Department_Name: 'Organisation',
  Products: 'Scope / Description',
  Estimated_Cost: 'Estimated Cost',
  EMD_Value: 'EMD',
  Document_Fees: 'Document Fees',
  Completion_Period: 'Contract / Completion Period',
  Location: 'Site Location',
  State: 'State',
  Delivery_district: 'District',
  Bid_End_Date_Time: 'Bid Submission Deadline',
  Eligibility_Criteria: 'Eligibility / PQC',
  Hard_Copy_Submission: 'Hard Copy Required',
  Payment_terms: 'Payment Terms',
  Levy_of_Penalty: 'Penalty Clause',
};

function formatT247Json(item: Record<string, unknown>): string {
  return Object.entries(T247_LABELS)
    .filter(([k]) => item[k])
    .map(([k, label]) => {
      const val = String(item[k])
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 800);
      return val ? `${label}:\n${val}` : null;
    })
    .filter(Boolean)
    .join('\n\n');
}