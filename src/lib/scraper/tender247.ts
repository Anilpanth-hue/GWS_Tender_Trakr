import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
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
        listingEmdValue: item.emdRaw || undefined,
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

export interface ScrapedDocument {
  label: string;       // e.g. "MIT", "BOQ Document 1", "Tender Document 2"
  url: string;         // documents.tender247.com URL
  docType: string;     // 'individual_doc' | 'full_docs_zip' | 'summary_pdf'
}

export interface TenderDocumentResult {
  documents: ScrapedDocument[];
  // Diagnostic info — populated even when documents is empty
  diag?: {
    phaseA_jsonBodiesScanned: number;
    phaseA_apiDocsFound: number;
    phaseB_embeddedDocsFound: number;
    phaseC_spansBefore: number;
    phaseC_spansAfter: number;
    phaseC_newSpans: string[];
    phaseC_allClickableSpans: string[];
    phaseD_docSpansFound: string[];
    phaseD_clickCaptured: string[];
    phaseE_windowOpenUrls: string[];
    phaseE_relevantResponses: string[];
    nextDataKeys: string[];
  };
  // Legacy fields kept for callers that still reference them
  pdfFileName: string | null;
  pdfFilePath: string | null;
  pdfPublicPath: string | null;
  pdfFileSize: number | null;
  fullDocsUrl: string | null;
}

/** Poll `dir` until a new non-temporary file appears, or timeout. Returns all new filenames. */
async function waitForNewFile(dir: string, knownFiles: Set<string>, timeoutMs: number): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    const current = fs.readdirSync(dir);
    const newFiles = current.filter(
      f => !knownFiles.has(f) && !f.endsWith('.crdownload') && !f.endsWith('.tmp') && !f.startsWith('.')
    );
    if (newFiles.length > 0) return newFiles;
  }
  return [];
}

/**
 * Download all documents from a tender's detail page using CDP download
 * interception. Puppeteer is already logged into T247 so session cookies are
 * present — navigating to a download URL from within the browser works
 * without any separate credential handling.
 *
 * Strategy (in order of preference):
 *  1. Find direct <a href> links pointing to document files and fetch each
 *     via a new authenticated page with CDP download behavior set.
 *  2. Click "Download All Documents" button and wait for a ZIP to land on disk.
 *  3. Click individual "Download" buttons one by one and collect each file.
 *
 * Files are saved to public/documents/{tenderId}/ and ScrapedDocument.url is
 * set to the local public path (/documents/{tenderId}/filename) so the route
 * can serve them directly without a separate download step.
 */
export async function fetchTenderDocuments(
  browser: Browser,
  tenderId: number,
  detailUrl: string
): Promise<TenderDocumentResult> {
  const downloadDir = path.resolve(process.cwd(), 'public', 'documents', String(tenderId));
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1366, height: 768 });
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Enable CDP download interception on this page
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });

    // Also set download behavior on any new tabs T247 might open
    const onNewTarget = async (target: import('puppeteer').Target) => {
      if (target.type() !== 'page') return;
      try {
        const tabClient = await target.createCDPSession();
        await tabClient.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadDir,
        });
      } catch { /* tab may already be closed */ }
    };
    browser.on('targetcreated', onNewTarget);

    console.log(`[Scraper] #${tenderId} navigating to: ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to trigger lazy-loaded Tender Documents section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));

    await page.waitForFunction(
      () => /tender\s*documents?/i.test(document.body.innerText),
      { timeout: 12000 }
    ).catch(() => console.warn(`[Scraper] #${tenderId} "Tender Documents" section not visible`));

    const filesBefore = new Set(fs.readdirSync(downloadDir));
    const found: ScrapedDocument[] = [];

    // ── Strategy 1: direct <a href> document links ────────────────────────────
    const directLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
        .filter(a => {
          const attr = a.getAttribute('href') || '';
          if (!attr || attr === '#' || /^javascript:/i.test(attr)) return false;
          return a.href.startsWith('http') &&
                 /documents?\.tender247|download|s3\.|\.pdf|\.zip|\.doc/i.test(a.href) &&
                 !/tender247\.com\/(tenders|dashboard|auth\/home|settings)/i.test(a.href);
        })
        .map(a => ({
          text: (a.textContent || '').trim() || a.title || 'Document',
          href: a.href,
        }))
    );

    console.log(`[Scraper] #${tenderId} Direct <a href> links: ${directLinks.length}`);

    for (const link of directLinks) {
      const snap = new Set(fs.readdirSync(downloadDir));
      const dlPage = await browser.newPage();
      try {
        const dlClient = await dlPage.createCDPSession();
        await dlClient.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadDir,
        });
        console.log(`[Scraper] #${tenderId} Fetching: ${link.href.substring(0, 100)}`);
        await dlPage.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        const newFiles = await waitForNewFile(downloadDir, snap, 20000);
        for (const f of newFiles) {
          const publicPath = `/documents/${tenderId}/${f}`;
          found.push({ label: link.text || f.replace(/\.[^.]+$/, ''), url: publicPath, docType: f.endsWith('.zip') ? 'full_docs_zip' : 'individual_doc' });
          console.log(`[Scraper] #${tenderId} ✓ "${link.text}" → ${publicPath}`);
        }
      } finally {
        await dlPage.close().catch(() => {});
      }
    }

    // ── Strategy 2: "Download All Documents" button ───────────────────────────
    if (found.length === 0) {
      const snapAll = new Set(fs.readdirSync(downloadDir));
      const clickedAll = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll<HTMLElement>('*'));
        const leaf = all.find(e => e.children.length === 0 && /download\s*all\s*documents?/i.test((e.textContent || '').trim()));
        if (!leaf) return false;
        (leaf.closest('a') || leaf.closest('button') || leaf as HTMLElement).click();
        return true;
      });
      console.log(`[Scraper] #${tenderId} "Download All Documents" click: ${clickedAll}`);

      if (clickedAll) {
        const newFiles = await waitForNewFile(downloadDir, snapAll, 30000);
        for (const f of newFiles) {
          const publicPath = `/documents/${tenderId}/${f}`;
          found.push({ label: f.endsWith('.zip') ? 'All Tender Documents (ZIP)' : f.replace(/\.[^.]+$/, ''), url: publicPath, docType: f.endsWith('.zip') ? 'full_docs_zip' : 'individual_doc' });
          console.log(`[Scraper] #${tenderId} ✓ ZIP/All → ${publicPath}`);
        }
      }
    }

    // ── Strategy 3: individual "Download" buttons ─────────────────────────────
    if (found.length === 0) {
      const downloadBtnCount = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('*'))
          .filter(e => e.children.length === 0 && /^download$/i.test((e.textContent || '').trim()))
          .length
      );
      console.log(`[Scraper] #${tenderId} Individual "Download" buttons: ${downloadBtnCount}`);

      for (let i = 0; i < downloadBtnCount; i++) {
        const snapBtn = new Set(fs.readdirSync(downloadDir));
        const btnLabel = await page.evaluate((idx: number) => {
          const btns = Array.from(document.querySelectorAll<HTMLElement>('*'))
            .filter(e => e.children.length === 0 && /^download$/i.test((e.textContent || '').trim()));
          const btn = btns[idx];
          if (!btn) return '';
          const parent = btn.closest('div');
          const labelEl = parent?.querySelector('span, p');
          const label = (labelEl?.textContent || '').trim();
          (btn.closest('a') || btn.closest('button') || btn).click();
          return label || `Document ${idx + 1}`;
        }, i);

        if (!btnLabel) continue;
        console.log(`[Scraper] #${tenderId} Clicking "Download" for "${btnLabel}"`);

        const newFiles = await waitForNewFile(downloadDir, snapBtn, 20000);
        for (const f of newFiles) {
          const publicPath = `/documents/${tenderId}/${f}`;
          found.push({ label: btnLabel || f.replace(/\.[^.]+$/, ''), url: publicPath, docType: f.endsWith('.zip') ? 'full_docs_zip' : 'individual_doc' });
          console.log(`[Scraper] #${tenderId} ✓ "${btnLabel}" → ${publicPath}`);
        }
      }
    }

    browser.off('targetcreated', onNewTarget);

    // Pick up any files already downloaded that we may have missed above
    const existingUrls = new Set(found.map(d => d.url));
    for (const f of fs.readdirSync(downloadDir)) {
      if (f.endsWith('.crdownload') || f.endsWith('.tmp') || f.startsWith('.')) continue;
      const publicPath = `/documents/${tenderId}/${f}`;
      if (!existingUrls.has(publicPath) && !filesBefore.has(f)) {
        found.push({ label: f.replace(/\.[^.]+$/, ''), url: publicPath, docType: f.endsWith('.zip') ? 'full_docs_zip' : 'individual_doc' });
      }
    }

    console.log(`[Scraper] #${tenderId} FINAL ${found.length} doc(s) downloaded`);

    return {
      documents: found,
      pdfFileName: null, pdfFilePath: null, pdfPublicPath: null, pdfFileSize: null,
      fullDocsUrl: found.find(d => d.docType === 'full_docs_zip')?.url ?? null,
    };

  } catch (err) {
    console.error(`[Scraper] fetchTenderDocuments error for #${tenderId}:`, (err as Error).message);
    return { documents: [], pdfFileName: null, pdfFilePath: null, pdfPublicPath: null, pdfFileSize: null, fullDocsUrl: null };
  } finally {
    await page.close().catch(() => {});
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
    reverseAuction: string;
    performanceBankGuarantee: string;
    hardCopySubmission: string;
    eligibilityCriteria: string;
    pqcSummary: string;
    fullSummaryText: string;
    fetchedAt: string;
    /** Every raw label→value pair from the T247 AI Generated Summary section */
    aiSummaryFields: Record<string, string>;
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
            !textLower.startsWith(labelLower + ' :') &&
            !textLower.startsWith(labelLower + ' ')) continue;
        if (text.length > labelLower.length + 30) continue; // too long, probably a paragraph

        // Next sibling in same parent (grid cell)
        // T247 uses a 3-cell grid: [label] [":"] [value] — skip pure separator cells
        const parent = el.parentElement;
        if (!parent) continue;
        const siblings = Array.from(parent.children);
        const idx = siblings.indexOf(el);
        for (let offset = 1; offset <= 2 && idx + offset < siblings.length; offset++) {
          const candidate = siblings[idx + offset] as HTMLElement;
          let val = (candidate.textContent || '').trim().replace(/\s+/g, ' ');
          if (val === ':') continue; // skip T247 separator cell
          if (val.startsWith(':')) val = val.slice(1).trim();
          if (val && val.length > 0 && val.length < 600 && !isJunk(val)) return val;
        }

        // Parent's next sibling (label in one div, value in next div)
        const parentNext = parent.nextElementSibling;
        if (parentNext) {
          const val = (parentNext.textContent || '').trim().replace(/\s+/g, ' ');
          if (val && val.length > 0 && val.length < 600 && !isJunk(val)) return val;
        }
      }

      // 3) H3 heading row — T247's top section shows EMD, Estimated Cost, Dates as h3
      //    elements where the label is the h3 direct text and the value is a child <div>.
      //    e.g. <h3>EMD <svg/> <div>₹ 5.53 Lakh</div></h3>
      for (const h3 of Array.from(document.querySelectorAll('h3'))) {
        if (isJunk(h3.textContent || '')) continue;
        const h3Lower = (h3.textContent || '').toLowerCase().trim();
        if (!h3Lower.startsWith(labelLower)) continue;
        const valueDiv = h3.querySelector('div');
        if (valueDiv) {
          const val = (valueDiv.textContent || '').trim().replace(/\s+/g, ' ').replace(/\|/g, '').trim();
          if (val && val.length > 0 && val.length < 200 && !isJunk(val)) return val;
        }
      }

      return '';
    }

    // ── Locate the AI Summary section ────────────────────────────────────────
    let summaryRoot: Element | null = null;
    for (const el of Array.from(document.querySelectorAll('div, section'))) {
      const heading = (el.querySelector('h2, h3, h4') || el).textContent || '';
      if (/AI Generated|Tender Summary|Eligibility Criteria/i.test(heading) && el.querySelectorAll('div').length > 5) {
        summaryRoot = el;
        break;
      }
    }

    // ── Parse ALL AI Summary rows into a flat key→value map ──────────────────
    // T247 AI Summary uses a 3-cell grid: [Label] [":"] [Value]
    // We extract every row here so smartLookup can do a simple dict lookup
    // instead of DOM traversal — much faster and more reliable.
    const aiSummaryFields: Record<string, string> = {};
    if (summaryRoot) {
      const leafEls = Array.from(summaryRoot.querySelectorAll('div, span, td'))
        .filter(el => el.children.length <= 1);

      for (const el of leafEls) {
        const labelText = (el.textContent || '').trim().replace(/\s+/g, ' ');
        // Skip: empty, pure separator, starts with ₹/digit (it's a value), too long, junk
        if (!labelText || labelText === ':' || labelText.length > 80) continue;
        if (/^[₹\d•]/.test(labelText) || isJunk(labelText)) continue;

        const parent = el.parentElement;
        if (!parent) continue;
        const siblings = Array.from(parent.children);
        const idx = siblings.indexOf(el);

        for (let off = 1; off <= 2 && idx + off < siblings.length; off++) {
          let val = ((siblings[off + idx] as HTMLElement).textContent || '').trim().replace(/\s+/g, ' ');
          if (val === ':') continue;
          if (val.startsWith(':')) val = val.slice(1).trim();
          const isLongField = /eligib|pre.qualif|turnover|experience|technical|financial|pqc|payment|penalty/i.test(labelText);
          if (val && !isJunk(val) && val.length > 0 && val.length < (isLongField ? 2000 : 600) && val !== labelText) {
            aiSummaryFields[labelText] = val;
            break;
          }
        }
      }
    }

    /** Look up labels against the pre-parsed AI summary map, then fall back to DOM search */
    function smartLookup(...labels: string[]): string {
      // 1) Check flat map first — O(n) dict lookup, works even if DOM layout varies
      for (const label of labels) {
        const labelLower = label.toLowerCase();
        for (const [key, val] of Object.entries(aiSummaryFields)) {
          if (key.toLowerCase() === labelLower && val) return val;
        }
      }
      // 2) DOM traversal fallback within summaryRoot (catches edge-case layouts)
      if (summaryRoot) {
        for (const label of labels) {
          const labelLower = label.toLowerCase();
          for (const el of Array.from(summaryRoot.querySelectorAll('div, span, td'))) {
            if (el.children.length > 1) continue;
            const text = (el.textContent || '').trim().toLowerCase();
            if (text === labelLower || text.startsWith(labelLower + ':') || text.startsWith(labelLower + ' :')) {
              const parent = el.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children);
                const idx = siblings.indexOf(el);
                for (let off = 1; off <= 2 && idx + off < siblings.length; off++) {
                  let val = ((siblings[idx + off] as HTMLElement).textContent || '').trim().replace(/\s+/g, ' ');
                  if (val === ':') continue;
                  if (val.startsWith(':')) val = val.slice(1).trim();
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
      // 3) Whole-page DOM search
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
    const location = smartLookup('Site location', 'Site Location', 'State', 'Location', 'District');

    // ── Overview fields ───────────────────────────────────────────────────────
    const orgTenderId      = smartLookup('Tender ID', 'Organisation Tender ID', 'Tender Reference', 'Ref No');
    const emdValue         = smartLookup('Emd Amount', 'EMD Value', 'EMD Amount', 'EMD', 'Earnest Money Deposit', 'Earnest Money');
    const documentFees     = smartLookup('Document Fee', 'Document Fees', 'Tender Fee', 'Tender Document Fee');
    const completionPeriod = smartLookup('Contract Period', 'Completion Period', 'Work Completion Period', 'Duration', 'Time Limit', 'Period of Contract', 'Period');
    const contactPerson    = smartLookup('Contact Person', 'Officer', 'Contact');
    const contactAddress   = smartLookup('Contact Address', 'Address');
    const quantity         = smartLookup('Quantity');
    const msmeExemption    = smartLookup('MSME Exemption', 'MSE Exemption', 'MSME');
    const startupExemption = smartLookup('Startup Exemption', 'Startup');
    const jvConsortium     = smartLookup('Joint Venture OR Consortium OR JV', 'JV / Consortium', 'Consortium', 'Joint Venture', 'JV Allowed', 'JV');
    const pbg              = smartLookup('Performance Bank Guarantee', 'Performance Security', 'PBG');
    const hardCopy         = smartLookup('Hard Copy', 'Hard Copy Submission');
    const eligibility      = smartLookup('Eligibility Criteria', 'Eligibility');
    const pqcSummary       = smartLookup('Pre Qualification', 'PQC', 'Pre-Qualification');
    const reverseAuction   = smartLookup('Bid to Ra Enabled', 'Reverse Auction', 'e-Reverse Auction', 'Reverse Bidding');

    // ── Full AI summary text ──────────────────────────────────────────────────
    const fullSummaryText = summaryRoot
      ? (summaryRoot.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 6000)
      : '';

    // ── Fallback: scan full page text for EMD and contract period ─────────────
    // Some tenders (especially corrigenda) don't have the AI Summary grid,
    // but EMD / period values are visible as plain text on the page.
    let emdFallback = emdValue;
    let periodFallback = completionPeriod;
    if (!emdFallback) {
      // T247 top section: "EMD" on one line, "₹ 5.53 Lakh" on the next line
      // Also handles inline formats: "EMD: ₹5,00,000" or "EMD ₹50 Lakh"
      const emdMatch =
        document.body.innerText.match(/^EMD\s*[^\n]*\n\s*([₹]?\s*[\d,.]+\s*(?:Cr(?:ore)?|Lakhs?|L)?)/im) ||
        document.body.innerText.match(/\bEMD\b[^:\n]*:\s*([₹]?\s*[\d,.]+\s*(?:Cr(?:ore)?|Lakhs?|L)?)/i);
      if (emdMatch) emdFallback = emdMatch[1].trim();
    }
    if (!periodFallback) {
      // Also check aiSummaryFields under alternate period keys
      periodFallback =
        aiSummaryFields['Completion Period'] ||
        aiSummaryFields['Contract Period'] ||
        aiSummaryFields['Work Completion Period'] ||
        aiSummaryFields['Completion period'] || '';
    }
    if (!periodFallback) {
      const periodMatch = document.body.innerText.match(/(?:completion|contract)\s+period[^:\n]*[:]\s*([^\n]{3,60})/i);
      if (periodMatch) periodFallback = periodMatch[1].trim();
    }

    return {
      title: title || '',
      bidValueRaw, dueDate, issuedBy, location,
      t247Id: tid,
      orgTenderId, estimatedCost: bidValueRaw, emdValue: emdFallback, documentFees,
      completionPeriod: periodFallback, siteLocation: location, contactPerson, contactAddress,
      quantity, msmeExemption, startupExemption, jvConsortium, reverseAuction,
      performanceBankGuarantee: pbg, hardCopySubmission: hardCopy,
      eligibilityCriteria: eligibility, pqcSummary, fullSummaryText,
      aiSummaryFields,
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

/**
 * Scrape the T247 AI Summary / detail page using an already-logged-in browser.
 * Use this during batch scraping (Phase 3) — no re-login needed, opens a new tab.
 */
export async function scrapeDetailPageData(
  browser: Browser,
  detailUrl: string,
  t247Id: string
): Promise<SingleTenderResult['overview']> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll to bottom to trigger lazy-loaded AI Summary section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Wait until AI Summary content is visible in DOM (up to 5 sec), then scroll back
    await page.waitForFunction(
      () => /Completion Period|Contract Period|Emd Amount|EMD Value/i.test(document.body.innerText),
      { timeout: 5000 }
    ).catch(() => {}); // non-fatal — proceed with whatever loaded
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => window.scrollTo(0, 0));

    const { title: _t, bidValueRaw: _b, dueDate: _d, issuedBy: _i, location: _l, ...overview } =
      await extractTenderDetailPage(page, t247Id);
    return overview;
  } finally {
    await page.close();
  }
}

export interface OverviewRefreshResult {
  overview: SingleTenderResult['overview'];
  /** Re-scraped due date in YYYY-MM-DD format (or null if not found) */
  dueDate: string | null;
  /** Re-scraped estimated cost raw string */
  estimatedCostRaw: string;
}

/**
 * Scrape overview fields + key dates for a tender already in the DB.
 * Returns the full overview AND the re-scraped due date so callers can
 * detect corrigendum / date extensions.
 */
export async function scrapeOverviewByDetailUrl(
  email: string,
  password: string,
  detailUrl: string,
  t247Id: string
): Promise<OverviewRefreshResult> {
  // Always start with a fresh browser — prevents "Connection closed" race condition
  // when a background scrape is still running and sharing the same browser instance.
  if (browserInstance) {
    try { await browserInstance.close(); } catch { /* already dead */ }
    browserInstance = null;
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1366, height: 768 });
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const loggedIn = await login(page, email, password);
    if (!loggedIn) throw new Error('Failed to login to Tender247. Check credentials in Settings.');

    // Use 'domcontentloaded' first for faster load, then wait for key selector
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Wait for page to settle and lazy sections to render
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));

    const pageData = await extractTenderDetailPage(page, t247Id);
    const { title: _t, bidValueRaw, dueDate, issuedBy: _i, location: _l, ...overview } = pageData;

    return {
      overview,
      dueDate: parseDateFlexible(dueDate),
      estimatedCostRaw: bidValueRaw,
    };
  } finally {
    await page.close();
  }
}
