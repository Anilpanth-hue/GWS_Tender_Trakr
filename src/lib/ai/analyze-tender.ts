// This file must only run on the server (Node.js). Never import it in client components.

import * as fs from 'fs';
import type { TenderL2Analysis } from '@/types';

// ── Lazy Genkit init ──────────────────────────────────────────────────────────
let _ai: Awaited<ReturnType<typeof import('genkit')['genkit']>> | null = null;

async function getAI() {
  if (_ai) return _ai;
  const { genkit } = await import('genkit');
  const { googleAI } = await import('@genkit-ai/googleai');
  _ai = genkit({ plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })] });
  return _ai;
}

// ── GWS context (injected into every prompt) ──────────────────────────────────
const GWS_CONTEXT = `
GlassWing Solutions (GWS) is a Mumbai-based multimodal logistics company.
GWS capabilities: Rail/Road/Sea/Air logistics, freight forwarding, port & terminal management,
container handling, warehousing, CFS, bulk cargo (fly ash, coal, steel coils, fertilisers,
limestone, bitumen), project/ODC movements, rake management, MMLP operations.
Target deal size: ₹50L minimum; preferred ₹1Cr+; priority ₹10Cr+.
GWS does NOT bid on: civil/construction, IT/software, stationery, medical, education.
`.trim();

// ── Sharp, qualitative analysis prompt ───────────────────────────────────────
const ANALYSIS_PROMPT = `You are a senior BD analyst at GlassWing Solutions (GWS), Mumbai.
Give a SHARP, STRATEGIC assessment of whether GWS should pursue this tender.

${GWS_CONTEXT}

=== TENDER TITLE ===
{TITLE}

=== TENDER CONTENT ===
{CONTENT}

Return ONLY valid JSON — no markdown, no explanation outside the JSON:

{
  "scopeOfWork": "What exactly must be done — 2 crisp sentences max",
  "gwsRelevanceScore": <integer 1-10>,
  "gwsRelevanceReason": "Core reason for this score — 1 sentence",
  "recommendedAction": "BID / NO-BID / CONSORTIUM REQUIRED / EVALUATE FURTHER — 1 sentence justification",
  "winProbabilityAssessment": "High / Medium / Low — 1 sentence: key driver of this estimate",
  "keyRisks": [
    "Risk 1 — specific, actionable",
    "Risk 2 — specific, actionable",
    "Risk 3 — specific, actionable"
  ],
  "pqcRequirements": {
    "turnoverCriteria": "Exact figure or Not mentioned",
    "experienceCriteria": "Key experience requirement or Not mentioned",
    "technicalCriteria": "Equipment / technical requirement or Not mentioned"
  },
  "emdAmount": "Exact amount or Not mentioned",
  "performanceBankGuarantee": "% or amount or Not mentioned",
  "contractDuration": "Duration",
  "consortiumJv": "Allowed / Not Allowed / Not mentioned",
  "reverseAuction": "Yes / No / Not mentioned",
  "mseExemptions": "Yes / No / Not mentioned",
  "startupExemptions": "Yes / No / Not mentioned",
  "bidEvaluationProcess": "L1 / QCBS / other",
  "tenderSchedule": {
    "preBidMeetings": "Date & time or Not mentioned",
    "bidDate": "Submission deadline",
    "openingDate": "Opening date or Same as bid date"
  },
  "keyTermsAndConditions": [
    "Most critical clause 1",
    "Critical clause 2",
    "Critical clause 3"
  ],
  "relevantBusinessLines": ["GWS service line that maps to this tender"],
  "competitiveInsights": "Who typically wins these — 1 sentence on market reality",
  "estimatedRevenuePotential": "Annual revenue estimate with brief rationale",
  "contactDetails": {
    "contactPerson": "Full name or Not mentioned",
    "phone": "Number or Not mentioned",
    "email": "Email or Not mentioned",
    "address": "Address or Not mentioned"
  },
  "bestCaseScenario": "If GWS wins and everything goes right — outcome in 1-2 sentences (revenue, relationship, expansion opportunity)",
  "worstCaseScenario": "If GWS wins but things go wrong — biggest operational or financial risk in 1-2 sentences",
  "otherNotableTakeaways": ["Any critical clause, exemption, or unusual term worth flagging"],
  "analyzedAt": "${new Date().toISOString()}"
}

Rules: exact numbers only. If not in document → "Not mentioned". Be direct — every sentence must add decision-making value. No filler, no summaries of obvious data.`;

// ── Convert Tender247 JSON summary to readable text ───────────────────────────
// Tender247's "PDF Download" endpoint returns a JSON object, not a PDF binary.
// We format this as structured text for Gemini.
function formatT247JsonAsText(item: Record<string, unknown>): string {
  const FIELD_LABELS: Record<string, string> = {
    Tender_Id:                'Tender ID (T247)',
    Department_Name:          'Department / Organisation',
    Products:                 'Scope of Work / Description',
    Estimated_Cost:           'Estimated Cost',
    EMD_Value:                'EMD (Earnest Money Deposit)',
    Document_Fees:            'Document Fees',
    Completion_Period:        'Completion / Contract Period',
    Location:                 'Site Location',
    State:                    'State',
    Delivery_district:        'District',
    Category:                 'Category',
    Bid_End_Date_Time:        'Bid Submission Deadline',
    Bid_Opening_Date_Time:    'Bid Opening Date & Time',
    Eligibility_Criteria:     'Eligibility / PQC Criteria',
    Hard_Copy_Submission:     'Hard Copy Submission Required',
    Payment_terms:            'Payment Terms',
    Levy_of_Penalty:          'Penalty Clause',
    Affidavit_notarized_documents: 'Required Documents',
    Checklist:                'Submission Checklist',
    Emd_Instrument_Type:      'EMD Instrument Type',
    Work_to_be_Done_Site_or_Workshop: 'Work Location Type',
    Courier_Speed_Post_Submission: 'Submission Mode',
  };

  const lines: string[] = [];
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const raw = item[key];
    if (!raw) continue;
    // Strip HTML tags and clean whitespace
    const clean = String(raw)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean && clean.length > 1 && clean.toLowerCase() !== 'no') {
      lines.push(`${label}:\n${clean.substring(0, 800)}`);
    }
  }
  return lines.join('\n\n');
}

// ── Main analysis entry point ─────────────────────────────────────────────────
export async function analyzeTenderL2(
  tenderTitle: string,
  pdfPath: string | null,
  fallbackText?: string
): Promise<TenderL2Analysis> {
  const ai = await getAI();
  const MODEL = 'googleai/gemini-2.5-flash';

  let tenderContent = fallbackText || 'No document content available.';
  let sendAsPdf = false;

  // ── Detect file type and prepare content ─────────────────────────────────
  if (pdfPath && fs.existsSync(pdfPath)) {
    const fileBuffer = fs.readFileSync(pdfPath);
    const header = fileBuffer.slice(0, 4).toString('ascii');

    if (header === '%PDF') {
      // Real PDF — send as binary to Gemini
      sendAsPdf = true;
      console.log(`[Analysis] Real PDF detected (${Math.round(fileBuffer.length / 1024)}KB) — sending to Gemini as PDF`);

      const pdfBase64 = fileBuffer.toString('base64');
      // Include overview/metadata alongside the PDF so EMD, eligibility etc. are explicit
      const pdfContentNote = fallbackText
        ? `[See attached PDF document]\n\n=== TENDER METADATA (from T247 summary) ===\n${fallbackText}`
        : '[See attached PDF document]';
      const promptText = ANALYSIS_PROMPT
        .replace('{TITLE}', tenderTitle)
        .replace('{CONTENT}', pdfContentNote);

      const { text } = await ai.generate({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { media: { url: `data:application/pdf;base64,${pdfBase64}`, contentType: 'application/pdf' } },
            { text: promptText },
          ],
        }],
        config: { temperature: 0.1, maxOutputTokens: 8192 },
      });

      return parseAndValidate(text);

    } else {
      // Tender247 JSON summary (their "PDF Download" returns JSON, not PDF)
      console.log(`[Analysis] Tender247 JSON summary detected (${Math.round(fileBuffer.length / 1024)}KB) — formatting as text`);
      try {
        const jsonData = JSON.parse(fileBuffer.toString('utf8')) as { Data?: Record<string, unknown>[] };
        const item = jsonData.Data?.[0] || (jsonData as Record<string, unknown>);
        tenderContent = formatT247JsonAsText(item as Record<string, unknown>);
        if (!tenderContent.trim()) {
          tenderContent = fileBuffer.toString('utf8').substring(0, 4000);
        }
      } catch {
        // Not valid JSON either — use as raw text
        tenderContent = fileBuffer.toString('utf8').substring(0, 4000);
      }
      console.log(`[Analysis] Formatted content length: ${tenderContent.length} chars`);
    }
  } else if (!sendAsPdf) {
    console.log('[Analysis] No document on disk — using metadata fallback text');
  }

  // ── Text-based analysis ────────────────────────────────────────────────────
  const promptText = ANALYSIS_PROMPT
    .replace('{TITLE}', tenderTitle)
    .replace('{CONTENT}', tenderContent);

  console.log(`[Analysis] Sending text prompt to Gemini (${promptText.length} chars)`);

  const { text } = await ai.generate({
    model: MODEL,
    prompt: promptText,
    config: { temperature: 0.1, maxOutputTokens: 8192 },
  });

  return parseAndValidate(text);
}

// ── Parse and validate Gemini JSON response ───────────────────────────────────
function parseAndValidate(rawText: string): TenderL2Analysis {
  let jsonStr = rawText.trim();

  // Strip markdown fences if present
  const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    jsonStr = fenced[1].trim();
  } else {
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);
  }

  let parsed: TenderL2Analysis;
  try {
    parsed = JSON.parse(jsonStr) as TenderL2Analysis;
  } catch (parseErr) {
    console.error('[Analysis] Gemini response (first 600 chars):', jsonStr.substring(0, 600));
    throw new Error(`AI returned malformed JSON: ${(parseErr as Error).message}`);
  }

  parsed.analyzedAt = new Date().toISOString();

  if (typeof parsed.gwsRelevanceScore !== 'number') {
    parsed.gwsRelevanceScore = parseInt(String(parsed.gwsRelevanceScore)) || 5;
  }

  // Normalize array fields — AI occasionally returns a string instead of an array
  const toArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  };
  parsed.keyRisks               = toArray(parsed.keyRisks);
  parsed.keyTermsAndConditions  = toArray(parsed.keyTermsAndConditions);
  parsed.relevantBusinessLines  = toArray(parsed.relevantBusinessLines);
  parsed.otherNotableTakeaways  = toArray(parsed.otherNotableTakeaways);

  return parsed;
}
