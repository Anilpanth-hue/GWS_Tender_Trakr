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

// ── Expert tender screener analysis prompt ────────────────────────────────────
const ANALYSIS_PROMPT = `You are India's most experienced government tender screener, hired by GlassWing Solutions (GWS).
Your ONLY job: read this tender document completely, understand it like a human expert, and extract accurate data so that a senior manager can make a bid/no-bid decision in under 2 minutes.

${GWS_CONTEXT}

=== TENDER TITLE ===
{TITLE}

=== TENDER DOCUMENT / CONTENT ===
{CONTENT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW INDIAN GOVERNMENT TENDERS ARE STRUCTURED — READ THIS FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Indian government tenders (NIT, RFP, EOI, GEM) follow a predictable structure:

SECTION 1 — NIT / NOTICE INVITING TENDER (top of document)
  Contains: Tender number, Estimated cost, EMD amount, document fees, submission dates, contract duration.
  EMD appears as: "Earnest Money Deposit: ₹X lakh" or "EMD Value: Rs. X,XX,000".

SECTION 2 — ELIGIBILITY CRITERIA / PRE-QUALIFICATION CRITERIA (PQC)
  THIS IS WHERE TURNOVER, EXPERIENCE, AND TECHNICAL CRITERIA LIVE.
  It is often a numbered list or table, like:
    "1. The bidder shall have minimum average annual turnover of Rs. X crore during last 3/5 financial years."
    "2. The bidder must have successfully completed/executed at least [N] similar work(s) of value not less than Rs. X crore in last [Y] years."
    "3. The bidder shall possess valid PF registration / ESI registration / ISO certification."
  On GEM portals, look under "Bidder's Eligibility" or "Bidder Registration & ITB Clauses".
  In CPPP/IREPS/railway tenders, look for "General Conditions", "Qualifying Criteria", "Technical Eligibility".

SECTION 3 — SCOPE OF WORK / SCHEDULE OF WORK (middle of document)
  Contains: What exactly needs to be done, quantities, locations, service SLAs.

SECTION 4 — TERMS & CONDITIONS (usually 2/3 through the document)
  Contains: Performance Bank Guarantee (PBG/Performance Security — ALWAYS present, typically 3% on GEM, 5-10% on state/central tenders), payment terms, penalty clauses, contract duration if not in NIT.

SECTION 5 — TENDER SCHEDULE / IMPORTANT DATES (usually at end or in NIT header)
  Contains: Pre-bid meeting date/venue, bid submission deadline, bid opening date.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD-BY-FIELD EXTRACTION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PQC — TURNOVER CRITERIA:
  WHERE TO LOOK: Eligibility Criteria / PQC section — numbered item about "turnover" or "financial capacity".
  WHAT IT LOOKS LIKE: "minimum average annual turnover of Rs. X crore", "annual turnover not less than Rs. X lakh", "financial capacity: Rs. X crore per year in last 3 financial years".
  TRIGGER PHRASES: "annual turnover", "average turnover", "minimum turnover", "financial eligibility", "financial capacity", "turnover of Rs.", "sales turnover".
  OUTPUT: State the exact figure AND the period. Example: "Minimum average annual turnover of ₹5 crore in last 3 financial years."
  CRITICAL: If the Eligibility Criteria section exists in the document but does not mention turnover, write "No turnover criteria stated in eligibility section." DO NOT write "Not mentioned in document" if you found an eligibility section.

PQC — EXPERIENCE CRITERIA:
  WHERE TO LOOK: Eligibility Criteria / PQC section — numbered item about "experience" or "similar work".
  WHAT IT LOOKS LIKE: "executed/completed at least one similar work", "experience of handling X MT of cargo", "should have handled similar nature of work", "supply/transport/handling of X commodity", "prior experience in logistics/freight/port operations".
  TRIGGER PHRASES: "similar work", "experience of", "executed", "completed similar", "nature of work", "work order value", "prior experience".
  OUTPUT: State type of work + value threshold + time window. Example: "At least 1 completed similar logistics/transport work of value ≥ ₹2 crore in last 5 years."
  CRITICAL: Same rule as above — if eligibility section exists, do not default to "Not mentioned".

PQC — TECHNICAL CRITERIA:
  WHERE TO LOOK: Eligibility section + anywhere in T&C for certifications/equipment.
  WHAT IT LOOKS LIKE: "ISO 9001 certification", "PF / ESI registration mandatory", "should own/have access to minimum X trucks/rakes/cranes", "valid driving licence / vehicle fitness certificate", "factory licence", "GST registration", "MSME certificate".
  OUTPUT: List ALL found. Example: "GST registration, PF & ESI registration, minimum 10 owned trucks, ISO 9001 preferred."
  If none found: "No specific technical/equipment criteria stated."

PERFORMANCE BANK GUARANTEE (PBG):
  WHERE TO LOOK: Terms & Conditions section — usually clause 15–25.
  IT IS ALMOST ALWAYS PRESENT. Typical text: "The successful bidder shall furnish a Performance Security of X% of the contract value within Y days of award."
  TRIGGER PHRASES: "Performance Bank Guarantee", "Performance Security", "PBG", "security deposit", "contract performance guarantee", "performance guarantee".
  GEM standard: 3% of contract value. State/central govt: 5–10%.
  OUTPUT: Exact percentage or amount as written. Example: "3% of contract value, valid till contract completion + 60 days."
  DO NOT say "Not mentioned" if you see a T&C section — look harder.

REVERSE AUCTION:
  DIRECT SIGNALS: If content says "Bid to Ra Enabled: No" → "No". If it says "Bid to Ra Enabled: Yes" → "Yes".
  If document says "Reverse Auction shall NOT be conducted" → "No".
  If document says "Reverse Auction shall be conducted" → "Yes".
  If GEM portal and no mention → typically "No" for small tenders, write "Not mentioned (likely No for this tender type)".

PRE-BID MEETING:
  TRIGGER PHRASES: "pre-bid meeting", "pre-bid conference", "pre-bid query submission", "clarification meeting", "site visit", "pre proposal meeting".
  OUTPUT: Exact date + time + venue as written. Example: "15-May-2025 at 11:00 AM, Conference Room, DRM Office, Mumbai."
  If absent → "Not scheduled."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — Return ONLY valid JSON (no markdown fences, no text outside JSON):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "scopeOfWork": "What exactly must be done — 2 crisp sentences. Include commodity, route/location, and key service.",
  "gwsRelevanceScore": <integer 1-10>,
  "gwsRelevanceReason": "Why this score — reference GWS capabilities vs. tender requirement in 1 sentence.",
  "recommendedAction": "BID / NO-BID / CONSORTIUM REQUIRED / EVALUATE FURTHER — 1 sentence justification.",
  "winProbabilityAssessment": "High / Medium / Low — 1 sentence: name the single biggest driver.",
  "keyRisks": [
    "Risk 1 — specific risk with consequence",
    "Risk 2 — specific risk with consequence",
    "Risk 3 — specific risk with consequence"
  ],
  "pqcRequirements": {
    "turnoverCriteria": "Exact figure + period as found in eligibility section, or 'No turnover criteria stated.'",
    "experienceCriteria": "Type + value threshold + years as found, or 'No experience criteria stated.'",
    "technicalCriteria": "All certifications/equipment/licences found, or 'No specific technical criteria stated.'"
  },
  "emdAmount": "Exact amount as stated (e.g. ₹5.53 Lakh), or Not mentioned",
  "performanceBankGuarantee": "% or exact amount as stated (e.g. 3% of contract value), or Not mentioned in document",
  "contractDuration": "Duration as stated (e.g. 2 years from date of award)",
  "consortiumJv": "Allowed / Not Allowed / Not mentioned",
  "reverseAuction": "Yes / No / Not mentioned in document",
  "mseExemptions": "Yes / No / Not mentioned",
  "startupExemptions": "Yes / No / Not mentioned",
  "bidEvaluationProcess": "L1 (lowest bid) / QCBS / other — state basis",
  "tenderSchedule": {
    "preBidMeetings": "Date, time, venue as written — or 'Not scheduled.'",
    "bidDate": "Exact submission deadline",
    "openingDate": "Opening date — or 'Same as bid date'"
  },
  "keyTermsAndConditions": [
    "Most important clause affecting bid decision",
    "Second most important clause",
    "Third most important clause"
  ],
  "relevantBusinessLines": ["Specific GWS service line matching this tender"],
  "competitiveInsights": "Who typically wins these tenders — 1 sentence on market reality in this segment.",
  "estimatedRevenuePotential": "Annual revenue estimate with brief rationale (reference estimated cost if available).",
  "contactDetails": {
    "contactPerson": "Full name or Not mentioned",
    "phone": "Number or Not mentioned",
    "email": "Email or Not mentioned",
    "address": "Address or Not mentioned"
  },
  "bestCaseScenario": "If GWS wins and everything goes right — 1-2 sentences on revenue, relationship, growth.",
  "worstCaseScenario": "If GWS wins but things go wrong — 1-2 sentences on biggest operational or financial risk.",
  "otherNotableTakeaways": ["Any unusual clause, exemption, or flag worth highlighting for senior review"],
  "analyzedAt": "${new Date().toISOString()}"
}

ABSOLUTE RULES — violating these makes the output useless:
1. Extract EXACT numbers/figures from the document. Never round or paraphrase financial figures.
2. "Not mentioned in document" is a LAST RESORT. Only write it if you searched the entire document and genuinely found nothing. A document with an Eligibility section that is silent on turnover → "No turnover criteria stated" (not "Not mentioned").
3. If content is from T247 AI Summary (structured key-value text), look for fields labeled "Eligibility / PQC Criteria", "Pre Qualification", "Financial Eligibility", "Technical Eligibility" — these are your primary PQC source.
4. If a real PDF is attached — READ EVERY PAGE. PQC is often on page 2-5 of the NIT. Do not stop at the front page.
5. Every field must add decision-making value. No generic filler like "standard government tender terms apply."`;
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
      const maxLen = key === "Eligibility_Criteria" ? 3000 : 1000;
      lines.push(`${label}:\n${clean.substring(0, maxLen)}`);
    }
  }
  return lines.join('\n\n');
}

// ── Main analysis entry point ─────────────────────────────────────────────────
// pdfPaths: array of all document paths (real PDFs + possibly a T247 JSON)
export async function analyzeTenderL2(
  tenderTitle: string,
  pdfPaths: string[],
  fallbackText?: string
): Promise<TenderL2Analysis> {
  const ai = await getAI();
  const MODEL = 'googleai/gemini-2.5-pro';

  // ── Separate real PDFs from T247 JSON files ───────────────────────────────
  const realPdfs: string[] = [];
  let t247JsonPath: string | null = null;

  for (const p of pdfPaths) {
    if (!fs.existsSync(p)) continue;
    const header = fs.readFileSync(p).subarray(0, 4).toString('ascii');
    if (header === '%PDF') {
      realPdfs.push(p);
    } else if (!t247JsonPath) {
      t247JsonPath = p; // T247 JSON disguised as .pdf
    }
  }

  // ── Route A: one or more real PDFs — send ALL to Gemini as multi-part ────
  if (realPdfs.length > 0) {
    // Sort by file size ascending: smaller docs (often PQC/eligibility) go first
    realPdfs.sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);

    // Cap total payload at 15MB (base64 adds ~33%, so ~20MB on the wire)
    const MAX_BYTES = 15 * 1024 * 1024;
    let totalBytes = 0;
    const selected = realPdfs.filter(p => {
      const sz = fs.statSync(p).size;
      if (totalBytes + sz > MAX_BYTES) return false;
      totalBytes += sz;
      return true;
    });
    const skipped = realPdfs.length - selected.length;

    console.log(
      `[Analysis] Sending ${selected.length} PDF(s) to Gemini Pro` +
      ` (${Math.round(totalBytes / 1024)}KB total)` +
      (skipped > 0 ? ` — ${skipped} skipped (size limit)` : '')
    );
    selected.forEach((p, i) =>
      console.log(`  [${i + 1}] ${require('path').basename(p)} (${Math.round(fs.statSync(p).size / 1024)}KB)`)
    );

    const fileList = selected
      .map((p, i) => `  Document ${i + 1}: ${require('path').basename(p)} (${Math.round(fs.statSync(p).size / 1024)}KB)`)
      .join('\n');
    const skippedNote = skipped > 0 ? `\n  (${skipped} additional large file(s) omitted due to size limit)` : '';
    const pdfContentNote = [
      `[${selected.length} PDF document(s) attached — read EVERY document thoroughly]`,
      `Files provided:\n${fileList}${skippedNote}`,
      fallbackText ? `\n=== TENDER METADATA (T247 summary) ===\n${fallbackText}` : '',
    ].filter(Boolean).join('\n\n');

    const promptText = ANALYSIS_PROMPT
      .replace('{TITLE}', tenderTitle)
      .replace('{CONTENT}', pdfContentNote);

    // Build Gemini content array: one media part per PDF, then the text prompt
    const mediaItems = selected.map(p => ({
      media: {
        url: `data:application/pdf;base64,${fs.readFileSync(p).toString('base64')}`,
        contentType: 'application/pdf' as const,
      },
    }));

    const { text } = await ai.generate({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [...mediaItems, { text: promptText }],
      }],
      config: { temperature: 1, maxOutputTokens: 16384, thinkingConfig: { thinkingBudget: 10000 } },
    });

    return parseAndValidate(text);
  }

  // ── Route B: T247 JSON summary (text-only) ────────────────────────────────
  let tenderContent = fallbackText || 'No document content available.';

  if (t247JsonPath) {
    console.log(`[Analysis] T247 JSON summary — formatting as text`);
    try {
      const fileBuffer = fs.readFileSync(t247JsonPath);
      const jsonData = JSON.parse(fileBuffer.toString('utf8')) as { Data?: Record<string, unknown>[] };
      const item = jsonData.Data?.[0] || (jsonData as Record<string, unknown>);
      const formatted = formatT247JsonAsText(item as Record<string, unknown>);
      if (formatted.trim()) tenderContent = formatted;
    } catch {
      tenderContent = fs.readFileSync(t247JsonPath).toString('utf8').substring(0, 4000);
    }
    console.log(`[Analysis] Text content length: ${tenderContent.length} chars`);
  } else {
    console.log('[Analysis] No documents — using tender overview metadata only');
  }

  const promptText = ANALYSIS_PROMPT
    .replace('{TITLE}', tenderTitle)
    .replace('{CONTENT}', tenderContent);

  console.log(`[Analysis] Sending text prompt to Gemini (${promptText.length} chars)`);

  const { text } = await ai.generate({
    model: MODEL,
    prompt: promptText,
    config: { temperature: 1, maxOutputTokens: 16384, thinkingConfig: { thinkingBudget: 10000 } },
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
