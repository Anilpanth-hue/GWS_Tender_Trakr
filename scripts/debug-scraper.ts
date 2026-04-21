/**
 * Debug script: modal-based login with React input handling.
 * Run: npx tsx scripts/debug-scraper.ts
 */
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const EMAIL = 'ashutosh.jha@glasswing.in';
const PASSWORD = 'BDlGRT1N9d';
const OUT_DIR = './debug-screenshots';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

async function screenshot(page: puppeteer.Page, name: string) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}`);
}

/** Fill a React-controlled input by triggering the native value setter */
async function fillReactInput(page: puppeteer.Page, selector: string, value: string) {
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

async function run() {
  console.log('\n🔍 Tender247 Debug – React Input Handling\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768'],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    // 1. Homepage
    console.log('1. Loading homepage...');
    await page.goto('https://www.tender247.com', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await screenshot(page, '01-homepage');

    // 2. Open login dialog
    console.log('2. Opening login dialog...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'));
      const loginBtn = btns.find(b => /sign\s*up|log\s*in/i.test(b.textContent || ''));
      loginBtn?.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, '02-dialog-open');

    // Confirm dialog is visible
    const dialogVisible = await page.$('[role="dialog"]');
    console.log('   Dialog element present:', dialogVisible ? 'YES' : 'NO');

    // 3. Fill fields using React-compatible setter
    console.log('3. Filling email...');
    await fillReactInput(page, 'input[name="emailId"], input[type="email"]', EMAIL);
    await new Promise(r => setTimeout(r, 300));

    console.log('   Filling password...');
    await fillReactInput(page, 'input[type="password"]', PASSWORD);
    await new Promise(r => setTimeout(r, 300));

    await screenshot(page, '03-filled');

    // Verify values were set
    const values = await page.evaluate(() => {
      const email = document.querySelector<HTMLInputElement>('input[name="emailId"], input[type="email"]');
      const pass = document.querySelector<HTMLInputElement>('input[type="password"]');
      return { email: email?.value || '', passLen: pass?.value.length || 0 };
    });
    console.log(`   Email value: "${values.email}", Password length: ${values.passLen}`);

    // 4. Submit
    console.log('4. Submitting...');
    const submitText = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        '[role="dialog"] button[type="submit"]'
      );
      if (btn) { btn.click(); return btn.textContent?.trim(); }

      // Fallback: find any button inside dialog that isn't type=button
      const dialog = document.querySelector('[role="dialog"]');
      const btns = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') || []);
      const submitLike = btns.find(b => /submit|login|sign\s*in/i.test(b.textContent || ''));
      if (submitLike) { submitLike.click(); return submitLike.textContent?.trim(); }
      return null;
    });
    console.log('   Submit button text:', submitText);

    if (!submitText) {
      // Last resort: Enter key
      await page.keyboard.press('Enter');
      console.log('   Used Enter key');
    }

    // 5. Wait and check result
    await new Promise(r => setTimeout(r, 3000));
    await screenshot(page, '04-after-submit');

    // Check for error messages in dialog
    const dialogContent = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      return {
        html: dialog.innerHTML.substring(0, 2000),
        text: dialog.textContent?.trim().substring(0, 500),
        visible: !!(dialog as HTMLElement).offsetParent,
      };
    });
    console.log('\n5. Dialog state after submit:');
    console.log('   Dialog still open:', dialogContent ? 'YES' : 'NO (closed = success!)');
    if (dialogContent) {
      console.log('   Dialog text:', dialogContent.text);
      fs.writeFileSync(path.join(OUT_DIR, 'dialog-after-submit.html'), dialogContent.html || '');
      console.log('   Dialog HTML saved to debug-screenshots/dialog-after-submit.html');
    }

    // Check login status
    const isLoggedIn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'));
      return !btns.some(b => /sign\s*up|log\s*in/i.test(b.textContent || ''));
    });
    console.log('   Login status:', isLoggedIn ? '✅ SUCCESS' : '❌ FAILED');

    if (isLoggedIn) {
      console.log('\n6. Going to tenders page...');
      await page.goto('https://www.tender247.com/tenders', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      await screenshot(page, '05-tenders');

      // Dump element candidates
      const candidates = await page.$$eval('*', els => {
        const found: string[] = [];
        for (const el of els) {
          const cls = el.className?.toString() || '';
          const tag = el.tagName.toLowerCase();
          if (cls.match(/tender|bid|result|listing|item|row|card/i)) {
            found.push(`<${tag} class="${cls.substring(0,100)}">`);
            if (found.length >= 30) break;
          }
        }
        return found;
      });
      console.log('   Tender elements:', candidates.length);
      candidates.forEach(c => console.log('  ', c));

      const html = await page.content();
      fs.writeFileSync(path.join(OUT_DIR, 'tenders-page.html'), html);
      console.log('   HTML saved to debug-screenshots/tenders-page.html');
    }

  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message);
    await screenshot(page, '99-error');
  } finally {
    await browser.close();
    console.log('\n✅ Done.\n');
  }
}

run();
