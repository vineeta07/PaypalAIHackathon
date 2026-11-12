// Renders the FairLoop PWA icons (original artwork) to PNG with headless Chromium.
// Usage: node scripts/icons.js   (writes into web/public/icons/)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const out = path.resolve('web/public/icons');
fs.mkdirSync(out, { recursive: true });

const glyph = (scale) => `<g transform="translate(256 256) scale(${scale}) translate(-16 -16)"><path d="M9 17a7 7 0 0 1 12-5l2-2v6h-6l2-2a4 4 0 1 0 1 4h3a7 7 0 0 1-14-1z" fill="#ffffff"/></g>`;
const svg = {
  any: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#166543"/>${glyph(13)}</svg>`,
  maskable: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#166543"/>${glyph(9.5)}</svg>`,
};
const jobs = [['icon-192.png', 'any', 192], ['icon-512.png', 'any', 512], ['maskable-512.png', 'maskable', 512], ['apple-touch-icon.png', 'maskable', 180]];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, kind, size] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg[kind].replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(out, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
fs.writeFileSync(path.join(out, 'icon.svg'), svg.any);
await browser.close();
console.log('Icons written to', out);
