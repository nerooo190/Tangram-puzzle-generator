// Ende-zu-Ende-Test der Web-App (Playwright/Chromium). Aufruf: node tools/e2e.mjs [screenshot-dir]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const shots = process.argv[2] || null;
const root = path.resolve('web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✔' : '✘'} ${msg}`); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const snap = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, `${n}.png`) }); };

await page.goto(url);
await page.waitForFunction(() => window.__tangram && document.querySelectorAll('#board .piece').length > 0, null, { timeout: 15000 });
ok(await page.locator('#board .piece').count() === 7, '7 Teile im Standard-Puzzle');
const cats = await page.locator('#catList .cat').count();
ok(cats >= 19, `Kategorien in Seitenleiste: ${cats}`);
await snap('01-start');

// Riesige Nummer
await page.fill('#numInput', '1000000000000000000000');
await page.press('#numInput', 'Enter');
await page.waitForTimeout(600);
ok((await page.inputValue('#numInput')).replace(/\D/g, '') === '1000000000000000000000', 'Nummer 10^21 wird angenommen');
ok(page.url().includes('1000000000000000000000'), 'URL-Hash enthält die Nummer');
ok(await page.locator('#board .piece').count() === 7, 'Puzzle Nr. 10^21 geladen (live berechnet)');
await snap('02-big');

// Abstrakte Kategorie mit Teilen x2
await page.evaluate(() => window.__tangram.selectCategory('kompakt', 12345678901234567890123n));
await page.selectOption('#setsSel', '2');
await page.waitForTimeout(500);
ok(await page.locator('#board .piece').count() === 14, '14 Teile bei 2 Sätzen');
await snap('03-sets2');
await page.selectOption('#setsSel', '1');

// Muster
await page.evaluate(() => window.__tangram.selectCategory('kaleidoskop', 7n));
await page.waitForTimeout(400);
ok(await page.locator('#board .piece').count() === 28, 'Kaleidoskop hat 28 Teile');
await snap('04-pattern');

// Spielen: Ziehen + Rastern + Lösen
await page.evaluate(() => window.__tangram.selectCategory('tiere', 3n));
await page.waitForTimeout(300);
const before = await page.evaluate(() => window.__tangram.board.pieces[0].pl.slice());
const pt = await page.evaluate(() => {
  const b = window.__tangram.board, p = b.pieces[0], v = p.verts;
  const c = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3];
  const svg = document.getElementById('board'), m = svg.getScreenCTM(), q = svg.createSVGPoint();
  q.x = c[0]; q.y = c[1]; const r = q.matrixTransform(m); return [r.x, r.y];
});
await page.mouse.move(pt[0], pt[1]);
await page.mouse.down();
await page.mouse.move(pt[0] + 60, pt[1] - 40, { steps: 6 });
await page.mouse.up();
const after = await page.evaluate(() => window.__tangram.board.pieces[0].pl.slice());
ok(before[3] !== after[3] || before[4] !== after[4], 'Teil lässt sich ziehen');
await page.evaluate(() => { const b = window.__tangram.board; b.select(b.pieces[2]); });
const r0 = await page.evaluate(() => window.__tangram.board.sel.pl[1]);
await page.keyboard.press('r');
const r1 = await page.evaluate(() => window.__tangram.board.sel.pl[1]);
ok(((r0 + 1) % 8) === r1, 'Taste R dreht um 45°');
await snap('05-play');
ok(await page.evaluate(() => window.__tangram.board.hint()), 'Tipp liefert Geisterteil');
page.once('dialog', (d) => d.accept());
await page.click('#solveBtn');
await page.waitForTimeout(1200);
ok(await page.locator('#win').isVisible(), 'Gewinn-Anzeige nach Lösung');
await snap('06-win');
await page.click('#winNext');
await page.waitForTimeout(400);

// Genaues Lösen per Code: jedes Teil exakt platzieren -> Gewinn muss erkannt werden
await page.evaluate(() => window.__tangram.selectCategory('essen', 5n));
await page.waitForTimeout(300);
const solved = await page.evaluate(() => {
  const b = window.__tangram.board;
  const cov0 = b.coverage();
  b.showSolution();
  return { cov0, solved: b.solved };
});
ok(solved.cov0.covered < 0.5 && solved.solved, 'Anfangs ungelöst, nach Platzierung gelöst');

// Echter Spielpfad: alle Teile per Maus ungefähr an die richtige Stelle ziehen -> Einrasten -> gelöst
for (const [catId, n] of [['tiere', 8n], ['kompakt', 99n], ['essen', 3n], ['buchstaben', 7n], ['zufall', 5n], ['lang', 12n], ['verzweigt', 31n], ['spiegel', 2n], ['natur', 20n]]) {
  await page.evaluate(([c, nn]) => window.__tangram.selectCategory(c, BigInt(nn)), [catId, String(n)]);
  await page.waitForTimeout(400);
  const count = await page.evaluate(() => window.__tangram.board.pieces.length);
  let wonByHand = false;
  for (let k = 0; k < count; k++) {
    const plan = await page.evaluate(async (k) => {
      const g = await import('./js/core/geom.js');
      const b = window.__tangram.board;
      const sp = b.solPls[k];
      const used = window.__used || (window.__used = new Set());
      if (k === 0) used.clear();
      const p = b.pieces.find((q) => q.type === sp[0] && !used.has(q));
      used.add(p);
      b.select(p);
      const norm = (verts) => { const c = g.polyCentroid(verts); return verts.map((v) => `${Math.round((v[0] - c[0]) * 100)},${Math.round((v[1] - c[1]) * 100)}`).sort().join(';'); };
      const want = norm(b.solPolys[k]);
      for (let i = 0; i < 16; i++) {
        if (norm(g.placementVerts(p.pl)) === want) break;
        if (i === 8) b.flip(); else b.rotate(1);
      }
      const tc = g.polyCentroid(b.solPolys[k]), pc = g.polyCentroid(g.placementVerts(p.pl));
      const svg = document.getElementById('board'), m = svg.getScreenCTM();
      const toScreen = (c) => { const q = svg.createSVGPoint(); q.x = c[0]; q.y = c[1]; const r = q.matrixTransform(m); return [r.x, r.y]; };
      return { from: toScreen(pc), to: toScreen([tc[0] + 0.12, tc[1] - 0.1]), match: norm(g.placementVerts(p.pl)) === want };
    }, k);
    if (!plan.match) { ok(false, `${catId}: Ausrichtung für Teil ${k} nicht gefunden`); break; }
    await page.mouse.move(plan.from[0], plan.from[1]);
    await page.mouse.down();
    await page.mouse.move((plan.from[0] + plan.to[0]) / 2, (plan.from[1] + plan.to[1]) / 2, { steps: 3 });
    await page.mouse.move(plan.to[0], plan.to[1], { steps: 3 });
    await page.mouse.up();
  }
  wonByHand = await page.evaluate(() => window.__tangram.board.solved && !window.__tangram.board.gaveUp);
  ok(wonByHand, `${catId} Nr. ${n}: per Maus (mit Einrasten) von Hand gelöst`);
  await page.waitForTimeout(1200);
  ok(await page.locator('#win').isVisible(), `${catId}: Gewinn-Karte erscheint nach Handlösung`);
  await snap(`06b-hand-${catId}`);
}

// Galerie + Live-Variante (außerhalb der gebackenen Varianten)
await page.evaluate(() => window.__tangram.selectCategory('tiere', 0n));
await page.click('#galBtn');
await page.waitForTimeout(1500);
ok(await page.locator('#galGrid .thumb svg').count() >= 8, 'Galerie zeigt Vorschauen');
await snap('07-gallery');
await page.click('#galBtn');
const nFig = await page.evaluate(() => window.__tangram.service.category('tiere').figures.length);
const live = await page.evaluate(async (nFig) => { const t = performance.now(); window.__tangram.go(BigInt(nFig) * 40n + 5n); return t; }, nFig);
await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 30000 });
await page.waitForTimeout(300);
ok(await page.locator('#board .piece').count() === 7 && await page.locator('#loading').isHidden(), `Live-Variante (Nr. ${nFig * 40 + 5}) berechnet`);
await snap('08-live');

// Eigene Kategorie
await page.click('#newCatBtn');
await page.fill('#catNameInp', 'Testwelt');
await page.fill('#catGlyphs', '🦖 🍔\nHUND');
await page.click('#catSave');
await page.waitForFunction(() => window.__tangram.state.cat.custom, null, { timeout: 15000 });
await page.waitForTimeout(3500);
ok(await page.locator('#board .piece').count() === 7, 'Eigene Kategorie erzeugt spielbares Puzzle');
ok((await page.evaluate(() => window.__tangram.state.cat.figures.length)) === 3, 'Drei eigene Formen gerastert');
await snap('09-custom');

// Import: bösartiges Paket (HTML im Glyph) darf nichts ausführen, kaputte Pakete werden abgelehnt
{
  const good = await page.evaluate(() => {
    const f = window.__tangram.service.category('tiere').figures[0];
    return { format: 'tangram-pack/1', id: 'evil', name: 'Evil <b>x</b>', icon: '⭐', figures: [{ id: 'e1', name: '<i>n</i>', glyph: '<img src=x onerror="window.__xss=1">', mask: f.mask, sols: f.sols.slice(0, 1) }] };
  });
  await page.setInputFiles('#importFile', { name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
  await page.waitForFunction(() => window.__tangram.state.cat.id === 'evil', null, { timeout: 5000 });
  await page.click('#galBtn');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => window.__xss === undefined) && await page.locator('#galGrid img').count() === 0, 'Import: HTML im Glyph wird nicht ausgeführt');
  await page.click('#galBtn');
  let alerted = false;
  page.once('dialog', (d) => { alerted = true; d.accept(); });
  const bad = { format: 'tangram-pack/1', id: 'bad', name: 'bad', figures: [{ id: 'b', name: 'b', glyph: 'b', mask: { w: 100000, h: 100000, c: 1, bits: 'AAAA' } }] };
  await page.setInputFiles('#importFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await page.waitForTimeout(500);
  ok(alerted && (await page.evaluate(() => window.__tangram.service.category('bad'))) === undefined, 'Import: ungültiges Paket wird abgelehnt');
}

// Mobil
await page.setViewportSize({ width: 390, height: 780 });
await page.evaluate(() => window.__tangram.selectCategory('fahrzeuge', 2n));
await page.waitForTimeout(500);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobil: kein horizontales Scrollen');
await snap('10-mobile');

ok(errors.length === 0, `keine Konsolenfehler ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
await browser.close();
server.close();
console.log(fails ? `\n${fails} Fehler` : '\nAlle Tests bestanden');
process.exit(fails ? 1 : 0);
