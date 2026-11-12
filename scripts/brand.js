// FairLoop brand assets, generated from one geometric definition.
//
// The mark: a ring (the loop of money between two people who trust each other) with one
// segment lifted out in mint (the agreed share of every sale that goes back to the lender).
// It doubles as the repayment-progress ring used across the app.
//
// Usage: node scripts/brand.js
// Writes: web/public/{logo.svg,favicon.svg,icons/*}, docs/brand/*
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

export const COLORS = { green: '#166543', mint: '#9AD6B5', mintStrong: '#3E9E6E', ink: '#181B1F', paper: '#F6F5F1', night: '#101214', light: '#E8E6E1', greenDark: '#76B892' };
const GEO = { cx: 31, cy: 33, r: 15, w: 8, segFrom: -74, segTo: -16, gap: 11, lift: 3.4 };

const f = (n) => +n.toFixed(2);
export function paths(g = GEO) {
  const P = (t, o = [0, 0]) => { const a = (t * Math.PI) / 180; return [f(g.cx + g.r * Math.cos(a) + o[0]), f(g.cy + g.r * Math.sin(a) + o[1])]; };
  const mid = (((g.segFrom + g.segTo) / 2) * Math.PI) / 180;
  const off = [g.lift * Math.cos(mid), g.lift * Math.sin(mid)];
  const rs = P(g.segTo + g.gap); const re = P(g.segFrom - g.gap + 360);
  const ss = P(g.segFrom, off); const se = P(g.segTo, off);
  return { ring: `M${rs[0]} ${rs[1]}A${g.r} ${g.r} 0 1 1 ${re[0]} ${re[1]}`, share: `M${ss[0]} ${ss[1]}A${g.r} ${g.r} 0 0 1 ${se[0]} ${se[1]}`, w: g.w };
}

/** tile: rounded square app icon · bleed: full-bleed square (maskable) · flat: no background */
export function markSVG({ variant = 'tile', ring = '#FFFFFF', share = COLORS.mint, bg = COLORS.green, scale = 1 } = {}) {
  const p = paths();
  const g = scale === 1 ? '' : ` transform="translate(32 32) scale(${scale}) translate(-32 -32)"`;
  const back = variant === 'tile' ? `<rect width="64" height="64" rx="15" fill="${bg}"/>` : variant === 'bleed' ? `<rect width="64" height="64" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${back}<g${g} fill="none" stroke-width="${p.w}"><path d="${p.ring}" stroke="${ring}"/><path d="${p.share}" stroke="${share}"/></g></svg>`;
}

export async function generate() {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const pub = path.resolve('web/public'); const icons = path.join(pub, 'icons'); const docs = path.resolve('docs/brand');
  for (const d of [icons, docs]) fs.mkdirSync(d, { recursive: true });

  const tile = markSVG();
  const flatLight = markSVG({ variant: 'flat', ring: COLORS.green, share: COLORS.mintStrong });
  const flatDark = markSVG({ variant: 'flat', ring: '#FFFFFF', share: COLORS.mint });
  fs.writeFileSync(path.join(pub, 'logo.svg'), tile);
  fs.writeFileSync(path.join(pub, 'favicon.svg'), tile);
  fs.writeFileSync(path.join(icons, 'icon.svg'), tile);
  fs.writeFileSync(path.join(docs, 'mark.svg'), tile);
  fs.writeFileSync(path.join(docs, 'mark-flat.svg'), flatLight);
  fs.writeFileSync(path.join(docs, 'mark-flat-dark.svg'), flatDark);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fonts = '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700&display=swap" rel="stylesheet">';
  async function render(file, html, w, h, scale = 1, transparent = true) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><head>${fonts}<style>html,body{margin:0;background:transparent}*{box-sizing:border-box}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const prev = page.viewportSize();
    await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h }, scale: scale === 1 ? 'css' : 'device' });
    return prev;
  }
  const svgAt = (svg, s) => svg.replace('<svg ', `<svg width="${s}" height="${s}" `);

  // App icons (PWA, Apple, favicon fallback)
  for (const [file, svg, size] of [
    ['icon-192.png', tile, 192], ['icon-512.png', tile, 512],
    ['maskable-512.png', markSVG({ variant: 'bleed', scale: 0.78 }), 512],
    ['apple-touch-icon.png', markSVG({ variant: 'bleed', scale: 0.86 }), 180],
  ]) await render(path.join(icons, file), svgAt(svg, size), size, size);

  // Horizontal lockups (rendered at 2x for crisp README display)
  const lockup = (dark) => `<div style="display:flex;align-items:center;gap:22px;padding:8px 10px;font-family:Geist,system-ui,sans-serif">
    ${svgAt(tile, 88)}
    <div style="font-size:64px;font-weight:650;letter-spacing:-0.035em;line-height:1;color:${dark ? COLORS.light : COLORS.ink}">Fair<span style="color:${dark ? COLORS.greenDark : COLORS.green}">Loop</span></div></div>`;
  for (const [file, dark] of [['fairloop-logo-light.png', false], ['fairloop-logo-dark.png', true]]) {
    const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 440, height: 108 } });
    const pg = await ctx.newPage();
    await pg.setContent(`<!doctype html><html><head>${fonts}<style>html,body{margin:0;background:transparent}</style></head><body>${lockup(dark)}</body></html>`, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: path.join(docs, file), omitBackground: true });
    await ctx.close();
  }

  // Social / Devpost card 1280x640
  {
    const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1280, height: 640 } });
    const pg = await ctx.newPage();
    const chip = (t) => `<span style="display:inline-block;border:1px solid #E2DFD7;background:#fff;border-radius:999px;padding:10px 18px;font-size:22px;color:#4F5560;margin:0 10px 10px 0">${t}</span>`;
    await pg.setContent(`<!doctype html><html><head>${fonts}</head><body style="margin:0;width:1280px;height:640px;background:${COLORS.paper};font-family:Geist,system-ui,sans-serif;position:relative;overflow:hidden">
      <div style="position:absolute;right:-120px;top:50%;transform:translateY(-50%);opacity:1">${svgAt(markSVG({ variant: 'flat', ring: '#E9E6DE', share: '#D5EBDD' }), 620)}</div>
      <div style="position:absolute;left:88px;top:84px;right:420px">
        <div style="display:flex;align-items:center;gap:20px">${svgAt(tile, 76)}<div style="font-size:54px;font-weight:650;letter-spacing:-0.035em;color:${COLORS.ink}">Fair<span style="color:${COLORS.green}">Loop</span></div></div>
        <div style="margin-top:56px;font-size:56px;line-height:1.08;font-weight:650;letter-spacing:-0.03em;color:${COLORS.ink}">Lend to people you trust. Get repaid from what they earn.</div>
        <div style="margin-top:26px;font-size:26px;line-height:1.4;color:#5C626B">Interest-free family loans, repaid automatically from each PayPal sale. Nothing is taken in a slow week.</div>
        <div style="margin-top:34px">${chip('PayPal Orders · Payouts · Subscriptions')}${chip('Gemini voice assistant')}${chip('English · हिन्दी · Français · Español')}</div>
      </div></body></html>`, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: path.join(docs, 'social-card.png') });
    await ctx.close();
  }
  await browser.close();
  console.log('Brand assets written to web/public and docs/brand');
}

if (import.meta.url === `file://${process.argv[1]}`) await generate();
