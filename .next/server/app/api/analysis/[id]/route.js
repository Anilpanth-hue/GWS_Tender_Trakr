(()=>{var e={};e.id=4210,e.ids=[4210],e.modules={643:e=>{"use strict";e.exports=require("node:perf_hooks")},1708:e=>{"use strict";e.exports=require("node:process")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4573:e=>{"use strict";e.exports=require("node:buffer")},7252:e=>{"use strict";e.exports=require("express")},10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11723:e=>{"use strict";e.exports=require("querystring")},12412:e=>{"use strict";e.exports=require("assert")},12909:(e,t,r)=>{"use strict";r.d(t,{N:()=>c});var i=r(27956);let s=r(46101).createPool({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"rootpassword",database:process.env.DB_DATABASE||"tender_trakr",waitForConnections:!0,connectionLimit:5});async function n(e){let[t]=await s.query("SELECT id, email, name, role FROM users WHERE email = ?",[e]);return t[0]??null}async function o(e,t){let[r]=await s.execute("INSERT INTO users (name, email, role) VALUES (?, ?, ?)",[e,t,"viewer"]);return{id:r.insertId,email:t,name:e,role:"viewer"}}async function a(e){await s.execute("UPDATE users SET last_login = NOW() WHERE email = ?",[e])}let c={useSecureCookies:process.env.NEXTAUTH_URL?.startsWith("https://")??!1,providers:[(0,i.A)({clientId:process.env.AZURE_AD_CLIENT_ID,clientSecret:process.env.AZURE_AD_CLIENT_SECRET,tenantId:process.env.AZURE_AD_TENANT_ID,authorization:{params:{scope:"openid profile email offline_access Mail.Send"}}})],secret:process.env.NEXTAUTH_SECRET,session:{strategy:"jwt"},callbacks:{async jwt({token:e,user:t,account:r,profile:i}){try{if(r?.provider==="azure-ad"&&t){let s=i?.upn||i?.email||t.email||"",c=i?.name||t.name||s;if(!s)throw Error("No email returned from Azure AD");if(!s.endsWith("@glasswing.in"))throw Error("Access restricted to @glasswing.in accounts.");let l=await n(s);l||(l=await o(c,s)),await a(s),e.id=String(l.id),e.email=l.email,e.name=l.name,e.role=l.role,e.provider="azure-ad",e.accessToken=r.access_token,e.refreshToken=r.refresh_token,e.accessTokenExpires=Date.now()+33e5}if("azure-ad"===e.provider&&e.refreshToken&&"number"==typeof e.accessTokenExpires&&Date.now()>=e.accessTokenExpires){let t=`https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,r=await fetch(t,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.AZURE_AD_CLIENT_ID,client_secret:process.env.AZURE_AD_CLIENT_SECRET,grant_type:"refresh_token",refresh_token:e.refreshToken,scope:"openid profile email offline_access Mail.Send"})});if(r.ok){let t=await r.json();e.accessToken=t.access_token,e.accessTokenExpires=Date.now()+(t.expires_in-300)*1e3,e.refreshToken=t.refresh_token??e.refreshToken}else e.error="RefreshAccessTokenError"}return e}catch(t){return console.error("[auth][jwt]",t),{...e,error:"JWTError"}}},session:async({session:e,token:t})=>(t.id&&t.email&&t.role?(e.user={id:t.id,email:t.email,name:t.name??"",role:t.role,image:null},e.accessToken=t.accessToken,e.error=t.error):e.error=t.error||"SessionMissingFields",e)},pages:{signIn:"/login",error:"/login"}}},16141:e=>{"use strict";e.exports=require("node:zlib")},16698:e=>{"use strict";e.exports=require("node:async_hooks")},19063:e=>{"use strict";e.exports=require("require-in-the-middle")},19771:e=>{"use strict";e.exports=require("process")},21820:e=>{"use strict";e.exports=require("os")},27910:e=>{"use strict";e.exports=require("stream")},28303:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=28303,e.exports=t},28354:e=>{"use strict";e.exports=require("util")},29021:e=>{"use strict";e.exports=require("fs")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:e=>{"use strict";e.exports=require("path")},34631:e=>{"use strict";e.exports=require("tls")},37067:e=>{"use strict";e.exports=require("node:http")},37366:e=>{"use strict";e.exports=require("dns")},37830:e=>{"use strict";e.exports=require("node:stream/web")},40600:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>b,routeModule:()=>v,serverHooks:()=>N,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>x});var i={};r.r(i),r.d(i,{POST:()=>I});var s=r(96559),n=r(48088),o=r(37719),a=r(32190),c=r(33873),l=r(29021),u=r(19854),d=r(12909),p=r(71682);let m=null;async function f(){if(m)return m;let{genkit:e}=await Promise.all([r.e(7955),r.e(4725)]).then(r.bind(r,97955)),{googleAI:t}=await Promise.all([r.e(7955),r.e(3363)]).then(r.bind(r,65887));return m=e({plugins:[t({apiKey:process.env.GEMINI_API_KEY})]})}let y=`
GlassWing Solutions (GWS) is a Mumbai-based multimodal logistics company.
GWS capabilities: Rail/Road/Sea/Air logistics, freight forwarding, port & terminal management,
container handling, warehousing, CFS, bulk cargo (fly ash, coal, steel coils, fertilisers,
limestone, bitumen), project/ODC movements, rake management, MMLP operations.
Target deal size: ₹50L minimum; preferred ₹1Cr+; priority ₹10Cr+.
GWS does NOT bid on: civil/construction, IT/software, stationery, medical, education.
`.trim(),E=`You are India's most experienced government tender screener, hired by GlassWing Solutions (GWS).
Your ONLY job: read this tender document completely, understand it like a human expert, and extract accurate data so that a senior manager can make a bid/no-bid decision in under 2 minutes.

${y}

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
5. Every field must add decision-making value. No generic filler like "standard government tender terms apply."`;async function h(e,t,r){let i=await f(),s="googleai/gemini-2.5-pro",n=[],o=null;for(let e of t)l.existsSync(e)&&("%PDF"===l.readFileSync(e).subarray(0,4).toString("ascii")?n.push(e):o||(o=e));if(n.length>0){n.sort((e,t)=>l.statSync(e).size-l.statSync(t).size);let t=0,o=n.filter(e=>{let r=l.statSync(e).size;return!(t+r>0xf00000)&&(t+=r,!0)}),a=n.length-o.length;console.log(`[Analysis] Sending ${o.length} PDF(s) to Gemini Pro (${Math.round(t/1024)}KB total)`+(a>0?` — ${a} skipped (size limit)`:"")),o.forEach((e,t)=>console.log(`  [${t+1}] ${c.basename(e)} (${Math.round(l.statSync(e).size/1024)}KB)`));let u=o.map((e,t)=>`  Document ${t+1}: ${c.basename(e)} (${Math.round(l.statSync(e).size/1024)}KB)`).join("\n"),d=a>0?`
  (${a} additional large file(s) omitted due to size limit)`:"",p=[`[${o.length} PDF document(s) attached — read EVERY document thoroughly]`,`Files provided:
${u}${d}`,r?`
=== TENDER METADATA (T247 summary) ===
${r}`:""].filter(Boolean).join("\n\n"),m=E.replace("{TITLE}",e).replace("{CONTENT}",p),f=o.map(e=>({media:{url:`data:application/pdf;base64,${l.readFileSync(e).toString("base64")}`,contentType:"application/pdf"}})),{text:y}=await i.generate({model:s,messages:[{role:"user",content:[...f,{text:m}]}],config:{temperature:1,maxOutputTokens:16384,thinkingConfig:{thinkingBudget:1e4}}});return g(y)}let a=r||"No document content available.";if(o){console.log(`[Analysis] T247 JSON summary — formatting as text`);try{let e=l.readFileSync(o),t=JSON.parse(e.toString("utf8")),r=t.Data?.[0]||t,i=function(e){let t=[];for(let[r,i]of Object.entries({Tender_Id:"Tender ID (T247)",Department_Name:"Department / Organisation",Products:"Scope of Work / Description",Estimated_Cost:"Estimated Cost",EMD_Value:"EMD (Earnest Money Deposit)",Document_Fees:"Document Fees",Completion_Period:"Completion / Contract Period",Location:"Site Location",State:"State",Delivery_district:"District",Category:"Category",Bid_End_Date_Time:"Bid Submission Deadline",Bid_Opening_Date_Time:"Bid Opening Date & Time",Eligibility_Criteria:"Eligibility / PQC Criteria",Hard_Copy_Submission:"Hard Copy Submission Required",Payment_terms:"Payment Terms",Levy_of_Penalty:"Penalty Clause",Affidavit_notarized_documents:"Required Documents",Checklist:"Submission Checklist",Emd_Instrument_Type:"EMD Instrument Type",Work_to_be_Done_Site_or_Workshop:"Work Location Type",Courier_Speed_Post_Submission:"Submission Mode"})){let s=e[r];if(!s)continue;let n=String(s).replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();if(n&&n.length>1&&"no"!==n.toLowerCase()){let e="Eligibility_Criteria"===r?3e3:1e3;t.push(`${i}:
${n.substring(0,e)}`)}}return t.join("\n\n")}(r);i.trim()&&(a=i)}catch{a=l.readFileSync(o).toString("utf8").substring(0,4e3)}console.log(`[Analysis] Text content length: ${a.length} chars`)}else console.log("[Analysis] No documents — using tender overview metadata only");let u=E.replace("{TITLE}",e).replace("{CONTENT}",a);console.log(`[Analysis] Sending text prompt to Gemini (${u.length} chars)`);let{text:d}=await i.generate({model:s,prompt:u,config:{temperature:1,maxOutputTokens:16384,thinkingConfig:{thinkingBudget:1e4}}});return g(d)}function g(e){let t,r=e.trim(),i=r.match(/```(?:json)?\s*([\s\S]*?)```/);if(i)r=i[1].trim();else{let e=r.indexOf("{"),t=r.lastIndexOf("}");-1!==e&&-1!==t&&(r=r.slice(e,t+1))}try{t=JSON.parse(r)}catch(e){throw console.error("[Analysis] Gemini response (first 600 chars):",r.substring(0,600)),Error(`AI returned malformed JSON: ${e.message}`)}t.analyzedAt=new Date().toISOString(),"number"!=typeof t.gwsRelevanceScore&&(t.gwsRelevanceScore=parseInt(String(t.gwsRelevanceScore))||5);let s=e=>Array.isArray(e)?e.filter(Boolean):"string"==typeof e&&e.trim()?[e.trim()]:[];return t.keyRisks=s(t.keyRisks),t.keyTermsAndConditions=s(t.keyTermsAndConditions),t.relevantBusinessLines=s(t.relevantBusinessLines),t.otherNotableTakeaways=s(t.otherNotableTakeaways),t}async function T(e,t=0){let i=[];if(!l.existsSync(e)||t>4)return i;for(let s of l.readdirSync(e,{withFileTypes:!0})){let n=c.join(e,s.name);if(s.isDirectory())i.push(...await T(n,t+1));else if(s.name.toLowerCase().endsWith(".pdf"))i.push(n);else if(s.name.toLowerCase().endsWith(".zip")){let e=n.slice(0,-4)+"_extracted";try{let o=(await r.e(3231).then(r.t.bind(r,43231,23))).default;await o(n,{dir:e}),console.log(`[Analysis] Extracted nested ZIP: ${s.name}`),i.push(...await T(e,t+1))}catch(e){console.warn(`[Analysis] Failed to extract nested ZIP ${s.name}:`,e.message)}}}return i}function S(e){if(!e||e.length<10)return!0;let t=/your request|please specify|once you specify|i am unable to|cannot extract/i.test(e),r=/turnover|experience|crore|lakh|certificate|registration|iso|pf|esi|gst|rs.|₹/i.test(e);return t&&!r}function R(e){let t=e.replace(/\\/g,"/");if(t.startsWith("/documents/")||t.startsWith("documents/"))return c.resolve(process.cwd(),"public",t.replace(/^\//,""));let r=t.indexOf("/public/");return -1!==r?c.resolve(process.cwd(),"public",t.slice(r+8)):c.resolve(process.cwd(),"public",t.replace(/^\//,""))}async function I(e,{params:t}){let i=await (0,u.getServerSession)(d.N);if(!i?.user?.email)return a.NextResponse.json({error:"Unauthorized"},{status:401});try{let{id:e}=await t,i=await (0,p.Zy)("SELECT * FROM tenders WHERE id = ?",[e]);if(!i)return a.NextResponse.json({error:"Tender not found"},{status:404});if("rejected"===i.l1_status&&"accepted"!==i.l1_decision)return a.NextResponse.json({error:"L2 analysis requires the tender to be qualified or accepted at L1"},{status:400});console.log(`[Analysis] L2 for tender #${e}: ${String(i.title).substring(0,80)}`);let s=await (0,p.query)(`SELECT file_path, doc_type
       FROM tender_documents
       WHERE tender_id = ? AND file_path IS NOT NULL
       ORDER BY FIELD(doc_type,'full_docs_zip','individual_doc','summary_pdf'), created_at ASC`,[e]),n=[],o=null;for(let e of s){if(!e.file_path)continue;let t=R(e.file_path);t.endsWith(".pdf")&&l.existsSync(t)&&(function(e){try{let t=Buffer.alloc(4),r=l.openSync(e,"r");return l.readSync(r,t,0,4,0),l.closeSync(r),"%PDF"===t.toString("ascii")}catch{return!1}}(t)?(n.push(t),console.log(`[Analysis] Found real PDF: ${c.basename(t)}`)):(o=o??t,console.log(`[Analysis] Skipping T247 JSON (fake .pdf): ${c.basename(t)}`)))}for(let e of s){if(!e.file_path)continue;let t=R(e.file_path);if(!t.endsWith(".zip")||!l.existsSync(t))continue;let i=t.slice(0,-4)+"_extracted";try{let e=(await r.e(3231).then(r.t.bind(r,43231,23))).default;await e(t,{dir:i});let s=await T(i);for(let e of(console.log(`[Analysis] ZIP extracted: found ${s.length} PDF(s) inside ${c.basename(t)}`),s))console.log(`  → ${c.relative(i,e)} (${Math.round(l.statSync(e).size/1024)}KB)`),n.push(e)}catch(e){console.warn(`[Analysis] ZIP extraction failed for ${c.basename(t)}:`,e.message)}}let u=n.length>0?n:o?[o]:[];0===u.length?console.log("[Analysis] No documents on disk — using structured text from tender overview."):console.log(`[Analysis] Total document paths to analyse: ${u.length}`);let d="";try{let e="string"==typeof i.tender_overview?JSON.parse(i.tender_overview):i.tender_overview;if(e){let t=[];if(e.eligibilityCriteria&&!S(e.eligibilityCriteria)&&t.push(`
=== ELIGIBILITY / PRE-QUALIFICATION CRITERIA (PQC) ===
${e.eligibilityCriteria}`),e.pqcSummary&&e.pqcSummary!==e.eligibilityCriteria&&!S(e.pqcSummary)&&t.push(`=== PRE-QUALIFICATION SUMMARY ===
${e.pqcSummary}`),e.aiSummaryFields&&"object"==typeof e.aiSummaryFields){let r=/eligib|pre.qualif|turnover|experience|technical|financial|pqc|qualification/i,i=Object.entries(e.aiSummaryFields).filter(([e,t])=>r.test(e)&&t&&String(t).trim().length>0).map(([e,t])=>`  ${e}: ${t}`).join("\n");i&&t.push(`=== T247 PQC FIELDS ===
${i}`);let s=Object.entries(e.aiSummaryFields).filter(([e,t])=>!r.test(e)&&t&&String(t).trim().length>0).map(([e,t])=>`  ${e}: ${t}`).join("\n");s&&t.push(`
=== T247 AI SUMMARY ===
${s}`)}e.estimatedCost&&t.push(`Estimated Cost: ${e.estimatedCost}`),e.emdValue&&t.push(`EMD: ${e.emdValue}`),e.documentFees&&t.push(`Document Fees: ${e.documentFees}`),e.completionPeriod&&t.push(`Completion Period: ${e.completionPeriod}`),e.siteLocation&&t.push(`Site Location: ${e.siteLocation}`),e.msmeExemption&&t.push(`MSME Exemption: ${e.msmeExemption}`),e.startupExemption&&t.push(`Startup Exemption: ${e.startupExemption}`),e.jvConsortium&&t.push(`JV / Consortium: ${e.jvConsortium}`),e.reverseAuction&&t.push(`Reverse Auction: ${e.reverseAuction}`),e.hardCopySubmission&&t.push(`Hard Copy Submission: ${e.hardCopySubmission}`),e.performanceBankGuarantee&&t.push(`Performance Bank Guarantee: ${e.performanceBankGuarantee}`),e.contactPerson&&t.push(`Contact Person: ${e.contactPerson}`),e.contactAddress&&t.push(`Contact Address: ${e.contactAddress}`),e.fullSummaryText&&t.push(`
=== SCOPE / AI SUMMARY ===
${e.fullSummaryText}`),d=t.join("\n")}}catch{}let m=[`Title: ${i.title}`,`Issued by: ${i.issued_by}`,`Location: ${i.location}`,`Estimated Value: ${i.estimated_value_raw}`,`Due Date: ${i.due_date}`,d].filter(Boolean).join("\n");console.log("[Analysis] Running Gemini AI analysis...");let f=await h(i.title,u,m);return await (0,p.g7)("UPDATE tenders SET l2_analyzed = TRUE, l2_analysis = ?, updated_at = NOW() WHERE id = ?",[JSON.stringify(f),e]),console.log(`[Analysis] Done. GWS Score: ${f.gwsRelevanceScore}/10, Action: ${f.recommendedAction}`),a.NextResponse.json({data:f,message:`Analysis complete — GWS Relevance: ${f.gwsRelevanceScore}/10`})}catch(e){return console.error("[API /analysis/[id]] Error:",e),a.NextResponse.json({error:e.message||"Analysis failed"},{status:500})}}let v=new s.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/analysis/[id]/route",pathname:"/api/analysis/[id]",filename:"route",bundlePath:"app/api/analysis/[id]/route"},resolvedPagePath:"/Users/rajeevsiddhu/GWS Projects/GWS_Tender_Trakr/src/app/api/analysis/[id]/route.ts",nextConfigOutput:"",userland:i}),{workAsyncStorage:A,workUnitAsyncStorage:x,serverHooks:N}=v;function b(){return(0,o.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:x})}},41204:e=>{"use strict";e.exports=require("string_decoder")},44708:e=>{"use strict";e.exports=require("node:https")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},53053:e=>{"use strict";e.exports=require("node:diagnostics_channel")},55511:e=>{"use strict";e.exports=require("crypto")},55591:e=>{"use strict";e.exports=require("https")},56801:e=>{"use strict";e.exports=require("import-in-the-middle")},57075:e=>{"use strict";e.exports=require("node:stream")},57975:e=>{"use strict";e.exports=require("node:util")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},66136:e=>{"use strict";e.exports=require("timers")},71682:(e,t,r)=>{"use strict";r.d(t,{Zy:()=>n,g7:()=>o,query:()=>s});let i=r(46101).createPool({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"rootpassword",database:process.env.DB_DATABASE||"tender_trakr",waitForConnections:!0,connectionLimit:10,queueLimit:50,connectTimeout:8e3,timezone:"+00:00"});async function s(e,t){let[r]=await i.query(e,t);return r}async function n(e,t){return(await s(e,t))[0]??null}async function o(e,t){let[r]=await i.execute(e,t);return r}},73024:e=>{"use strict";e.exports=require("node:fs")},73136:e=>{"use strict";e.exports=require("node:url")},73496:e=>{"use strict";e.exports=require("http2")},73566:e=>{"use strict";e.exports=require("worker_threads")},74075:e=>{"use strict";e.exports=require("zlib")},74998:e=>{"use strict";e.exports=require("perf_hooks")},76760:e=>{"use strict";e.exports=require("node:path")},77030:e=>{"use strict";e.exports=require("node:net")},77598:e=>{"use strict";e.exports=require("node:crypto")},78335:()=>{},79428:e=>{"use strict";e.exports=require("buffer")},79551:e=>{"use strict";e.exports=require("url")},79646:e=>{"use strict";e.exports=require("child_process")},79748:e=>{"use strict";e.exports=require("fs/promises")},81630:e=>{"use strict";e.exports=require("http")},83997:e=>{"use strict";e.exports=require("tty")},84297:e=>{"use strict";e.exports=require("async_hooks")},91645:e=>{"use strict";e.exports=require("net")},94735:e=>{"use strict";e.exports=require("events")},96487:()=>{}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[4243,8203,2190,5191],()=>r(40600));module.exports=i})();