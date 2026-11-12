// Headless click-through of the whole demo in simulated mode + Devpost screenshots.
// Usage: npm run build && npm run e2e   (starts its own server on a temp data file)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // pre-installed globally or via npm i -D playwright
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3456;
const base = `http://localhost:${PORT}`;
const out = path.resolve('docs/screenshots');
fs.mkdirSync(out, { recursive: true });
const dataFile = path.join(os.tmpdir(), `fairloop-e2e-${Date.now()}.json`);
const env = { ...process.env, PORT: String(PORT), DATA_FILE: dataFile, PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '', GEMINI_API_KEY: '' };
const srv = spawn('node', ['server/index.js'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.on('data', (d) => String(d).includes('FairLoop on') && r()));

const errors = [];
const browser = await chromium.launch();
const shot = async (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
async function newPage(width, dark, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  if (!opts.tour) await page.addInitScript(() => { try { localStorage.setItem('fl-tour', 'done'); } catch { /* ignore */ } });
  page.on('console', (m) => m.type() === 'error' && errors.push(`${width}${dark ? ' dark' : ''}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  return page;
}
const click = (page, name) => page.getByRole('button', { name }).first().click();
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

try {
  await fetch(`${base}/api/reset`, { method: 'POST' });
  const p = await newPage(1440, false);
  await p.goto(base);
  await shot(p, 'landing-1440-light');
  await p.goto(`${base}/borrower`);
  await click(p, 'Draft my agreement');
  await p.getByText('Loan agreement').waitFor();
  await click(p, 'Approve as Ravi');
  await p.getByText('Approved. Waiting for the other person.').waitFor();
  await p.goto(`${base}/lender`);
  await click(p, 'Approve as Maya');
  await p.getByText('Both approved: the agreement is active.').waitFor();
  await shot(p, 'agreement-1440-light');
  await p.goto(`${base}/borrower`);
  await click(p, 'Approve fallback with PayPal');
  await p.getByText('Standby').first().waitFor();
  await p.goto(`${base}/lender`);
  await click(p, 'Fund with PayPal');
  await p.getByText('Your loan to Ravi').waitFor();
  await p.goto(`${base}/pay/ravi`);
  await shot(p, 'pay-1440-light');
  await click(p, /Pay \$40\.00 with PayPal/);
  await p.getByText('Thank you!').waitFor();
  await shot(p, 'pay-thanks-1440-light');

  // voice/text assistant (offline agent): live answer, Hindi navigation, Spanish hardship prefill
  await p.goto(`${base}/borrower`);
  await p.getByTestId('assistant-open').click();
  const panel = p.getByTestId('assistant');
  await panel.getByRole('button', { name: 'How much is left?' }).click();
  await panel.getByText('left to pay back to Maya').waitFor();
  await shot(p, 'assistant-1440-light');
  await panel.getByRole('textbox').fill('मुझे लेजर दिखाओ');
  await panel.getByRole('button', { name: 'Send' }).click();
  await p.waitForURL(/\/ledger$/);
  await panel.getByText('हिन्दी में जवाब', { exact: false }).or(panel.getByText('Replied in हिन्दी')).first().waitFor();
  await panel.getByRole('textbox').fill('Estuve enfermo esta semana, ¿puedo hacer una pausa de 2 semanas?');
  await panel.getByRole('button', { name: 'Send' }).click();
  await p.waitForURL(/\/borrower$/);
  const hs = p.locator('#hs');
  await hs.waitFor();
  if (!(await hs.inputValue()).includes('enfermo')) errors.push('assistant did not prefill the hardship request');
  await p.getByRole('dialog', { name: /room/ }).getByRole('button', { name: 'Close' }).click();
  if (await p.getByTestId('assistant').isVisible()) await p.getByRole('button', { name: 'Close assistant' }).click();
  // PWA: manifest + service worker
  const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
  if (!manifest.icons?.some((i) => i.sizes === '512x512') || manifest.display !== 'standalone') errors.push('manifest incomplete');
  const swScope = await p.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 8000))]); return r ? r.scope : null; });
  if (!swScope) errors.push('service worker did not register');
  await p.goto(`${base}/borrower`);
  await click(p, /Slow week/);
  await p.getByText('Week closed.').waitFor();
  await click(p, /hard week/);
  await click(p, /Send request to Maya/);
  await p.goto(`${base}/lender`);
  await p.getByText('Ravi is asking for some room').waitFor();
  await shot(p, 'lender-hardship-1440-light');
  await click(p, /^Approve$/);
  await p.getByText('approved', { exact: true }).first().waitFor();
  await p.goto(`${base}/borrower`);
  for (let i = 0; i < 2; i++) { await click(p, /Normal week/); await p.getByText('Week closed.').waitFor(); }
  await shot(p, 'borrower-1440-light');
  await p.goto(`${base}/ledger`);
  await click(p, /Verify chain/);
  await p.getByText('chain intact').waitFor();
  await shot(p, 'ledger-1440-light');
  // run to payoff
  for (let i = 0; i < 30; i++) {
    const s = await (await fetch(`${base}/api/state`)).json();
    if (s.loan.status !== 'active') break;
    await fetch(`${base}/api/simulate/week`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'good' }) });
  }
  await p.goto(`${base}/borrower`);
  await p.getByText('Loan repaid 🎉', { exact: true }).waitFor();
  await shot(p, 'repaid-1440-light');

  // guided tour: first-visit prompt, then every step, on desktop and phone
  for (const w of [1440, 390]) {
    const page = await newPage(w, false, { tour: true });
    await page.goto(base);
    await page.getByRole('button', { name: 'Start tour' }).click();
    const tour = page.getByTestId('tour');
    for (let i = 1; i <= 11; i++) {
      await tour.getByText(`Step ${i} of 11`).waitFor();
      if (w === 1440 && [2, 5, 7].includes(i)) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, `tour-step${i}-${w}.png`) }); }
      if (w === 390 && i === 4) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, `tour-step${i}-${w}.png`) }); }
      await tour.getByRole('button', { name: i === 11 ? 'Finish' : 'Next' }).click();
    }
    await tour.waitFor({ state: 'detached' });
    const seen = await page.evaluate(() => localStorage.getItem('fl-tour'));
    if (seen !== 'done') errors.push('tour completion not remembered');
    await page.context().close();
  }

  // phone: assistant as a bottom sheet + tap-target audit on every page
  {
    const page = await newPage(390, false);
    await page.goto(`${base}/borrower`);
    await page.getByTestId('assistant-open').click();
    await page.getByTestId('assistant').getByRole('button', { name: 'How is this week going?' }).click();
    await page.getByTestId('assistant').getByText(/Ravi|loan/).first().waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'assistant-390-light.png') });
    await page.context().close();
    const audit = await newPage(360, false);
    for (const r of ['/', '/borrower', '/lender', '/pay/ravi', '/ledger']) {
      await audit.goto(base + r);
      await audit.waitForLoadState('networkidle');
      const small = await audit.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea, summary')]
        .filter((el) => { const st = getComputedStyle(el); const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && !el.closest('.sr-only') && !(el.tagName === 'A' && el.closest('p')) && (b.height < 32 || b.width < 32); })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
      if (small.length) errors.push(`small tap targets on ${r}: ${small.slice(0, 5).join('; ')}`);
    }
    await audit.context().close();
  }

  // language sweep: every page in Hindi, French and Spanish, phone and desktop
  for (const lang of ['hi', 'fr', 'es']) {
    for (const [w, dark] of [[360, false], [1440, lang === 'hi']]) {
      const page = await newPage(w, dark);
      await page.addInitScript((l) => localStorage.setItem('fl-lang', l), lang);
      for (const r of ['/', '/borrower', '/lender', '/pay/ravi', '/ledger']) {
        await page.goto(base + r);
        await page.waitForLoadState('networkidle');
        if (await overflow(page)) errors.push(`horizontal overflow at ${w}px on ${r} (${lang})`);
        const leftovers = await page.evaluate(() => document.body.innerText.match(/\{[a-z_]+\}|\b(?:ag|fb|po|tl|led|hs|req|sim)\.[a-zA-Z_]+\b/g));
        if (leftovers) errors.push(`untranslated placeholders on ${r} (${lang}): ${leftovers.slice(0, 3).join(', ')}`);
        if ((r === '/borrower' && w === 360) || (r === '/lender' && w === 1440)) await shot(page, `${r.slice(1)}-${w}-${lang}`);
      }
      const htmlLang = await page.evaluate(() => document.documentElement.lang);
      if (htmlLang !== lang) errors.push(`<html lang> is ${htmlLang}, expected ${lang}`);
      await page.context().close();
    }
  }

  // responsive + dark sweep
  const routes = ['/', '/borrower', '/lender', '/pay/ravi', '/ledger'];
  for (const [w, dark] of [[390, false], [390, true], [1440, true], [360, false], [768, false], [1024, true]]) {
    const page = await newPage(w, dark);
    for (const r of routes) {
      await page.goto(base + r);
      await page.waitForLoadState('networkidle');
      if (await overflow(page)) errors.push(`horizontal overflow at ${w}px on ${r}`);
      if (w === 390 || (w === 1440 && dark)) await shot(page, `${(r.replace(/\//g, '-').replace(/^-/, '') || 'landing')}-${w}-${dark ? 'dark' : 'light'}`);
    }
    await page.context().close();
  }
} catch (e) {
  errors.push(`flow failed: ${e.message}`);
} finally {
  await browser.close();
  srv.kill();
  fs.rmSync(dataFile, { force: true });
}
if (errors.length) { console.error('E2E problems:\n' + errors.join('\n')); process.exit(1); }
console.log(`E2E passed. Screenshots in ${out}`);
