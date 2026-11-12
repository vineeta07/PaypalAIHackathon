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
async function newPage(width, dark) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
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
  await p.getByText('Approved. Waiting').waitFor();
  await p.goto(`${base}/lender`);
  await click(p, 'Approve as Maya');
  await p.getByText('Both approved').waitFor();
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
