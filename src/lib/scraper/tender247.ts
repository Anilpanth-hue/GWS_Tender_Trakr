import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import type { RawTender, ScrapeSession } from '@/types';

const BASE_URL = 'https://www.tender247.com';
const TENDERS_URL = `${BASE_URL}/tenders`;

// How many scroll steps to do when loading more items (infinite scroll)
const MAX_SCROLL_ROUNDS = 10; // ~150 tenders max per scrape run

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1366,768',
    ],
  });
  return browserInstance;
}

export function getBrowserInstance(): Browser | null {
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Launch a browser, log into Tender247, and return the logged-in browser instance.
 * Use this when you need a fresh authenticated session outside of a scrape run.
 */
export async function loginBrowser(email: string, password: string): Promise<Browser> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  const ok = await login(page, email, password);
  await page.close();
  if (!ok) throw new Error('Tender247 login failed — check credentials in Settings.');
  return browser;
}

/** Fill a React-controlled input using the native value setter so React picks up the change */
async function fillReactInput(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate((sel: string, val: string) => {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (!el) return;
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    nativeInputSetter?.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
}

async function login(page: Page, email: string, password: string): Promise<boolean> {
  try {
    console.log('[Scraper] Navigating to Tender247 homepage...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    console.log('[Scraper] Opening login dialog...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'));
      const loginBtn = btns.find(b => /sign\s*up|log\s*in/i.test(b.textContent || ''));
      loginBtn?.click();
    });

    await page.waitForSelector('input[name="emailId"], input[type="email"]', {
      timeout: 15000,
      visible: true,
    });
    await new Promise(r => setTimeout(r, 500));

    console.log('[Scraper] Filling credentials...');
    await fillReactInput(page, 'input[name="emailId"], input[type="email"]', email);
    await new Promise(r => setTimeout(r, 200));
    await fillReactInput(page, 'input[type="password"]', password);
    await new Promise(r => setTimeout(r, 200));

    // Click submit button inside the dialog
    const submitted = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!submitted) await page.keyboard.press('Enter');

    // Wait for dialog to close
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 10000 }),
    ]).catch(() => {});

    await new Promise(r => setTimeout(r, 2000));

    const isLoggedIn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'));
      return !btns.some(b => /sign\s*up|log\s*in/i.test(b.textContent || ''));
    });

    console.log(`[Scraper] Login ${isLoggedIn ? '✅ successful' : '❌ failed'}`);
    return isLoggedIn;
  } catch (err) {
    console.error('[Scraper] Login error:', err);
    return false;
  }
}

function parseValue(valueStr: string): number | null {
  if (!valueStr) return null;
  const clean = valueStr.replace(/[₹,\s]/g, '').toLowerCase();
  if (clean.includes('cr') || clean.includes('crore')) {
    const num = parseFloat(clean.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) return Math.round(num * 10000000);
  }
  if (clean.includes('l') || clean.includes('lakh')) {
    const num = parseFloat(clean.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) return Math.round(num * 100000);
  }
  const num = parseFloat(clean.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : Math.round(num);
}

function parseDateDMY(dateStr: string): string | null {
  if (!dateStr) return null;
  // Handle DD-MM-YYYY format from Tender247
  const dmyMatch = dateStr.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Fallback: try ISO/standard parsing
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch { /* ignore */ }
  return null;
}

type RawItemData = {
  t247Id: string;
  title: string;
  bidValueRaw: string;
  emdRaw: string;
  dueDate: string;
  orgLocation: string;
  detailPath: string;
};

/**
 * Extract all tender items currently visible in the DOM.
 * Tender247 uses Tailwind utility classes — no semantic class names.
 * Items are identified by their card container class signature.
 */
async function extractVisibleTenders(page: Page): Promise<RawItemData[]> {
  return page.evaluate(() => {
    const results: Array<{
      t247Id: string;
      title: string;
      bidValueRaw: string;
      emdRaw: string;
      dueDate: string;
      orgLocation: string;
      detailPath: string;
    }> = [];

    // Each tender card has 'bg-[#fff]' and 'mt-[10px]' and 'border-[#D4D4D4]' in class
    const allDivs = Array.from(document.querySelectorAll('div'));
    const cards = allDivs.filter(div => {
      const cls = div.className || '';
      return cls.includes('bg-[#fff]') && cls.includes('mt-[10px]') && cls.includes('border-[#D4D4D4]');
    });

    for (const card of cards) {
      // T247 ID: text of h3 element containing "T247 ID-" span
      let t247Id = '';
      const h3Els = Array.from(card.querySelectorAll('h3'));
      for (const h3 of h3Els) {
        if (h3.textContent?.includes('T247 ID')) {
          // Text after the span "T247 ID-" is the ID number
          const rawText = h3.textContent || '';
          const match = rawText.match(/T247\s*ID[-–]\s*(\d+)/);
          if (match) t247Id = match[1];
          break;
        }
      }
      if (!t247Id) continue; // Not a tender card

      // Title: first span.cursor-pointer inside a <p> tag
      const titleEl = card.querySelector('p span.cursor-pointer, p[class*="capitalize"] span');
      const title = titleEl?.textContent?.trim() || '';

      // Bid Value: span containing "Bid Value:" then sibling div
      let bidValueRaw = '';
      for (const h3 of h3Els) {
        if (h3.textContent?.includes('Bid Value:')) {
          const valueDiv = h3.querySelector('div');
          bidValueRaw = valueDiv?.textContent?.replace(/\|/g, '').trim() || '';
          break;
        }
      }

      // EMD: span containing "EMD:" then sibling div
      let emdRaw = '';
      for (const h3 of h3Els) {
        if (h3.textContent?.includes('EMD:') && !h3.textContent?.includes('Bid Value')) {
          const valueDiv = h3.querySelector('div');
          emdRaw = valueDiv?.textContent?.replace(/\|/g, '').trim() || '';
          break;
        }
      }

      // Due Date: DD-MM-YYYY pattern in any h3 (the one with clock icon)
      let dueDate = '';
      for (const h3 of h3Els) {
        const match = h3.textContent?.match(/(\d{2}-\d{2}-\d{4})/);
        if (match) { dueDate = match[1]; break; }
      }

      // Organization/Location: text in the location row (after location pin SVG)
      // It's in a div with a span containing the org name + location, then "| AI summary" link
      let orgLocation = '';
      const locContainer = card.querySelector('div[class*="text-[#121212]"][class*="float-left"] span');
      if (locContainer) {
        orgLocation = locContainer.textContent?.trim() || '';
      }

      // Detail URL: first try inside the card, then fall back to a document-wide
      // search by t247Id (some cards wrap the link outside their boundary)
      const linkInCard = card.querySelector<HTMLAnchorElement>('a[href*="/auth/tender/"]');
      const linkInDoc = !linkInCard && t247Id
        ? document.querySelector<HTMLAnchorElement>(`a[href*="/auth/tender/${t247Id}/"]`)
        : null;
      const detailPath = (linkInCard || linkInDoc)?.getAttribute('href') || '';

      results.push({ t247Id, title, bidValueRaw, emdRaw, dueDate, orgLocation, detailPath });
    }

    return results;
  });
}

async function scrapeTendersWithScroll(
  page: Page,
  url: string,
  session: ScrapeSession,
  maxTenders: number
): Promise<RawTender[]> {
  console.log(`[Scraper] Navigating to: ${url} (limit: ${maxTenders})`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Wait for first item to appear
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('a[href*="/auth/tender/"]').length > 0,
      { timeout: 20000 }
    );
  } catch {
    console.log('[Scraper] No tender items loaded on this page');
    return [];
  }

  const seenIds = new Set<string>();
  const allTenders: RawTender[] = [];

  for (let round = 0; round < MAX_SCROLL_ROUNDS; round++) {
    const items = await extractVisibleTenders(page);
    let newCount = 0;

    for (const item of items) {
      if (seenIds.has(item.t247Id)) continue;
      seenIds.add(item.t247Id);
      newCount++;

      allTenders.push({
        tenderNo: item.t247Id,
        title: item.title,
        issuedBy: item.orgLocation.split('-')[0]?.trim() || item.orgLocation,
        location: item.orgLocation.split('-').slice(1).join('-').trim(),
        estimatedValueRaw: item.bidValueRaw,
        estimatedValue: parseValue(item.bidValueRaw),
        dueDate: parseDateDMY(item.dueDate),
        publishedDate: null,
        category: '',
        detailUrl: item.detailPath ? `${BASE_URL}${item.detailPath}` : '',
        sourceSession: session,
      });

      // Stop as soon as we hit the limit
      if (allTenders.length >= maxTenders) {
        console.log(`[Scraper] Reached max tenders limit (${maxTenders}), stopping`);
        return allTenders;
      }
    }

    console.log(`[Scraper] Round ${round + 1}: ${items.length} visible, ${newCount} new (total: ${allTenders.length})`);

    if (newCount === 0) {
      console.log('[Scraper] No new items after scroll, stopping');
      break;
    }

    // Scroll down to trigger infinite scroll loading
    const prevHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2500));

    // Check if more content loaded
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === prevHeight) {
      console.log('[Scraper] Page height unchanged after scroll, no more items');
      break;
    }
  }

  return allTenders;
}

export interface TenderDocumentResult {
  pdfFileName: string | null;
  pdfFilePath: string | null;
  pdfPublicPath: string | null;
  pdfFileSize: number | null;
  fullDocsUrl: string | null;
}

/**
 * Within an already-logged-in browser session, visit a tender's detail page
 * and download the AI Summary PDF + capture the full-documents ZIP URL.
 *
 * Four strategies run in order — whichever fires first wins for the PDF:
 *   A. CDP download behavior   — browser saves download to disk automatically
 *   B. Response interception   — captures application/pdf response body directly
 *   C. Request interception    — captures outgoing request, replays with Node fetch
 *   D. DOM link scan           — finds <a href="...documents.tender247..."> without clicking
 */
export async function fetchTenderDocuments(
  browser: Browser,
  tenderId: number,
  detailUrl: string
): Promise<TenderDocumentResult> {
  const downloadDir = path.resolve(process.cwd(), 'public', 'documents', String(tenderId));
  fs.mkdirSync(downloadDir, { recursive: true });

  const PDF_NAME = `Tender-Summary-${tenderId}.pdf`;
  const page = await browser.newPage();
  let pdfFileName: string | null = null;
  let fullDocsUrl: string | null = null;

  // Mutable state set by async event handlers
  // (use object wrapper so TypeScript narrowing works correctly)
  const state = {
    pdfBuffer: null as Buffer | null,
    pdfReq: null as { url: string; method: string; headers: Record<string, string>; postData: string | undefined } | null,
    cdpDownloadDone: false,
    cdpFilename: '',
  };

  try {
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // ── Strategy A: CDP auto-download (most reliable for file downloads) ──────
    // Puppeteer 24.x: Browser.setDownloadBehavior saves triggered downloads to disk.
    let cdpSession: Awaited<ReturnType<typeof page.createCDPSession>> | null = null;
    try {
      cdpSession = await page.createCDPSession();
      await cdpSession.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: path.resolve(downloadDir),
        eventsEnabled: true,
      });
      cdpSession.on('Browser.downloadWillBegin', (evt: { suggestedFilename?: string }) => {
        state.cdpFilename = evt.suggestedFilename || '';
        console.log(`[Scraper] CDP download starting: "${state.cdpFilename}" for #${tenderId}`);
      });
      cdpSession.on('Browser.downloadProgress', (evt: { state: string }) => {
        if (evt.state === 'completed') {
          state.cdpDownloadDone = true;
          console.log(`[Scraper] ✓ CDP download completed: "${state.cdpFilename}" for #${tenderId}`);
        } else if (evt.state === 'canceled') {
          console.warn(`[Scraper] CDP download canceled for #${tenderId}`);
        }
      });
      console.log(`[Scraper] CDP download behavior set for #${tenderId} → ${downloadDir}`);
    } catch (cdpErr) {
      console.warn(`[Scraper] CDP setup failed (non-fatal):`, (cdpErr as Error).message);
    }

    // ── Strategy B: Response interception (PDF content-type) ─────────────────
    page.on('response', async response => {
      if (state.pdfBuffer) return;
      const ct = response.headers()['content-type'] || '';
      const url = response.url();
      const isPdf = ct.includes('application/pdf')
        || ct.includes('application/octet-stream')
        || (url.toLowerCase().includes('.pdf') && response.status() === 200);
      if (isPdf) {
        try {
          const buf = await response.buffer();
          if (buf.length > 3000) {
            state.pdfBuffer = buf;
            console.log(`[Scraper] ✓ PDF response captured (${Math.round(buf.length / 1024)}KB) for #${tenderId}`);
          }
        } catch { /* browser may have consumed response already */ }
      }
    });

    // ── Strategy C: Request interception — capture outgoing PDF API call ──────
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      const method = req.method();

      // Match any PDF-generation API endpoint
      const isPdfCall =
        /pdf[\-_]?download|download[\-_]?pdf|generate[\-_]?pdf|ai[\-_]?summary|tender[\-_]?pdf/i.test(url)
        || (method === 'POST' && /pdf|summary/i.test(url));
      if (isPdfCall && !state.pdfReq) {
        state.pdfReq = { url, method, headers: { ...req.headers() }, postData: req.postData() ?? undefined };
        console.log(`[Scraper] ✓ PDF ${method} request captured: ${url.substring(0, 100)} for #${tenderId}`);
      }

      // Capture full-docs ZIP URL (any request to documents.tender247.com)
      if (/documents\.tender247\.com/i.test(url) || /download-document-all|all-documents/i.test(url)) {
        if (!fullDocsUrl) {
          fullDocsUrl = url;
          console.log(`[Scraper] ✓ Full-docs URL captured for #${tenderId}: ${url.substring(0, 100)}`);
        }
      }

      req.continue();
    });

    // ── Navigate to detail page ───────────────────────────────────────────────
    console.log(`[Scraper] Loading detail page for #${tenderId}: ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    // ── Diagnostics: log what's on the page ──────────────────────────────────
    const pageInfo = await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('button, a'))
        .map(el => (el.textContent || '').trim().replace(/\s+/g, ' '))
        .filter(t => t.length > 1 && t.length < 80)
        .slice(0, 30);
      const allLinks = Array.from(document.querySelectorAll('a[href]'))
        .map(el => (el as HTMLAnchorElement).href)
        .filter(h => h.length > 10)
        .slice(0, 20);
      return { buttons: allBtns, links: allLinks };
    });
    console.log(`[Scraper] #${tenderId} buttons: ${pageInfo.buttons.join(' | ')}`);

    // ── Strategy D: DOM link scan (no click needed) ───────────────────────────
    for (const href of pageInfo.links) {
      if (/documents\.tender247\.com/i.test(href) && !fullDocsUrl) {
        fullDocsUrl = href;
        console.log(`[Scraper] ✓ Full-docs URL from DOM: ${href.substring(0, 100)}`);
      }
    }

    // ── Record files already in downloadDir before clicking ───────────────────
    const preClickFiles = new Set(fs.existsSync(downloadDir) ? fs.readdirSync(downloadDir) : []);

    // ── Click PDF download button ─────────────────────────────────────────────
    const PDF_RE = /pdf\s*download|download\s*pdf|ai\s*summary|tender\s*summary|summary\s*(pdf|report)|ai\s*(pdf|report)/i;

    const pdfBtnText = await page.evaluate((reSource: string) => {
      const re = new RegExp(reSource, 'i');
      // Search all clickable elements broadly
      const candidates = Array.from(document.querySelectorAll(
        'button, a, [role="button"], span[class*="cursor"], div[class*="cursor"]'
      ));
      const el = candidates.find(e => re.test((e.textContent || '').trim()));
      if (el) {
        (el as HTMLElement).click();
        return (el.textContent || '').trim().substring(0, 60);
      }
      return '';
    }, PDF_RE.source);

    if (pdfBtnText) {
      console.log(`[Scraper] Clicked PDF button: "${pdfBtnText}" for #${tenderId}`);

      // Wait up to 20s for PDF via any of the three strategies
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (state.pdfBuffer || state.pdfReq || state.cdpDownloadDone) break;
        // Also poll disk for new file (CDP strategy)
        const nowFiles = fs.existsSync(downloadDir) ? fs.readdirSync(downloadDir) : [];
        const newFile = nowFiles.find(f => !preClickFiles.has(f) && !f.endsWith('.crdownload'));
        if (newFile) { state.cdpFilename = newFile; state.cdpDownloadDone = true; break; }
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      console.warn(`[Scraper] ✗ No PDF button matched "${PDF_RE}" for #${tenderId}`);
      console.warn(`[Scraper]   Available buttons: ${pageInfo.buttons.slice(0, 10).join(', ')}`);
    }

    // ── Save PDF — whichever strategy fired ───────────────────────────────────

    if (state.pdfBuffer) {
      // Strategy B: direct response buffer
      fs.writeFileSync(path.join(downloadDir, PDF_NAME), state.pdfBuffer);
      pdfFileName = PDF_NAME;
      console.log(`[Scraper] ✓ PDF saved (response) for #${tenderId}: ${Math.round(state.pdfBuffer.length / 1024)}KB`);

    } else if (state.cdpDownloadDone && state.cdpFilename) {
      // Strategy A: CDP auto-download — file already on disk
      const src = path.join(downloadDir, state.cdpFilename);
      const dst = path.join(downloadDir, PDF_NAME);
      if (fs.existsSync(src)) {
        if (src !== dst) fs.renameSync(src, dst);
        pdfFileName = PDF_NAME;
        const sz = fs.statSync(dst).size;
        console.log(`[Scraper] ✓ PDF saved (CDP) for #${tenderId}: ${state.cdpFilename} → ${PDF_NAME} (${Math.round(sz / 1024)}KB)`);
      }

    } else if (state.pdfReq) {
      // Strategy C: replicate outgoing request with Node.js fetch
      const req = state.pdfReq;
      const SKIP = new Set(['host', 'content-length', 'transfer-encoding', 'connection']);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!SKIP.has(k.toLowerCase())) headers[k] = String(v);
      }
      try {
        const res = await fetch(req.url, { method: req.method, headers, body: req.postData });
        console.log(`[Scraper] Request replay → HTTP ${res.status} for #${tenderId}`);
        if (res.status === 200 || res.status === 201) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 2000) {
            fs.writeFileSync(path.join(downloadDir, PDF_NAME), buf);
            pdfFileName = PDF_NAME;
            console.log(`[Scraper] ✓ PDF saved (replay) for #${tenderId}: ${Math.round(buf.length / 1024)}KB`);
          } else {
            console.warn(`[Scraper] Replay PDF too small (${buf.length}B) — likely an error response`);
          }
        } else {
          const errText = await res.text().catch(() => '');
          console.warn(`[Scraper] Replay → HTTP ${res.status}: ${errText.substring(0, 150)}`);
        }
      } catch (e) {
        console.warn(`[Scraper] Replay fetch failed:`, (e as Error).message);
      }

    } else {
      console.warn(`[Scraper] ✗ No PDF obtained for #${tenderId} — button may need subscription or page structure changed`);
    }

    // ── Click "Download All Documents" if ZIP URL still missing ───────────────
    if (!fullDocsUrl) {
      const DOCS_RE = /download\s*all\s*documents?|all\s*tender\s*documents?|download\s*documents/i;
      const docsClicked = await page.evaluate((reSource: string) => {
        const re = new RegExp(reSource, 'i');
        const el = Array.from(document.querySelectorAll('button, a, span'))
          .find(e => re.test(e.textContent || ''));
        if (el) { (el as HTMLElement).click(); return (el.textContent || '').trim(); }
        return '';
      }, DOCS_RE.source);
      if (docsClicked) {
        console.log(`[Scraper] Clicked full-docs button: "${docsClicked}" for #${tenderId}`);
        await new Promise(r => setTimeout(r, 5000)); // wait for redirect/request
      }
    }

    const pdfFilePath = pdfFileName ? path.join(downloadDir, pdfFileName) : null;
    const pdfPublicPath = pdfFileName ? `/documents/${tenderId}/${pdfFileName}` : null;
    const pdfFileSize = pdfFilePath && fs.existsSync(pdfFilePath)
      ? fs.statSync(pdfFilePath).size : null;

    console.log(`[Scraper] #${tenderId} DONE → PDF: ${pdfFileName || '✗ none'} | ZIP: ${fullDocsUrl ? '✓' : '✗ none'}`);
    return { pdfFileName, pdfFilePath, pdfPublicPath, pdfFileSize, fullDocsUrl };

  } catch (err) {
    console.error(`[Scraper] fetchTenderDocuments error for #${tenderId}:`, (err as Error).message);
    return { pdfFileName: null, pdfFilePath: null, pdfPublicPath: null, pdfFileSize: null, fullDocsUrl: null };
  } finally {
    await page.close();
  }
}

/** Result of fetching a single tender by its T247 ID */
export interface SingleTenderResult {
  rawTender: RawTender;
  overview: {
    t247Id: string;
    orgTenderId: string;
    estimatedCost: string;
    emdValue: string;
    documentFees: string;
    completionPeriod: string;
    siteLocation: string;
    contactPerson: string;
    contactAddress: string;
    quantity: string;
    msmeExemption: string;
    startupExemption: string;
    jvConsortium: string;
    performanceBankGuarantee: string;
    hardCopySubmission: string;
    eligibilityCriteria: string;
    pqcSummary: string;
    fullSummaryText: string;
    fetchedAt: string;
  };
}

/**
 * Parse a date that could be DD/MM/YYYY or DD-MM-YYYY format.
 */
function parseDateFlexible(dateStr: string): string | null {
  if (!dateStr) return null;
  // Replace slashes with dashes for unified handling
  const normalised = dateStr.trim().replace(/\//g, '-');
  return parseDateDMY(normalised);
}

/**
 * Extract structured data from a Tender247 tender detail page.
 *
 * Tender247 page quirks:
 *  • A floating chat-support widget has an <h1> with support contact info — not the tender title
 *  • A sidebar banner "AUTOMATE BIDS, POWERED BY AI" appears in h2/h3 — also not the tender title
 *  • The real structured data is in the "AI Generated Tender Summary" grid section
 *  • The generic full-body regex scan causes false-positive field matches — removed
 */
async function extractTenderDetailPage(page: Page, t247Id: string): Promise<SingleTenderResult['overview'] & {
  title: string;
  bidValueRaw: string;
  dueDate: string;
  issuedBy: string;
  location: string;
}> {
  return page.evaluate((tid: string) => {

    // ── Text filters ──────────────────────────────────────────────────────────
    /** Returns true if this text is from a known non-tender UI element */
    function isJunk(text: string): boolean {
      return /complaint|report here|call\s*:-|free\s*call|chat\s*support|automate\s*bids|powered\s*by\s*ai|sign\s*up|log\s*in|subscribe|download\s*app|sign\s*in\s*to\s*unlock|unlock|login\s*to\s*view/i.test(text)
        || /\d{8,}/.test(text); // phone numbers
    }

    // ── findLabelValue: structured lookup only (no full-body regex scan) ──────
    // Searches table rows and adjacent-element grid patterns.
    // The regex body scan was removed — it caused false positives like
    // "Organisation Name" matching contact-address paragraphs on the page.
    function findLabelValue(label: string): string {
      const labelLower = label.toLowerCase();

      // 1) <table> row: <td>Label</td><td>Value</td>
      for (const td of Array.from(document.querySelectorAll('td, th'))) {
        const tdText = (td.textContent || '').trim().toLowerCase();
        if (tdText === labelLower || tdText.startsWith(labelLower + ':') || tdText.startsWith(labelLower + ' ')) {
          const next = td.nextElementSibling;
          if (next) {
            const val = (next.textContent || '').trim().replace(/\s+/g, ' ');
            if (val && val.length < 600 && !isJunk(val)) return val;
          }
        }
      }

      // 2) CSS grid / flex pattern: sibling elements where one is a label, next is the value
      //    Tender247's AI Summary uses this layout for its 2-column key-value grid.
      for (const el of Array.from(document.querySelectorAll('div, span, p'))) {
        // Must be a leaf-ish element (few children, short text = likely a label cell)
        if (el.children.length > 1) continue;
        const text = (el.textContent || '').trim();
        const textLower = text.toLowerCase();
        if (textLower !== labelLower &&
            !textLower.startsWith(labelLower + ':') &&
            !textLower.startsWith(labelLower + ' ')) continue;
        if (text.length > labelLower.length + 5) continue; // too long, probably a paragraph

        // Next sibling in same parent (grid cell)
        const parent = el.parentElement;
        if (!parent) continue;
        const siblings = Array.from(parent.children);
        const idx = siblings.indexOf(el);
        for (let offset = 1; offset <= 2 && idx + offset < siblings.length; offset++) {
          const candidate = siblings[idx + offset] as HTMLElement;
          const val = (candidate.textContent || '').trim().replace(/\s+/g, ' ');
          if (val && val.length > 0 && val.length < 600 && !isJunk(val)) return val;
        }

        // Parent's next sibling (label in one div, value in next div)
        const parentNext = parent.nextElementSibling;
        if (parentNext) {
          const val = (parentNext.textContent || '').trim().replace(/\s+/g, ' ');
          if (val && val.length > 0 && val.length < 600 && !isJunk(val)) return val;
        }
      }

      return '';
    }

    // ── Locate the AI Summary section ────────────────────────────────────────
    // Tender247 detail pages have an "AI Generated Tender Summary / Eligibility Criteria"
    // section with a 2-column grid. This is the most reliable data source on the page.
    let summaryRoot: Element | null = null;
    for (const el of Array.from(document.querySelectorAll('div, section'))) {
      const heading = (el.querySelector('h2, h3, h4') || el).textContent || '';
      if (/AI Generated|Tender Summary|Eligibility Criteria/i.test(heading) && el.querySelectorAll('div').length > 5) {
        summaryRoot = el;
        break;
      }
    }

    /** Look up a label in the AI Summary section FIRST, then fall back to whole page */
    function smartLookup(...labels: string[]): string {
      if (summaryRoot) {
        for (const label of labels) {
          const labelLower = label.toLowerCase();
          for (const el of Array.from(summaryRoot.querySelectorAll('div, span, td'))) {
            if (el.children.length > 1) continue;
            const text = (el.textContent || '').trim().toLowerCase();
            if (text === labelLower || text.startsWith(labelLower + ':')) {
              const parent = el.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children);
                const idx = siblings.indexOf(el);
                for (let off = 1; off <= 2 && idx + off < siblings.length; off++) {
                  const val = ((siblings[idx + off] as HTMLElement).textContent || '').trim().replace(/\s+/g, ' ');
                  if (val && !isJunk(val) && val.length < 600) return val;
                }
              }
              const next = (el as HTMLElement).nextElementSibling;
              if (next) {
                const val = (next.textContent || '').trim().replace(/\s+/g, ' ');
                if (val && !isJunk(val) && val.length < 600) return val;
              }
            }
          }
        }
      }
      for (const label of labels) {
        const v = findLabelValue(label);
        if (v) return v;
      }
      return '';
    }

    // ── Title ─────────────────────────────────────────────────────────────────
    // Priority:
    //  1) "Description" field from the AI Summary table (most reliable)
    //  2) document.title stripped of site name
    //  3) h1 elements, skipping chat widget and promo banners
    //  4) h2/h3 elements, skipping junk

    let title = smartLookup('Description', 'Tender Description', 'Work Description', 'Subject');

    if (!title || title.length < 10) {
      // Try document.title: "Tender Name | Tender247.com"
      const docTitle = document.title
        .replace(/\s*[|\-–]\s*tender247.*$/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();
      if (docTitle.length >= 15 && !isJunk(docTitle)) title = docTitle;
    }

    if (!title || title.length < 10) {
      for (const h of Array.from(document.querySelectorAll('h1'))) {
        const t = (h.textContent || '').trim();
        if (t.length >= 15 && t.length <= 600 && !isJunk(t)) { title = t; break; }
      }
    }

    if (!title || title.length < 10) {
      for (const h of Array.from(document.querySelectorAll('h2, h3'))) {
        const t = (h.textContent || '').trim();
        if (t.length >= 20 && t.length <= 500 && !isJunk(t) && !/T247|₹|\d{5,}/.test(t)) {
          title = t; break;
        }
      }
    }

    // ── Issuing organisation ──────────────────────────────────────────────────
    // "Department Name" is the correct Tender247 label (visible in AI Summary table)
    const issuedBy = smartLookup(
      'Department Name', 'Organisation Name', 'Organization Name',
      'Organization', 'Department', 'Tendering Authority', 'Issuer'
    );

    // ── Estimated value ───────────────────────────────────────────────────────
    let bidValueRaw = smartLookup('Estimated Cost', 'Bid Value', 'Contract Value', 'Tender Value', 'Cost');
    // Numeric-only response (e.g. "82,84,56,741") → prefix with ₹
    if (bidValueRaw && /^[\d,]+$/.test(bidValueRaw.trim())) bidValueRaw = `₹${bidValueRaw}`;
    if (!bidValueRaw) {
      const m = document.body.innerText.match(/₹\s?[\d,.]+\s*(?:Cr|Crore|Lakh|L)?/i);
      if (m) bidValueRaw = m[0].trim();
    }

    // ── Due / bid opening date ────────────────────────────────────────────────
    let dueDate = smartLookup('Bid Opening Date', 'Bid Submission', 'Due Date', 'Last Date', 'Closing Date');
    // Strip time/extra text — keep only the date part
    if (dueDate) dueDate = dueDate.split(/\s+/)[0].replace(/[^\d\/\-]/g, '');
    if (!dueDate) {
      const dm = document.body.innerText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
      if (dm) dueDate = dm[1];
    }

    // ── Location ─────────────────────────────────────────────────────────────
    const location = smartLookup('Site Location', 'State', 'Location', 'District');

    // ── Overview fields ───────────────────────────────────────────────────────
    const orgTenderId      = smartLookup('Tender ID', 'Organisation Tender ID', 'Tender Reference', 'Ref No');
    const emdValue         = smartLookup('EMD', 'Earnest Money Deposit', 'Earnest Money');
    const documentFees     = smartLookup('Document Fee', 'Document Fees', 'Tender Fee');
    const completionPeriod = smartLookup('Completion Period', 'Contract Period', 'Duration', 'Period');
    const contactPerson    = smartLookup('Contact Person', 'Officer', 'Contact');
    const contactAddress   = smartLookup('Contact Address', 'Address');
    const quantity         = smartLookup('Quantity');
    const msmeExemption    = smartLookup('MSME Exemption', 'MSE Exemption', 'MSME');
    const startupExemption = smartLookup('Startup Exemption', 'Startup');
    const jvConsortium     = smartLookup('JV / Consortium', 'Consortium', 'Joint Venture', 'JV');
    const pbg              = smartLookup('Performance Bank Guarantee', 'PBG');
    const hardCopy         = smartLookup('Hard Copy', 'Hard Copy Submission');
    const eligibility      = smartLookup('Eligibility Criteria', 'Eligibility');
    const pqcSummary       = smartLookup('Pre Qualification', 'PQC', 'Pre-Qualification');

    // ── Full AI summary text ──────────────────────────────────────────────────
    const fullSummaryText = summaryRoot
      ? (summaryRoot.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 2000)
      : '';

    return {
      title: title || '',
      bidValueRaw, dueDate, issuedBy, location,
      t247Id: tid,
      orgTenderId, estimatedCost: bidValueRaw, emdValue, documentFees,
      completionPeriod, siteLocation: location, contactPerson, contactAddress,
      quantity, msmeExemption, startupExemption, jvConsortium,
      performanceBankGuarantee: pbg, hardCopySubmission: hardCopy,
      eligibilityCriteria: eligibility, pqcSummary, fullSummaryText,
      fetchedAt: new Date().toISOString(),
    };
  }, t247Id);
}

/**
 * Scrape a single tender by its Tender247 numeric ID.
 *
 * Strategy:
 *  1. Login
 *  2. Search the LISTING PAGE for the T247 ID — this uses extractVisibleTenders()
 *     which reads 'p span.cursor-pointer' for the title, guaranteed to be correct
 *     (the detail page has a chat-widget <h1> that returns a support phone number)
 *  3. Navigate to the detail page (using the detailUrl from the listing) to extract
 *     overview / contact / EMD / schedule fields
 *  4. Return rawTender (title from listing) + overview (from detail page)
 */
export async function scrapeSingleTenderById(
  email: string,
  password: string,
  t247Id: string
): Promise<SingleTenderResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const loggedIn = await login(page, email, password);
    if (!loggedIn) throw new Error('Failed to login to Tender247. Please check credentials in Settings.');

    // ── Step 1: Try to find tender on LISTING PAGE via link scan ────────────
    // Tender247's listing search works by keywords — searching for a numeric T247 ID
    // may not return that specific card. Instead we navigate to a page that contains
    // the tender link so extractVisibleTenders() can read the correct card title.
    console.log(`[Scraper] Looking for T247 #${t247Id} card on listing page…`);

    let matchedItem: RawItemData | null = null;

    // Try: listing page with query param (works if T247 indexes IDs as searchable)
    const searchUrls = [
      `${TENDERS_URL}?search=${t247Id}`,
      `${TENDERS_URL}?q=${t247Id}`,
      `${TENDERS_URL}?keyword=${t247Id}`,
    ];
    for (const url of searchUrls) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      try {
        await page.waitForFunction(
          () => document.querySelectorAll('a[href*="/auth/tender/"]').length > 0,
          { timeout: 8000 }
        );
      } catch { /* no cards */ }
      const items = await extractVisibleTenders(page);
      matchedItem = items.find(i => i.t247Id === t247Id) ?? null;
      if (matchedItem) break;
    }

    if (matchedItem) {
      console.log(`[Scraper] ✓ Found on listing page: "${matchedItem.title}"`);
    } else {
      console.log(`[Scraper] Listing search did not return card for #${t247Id} — will extract from detail page`);
    }

    // ── Step 2: Navigate to detail page for overview fields ────────────────────
    // Use the detailPath from the listing card if available; otherwise construct it.
    const detailUrl = matchedItem?.detailPath
      ? `${BASE_URL}${matchedItem.detailPath}`
      : `${BASE_URL}/auth/tender/${t247Id}/`;

    console.log(`[Scraper] Loading detail page: ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));

    // Capture the final URL after any redirect (includes the slug: /auth/tender/{id}/{slug})
    // This full URL is what we must use for document download later.
    const finalDetailUrl = page.url().startsWith('http') ? page.url() : detailUrl;
    console.log(`[Scraper] Final detail URL: ${finalDetailUrl}`);

    const pageData = await extractTenderDetailPage(page, t247Id);

    // ── Build final values — priority rules ────────────────────────────────────
    //
    // TITLE:    listing page first (chat-widget-safe), then detail page
    // ISSUING ORG: listing page first (Tender247 paywalls this on detail pages even
    //              for logged-in users — shows "Sign In to unlock"), then detail page
    //              ONLY if it doesn't contain paywall text
    // DUE DATE: detail page first (accurate bid-submission date), then listing page
    //           (listing grabs the first DD-MM-YYYY pattern which may be published date)
    // VALUE:    listing page first (bid value from card), then detail page
    // LOCATION: detail page first (more specific), then listing page

    const SIGN_IN_RE = /sign\s*in\s*to\s*unlock|sign\s*in|unlock|login\s*to\s*view/i;

    const finalTitle = matchedItem?.title || pageData.title || `Tender T247-${t247Id}`;

    // Org from listing — split "OrgName-City, State" (same pattern as regular scrape)
    const orgParts = matchedItem?.orgLocation?.split('-') ?? [];
    const listingOrg = orgParts[0]?.trim() || '';
    const listingLocation = orgParts.slice(1).join('-').trim();
    const detailOrg = (pageData.issuedBy && !SIGN_IN_RE.test(pageData.issuedBy))
      ? pageData.issuedBy
      : '';
    const finalIssuedBy = listingOrg || detailOrg;
    const finalLocation = (pageData.location && !SIGN_IN_RE.test(pageData.location))
      ? pageData.location
      : listingLocation;

    // Date — detail page is more accurate (specific field lookup), listing grabs first pattern
    const detailDate = pageData.dueDate && !SIGN_IN_RE.test(pageData.dueDate) ? pageData.dueDate : '';
    const finalDueDate = parseDateFlexible(detailDate || matchedItem?.dueDate || '');

    // Value
    const finalValueRaw = matchedItem?.bidValueRaw || pageData.bidValueRaw || '';

    console.log(`[Scraper] Final values — title: "${finalTitle}" | org: "${finalIssuedBy}" | date: "${finalDueDate}" | value: "${finalValueRaw}"`);

    const rawTender: RawTender = {
      tenderNo: t247Id,
      title: finalTitle,
      issuedBy: finalIssuedBy,
      estimatedValueRaw: finalValueRaw,
      estimatedValue: parseValue(finalValueRaw),
      dueDate: finalDueDate,
      publishedDate: null,
      location: finalLocation,
      category: '',
      detailUrl: finalDetailUrl,   // full URL with slug — needed for doc download
      sourceSession: 'manual',
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { title: _t, bidValueRaw: _b, dueDate: _d, issuedBy: _i, location: _l, ...overview } = pageData;

    console.log(`[Scraper] ✓ Single tender #${t247Id} scraped: "${rawTender.title}"`);
    return { rawTender, overview };
  } finally {
    await page.close();
  }
}

export async function scrapeAllTenders(
  email: string,
  password: string,
  session: ScrapeSession = 'manual',
  maxTenders = 100
): Promise<RawTender[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const loggedIn = await login(page, email, password);
    if (!loggedIn) {
      throw new Error('Failed to login to Tender247. Please check credentials.');
    }

    // Scrape main tenders listing (sorted newest first)
    const tenders = await scrapeTendersWithScroll(
      page, `${TENDERS_URL}?sort=date&order=desc`, session, maxTenders
    );

    console.log(`[Scraper] Total unique tenders scraped: ${tenders.length}`);
    return tenders;
  } finally {
    await page.close();
  }
}
