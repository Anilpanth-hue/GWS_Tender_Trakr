/**
 * Debug: scrape a tender detail page to understand its DOM structure
 * Run: npx tsx scripts/debug-detail.ts
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

  try {
    // Login
    console.log('1. Login...');
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
    await page.evaluate(() => {
      (document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]'))?.click();
    });
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 10000 }),
    ]).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    console.log('   Logged in');

    // Navigate to detail page
    console.log('2. Navigating to detail page...');
    await page.goto(DETAIL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(OUT_DIR, '10-detail-page.png'), fullPage: true });
    console.log('   Screenshot saved');

    // Save full HTML
    const html = await page.content();
    fs.writeFileSync(path.join(OUT_DIR, 'detail-page.html'), html);
    console.log('   HTML saved');

    // Extract overview fields
    const overview = await page.evaluate(() => {
      const rows: Record<string, string> = {};
      // Look for key-value table rows
      const cells = Array.from(document.querySelectorAll('td, [class*="grid"] > div'));
      for (let i = 0; i < cells.length - 1; i += 2) {
        const key = cells[i].textContent?.trim() || '';
        const val = cells[i + 1]?.textContent?.trim() || '';
        if (key && key.length < 50) rows[key] = val;
      }
      return rows;
    });
    console.log('\n3. Overview fields:');
    Object.entries(overview).forEach(([k, v]) => console.log(`   ${k}: ${v.substring(0,60)}`));

    // Find document links
    const docs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links
        .map(a => ({
          text: a.textContent?.trim().substring(0, 80) || '',
          href: (a as HTMLAnchorElement).href,
        }))
        .filter(l => l.href.match(/download|doc|pdf|attachment|file/i) || l.text.match(/download|document|pdf|tender/i));
    });
    console.log('\n4. Document links:');
    docs.slice(0, 20).forEach(d => console.log(`   [${d.text}] ${d.href}`));

    // Extract all text for AI context
    const textContent = await page.evaluate(() => {
      document.querySelectorAll('script, style, nav, header').forEach(e => e.remove());
      return document.body.innerText.replace(/\s+/g, ' ').trim().substring(0, 5000);
    });
    console.log('\n5. Page text (first 1000 chars):');
    console.log(textContent.substring(0, 1000));

  } catch (err) {
    console.error('Error:', (err as Error).message);
    await page.screenshot({ path: path.join(OUT_DIR, '99-detail-error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

run();
