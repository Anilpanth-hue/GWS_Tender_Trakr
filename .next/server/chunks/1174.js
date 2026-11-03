"use strict";exports.id=1174,exports.ids=[1174],exports.modules={51174:(e,t,i)=>{i.d(t,{analyzeL1:()=>c});let n=`
GlassWing Solutions (GWS) is a Mumbai-based multimodal logistics company.
Capabilities: Rail/Road/Sea/Air logistics, freight forwarding, port & terminal management,
container handling, warehousing, CFS, bulk cargo (fly ash, coal, steel coils, fertilisers,
limestone, bitumen), project/ODC movements, rake management, MMLP operations.
Minimum deal size: ₹50 Lakh. Preferred: ₹1 Cr+. Priority: ₹10 Cr+.
GWS does NOT bid on: civil/construction, IT/software, stationery, medical, education,
solid waste management, tank trucks for oil companies, pure supply/fabrication EPC.
`.trim(),o=`You are a senior logistics BD analyst at GlassWing Solutions (GWS), Mumbai.
Read the attached tender document and perform a Level-1 screening.

${n}

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
- scopeOfWork must describe the actual work, not just the tender title.
- If a field value says "Refer to documents", "Refer to tender document", or similar, treat it as NOT available — output "Not mentioned" instead.
- Never output "Refer to documents" or "Refer to tender" in your response.`,a=`You are a senior logistics BD analyst at GlassWing Solutions (GWS), Mumbai.
Read the tender information below and perform a Level-1 screening.

${n}

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
}

Rules:
- If a field says "Refer to documents", "Refer to tender document", or similar, treat it as NOT available — output "Not mentioned".
- Never output "Refer to documents" anywhere in your response.`,s=null;async function r(){if(s)return s;let{genkit:e}=await Promise.all([i.e(7955),i.e(4725)]).then(i.bind(i,97955)),{googleAI:t}=await Promise.all([i.e(7955),i.e(3363)]).then(i.bind(i,65887));return s=e({plugins:[t({apiKey:process.env.GEMINI_API_KEY})]})}let l="googleai/gemini-2.5-flash";async function c(e,t,i,n){if(0===i.length)return u(n);let s=await r();try{let n,r=i.find(e=>"pdf_base64"===e.type),c=i.filter(e=>"text"===e.type);if(r){let{text:t}=await s.generate({model:l,messages:[{role:"user",content:[{media:{url:`data:application/pdf;base64,${r.content}`,contentType:"application/pdf"}},{text:`Tender Title: ${e}

${o}`}]}],config:{temperature:.1,maxOutputTokens:2048}});n=t}else{let i=[`Tender: ${e}`,t,...c.map(e=>e.content)].join("\n\n").substring(0,12e3),o=a.replace("{CONTENT}",i),{text:r}=await s.generate({model:l,prompt:o,config:{temperature:.1,maxOutputTokens:2048}});n=r}return{...function(e){let t=e.trim(),i=t.match(/```(?:json)?\s*([\s\S]*?)```/);if(i)t=i[1].trim();else{let e=t.indexOf("{"),i=t.lastIndexOf("}");-1!==e&&-1!==i&&(t=t.slice(e,i+1))}let n=JSON.parse(t);return{status:"qualified"===n.status||"rejected"===n.status?n.status:"rejected",scopeOfWork:n.scopeOfWork||"",qualificationReasons:Array.isArray(n.qualificationReasons)?n.qualificationReasons:[],rejectionReason:n.rejectionReason||null,emdAmount:n.emdAmount||"Not mentioned",contractPeriod:n.contractPeriod||"Not mentioned",eligibilitySummary:n.eligibilitySummary||"Not mentioned",confidence:["high","medium","low"].includes(n.confidence)?n.confidence:"medium"}}(n),analysisSource:"documents"}}catch(e){return console.warn("[L1-AI] Gemini call failed, falling back to keyword result:",e.message),u(n)}}function u(e){return{status:e.status,scopeOfWork:"",qualificationReasons:e.qualificationReasons,rejectionReason:e.exclusionReason,emdAmount:"Not mentioned",contractPeriod:"Not mentioned",eligibilitySummary:"Not mentioned",confidence:"low",analysisSource:"metadata_only"}}}};