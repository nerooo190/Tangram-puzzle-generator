// Backt die Formen-Pakete: Glyphen -> Silhouetten-Masken -> Tangram-Lösungen (Solver) -> JSON-Packs.
// Aufruf: node tools/bake.mjs [--only=tiere,essen] [--limit=5] [--restarts=40] [--iters=25000]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import { loadCatalog } from './catalog.mjs';
import { maskFromBitmap, maskToJson } from '../web/js/core/mask.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const only = args.only ? String(args.only).split(',') : null;
const limit = args.limit ? Number(args.limit) : Infinity;
const restarts = Number(args.restarts || 40), iters = Number(args.iters || 25000), topK = Number(args.topk || 10);
const outDir = path.resolve('web/data/packs');
fs.mkdirSync(outDir, { recursive: true });

const catalog = loadCatalog().filter((c) => !only || only.includes(c.id));
for (const c of catalog) c.figures = c.figures.slice(0, limit);

// 1) Glyphen rastern (Chromium)
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent('<canvas id=c width=320 height=320></canvas>');
async function rasterize(glyph, mode) {
  return page.evaluate(async ([glyph, mode]) => {
    const cv = document.getElementById('c'), ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 320, 320);
    ctx.fillStyle = '#000';
    if (mode === 'emoji') { ctx.font = '230px "Noto Color Emoji"'; ctx.textAlign = 'left'; ctx.fillText(glyph, 40, 245); }
    else { ctx.font = 'bold 250px "DejaVu Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(glyph, 160, 245); }
    const d = ctx.getImageData(0, 0, 320, 320).data;
    let s = '';
    for (let i = 3; i < d.length; i += 4) s += d[i] > 24 ? '1' : '0';
    return s;
  }, [glyph, mode]);
}
const toBin = (s) => Uint8Array.from(s, (ch) => (ch === '1' ? 1 : 0));
const tofu = await rasterize('\u{10FFFD}', 'emoji');

const tasks = [];
const meta = new Map();
const skipped = [];
for (const cat of catalog) {
  for (const fig of cat.figures) {
    const s = await rasterize(fig.glyph, cat.mode);
    const bin = toBin(s);
    const empty = !s.includes('1');
    if (empty || (cat.mode === 'emoji' && s === tofu)) { skipped.push(`${cat.id}/${fig.name} ${fig.glyph}`); continue; }
    const mask = maskFromBitmap(bin, 320, 320);
    if (!mask) { skipped.push(`${cat.id}/${fig.name} (Maske)`); continue; }
    fig.mask = maskToJson(mask);
    tasks.push({ id: fig.id, mask: fig.mask, restarts, iters, topK });
    meta.set(fig.id, { cat, fig });
  }
}
await browser.close();
console.log(`Figuren: ${tasks.length}, übersprungen: ${skipped.length}`, skipped);

// 2) Lösen (parallel)
const results = new Map();
let next = 0, done = 0;
const t0 = Date.now();
await new Promise((resolve) => {
  const n = Math.min(os.cpus().length, tasks.length);
  let alive = n;
  for (let w = 0; w < n; w++) {
    const worker = new Worker(new URL('./bake-worker.mjs', import.meta.url));
    const feed = () => {
      if (next >= tasks.length) { worker.terminate(); if (--alive === 0) resolve(); return; }
      worker.postMessage(tasks[next++]);
    };
    worker.on('message', (m) => {
      results.set(m.id, m.sols); done++;
      if (done % 20 === 0) console.log(`  ${done}/${tasks.length}  (${Math.round((Date.now() - t0) / 1000)}s)`);
      feed();
    });
    feed();
  }
});

// 3) Schreiben
const index = [];
for (const cat of catalog) {
  const figures = [];
  for (const fig of cat.figures) {
    const sols = results.get(fig.id);
    if (!sols || !sols.length) continue;
    const best = sols[0].iou;
    const keep = sols.filter((s) => s.iou >= best - 0.12);
    figures.push({
      id: fig.id, name: fig.name, glyph: fig.glyph, mask: fig.mask,
      sols: keep.map((s) => ({ iou: s.iou, p: s.pls })),
    });
  }
  const pack = { format: 'tangram-pack/1', id: cat.id, name: cat.name, icon: cat.icon, figures };
  fs.writeFileSync(path.join(outDir, `${cat.id}.json`), JSON.stringify(pack));
  index.push({ id: cat.id, name: cat.name, icon: cat.icon, count: figures.length });
  const avg = figures.reduce((s, f) => s + f.sols[0].iou, 0) / Math.max(1, figures.length);
  console.log(`${cat.id}: ${figures.length} Figuren, Ø beste IoU ${avg.toFixed(3)}`);
}
if (!only) fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index));
// dieselben Pakete für das Godot-Projekt
const godotDir = path.resolve('godot/tangram/data/packs');
fs.mkdirSync(godotDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.copyFileSync(path.join(outDir, f), path.join(godotDir, f));
console.log('fertig in', Math.round((Date.now() - t0) / 1000), 's');
