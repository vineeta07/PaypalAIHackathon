// Builds the Devpost image gallery: 3:2 slides (1800x1200 JPG) from the live app.
// Usage: npm run build && node scripts/gallery.js   → docs/gallery/*.jpg
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { markSVG } from './brand.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const PORT = 3461;
const base = `http://localhost:${PORT}`;
const out = path.resolve('docs/gallery');
fs.mkdirSync(out, { recursive: true });
const raw = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-gallery-'));
const dataFile = path.join(raw, 'db.json');

const srv = spawn('node', ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: dataFile, PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '', GEMINI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => srv.kill());
process.on('uncaughtException', (e) => { console.error(e); srv.kill(); process.exit(1); });
await new Promise((r) => srv.stdout.on('data', (d) => String(d).includes('FairLoop on') && r()));
const post = (p, b = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());

const browser = await chromium.launch();
async function page({ w = 1440, h = 900, dark = false, lang = 'en', tour = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  await ctx.addInitScript(([d, l, tr]) => { try { localStorage.setItem('fl-theme', d ? 'dark' : 'light'); localStorage.setItem('fl-lang', l); if (!tr) localStorage.setItem('fl-tour', 'done'); localStorage.setItem('fl-voice', 'off'); } catch { /* ignore */ } }, [dark, lang, tour]);
  return ctx.newPage();
}
async function go(p, route) { await p.goto(base + route); await p.waitForLoadState('networkidle'); await p.waitForTimeout(400); }
async function scrollTo(p, selector, offset = 24) { await p.evaluate(([s, o]) => { const el = document.querySelector(s); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o); }, [selector, offset]); await p.waitForTimeout(350); }
const shots = {};
async function snap(p, name) { const file = path.join(raw, `${name}.png`); await p.screenshot({ path: file }); shots[name] = file; }

// ---------- capture the story ----------
log('server up'); await post('/api/reset');
let p = await page();
await go(p, '/'); await snap(p, 'home');
await scrollTo(p, '#h-calc', 140);
await p.locator('#calc').fill('2000'); await p.waitForTimeout(250); await snap(p, 'calc');

await post('/api/loan/request', { text: 'I need $300 for a new oven, I earn about $40–120 a week from cake orders.', lang: 'en' });
await go(p, '/borrower'); await scrollTo(p, '[data-tour="next-step"]', 28); await snap(p, 'agreement');

await post('/api/agreement/approve', { role: 'borrower' });
await post('/api/agreement/approve', { role: 'lender' });
const plan = await post('/api/fallback/plan');
await post('/api/fallback/approved', { subscription_id: plan.sim_subscription_id });
await go(p, '/lender'); await scrollTo(p, '#fund', 220); await snap(p, 'fund');

const order = await post('/api/fund/order');
await post('/api/fund/capture', { order_id: order.id });
await go(p, '/pay/ravi');
await p.getByRole('button', { name: /Pay \$40\.00 with PayPal/ }).click();
await p.getByText('Thank you!').waitFor(); await p.waitForTimeout(300); await snap(p, 'paid');

await post('/api/simulate/week', { mode: 'normal' });
await post('/api/simulate/week', { mode: 'low' });
await go(p, '/borrower'); await snap(p, 'borrower');

await p.getByTestId('assistant-open').click();
const panel = p.getByTestId('assistant');
await panel.getByRole('textbox').fill('कितना बाकी है? इस हफ़्ते क्या हुआ?');
await panel.getByRole('button', { name: 'Send' }).click();
await panel.getByText('Replied in हिन्दी').waitFor();
await panel.getByRole('textbox').fill('Estuve enfermo esta semana, ¿puedo hacer una pausa de 2 semanas?');
await panel.getByRole('button', { name: 'Send' }).click();
await p.locator('#hs').waitFor(); await p.getByRole('dialog', { name: /room/ }).getByRole('button', { name: 'Close' }).click();
await p.goto(base + '/borrower'); await p.waitForLoadState('networkidle');
await p.getByTestId('assistant-open').click();
await panel.getByRole('textbox').fill('मुझे बताओ कितना बाकी है');
await panel.getByRole('button', { name: 'Send' }).click();
await panel.getByText('Replied in हिन्दी').waitFor();
await panel.getByRole('textbox').fill('¿Qué hago ahora?');
await panel.getByRole('button', { name: 'Send' }).click();
await panel.getByText('Replied in Español').waitFor(); await p.waitForTimeout(300);
await snap(p, 'assistant');
await p.context().close();

await post('/api/hardship/request', { text: 'I was sick this week, can I pause for 2 weeks?', lang: 'en' });
p = await page();
await go(p, '/lender'); await scrollTo(p, '#pending', 200); await snap(p, 'hardship');
const st = await (await fetch(base + '/api/state')).json();
await post(`/api/hardship/${st.hardships[0].id}/decide`, { role: 'lender', approve: true });
await p.context().close();

p = await page({ dark: true });
await go(p, '/ledger'); await p.getByRole('button', { name: /Verify chain/ }).click(); await p.getByText('chain intact').waitFor(); await snap(p, 'ledger');
await p.context().close();

p = await page({ tour: true });
await go(p, '/'); await p.getByRole('button', { name: 'Start tour' }).click();
for (let i = 1; i < 5; i++) { await p.getByTestId('tour').getByText(`Step ${i} of 11`).waitFor(); await p.getByTestId('tour').getByRole('button', { name: 'Next' }).click(); }
await p.getByTestId('tour').getByText('Step 5 of 11').waitFor(); await p.waitForTimeout(500); await snap(p, 'tour');
await p.context().close();

for (const [name, route, opts] of [['phone-home', '/', {}], ['phone-borrower', '/borrower', {}], ['phone-pay', '/pay/ravi', {}]]) {
  p = await page({ w: 390, h: 844, ...opts }); await go(p, route); await snap(p, name); await p.context().close();
}
p = await page({ w: 390, h: 844 }); await go(p, '/borrower');
await p.getByTestId('assistant-open').click();
await p.getByTestId('assistant').getByRole('button', { name: 'How much is left?' }).click();
await p.getByTestId('assistant').getByText('left to pay back').waitFor(); await p.waitForTimeout(400);
await snap(p, 'phone-assistant'); await p.context().close();

p = await page({ dark: true, lang: 'hi' }); await go(p, '/lender'); await snap(p, 'hindi'); await p.context().close();

for (let i = 0; i < 40; i++) { const s = await (await fetch(base + '/api/state')).json(); if (s.loan.status !== 'active') break; await post('/api/simulate/week', { mode: 'good' }); }
p = await page(); await go(p, '/borrower'); await snap(p, 'repaid'); await p.context().close();

// ---------- compose 3:2 slides ----------
const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const fonts = '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@500;600&display=swap" rel="stylesheet">';
const mark = (s) => markSVG().replace('<svg ', `<svg width="${s}" height="${s}" `);
const C = { ink: '#181B1F', muted: '#5C626B', green: '#166543', paper: '#F6F5F1' };
const head = (eyebrow, title, sub) => `
  <div style="position:absolute;left:96px;top:60px;right:96px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:19px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${C.green}">${eyebrow}</div>
      <div style="display:flex;align-items:center;gap:10px">${mark(34)}<span style="font-size:24px;font-weight:650;letter-spacing:-.03em;color:${C.ink}">Fair<span style="color:${C.green}">Loop</span></span></div>
    </div>
    <div style="margin-top:14px;font-size:50px;line-height:1.08;font-weight:650;letter-spacing:-.03em;color:${C.ink}">${title}</div>
    <div style="margin-top:12px;font-size:24px;line-height:1.4;color:${C.muted};max-width:1450px">${sub}</div>
  </div>`;
const browserFrame = (img, url, { top = 300, width = 1440 } = {}) => `
  <div style="position:absolute;left:${(1800 - width) / 2}px;top:${top}px;width:${width}px;border-radius:16px 16px 0 0;overflow:hidden;box-shadow:0 30px 70px -20px rgba(16,24,32,.35),0 0 0 1px rgba(16,24,32,.08);background:#fff">
    <div style="height:40px;background:#ECEAE4;display:flex;align-items:center;gap:8px;padding:0 16px">
      <span style="width:12px;height:12px;border-radius:50%;background:#CFCBC2"></span><span style="width:12px;height:12px;border-radius:50%;background:#CFCBC2"></span><span style="width:12px;height:12px;border-radius:50%;background:#CFCBC2"></span>
      <span style="margin-left:18px;flex:1;max-width:560px;height:24px;border-radius:7px;background:#fff;color:#7A7F86;font-size:14px;display:flex;align-items:center;padding:0 12px">fairloop.onrender.com${url}</span>
    </div>
    <img src="${b64(img)}" style="display:block;width:100%">
  </div>`;
const phone = (img) => `<div style="width:330px;border-radius:44px;padding:12px;background:#1B1E22;box-shadow:0 30px 60px -20px rgba(16,24,32,.45)"><img src="${b64(img)}" style="display:block;width:100%;border-radius:33px"></div>`;
const chip = (t) => `<span style="display:inline-block;border:1px solid #E2DFD7;background:#fff;border-radius:999px;padding:10px 18px;font-size:21px;color:#4F5560;margin:0 10px 12px 0">${t}</span>`;

const slides = [
  ['01-cover', `
    <div style="position:absolute;left:96px;top:190px;width:760px">
      <div style="display:flex;align-items:center;gap:20px">${mark(84)}<div style="font-size:60px;font-weight:650;letter-spacing:-.035em;color:${C.ink}">Fair<span style="color:${C.green}">Loop</span></div></div>
      <div style="margin-top:64px;font-size:62px;line-height:1.06;font-weight:650;letter-spacing:-.03em;color:${C.ink}">Lend to people you trust. Get repaid from what they earn.</div>
      <div style="margin-top:28px;font-size:27px;line-height:1.45;color:${C.muted}">Interest-free family loans, repaid automatically from each PayPal sale. Nothing is taken in a slow week.</div>
      <div style="margin-top:40px">${chip('PayPal Orders · Payouts · Subscriptions')}${chip('Gemini AI + voice')}${chip('English · हिन्दी · Français · Español')}</div>
    </div>
    <div style="position:absolute;left:900px;top:200px;width:1240px;border-radius:16px;overflow:hidden;box-shadow:0 40px 80px -20px rgba(16,24,32,.35),0 0 0 1px rgba(16,24,32,.08)"><img src="${b64(shots.borrower)}" style="display:block;width:100%"></div>`],
  ['02-the-idea', head('The idea', 'Loans between people who trust each other, repaid from what you earn', 'A fair, written agreement for family and community loans. Every PayPal sale sends a small agreed share back to the lender, at 0% interest.') + browserFrame(shots.home, '/')],
  ['03-slow-weeks', head('Built for irregular income', 'A slow week never causes a default', 'Drag the calculator: below the agreed weekly minimum nothing is taken; good weeks repay faster, never more than the weekly cap.') + browserFrame(shots.calc, '/')],
  ['04-ai-agreement', head('AI drafts, people decide', 'Gemini writes a fair agreement from real income', 'Plain-language terms, sliding shares, weekly minimum and cap, and a payoff projection from the borrower’s last 8 weeks of sales. Terms are hashed with SHA-256.') + browserFrame(shots.agreement, '/borrower')],
  ['05-fund-with-paypal', head('PayPal Checkout + Payouts', 'Both approve, then the lender funds with PayPal', 'The loan only starts when both people approve the same terms. Funding is captured with Orders v2 and sent straight to the borrower with PayPal Payouts.') + browserFrame(shots.fund, '/lender')],
  ['06-automatic-split', head('Repaid from every sale', 'One customer payment, split automatically', 'A $40 cake paid through PayPal: $6 goes back to the lender and $34 to the baker, in one Payouts batch, with the reason written out. No reminders needed.') + browserFrame(shots.paid, '/pay/ravi')],
  ['07-borrower-dashboard', head('Borrower dashboard', 'Always clear: repaid, remaining, this week', 'Live progress, this week’s income against the minimum, the next deduction explained in plain words, and a “Next step” card that tells you what to do.') + browserFrame(shots.borrower, '/borrower')],
  ['08-voice-assistant', head('Voice AI in your language', 'Ask out loud, in Hindi, English, French or Spanish', 'The assistant answers from live data in the language you speak, reads it aloud, opens pages and fills in forms. It can never approve or move money.') + browserFrame(shots.assistant, '/borrower')],
  ['09-hardship', head('Kind by design', 'Sick this week? Ask for a pause, the lender decides', 'Gemini turns a message in any language into a clear request: pause, lower share or more time. Terms can only get gentler, never harsher automatically.') + browserFrame(shots.hardship, '/lender')],
  ['10-ledger', head('Tamper-evident record', 'Every event in a verifiable hash chain', 'Agreements, approvals, payments, splits, skipped weeks and decisions are linked with SHA-256 in an AG Grid ledger. One click verifies nothing was changed.') + browserFrame(shots.ledger, '/ledger')],
  ['11-guided-tour', head('Easy to understand', 'A guided tour and live progress for first-time users', 'An 11-step spotlight tour, a demo checklist in the sidebar and a “Next step” card on every dashboard mean nobody gets lost.') + browserFrame(shots.tour, '/borrower')],
  ['12-mobile-app', head('Mobile-first · installable app', 'Works beautifully on phones, installs as an app', 'Bottom tabs, bottom sheets and large touch targets. FairLoop is a PWA with home-screen shortcuts and an offline shell.') + `
    <div style="position:absolute;left:0;right:0;top:300px;display:flex;justify-content:center;gap:40px">${phone(shots['phone-home'])}${phone(shots['phone-borrower'])}${phone(shots['phone-assistant'])}${phone(shots['phone-pay'])}</div>`],
  ['13-four-languages', head('Four languages · light and dark', 'Every screen in English, हिन्दी, Français and Español', 'Agreements, explanations and notifications render in each viewer’s language, so the lender can read English while the borrower reads Hindi.') + browserFrame(shots.hindi, '/lender')],
  ['14-loan-repaid', head('The outcome', 'Loan repaid. Relationship intact.', 'The final deduction is capped at the balance, deductions stop, the safeguard is cancelled, and both people see the same clear summary. 0% interest throughout.') + browserFrame(shots.repaid, '/borrower')],
];

// Architecture slide (pure HTML diagram)
const box = (title, lines, color = '#fff', border = '#E2DFD7') => `<div style="background:${color};border:1px solid ${border};border-radius:18px;padding:26px 28px;box-shadow:0 1px 2px rgba(16,24,32,.04)"><div style="font-size:26px;font-weight:650;color:${C.ink}">${title}</div><div style="margin-top:12px;font-size:20px;line-height:1.55;color:${C.muted}">${lines.join('<br>')}</div></div>`;
const arrow = `<div style="display:flex;align-items:center;justify-content:center;color:${C.green};font-size:40px">→</div>`;
slides.push(['15-how-it-works', head('How it’s built', 'AI helps. People decide. Code enforces.', 'PayPal moves the money, a tested rules engine decides every cent, and Gemini drafts, explains and listens, but never moves money.') + `
  <div style="position:absolute;left:96px;right:96px;top:290px;display:grid;grid-template-columns:1fr 70px 1.15fr 70px 1fr;gap:0;align-items:stretch">
    ${box('People', ['Ravi (borrower), Maya (lender), customers', 'React PWA · 4 languages', 'Voice: Web Speech API', 'PayPal JS SDK Buttons'])}
    ${arrow}
    ${box('FairLoop server', ['Repayment engine: integer cents, weekly minimum & cap, pause, review, payoff', 'Voice agent: Gemini function calling (data + UI tools)', 'Hash-chained ledger · idempotent by capture id'], '#E4F0E9', '#B9DCC8')}
    ${arrow}
    <div style="display:grid;gap:22px">
      ${box('PayPal (sandbox)', ['Orders v2 · Payouts', 'Subscriptions · Webhooks'])}
      ${box('Google Gemini', ['Function calling', 'Structured JSON output'])}
    </div>
  </div>
  <div style="position:absolute;left:96px;right:96px;top:700px">
    <div style="font-size:19px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${C.green}">The money flow</div>
    <div style="margin-top:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px">
      ${[['1', 'Ask', 'Gemini drafts fair terms from real income'], ['2', 'Approve', 'Both sign the same SHA-256-hashed terms'], ['3', 'Fund', 'Orders v2 capture, then a Payouts disbursement'], ['4', 'Earn', 'Each sale split in one Payouts batch'], ['5', 'Protect', 'Subscriptions safeguard: suspend or activate']]
        .map(([n, t, d]) => `<div style="background:#fff;border:1px solid #E2DFD7;border-radius:16px;padding:20px 22px"><div style="display:flex;align-items:center;gap:12px"><span style="width:34px;height:34px;border-radius:10px;background:#E4F0E9;color:${C.green};font-weight:650;font-size:18px;display:flex;align-items:center;justify-content:center">${n}</span><span style="font-size:23px;font-weight:650;color:${C.ink}">${t}</span></div><div style="margin-top:10px;font-size:18px;line-height:1.45;color:${C.muted}">${d}</div></div>`).join('')}
    </div>
  </div>
  <div style="position:absolute;left:96px;right:96px;bottom:56px;display:flex;gap:16px;flex-wrap:wrap">${chip('AI only proposes: humans approve every change')}${chip('Terms can never get harsher automatically')}${chip('AG Grid ledger · Render hosting')}${chip('38 tests + full browser test')}</div>`]);

const comp = await browser.newContext({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1 });
const cp = await comp.newPage();
for (const [name, html] of slides) {
  await cp.setContent(`<!doctype html><html><head>${fonts}</head><body style="margin:0;width:1800px;height:1200px;background:${C.paper};font-family:Geist,'Noto Sans Devanagari',system-ui,sans-serif;position:relative;overflow:hidden">${html}</body></html>`, { waitUntil: 'networkidle' });
  await cp.evaluate(() => document.fonts.ready);
  await cp.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 90 });
}
await browser.close();
srv.kill();
fs.rmSync(raw, { recursive: true, force: true });
console.log(`Gallery written to ${out}`);
