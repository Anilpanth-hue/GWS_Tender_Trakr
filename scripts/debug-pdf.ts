/**
 * Debug: find what the "PDF Download" button does on T247 detail page
 * Run: npx tsx scripts/debug-pdf.ts
 */
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const EMAIL = 'ashutosh.jha@glasswing.in';
const PASSWORD = 'BDlGRT1N9d';
const DETAIL_URL = 'https://www.tender247.com/auth/tender/97250283/869ad79d-8f08-4dc4-b037-c47e01f831a5?tesd=04-05-2026';
const OUT_DIR = './debug-screenshots';

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
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Track ALL network requests
  const requests: string[] = [];
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('_next') && !url.includes('static') && !url.includes('.css') && !url.includes('.js')) {
      requests.push(`[${req.method()}] ${url}`);
    }
  });

  // Track new pages / popups
  browser.on('targetcreated', async target => {
    const url = target.url();
    console.log('\n🆕 NEW TAB/TARGET:', url);
  });

  try {
    // Login
    console.log('1. Logging in...');
    await page.goto('https://www.tender247.com', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'));
      btns.find(b => /sign\s*up|log\s*in/i.test(b.textContent || ''))?.click();
    });
    await page.waitForSelector('input[name="emailId"]', { visible: true, timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));
    await fillReactInput(page, 'input[name="emailId"]', EMAIL);
    await fillReactInput(page, 'input[type="password"]', PASSWORD);
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => (document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]'))?.click());
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 10000 }),
    ]).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    console.log('   Logged in ✓');

    // Navigate to detail
    console.log('\n2. Navigating to tender detail...');
    requests.length = 0;
    await page.goto(DETAIL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Find all buttons and links
    const buttons = await page.$$eval('button', els => els.map(el => ({
      text: el.textContent?.trim().substring(0, 50),
      className: el.className.substring(0, 80),
    })));
    console.log('\n3. All buttons on detail page:');
    buttons.forEach((b, i) => console.log(`   [${i}] "${b.text}" | ${b.className.substring(0,60)}`));

    const links = await page.$$eval('a[href]', els => els.map(el => ({
      text: el.textContent?.trim().substring(0, 50),
      href: (el as HTMLAnchorElement).href,
    })));
    console.log('\n4. All links with href:');
    links.filter(l => l.href && !l.href.includes('_next')).forEach(l => console.log(`   "${l.text}" → ${l.href}`));

    // Click the PDF Download button and track what happens
    console.log('\n5. Clicking PDF Download button...');
    requests.length = 0;

    // Set up download interception
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: path.resolve(OUT_DIR),
    });

    const newPagePromise = new Promise<string>(resolve => {
      browser.once('targetcreated', async target => {
        resolve(target.url());
      });
      // Timeout
      setTimeout(() => resolve(''), 5000);
    });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const pdfBtn = btns.find(b => /pdf\s*download/i.test(b.textContent || ''));
      if (pdfBtn) { pdfBtn.click(); return true; }
      return false;
    });

    // Wait for response
    await new Promise(r => setTimeout(r, 3000));
    const newPageUrl = await newPagePromise;

    console.log('\n6. New page/tab URL:', newPageUrl || 'none');
    console.log('\n7. Network requests after PDF click:');
    requests.forEach(r => console.log('  ', r));

    // Also check current page URL
    console.log('\n8. Current page URL:', page.url());

    // Check if any files were downloaded
    const files = fs.readdirSync(OUT_DIR).filter(f => !f.endsWith('.png') && !f.endsWith('.html') && !f.endsWith('.ts'));
    console.log('\n9. Downloaded files:', files);

    // Now try "Download All Documents"
    console.log('\n10. Trying "Download All Documents"...');
    requests.length = 0;
    await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const dlBtn = spans.find(s => /download all documents/i.test(s.textContent || ''));
      if (dlBtn) { (dlBtn as HTMLElement).click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 3000));
    console.log('    Requests after Download All:', requests.slice(0, 10));

  } catch (err) {
    console.error('Error:', (err as Error).message);
  } finally {
    await browser.close();
  }
}

run();
