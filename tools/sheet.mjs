// Rendert Puzzles (Listen von Platzierungen) als Kontaktbogen-PNG (zum Prüfen).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { placementVerts, bbox } from '../web/js/core/geom.js';
const require = createRequire('/opt/node22/lib/node_modules/');
const COLORS = ['#e4572e', '#17bebb', '#f2a900', '#76b041', '#4357ad', '#b5179e'];

export function svgFor(pls, size = 200, colored = true, label = '') {
  const polys = pls.map(placementVerts);
  const bb = bbox(polys);
  const w = bb[2] - bb[0], h = bb[3] - bb[1], s = (size - 24) / Math.max(w, h, 1);
  const ox = size / 2 - ((bb[0] + bb[2]) / 2) * s, oy = size / 2 - ((bb[1] + bb[3]) / 2) * s;
  const pts = (v) => v.map((p) => `${(p[0] * s + ox).toFixed(2)},${(p[1] * s + oy).toFixed(2)}`).join(' ');
  let body = polys.map((v, i) => colored
    ? `<polygon points="${pts(v)}" fill="${COLORS[pls[i][0]]}" stroke="#222" stroke-width="1"/>`
    : `<polygon points="${pts(v)}" fill="#223" stroke="#223" stroke-width="1" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="background:#fff;border:1px solid #ccc">${body}<text x="4" y="14" font-size="11" font-family="sans-serif" fill="#555">${label}</text></svg>`;
}

export async function sheet(items, file, { size = 200, cols = 6, colored = true } = {}) {
  const { chromium } = require('playwright');
  const html = `<body style="margin:6px;display:grid;grid-template-columns:repeat(${cols},${size}px);gap:6px;font-family:sans-serif">` +
    items.map((it) => svgFor(it.pls, size, colored, it.label || '')).join('') + '</body>';
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: cols * (size + 6) + 12, height: 400 } });
  await page.setContent(html);
  await page.screenshot({ path: file, fullPage: true });
  await browser.close();
}
