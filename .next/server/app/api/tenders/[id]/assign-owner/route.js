(()=>{var e={};e.id=2767,e.ids=[2767],e.modules={3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4573:e=>{"use strict";e.exports=require("node:buffer")},10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11723:e=>{"use strict";e.exports=require("querystring")},12412:e=>{"use strict";e.exports=require("assert")},12909:(e,t,r)=>{"use strict";r.d(t,{N:()=>c});var s=r(27956);let o=r(46101).createPool({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"rootpassword",database:process.env.DB_DATABASE||"tender_trakr",waitForConnections:!0,connectionLimit:5});async function n(e){let[t]=await o.query("SELECT id, email, name, role FROM users WHERE email = ?",[e]);return t[0]??null}async function i(e,t){let[r]=await o.execute("INSERT INTO users (name, email, role) VALUES (?, ?, ?)",[e,t,"viewer"]);return{id:r.insertId,email:t,name:e,role:"viewer"}}async function a(e){await o.execute("UPDATE users SET last_login = NOW() WHERE email = ?",[e])}let c={useSecureCookies:process.env.NEXTAUTH_URL?.startsWith("https://")??!1,providers:[(0,s.A)({clientId:process.env.AZURE_AD_CLIENT_ID,clientSecret:process.env.AZURE_AD_CLIENT_SECRET,tenantId:process.env.AZURE_AD_TENANT_ID,authorization:{params:{scope:"openid profile email offline_access Mail.Send"}}})],secret:process.env.NEXTAUTH_SECRET,session:{strategy:"jwt"},callbacks:{async jwt({token:e,user:t,account:r,profile:s}){try{if(r?.provider==="azure-ad"&&t){let o=s?.upn||s?.email||t.email||"",c=s?.name||t.name||o;if(!o)throw Error("No email returned from Azure AD");if(!o.endsWith("@glasswing.in"))throw Error("Access restricted to @glasswing.in accounts.");let d=await n(o);d||(d=await i(c,o)),await a(o),e.id=String(d.id),e.email=d.email,e.name=d.name,e.role=d.role,e.provider="azure-ad",e.accessToken=r.access_token,e.refreshToken=r.refresh_token,e.accessTokenExpires=Date.now()+33e5}if("azure-ad"===e.provider&&e.refreshToken&&"number"==typeof e.accessTokenExpires&&Date.now()>=e.accessTokenExpires){let t=`https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,r=await fetch(t,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.AZURE_AD_CLIENT_ID,client_secret:process.env.AZURE_AD_CLIENT_SECRET,grant_type:"refresh_token",refresh_token:e.refreshToken,scope:"openid profile email offline_access Mail.Send"})});if(r.ok){let t=await r.json();e.accessToken=t.access_token,e.accessTokenExpires=Date.now()+(t.expires_in-300)*1e3,e.refreshToken=t.refresh_token??e.refreshToken}else e.error="RefreshAccessTokenError"}return e}catch(t){return console.error("[auth][jwt]",t),{...e,error:"JWTError"}}},session:async({session:e,token:t})=>(t.id&&t.email&&t.role?(e.user={id:t.id,email:t.email,name:t.name??"",role:t.role,image:null},e.accessToken=t.accessToken,e.error=t.error):e.error=t.error||"SessionMissingFields",e)},pages:{signIn:"/login",error:"/login"}}},19771:e=>{"use strict";e.exports=require("process")},27910:e=>{"use strict";e.exports=require("stream")},28303:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=28303,e.exports=t},28354:e=>{"use strict";e.exports=require("util")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},34631:e=>{"use strict";e.exports=require("tls")},40979:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>m,routeModule:()=>u,serverHooks:()=>f,workAsyncStorage:()=>x,workUnitAsyncStorage:()=>g});var s={};r.r(s),r.d(s,{POST:()=>p});var o=r(96559),n=r(48088),i=r(37719),a=r(32190),c=r(19854),d=r(12909),l=r(71682);async function p(e,{params:t}){try{let r=await (0,c.getServerSession)(d.N);if(!r?.user?.email)return a.NextResponse.json({error:"Unauthorized"},{status:401});let{id:s}=await t,o=((await e.json()).assigneeEmail||"").trim().toLowerCase();if(!o)return a.NextResponse.json({error:"assigneeEmail is required"},{status:400});if(!o.endsWith("@glasswing.in"))return a.NextResponse.json({error:"Only @glasswing.in email addresses are allowed"},{status:400});let n=await (0,l.Zy)("SELECT id, title, tender_no, issued_by, location, estimated_value_raw, due_date, detail_url, l2_analysis FROM tenders WHERE id = ?",[s]);if(!n)return a.NextResponse.json({error:"Tender not found"},{status:404});let i={};try{let e=n.l2_analysis;"object"==typeof e&&null!==e?i=e:"string"==typeof e&&(i=JSON.parse(e))}catch{}let p=(process.env.NEXTAUTH_URL||"http://localhost:3000").replace(/\/$/,""),u=`${p}/analysis/${s}`,x=n.detail_url||"",g=r.user.name||r.user.email,f=r.user.email,m=o.split("@")[0].split(".")[0],h=m.charAt(0).toUpperCase()+m.slice(1),w=function(e,t,r,s,o,n,i){let a=(t.split("@")[1]??"").split(".")[0],c=a.charAt(0).toUpperCase()+a.slice(1),d=s.due_date?new Date(s.due_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—",l=s.due_date?Math.ceil((new Date(s.due_date).getTime()-Date.now())/864e5):null,p=null!==l&&l<=14?`<div style="background:#fff0f0;border:1px solid #cc0000;border-radius:4px;padding:12px 16px;margin-bottom:20px;color:#cc0000;font-size:13px;font-weight:600">
        &#9888; Due in ${l} day${1===l?"":"s"} — please act urgently.
       </div>`:"",u=[o.recommendedAction?`
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;background:#f5f5f5;border-bottom:1px solid #cccccc;width:160px">AI Recommendation</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;font-weight:700;color:#000000">${o.recommendedAction}</td>
      </tr>`:"",o.gwsRelevanceScore?`
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;border-bottom:1px solid #cccccc;width:160px">Relevance Score</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;color:#000000">${o.gwsRelevanceScore}/10</td>
      </tr>`:"",o.winProbabilityAssessment?`
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;background:#f5f5f5;border-bottom:1px solid #cccccc;width:160px">Win Probability</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;color:#000000">${o.winProbabilityAssessment.split("—")[0].trim()}</td>
      </tr>`:""].filter(Boolean).join("");return`
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#000000">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px 28px;border-radius:12px 12px 0 0">
    <p style="margin:0;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">${c} — Internal</p>
    <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700">📋 Tender Assignment</h1>
  </div>

  <!-- Body -->
  <div style="background:#ffffff;border:1px solid #cccccc;border-top:none;border-radius:0 0 12px 12px;padding:28px 32px">

    <p style="margin:0 0 6px;color:#000000">Dear <strong>${r}</strong>,</p>
    <p style="margin:0 0 20px;color:#000000">
      <strong>${e}</strong> (<a href="mailto:${t}" style="color:#7c3aed">${t}</a>) has assigned the following tender to you for review and follow-up.
      Please go through the details and the AI analysis at the earliest.
    </p>

    ${p}

    <!-- Tender details table -->
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:13px;border:1px solid #cccccc">
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;background:#f5f5f5;border-bottom:1px solid #cccccc;width:160px">Title</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;font-weight:600;color:#000000">${s.title}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;border-bottom:1px solid #cccccc;width:160px">T247 ID</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;color:#000000">T247-${s.tender_no}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;background:#f5f5f5;border-bottom:1px solid #cccccc;width:160px">Issued By</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;color:#000000">${s.issued_by||"—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;border-bottom:1px solid #cccccc;width:160px">Location</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;color:#000000">${s.location||"—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;background:#f5f5f5;border-bottom:1px solid #cccccc;width:160px">Est. Value</td>
        <td style="padding:10px 14px;border-bottom:1px solid #cccccc;font-weight:600;color:#000000">${s.estimated_value_raw||"—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#000000;border-bottom:${u?"1px solid #cccccc":"none"};width:160px">Due Date</td>
        <td style="padding:10px 14px;border-bottom:${u?"1px solid #cccccc":"none"};font-weight:600;color:${null!==l&&l<=14?"#cc0000":"#000000"}">${d}</td>
      </tr>
      ${u}
    </table>

    <!-- Action links -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td style="padding:0 8px 0 0;width:50%">
          <a href="${n}"
             style="display:block;text-align:center;padding:12px 16px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">
            View AI Analysis on GWS Platform
          </a>
        </td>
        <td style="padding:0 0 0 8px;width:50%">
          <a href="${i}"
             style="display:block;text-align:center;padding:12px 16px;background:#0284c7;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">
            View Tender on Tender247
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;color:#000000;font-size:13px">
      Please review and take the necessary action. Feel free to reach out if you have any questions.
    </p>

    <p style="margin:0;border-top:1px solid #cccccc;padding-top:20px;font-size:13px;color:#000000">
      Best regards,<br>
      <strong>${e}</strong><br>
      ${c}
    </p>
  </div>
</div>`}(g,f,h,n,i,u,x),y=`Tender Assignment: ${n.title} [T247-${n.tender_no}]`;try{await (0,l.g7)("UPDATE tenders SET owner_email = ?, owner_assigned_at = NOW(), assigned_by_email = ?, assigned_by_name = ?, updated_at = NOW() WHERE id = ?",[o,f,r.user.name||f,s])}catch(e){if((e.message||"").includes("Unknown column"))return a.NextResponse.json({error:"Database schema is outdated on this machine. Please call POST /api/admin/run-migration once, then try again."},{status:500});throw e}let b=r.accessToken;if(!b)return a.NextResponse.json({error:"No Microsoft access token in session. Please sign out and sign back in to enable email sending."},{status:401});let _=await fetch("https://graph.microsoft.com/v1.0/me/sendMail",{method:"POST",headers:{Authorization:`Bearer ${b}`,"Content-Type":"application/json"},body:JSON.stringify({message:{subject:y,body:{contentType:"html",content:w},toRecipients:[{emailAddress:{address:o}}]},saveToSentItems:!0})});if(!_.ok){let e=await _.text();if(console.error("[AssignOwner] Graph API error:",_.status,e),401===_.status)return a.NextResponse.json({error:"Access token expired. Please sign out and sign back in, then try again."},{status:401});if(403===_.status)return a.NextResponse.json({error:"Mail.Send permission not granted. An Azure AD admin needs to consent to this permission in the app registration."},{status:403});return a.NextResponse.json({error:`Failed to send email via Outlook (${_.status}). ${e.substring(0,200)}`},{status:500})}return console.log(`[AssignOwner] Tender #${s} assigned to ${o} by ${f}`),a.NextResponse.json({message:`Tender successfully assigned to ${o}. Email sent from your Outlook.`})}catch(e){return console.error("[AssignOwner] Unexpected error:",e),a.NextResponse.json({error:e.message||"Failed to assign owner"},{status:500})}}let u=new o.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/tenders/[id]/assign-owner/route",pathname:"/api/tenders/[id]/assign-owner",filename:"route",bundlePath:"app/api/tenders/[id]/assign-owner/route"},resolvedPagePath:"/Users/rajeevsiddhu/GWS Projects/GWS_Tender_Trakr/src/app/api/tenders/[id]/assign-owner/route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:x,workUnitAsyncStorage:g,serverHooks:f}=u;function m(){return(0,i.patchFetch)({workAsyncStorage:x,workUnitAsyncStorage:g})}},41204:e=>{"use strict";e.exports=require("string_decoder")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},53053:e=>{"use strict";e.exports=require("node:diagnostics_channel")},55511:e=>{"use strict";e.exports=require("crypto")},55591:e=>{"use strict";e.exports=require("https")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},66136:e=>{"use strict";e.exports=require("timers")},71682:(e,t,r)=>{"use strict";r.d(t,{Zy:()=>n,g7:()=>i,query:()=>o});let s=r(46101).createPool({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"rootpassword",database:process.env.DB_DATABASE||"tender_trakr",waitForConnections:!0,connectionLimit:10,queueLimit:50,connectTimeout:8e3,timezone:"+00:00"});async function o(e,t){let[r]=await s.query(e,t);return r}async function n(e,t){return(await o(e,t))[0]??null}async function i(e,t){let[r]=await s.execute(e,t);return r}},74075:e=>{"use strict";e.exports=require("zlib")},78335:()=>{},79428:e=>{"use strict";e.exports=require("buffer")},79551:e=>{"use strict";e.exports=require("url")},81630:e=>{"use strict";e.exports=require("http")},91645:e=>{"use strict";e.exports=require("net")},94735:e=>{"use strict";e.exports=require("events")},96487:()=>{}};var t=require("../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[4243,8203,2190,5191],()=>r(40979));module.exports=s})();