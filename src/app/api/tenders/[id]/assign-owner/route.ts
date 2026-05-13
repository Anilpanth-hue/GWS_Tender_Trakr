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

    // ── Build email ───────────────────────────────────────────────────────
    const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
    const analysisUrl = `${appUrl}/analysis/${id}`;
    const detailUrl   = (tender.detail_url as string) || '';

    const senderName  = session.user.name || session.user.email;
    const senderEmail = session.user.email;

    // Extract assignee's first name from email (e.g. "john.doe@glasswing.in" → "John")
    const assigneeFirstName = assigneeEmail.split('@')[0].split('.')[0];
    const assigneeName = assigneeFirstName.charAt(0).toUpperCase() + assigneeFirstName.slice(1);

    // Always use the reliable template — Gemini was returning incomplete responses
    const emailHtml = buildAssignmentEmail(senderName, senderEmail, assigneeName, tender, l2, analysisUrl, detailUrl);

    const emailSubject = `Tender Assignment: ${tender.title} [T247-${tender.tender_no}]`;

    // ── Validate DB schema before sending email ───────────────────────────
    // Fail fast if migration hasn't been run — avoids sending email then crashing on DB update
    try {
      await execute(
        'UPDATE tenders SET owner_email = ?, owner_assigned_at = NOW(), assigned_by_email = ?, assigned_by_name = ?, updated_at = NOW() WHERE id = ?',
        [assigneeEmail, senderEmail, session.user.name || senderEmail, id]
      );
    } catch (dbErr) {
      const msg = (dbErr as Error).message || '';
      if (msg.includes('Unknown column')) {
        return NextResponse.json<ApiResponse>({
          error: 'Database schema is outdated on this machine. Please call POST /api/admin/run-migration once, then try again.',
        }, { status: 500 });
      }
      throw dbErr;
    }

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
            contentType: 'html',
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

/** Reliable HTML assignment email — all key info guaranteed present */
function buildAssignmentEmail(
  senderName: string,
  senderEmail: string,
  assigneeName: string,
  tender: Record<string, unknown>,
  l2: { recommendedAction?: string; gwsRelevanceScore?: number; scopeOfWork?: string; winProbabilityAssessment?: string },
  analysisUrl: string,
  detailUrl: string
): string {
  // Derive org name from sender's email domain: "rajeev@glasswing.in" → "Glasswing"
  const domainPart = senderEmail.split('@')[1] ?? '';
  const orgName = domainPart.split('.')[0];
  const orgDisplay = orgName.charAt(0).toUpperCase() + orgName.slice(1);

  const dueDate = tender.due_date
    ? new Date(tender.due_date as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  // Warn if due date is within 14 days
  const daysUntilDue = tender.due_date
    ? Math.ceil((new Date(tender.due_date as string).getTime() - Date.now()) / 86400000)
    : null;
  const urgentBanner = daysUntilDue !== null && daysUntilDue <= 14
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-bottom:20px;color:#b91c1c;font-size:13px;font-weight:600">
        ⚠️ Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} — please act urgently.
       </div>`
    : '';

  const aiRows = [
    l2.recommendedAction ? `
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:160px">AI Recommendation</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#7c3aed">${l2.recommendedAction}</td>
      </tr>` : '',
    l2.gwsRelevanceScore ? `
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;width:160px">Relevance Score</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${l2.gwsRelevanceScore}/10</td>
      </tr>` : '',
    l2.winProbabilityAssessment ? `
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:160px">Win Probability</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${l2.winProbabilityAssessment.split('—')[0].trim()}</td>
      </tr>` : '',
  ].filter(Boolean).join('');

  return `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px 28px;border-radius:12px 12px 0 0">
    <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;text-transform:uppercase;letter-spacing:0.05em">${orgDisplay} — Internal</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700">📋 Tender Assignment</h1>
  </div>

  <!-- Body -->
  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 32px">

    <p style="margin:0 0 6px">Dear <strong>${assigneeName}</strong>,</p>
    <p style="margin:0 0 20px;color:#475569">
      <strong>${senderName}</strong> (<a href="mailto:${senderEmail}" style="color:#7c3aed">${senderEmail}</a>) has assigned the following tender to you for review and follow-up.
      Please go through the details and the AI analysis at the earliest.
    </p>

    ${urgentBanner}

    <!-- Tender details table -->
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:160px">Title</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600">${tender.title}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;width:160px">T247 ID</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">T247-${tender.tender_no}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:160px">Issued By</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${tender.issued_by || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;width:160px">Location</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${tender.location || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:160px">Est. Value</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a">${tender.estimated_value_raw || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#64748b;border-bottom:${aiRows ? '1px solid #e2e8f0' : 'none'};width:160px">Due Date</td>
        <td style="padding:10px 14px;border-bottom:${aiRows ? '1px solid #e2e8f0' : 'none'};font-weight:600;color:${daysUntilDue !== null && daysUntilDue <= 14 ? '#b91c1c' : '#0f172a'}">${dueDate}</td>
      </tr>
      ${aiRows}
    </table>

    <!-- Action links -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td style="padding:0 8px 0 0;width:50%">
          <a href="${analysisUrl}"
             style="display:block;text-align:center;padding:12px 16px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">
            📊 View AI Analysis on GWS Platform
          </a>
        </td>
        <td style="padding:0 0 0 8px;width:50%">
          <a href="${detailUrl}"
             style="display:block;text-align:center;padding:12px 16px;background:#0284c7;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">
            🔗 View Tender on Tender247
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;color:#475569;font-size:13px">
      Please review and take the necessary action. Feel free to reach out if you have any questions.
    </p>

    <p style="margin:0;border-top:1px solid #e2e8f0;padding-top:20px;font-size:13px">
      Best regards,<br>
      <strong>${senderName}</strong><br>
      <span style="color:#64748b">${orgDisplay}</span>
    </p>
  </div>
</div>`;
}
