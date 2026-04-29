import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * POST /api/tenders/[id]/assign-owner
 *
 * Body: { assigneeEmail: string }
 *
 * 1. Validates assigneeEmail is @glasswing.in
 * 2. Fetches tender details
 * 3. Generates a professional email via Gemini
 * 4. Sends via Microsoft Graph API (Outlook) on behalf of the logged-in user
 * 5. Updates tenders.owner_email in DB
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json<ApiResponse>({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json() as { assigneeEmail?: string };
    const assigneeEmail = (body.assigneeEmail || '').trim().toLowerCase();

    // ── Validate email ─────────────────────────────────────────────────────
    if (!assigneeEmail) {
      return NextResponse.json<ApiResponse>({ error: 'assigneeEmail is required' }, { status: 400 });
    }
    if (!assigneeEmail.endsWith('@glasswing.in')) {
      return NextResponse.json<ApiResponse>(
        { error: 'Only @glasswing.in email addresses are allowed' },
        { status: 400 }
      );
    }

    // ── Fetch tender ───────────────────────────────────────────────────────
    const tender = await queryOne<Record<string, unknown>>(
      'SELECT id, title, tender_no, issued_by, location, estimated_value_raw, due_date, detail_url, l2_analysis FROM tenders WHERE id = ?',
      [id]
    );
    if (!tender) {
      return NextResponse.json<ApiResponse>({ error: 'Tender not found' }, { status: 404 });
    }

    // Parse l2_analysis
    type L2 = {
      recommendedAction?: string;
      gwsRelevanceScore?: number;
      gwsRelevanceReason?: string;
      scopeOfWork?: string;
      winProbabilityAssessment?: string;
    };
    let l2: L2 = {};
    try {
      const raw = tender.l2_analysis;
      if (typeof raw === 'object' && raw !== null) l2 = raw as L2;
      else if (typeof raw === 'string') l2 = JSON.parse(raw);
    } catch { /* no analysis yet */ }

    // ── Generate email body via Gemini ────────────────────────────────────
    const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
    const analysisUrl = `${appUrl}/analysis/${id}`;
    const detailUrl   = (tender.detail_url as string) || '';

    const senderName  = session.user.name || session.user.email;
    const senderEmail = session.user.email;

    // Extract assignee's first name from email (e.g. "john.doe@glasswing.in" → "John")
    const assigneeFirstName = assigneeEmail.split('@')[0].split('.')[0];
    const assigneeName = assigneeFirstName.charAt(0).toUpperCase() + assigneeFirstName.slice(1);

    const tenderDetails = [
      `Title: ${tender.title}`,
      `T247 ID: T247-${tender.tender_no}`,
      `Issued By: ${tender.issued_by}`,
      `Location: ${tender.location || 'Not specified'}`,
      `Estimated Value: ${tender.estimated_value_raw || 'Not specified'}`,
      `Due Date: ${tender.due_date ? new Date(tender.due_date as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not specified'}`,
      l2.recommendedAction ? `GWS AI Recommendation: ${l2.recommendedAction}` : '',
      l2.gwsRelevanceScore  ? `GWS Relevance Score: ${l2.gwsRelevanceScore}/10` : '',
      l2.winProbabilityAssessment ? `Win Probability: ${l2.winProbabilityAssessment.split('—')[0].trim()}` : '',
      l2.scopeOfWork        ? `Scope of Work: ${l2.scopeOfWork.substring(0, 300)}${l2.scopeOfWork.length > 300 ? '...' : ''}` : '',
    ].filter(Boolean).join('\n');

    const geminiPrompt = `You are drafting a professional internal business email for GlassWing Solutions (GWS), a Mumbai-based multimodal logistics company.

SENDER: ${senderName} (${senderEmail}) — the person assigning this tender
RECIPIENT NAME: ${assigneeName}
RECIPIENT EMAIL: ${assigneeEmail}

Write a concise, professional HTML email body where ${senderName} assigns the following tender to ${assigneeName} and asks them to review it.

TENDER DETAILS:
${tenderDetails}

IMPORTANT LINKS (include these prominently):
- GWS Platform AI Analysis: ${analysisUrl}
- Original Tender on Tender247: ${detailUrl}

EMAIL REQUIREMENTS:
1. Start with: Dear ${assigneeName},
2. Brief intro — ${senderName} is assigning this tender for review and follow-up
3. A clean tender summary table with the key details above
4. Highlight the AI recommendation and relevance score if available
5. Ask them to review the full AI analysis at the platform link and the original tender at Tender247
6. Mention the due date urgently if it's within 2 weeks
7. Sign off professionally from ${senderName}, GlassWing Solutions

FORMATTING:
- Return ONLY the HTML email body (start with <div style="font-family:...)
- Use inline CSS only — clean, professional, corporate style
- Use a readable font, light background for the tender table, accent color #7c3aed (GWS brand)
- No markdown, no code fences, no explanation — pure HTML only`;

    let emailHtml = '';
    try {
      const { genkit }   = await import('genkit');
      const { googleAI } = await import('@genkit-ai/googleai');
      const ai = genkit({ plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })] });

      const result = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: geminiPrompt,
        config: { temperature: 0.4, maxOutputTokens: 2048 },
      });
      emailHtml = result.text.replace(/^```html?\s*/i, '').replace(/```\s*$/, '').trim();
    } catch (geminiErr) {
      console.error('[AssignOwner] Gemini error:', geminiErr);
      // Fallback: plain HTML email
      emailHtml = buildFallbackEmail(senderName, assigneeName, tender, l2, analysisUrl, detailUrl);
    }

    const emailSubject = `Tender Assignment: ${tender.title} [T247-${tender.tender_no}]`;

    // ── Send via Microsoft Graph API ──────────────────────────────────────
    const accessToken = session.accessToken;
    if (!accessToken) {
      return NextResponse.json<ApiResponse>({
        error: 'No Microsoft access token in session. Please sign out and sign back in to enable email sending.',
      }, { status: 401 });
    }

    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: emailSubject,
          body: {
            contentType: 'HTML',
            content: emailHtml,
          },
          toRecipients: [
            { emailAddress: { address: assigneeEmail } },
          ],
        },
        saveToSentItems: true,
      }),
    });

    if (!graphRes.ok) {
      const errText = await graphRes.text();
      console.error('[AssignOwner] Graph API error:', graphRes.status, errText);

      // Graph returns 403 if Mail.Send not consented, 401 if token expired
      if (graphRes.status === 401) {
        return NextResponse.json<ApiResponse>({
          error: 'Access token expired. Please sign out and sign back in, then try again.',
        }, { status: 401 });
      }
      if (graphRes.status === 403) {
        return NextResponse.json<ApiResponse>({
          error: 'Mail.Send permission not granted. An Azure AD admin needs to consent to this permission in the app registration.',
        }, { status: 403 });
      }
      return NextResponse.json<ApiResponse>({
        error: `Failed to send email via Outlook (${graphRes.status}). ${errText.substring(0, 200)}`,
      }, { status: 500 });
    }

    // ── Update DB ─────────────────────────────────────────────────────────
    await execute(
      'UPDATE tenders SET owner_email = ?, owner_assigned_at = NOW(), updated_at = NOW() WHERE id = ?',
      [assigneeEmail, id]
    );

    console.log(`[AssignOwner] Tender #${id} assigned to ${assigneeEmail} by ${senderEmail}`);

    return NextResponse.json<ApiResponse>({
      message: `Tender successfully assigned to ${assigneeEmail}. Email sent from your Outlook.`,
    });

  } catch (err) {
    console.error('[AssignOwner] Unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { error: (err as Error).message || 'Failed to assign owner' },
      { status: 500 }
    );
  }
}

/** Plain HTML email used if Gemini is unavailable */
function buildFallbackEmail(
  senderName: string,
  assigneeName: string,
  tender: Record<string, unknown>,
  l2: { recommendedAction?: string; gwsRelevanceScore?: number; scopeOfWork?: string },
  analysisUrl: string,
  detailUrl: string
): string {
  return `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
  <div style="background:linear-gradient(135deg,#7c3aed,#22d3ee);padding:24px 28px;border-radius:12px 12px 0 0">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.8">GlassWing Solutions — Internal</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700">Tender Assignment</h1>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px">
    <p>Dear ${assigneeName},</p>
    <p>I am assigning the following tender to you for review and follow-up. Please go through the details and the AI analysis at the earliest.</p>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px">
      <tr style="background:#f8fafc">
        <td style="padding:10px 14px;font-weight:600;color:#64748b;width:160px;border-bottom:1px solid #e2e8f0">Title</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${tender.title}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0">T247 ID</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">T247-${tender.tender_no}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px 14px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Issued By</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${tender.issued_by}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0">Est. Value</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${tender.estimated_value_raw || '—'}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px 14px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Due Date</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${tender.due_date ? new Date(tender.due_date as string).toLocaleDateString('en-IN') : '—'}</td>
      </tr>
      ${l2.recommendedAction ? `
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0">AI Recommendation</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#7c3aed">${l2.recommendedAction}</td>
      </tr>` : ''}
      ${l2.gwsRelevanceScore ? `
      <tr style="background:#f8fafc">
        <td style="padding:10px 14px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Relevance Score</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${l2.gwsRelevanceScore}/10</td>
      </tr>` : ''}
    </table>

    <p style="margin-top:20px;font-weight:600">Important Links:</p>
    <p>
      📊 <a href="${analysisUrl}" style="color:#7c3aed">View AI Analysis on GWS Platform</a><br>
      🔗 <a href="${detailUrl}" style="color:#0284c7">View Original Tender on Tender247</a>
    </p>

    <p>Please review and take the necessary action at the earliest. Let me know if you have any questions.</p>

    <p style="margin-top:24px">Best regards,<br><strong>${senderName}</strong><br>GlassWing Solutions</p>
  </div>
</div>`;
}
