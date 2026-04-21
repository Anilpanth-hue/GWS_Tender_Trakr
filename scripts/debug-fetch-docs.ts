/**
 * Debug: test the full document fetch flow for a specific tender
 * Run: npx tsx scripts/debug-fetch-docs.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const EMAIL = 'ashutosh.jha@glasswing.in';
const PASSWORD = 'BDlGRT1N9d';
const TENDER_ID = 426;
const DETAIL_URL = 'https://www.tender247.com/auth/tender/98884609/6f8e3e69-77f2-4a19-adcb-5052b61777d2?tesd=24-04-2026';
const OUT_DIR = path.resolve('./debug-docfetch');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function fillReactInput(page: puppeteer.Page, selector: string, value: string) {
  await page.evaluate((sel: string, val: string) => {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768'],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  // Track ALL requests/responses
  page.on('request', req => {
    const url = req.url();
    if (url.includes('tender247') && !url.includes('_next') && !url.includes('.js') && !url.includes('.css')) {
      console.log(`  REQ [${req.method()}] ${url.substring(0, 100)}`);
    }
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('t247_api') || url.includes('pdf-download') || url.includes('documents.tender247')) {
      const ct = res.headers()['content-type'] || '';
      const cl = res.headers()['content-length'] || '?';
      console.log(`  RES [${res.status()}] ${url.substring(0, 100)}`);
      console.log(`      content-type: ${ct}  content-length: ${cl}`);
    }
  });

  try {
    // ── Step 1: Login ─────────────────────────────────────────────────────────
    console.log('\n1. Logging in...');
    await page.goto('https://www.tender247.com', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'))
        .find(b => /sign\s*up|log\s*in/i.test(b.textContent || ''));
      btn?.click();
    });
    await page.waitForSelector('input[name="emailId"]', { visible: true, timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));
    await fillReactInput(page, 'input[name="emailId"]', EMAIL);
    await fillReactInput(page, 'input[type="password"]', PASSWORD);
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() =>
      document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.click()
    );
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 10000 }),
    ]).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const loggedIn = await page.evaluate(() =>
      !Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'))
        .some(b => /sign\s*up|log\s*in/i.test(b.textContent || ''))
    );
    console.log(`   Login: ${loggedIn ? '✓ success' : '✗ FAILED'}`);
    if (!loggedIn) { await browser.close(); return; }

    // ── Step 2: Navigate to detail page ──────────────────────────────────────
    console.log(`\n2. Navigating to detail page (Tender #${TENDER_ID})...`);
    await page.goto(DETAIL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    console.log(`   Current URL: ${page.url()}`);

    await page.screenshot({ path: path.join(OUT_DIR, '01-detail-page.png') });
    console.log('   Screenshot saved: 01-detail-page.png');

    // ── Step 3: List all buttons ──────────────────────────────────────────────
    console.log('\n3. Buttons on page:');
    const buttons = await page.$$eval('button', els =>
      els.map(e => e.textContent?.trim().substring(0, 60) || '').filter(t => t)
    );
    buttons.forEach((b, i) => console.log(`   [${i}] "${b}"`));

    // ── Step 4: Intercept outgoing request, replicate with Node fetch ─────────
    console.log('\n4. Enabling request interception + clicking PDF Download...');

    await page.setRequestInterception(true);

    let capturedReq: {
      url: string; method: string;
      headers: Record<string, string>; postData: string | undefined;
    } | null = null;

    page.on('request', req => {
      const url = req.url();
      if (url.includes('pdf-download') && req.method() === 'POST') {
        capturedReq = {
          url, method: req.method(),
          headers: { ...req.headers() },
          postData: req.postData() ?? undefined,
        };
        console.log(`   Captured PDF POST: ${url.substring(0, 80)}`);
        console.log(`   Post body: ${(req.postData() || '').substring(0, 200)}`);
      }
      req.continue();
    });

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => /pdf\s*download/i.test(b.textContent || ''));
      if (btn) { (btn as HTMLButtonElement).click(); return true; }
      return false;
    });

    // Wait up to 10s for the request capture
    const deadline = Date.now() + 10000;
    while (!capturedReq && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 150));
    }

    if (!capturedReq) {
      console.log('   ✗ PDF POST request not captured within 10s');
    } else {
      console.log('   ✓ PDF POST request captured — replicating with Node fetch...');
      const SKIP = new Set(['host', 'content-length', 'transfer-encoding', 'connection']);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(capturedReq.headers)) {
        if (!SKIP.has(k.toLowerCase())) headers[k] = v;
      }
      const res = await fetch(capturedReq.url, {
        method: capturedReq.method, headers, body: capturedReq.postData,
      });
      console.log(`   Node fetch → HTTP ${res.status}`);
      console.log(`   Content-Type: ${res.headers.get('content-type') || 'unknown'}`);
      if (res.status === 200 || res.status === 201) {
        const buf = Buffer.from(await res.arrayBuffer());
        console.log(`   Buffer size: ${buf.length} bytes`);
        if (buf.length > 1000) {
          const outPath = path.join(OUT_DIR, `Tender-Summary-${TENDER_ID}.pdf`);
          fs.writeFileSync(outPath, buf);
          console.log(`   ✓ PDF saved: ${outPath}`);
        } else {
          console.log(`   ✗ Buffer too small — response: ${buf.toString('utf8').substring(0, 200)}`);
        }
      } else {
        const text = await res.text().catch(() => '');
        console.log(`   ✗ Non-200 response: ${text.substring(0, 200)}`);
      }
    }

    // ── Step 5: Check "Download All Documents" ────────────────────────────────
    console.log('\n5. Checking "Download All Documents"...');
    let docsUrl = '';
    page.on('request', req => {
      if (req.url().includes('download-document-all')) docsUrl = req.url();
    });
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('button, span, a'))
        .find(e => /download all documents/i.test(e.textContent || ''));
      if (el) { (el as HTMLElement).click(); console.log('clicked'); }
      else console.log('button not found');
    });
    await new Promise(r => setTimeout(r, 4000));
    console.log(`   Download All URL: ${docsUrl || 'not captured'}`);

  } catch (err) {
    console.error('Fatal error:', (err as Error).message);
  } finally {
    await browser.close();
    console.log('\nDone. Check debug-docfetch/ for screenshots.');
  }
}

run();
