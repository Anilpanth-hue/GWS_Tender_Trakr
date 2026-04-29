import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * POST /api/tenders/[id]/diagnose-docs
 *
 * Takes a screenshot of what Puppeteer sees on the tender detail page
 * and dumps all anchor tags found. Saves screenshot to public/debug-screenshot.png
 * so you can open it at http://localhost:3000/debug-screenshot.png
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tender = await queryOne<{ id: number; detail_url: string; tender_no: string }>(
      'SELECT id, detail_url, tender_no FROM tenders WHERE id = ?',
      [id]
    );
    if (!tender) return NextResponse.json<ApiResponse>({ error: 'Tender not found' }, { status: 404 });
    if (!tender.detail_url) return NextResponse.json<ApiResponse>({ error: 'No detail URL stored' }, { status: 400 });

    const settingRows = await query<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM scrape_settings WHERE setting_key IN (?, ?)',
      ['tender247_email', 'tender247_password']
    );
    const settings: Record<string, string> = {};
    for (const s of settingRows) settings[s.setting_key] = s.setting_value;

    if (!settings.tender247_email || !settings.tender247_password) {
      return NextResponse.json<ApiResponse>({ error: 'T247 credentials not configured' }, { status: 400 });
    }

    console.log(`[Diagnose] Starting for tender #${id}, URL: ${tender.detail_url}`);

    const { loginBrowser, closeBrowser } = await import('@/lib/scraper/tender247');
    const browser = await loginBrowser(settings.tender247_email, settings.tender247_password);
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1366, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

      // Forward browser console to server terminal
      page.on('console', msg => console.log(`[BrowserLog]`, msg.text()));

      // Navigate
      console.log(`[Diagnose] Navigating to: ${tender.detail_url}`);
      await page.goto(tender.detail_url, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 4000));

      // Scroll to bottom to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2000));

      // Screenshot — saved to public folder so it's accessible in browser
      const fs = await import('fs');
      const path = await import('path');
      const screenshotPath = path.join(process.cwd(), 'public', 'debug-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[Diagnose] Screenshot saved to ${screenshotPath}`);
      console.log(`[Diagnose] View at: http://localhost:3000/debug-screenshot.png`);

      // Dump all anchor tags
      const diagnosis = await page.evaluate(() => {
        const allAnchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).map(a => ({
          text: (a.textContent || '').trim().substring(0, 80),
          href: a.href.substring(0, 200),
          hrefAttr: a.getAttribute('href') || '',
        }));

        const allClickable = Array.from(document.querySelectorAll<HTMLElement>('a, button, [role="button"]'))
          .filter(el => /download|document|pdf|zip/i.test(el.textContent || el.getAttribute('aria-label') || ''))
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || '').trim().substring(0, 100),
            href: el instanceof HTMLAnchorElement ? el.href : '',
            hrefAttr: el instanceof HTMLAnchorElement ? (el.getAttribute('href') || '') : '',
            dataHref: el.getAttribute('data-href') || '',
            onclick: el.getAttribute('onclick') || '',
          }));

        // Find "Tender Documents" section
        let docSectionText = 'NOT FOUND';
        let docSectionAnchors: Array<{text: string; href: string}> = [];
        const allEls = Array.from(document.querySelectorAll('*'));
        for (const el of allEls) {
          const txt = (el.textContent || '').trim();
          if (/tender\s*documents?/i.test(txt) && el.children.length > 0 && txt.length < 200) {
            docSectionText = txt;
            docSectionAnchors = Array.from(el.querySelectorAll('a')).map(a => ({
              text: (a.textContent || '').trim(),
              href: (a as HTMLAnchorElement).href,
            }));
            break;
          }
        }

        return {
          pageTitle: document.title,
          pageUrl: window.location.href,
          isLoggedIn: !Array.from(document.querySelectorAll('button')).some(b => /log\s*in|sign\s*up/i.test(b.textContent || '')),
          totalAnchors: allAnchors.length,
          allAnchors,
          downloadElements: allClickable,
          docSection: { text: docSectionText, anchors: docSectionAnchors },
          bodySnippet: document.body.innerText.substring(0, 1000),
        };
      });

      console.log(`[Diagnose] Page: "${diagnosis.pageTitle}" | URL: ${diagnosis.pageUrl}`);
      console.log(`[Diagnose] Logged in: ${diagnosis.isLoggedIn} | Total anchors: ${diagnosis.totalAnchors}`);
      console.log(`[Diagnose] Download elements:`, JSON.stringify(diagnosis.downloadElements, null, 2));
      console.log(`[Diagnose] Doc section anchors:`, JSON.stringify(diagnosis.docSection, null, 2));

      return NextResponse.json({
        message: `Screenshot saved. Open http://localhost:3000/debug-screenshot.png to see what Puppeteer sees.`,
        data: diagnosis,
      });

    } finally {
      await page.close();
      await closeBrowser();
    }

  } catch (err) {
    console.error('[diagnose-docs]', err);
    return NextResponse.json<ApiResponse>({ error: (err as Error).message }, { status: 500 });
  }
}
