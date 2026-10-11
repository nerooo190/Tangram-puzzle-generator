// Kontaktbogen: Glyphe neben bester Tangram-Lösung. Aufruf: node tools/review.mjs <pack-id> <out.png> [start] [count]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { svgFor } from './sheet.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const [packId, out, start = 0, count = 24, variant = 0] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(`web/data/packs/${packId}.json`, 'utf8'));
const figs = pack.figures.slice(Number(start), Number(start) + Number(count));
const cells = figs.map((f) => {
  const s = f.sols[Math.min(Number(variant), f.sols.length - 1)];
  return `<div style="display:flex;align-items:center;gap:2px;border:1px solid #ddd"><div style="width:70px;text-align:center;font:62px 'Noto Color Emoji','DejaVu Sans'">${f.glyph}</div>${svgFor(s.p, 150, true, f.name + ' ' + s.iou)}</div>`;
});
const html = `<body style="margin:6px;display:grid;grid-template-columns:repeat(4,240px);gap:6px">${cells.join('')}</body>`;
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1000, height: 400 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
