import type { ScreeningResult } from '@/lib/screening/rules';

export interface L1AIResult {
  status: 'qualified' | 'rejected';
  scopeOfWork: string;
  qualificationReasons: string[];
  rejectionReason: string | null;
  emdAmount: string;
  contractPeriod: string;
  eligibilitySummary: string;
  confidence: 'high' | 'medium' | 'low';
  analysisSource: 'documents' | 'metadata_only';
}

const GWS_CONTEXT = `
GlassWing Solutions (GWS) is a Mumbai-based multimodal logistics company.
Capabilities: Rail/Road/Sea/Air logistics, freight forwarding, port & terminal management,
container handling, warehousing, CFS, bulk cargo (fly ash, coal, steel coils, fertilisers,
limestone, bitumen), project/ODC movements, rake management, MMLP operations.
Minimum deal size: ₹50 Lakh. Preferred: ₹1 Cr+. Priority: ₹10 Cr+.
GWS does NOT bid on: civil/construction, IT/software, stationery, medical, education,
solid waste management, tank trucks for oil companies, pure supply/fabrication EPC.
`.trim();

const L1_PROMPT_DOC = `You are a senior logistics BD analyst at GlassWing Solutions (GWS), Mumbai.
Read the attached tender document and perform a Level-1 screening.

${GWS_CONTEXT}

Return ONLY valid JSON — no markdown, no explanation:
{
  "status": "qualified" | "rejected",
  "scopeOfWork": "What exactly must be done — 2-3 crisp sentences from the document",
  "qualificationReasons": ["Reason 1 if qualified", "Reason 2 if applicable"],
  "rejectionReason": "Single sentence if rejected, else null",
  "emdAmount": "Exact EMD from document or 'Not mentioned'",
  "contractPeriod": "Duration from document or 'Not mentioned'",
  "eligibilitySummary": "Key eligibility/PQC in 1-2 sentences or 'Not mentioned'",
  "confidence": "high" | "medium" | "low"
}

Rules:
- "qualified" only if the work maps to GWS logistics capabilities
- "rejected" if it's civil, IT, medical, solid waste, stationery, supply-only, or completely unrelated to logistics
- Extract exact figures from the document. Never guess.
- scopeOfWork must describe the actual work, not just the tender title.`;

const L1_PROMPT_TEXT = `You are a senior logistics BD analyst at GlassWing Solutions (GWS), Mumbai.
Read the tender information below and perform a Level-1 screening.

${GWS_CONTEXT}

=== TENDER INFORMATION ===
{CONTENT}

Return ONLY valid JSON — no markdown, no explanation:
{
  "status": "qualified" | "rejected",
  "scopeOfWork": "What exactly must be done — 2-3 crisp sentences",
  "qualificationReasons": ["Reason 1 if qualified", "Reason 2 if applicable"],
  "rejectionReason": "Single sentence if rejected, else null",
  "emdAmount": "Exact EMD or 'Not mentioned'",
  "contractPeriod": "Duration or 'Not mentioned'",
  "eligibilitySummary": "Key eligibility/PQC in 1-2 sentences or 'Not mentioned'",
  "confidence": "high" | "medium" | "low"
}`;

let _ai: Awaited<ReturnType<typeof import('genkit')['genkit']>> | null = null;
async function getAI() {
  if (_ai) return _ai;
  const { genkit } = await import('genkit');
  const { googleAI } = await import('@genkit-ai/googleai');
  _ai = genkit({ plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })] });
  return _ai;
}

const MODEL = 'googleai/gemini-2.5-flash';

/**
 * Run AI L1 screening on a tender using its document content.
 *
 * @param tenderTitle  - tender title
 * @param docContents  - array of { type, content } from readFileForAI()
 * @param keywordResult - fast pre-filter result (used as fallback if no docs)
 */
export async function analyzeL1(
  tenderTitle: string,
  tenderMeta: string,
  docContents: Array<{ type: 'pdf_base64' | 'text'; content: string }>,
  keywordResult: ScreeningResult
): Promise<L1AIResult> {

  // No documents at all — fall back to keyword result
  if (docContents.length === 0) {
    return keywordFallback(keywordResult);
  }

  const ai = await getAI();

  try {
    // Prefer the first PDF, otherwise use text content
    const pdf = docContents.find(d => d.type === 'pdf_base64');
    const texts = docContents.filter(d => d.type === 'text');

    let rawText: string;

    if (pdf) {
      // Send PDF natively to Gemini (multimodal)
      const { text } = await ai.generate({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { media: { url: `data:application/pdf;base64,${pdf.content}`, contentType: 'application/pdf' } },
            { text: `Tender Title: ${tenderTitle}\n\n${L1_PROMPT_DOC}` },
          ],
        }],
        config: { temperature: 0.1, maxOutputTokens: 2048 },
      });
      rawText = text;
    } else {
      // Text content (T247 JSON or raw text)
      const combined = [
        `Tender: ${tenderTitle}`,
        tenderMeta,
        ...texts.map(t => t.content),
      ].join('\n\n').substring(0, 12000);

      const prompt = L1_PROMPT_TEXT.replace('{CONTENT}', combined);
      const { text } = await ai.generate({
        model: MODEL,
        prompt,
        config: { temperature: 0.1, maxOutputTokens: 2048 },
      });
      rawText = text;
    }

    const parsed = parseL1Response(rawText);
    return { ...parsed, analysisSource: 'documents' };

  } catch (err) {
    console.warn('[L1-AI] Gemini call failed, falling back to keyword result:', (err as Error).message);
    return keywordFallback(keywordResult);
  }
}

function parseL1Response(rawText: string): Omit<L1AIResult, 'analysisSource'> {
  let jsonStr = rawText.trim();
  const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonStr = fenced[1].trim();
  else {
    const s = jsonStr.indexOf('{'), e = jsonStr.lastIndexOf('}');
    if (s !== -1 && e !== -1) jsonStr = jsonStr.slice(s, e + 1);
  }

  const p = JSON.parse(jsonStr) as Partial<L1AIResult>;
  return {
    status:               (p.status === 'qualified' || p.status === 'rejected') ? p.status : 'rejected',
    scopeOfWork:          p.scopeOfWork || '',
    qualificationReasons: Array.isArray(p.qualificationReasons) ? p.qualificationReasons : [],
    rejectionReason:      p.rejectionReason || null,
    emdAmount:            p.emdAmount || 'Not mentioned',
    contractPeriod:       p.contractPeriod || 'Not mentioned',
    eligibilitySummary:   p.eligibilitySummary || 'Not mentioned',
    confidence:           (['high', 'medium', 'low'] as const).includes(p.confidence as 'high') ? p.confidence! : 'medium',
  };
}

function keywordFallback(keywordResult: ScreeningResult): L1AIResult {
  return {
    status:               keywordResult.status,
    scopeOfWork:          '',
    qualificationReasons: keywordResult.qualificationReasons,
    rejectionReason:      keywordResult.exclusionReason,
    emdAmount:            'Not mentioned',
    contractPeriod:       'Not mentioned',
    eligibilitySummary:   'Not mentioned',
    confidence:           'low',
    analysisSource:       'metadata_only',
  };
}