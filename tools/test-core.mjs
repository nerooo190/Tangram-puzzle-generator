// Tests für den gemeinsamen Kern. Aufruf: node tools/test-core.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Rng } from '../web/js/core/prng.js';
import { TYPES, ORIENT, placementVerts, polyArea, overlaps, contactLength, SET_AREA } from '../web/js/core/geom.js';
import { generateAbstract, generatePattern, STYLES, PATTERNS } from '../web/js/core/generate.js';
import { hasHole } from '../web/js/core/raster.js';
import { packBits, unpackBits, maskFromPolys, maskFromJson, maskToJson } from '../web/js/core/mask.js';
import { solve } from '../web/js/core/fit.js';

const REGRESSION = [3038352894, 2882657882, 1370931434]; // gleiche Werte prüft godot/tests/lib_test.gd
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✘ ${name}\n   ${e.message}`); }
}

function checkAssembly(pls, expectedPieces, label) {
  assert.equal(pls.length, expectedPieces, `${label}: Teilezahl`);
  const polys = pls.map(placementVerts);
  const area = polys.reduce((s, v) => s + polyArea(v), 0);
  assert.ok(Math.abs(area - (expectedPieces / 7) * SET_AREA) < 1e-4, `${label}: Fläche ${area}`);
  for (let a = 0; a < polys.length; a++) for (let b = a + 1; b < polys.length; b++) {
    assert.ok(!overlaps(polys[a], polys[b], 1e-4), `${label}: Teile ${a}/${b} überlappen`);
  }
  // zusammenhängend über Kantenkontakt
  const seen = new Set([0]), st = [0];
  while (st.length) {
    const i = st.pop();
    for (let j = 0; j < polys.length; j++) if (!seen.has(j) && contactLength(polys[i], polys[j], 1e-4) > 1e-4) { seen.add(j); st.push(j); }
  }
  assert.equal(seen.size, polys.length, `${label}: nicht zusammenhängend`);
  return polys;
}

test('Teile: Flächen und Kanten', () => {
  const areas = TYPES.map((t, i) => polyArea(ORIENT[i][0].v));
  assert.deepEqual(areas.map((a) => Math.round(a * 1e9) / 1e9), TYPES.map((t) => t.area));
  for (let t = 0; t < 5; t++) for (let f = 0; f < 2; f++) assert.ok(polyArea(ORIENT[t][f].v) > 0, `positive Fläche ${t}/${f}`);
});

test('PRNG: Regressionswerte und Gleichverteilung', () => {
  const r = new Rng('tangram');
  assert.deepEqual([r.nextU32(), r.nextU32(), r.nextU32()], REGRESSION);
  const q = new Rng('x'); const cnt = [0, 0, 0, 0, 0];
  for (let i = 0; i < 50000; i++) cnt[q.int(5)]++;
  assert.ok(cnt.every((c) => Math.abs(c - 10000) < 400), `Verteilung ${cnt}`);
});

test('Abstrakte Figuren: gültig, deterministisch, 1–3 Sätze', () => {
  for (const style of Object.keys(STYLES)) for (let sets = 1; sets <= 3; sets++) for (let i = 0; i < (sets === 1 ? 120 : 25); i++) {
    const seed = `${style}:${i}:${sets}`;
    const a = generateAbstract(seed, style, sets);
    checkAssembly(a, 7 * sets, seed);
    assert.ok(!hasHole(a.map(placementVerts)), `${seed}: Loch`);
    assert.deepEqual(a, generateAbstract(seed, style, sets), `${seed}: nicht deterministisch`);
  }
});

test('Riesige Nummern (22 Stellen) funktionieren als Seed', () => {
  const a = generateAbstract('zufall:1000000000000000000000:1', 'frei', 1);
  const b = generateAbstract('zufall:1000000000000000000001:1', 'frei', 1);
  checkAssembly(a, 7, 'big'); checkAssembly(b, 7, 'big+1');
  assert.notDeepEqual(a, b);
});

test('Muster: gültig und symmetrisch', () => {
  for (const kind of Object.keys(PATTERNS)) for (let i = 0; i < 40; i++) {
    const pls = generatePattern(`${kind}:${i}:1`, kind, 1);
    const n = kind === 'vier' ? 28 : 14;
    const polys = checkAssembly(pls, n, `${kind}:${i}`);
    if (kind !== 'punkt') {
      // Spiegelsymmetrie an der Mittelachse x=0 (Bounding-Box zentriert)
      const key = (v) => v.map((p) => `${Math.round(p[0] * 1e3)},${Math.round(p[1] * 1e3)}`).sort().join(';');
      const set = new Set(polys.map(key));
      const mirrored = polys.map((v) => key(v.map((p) => [-p[0], p[1]])));
      assert.ok(mirrored.every((k) => set.has(k)), `${kind}:${i} nicht spiegelsymmetrisch`);
    }
  }
});

test('Muster mit größerer Basis (2 Sätze)', () => {
  for (const kind of Object.keys(PATTERNS)) for (let i = 0; i < 6; i++) {
    const pls = generatePattern(`${kind}:${i}:2`, kind, 2);
    checkAssembly(pls, PATTERNS[kind].mult * 14, `${kind}:${i}:2`);
  }
});

test('Masken: Bit-Packung und Normierung', () => {
  const bits = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7919) % 3 === 0 ? 1 : 0);
  assert.deepEqual(unpackBits(packBits(bits), bits.length), bits);
  const m = maskFromPolys([[[0, 0], [3, 0], [3, 1], [0, 1]]]);
  let ones = 0; for (const b of m.bits) ones += b;
  assert.ok(Math.abs(ones * m.c * m.c - 8) < 1e-9, 'Fläche normiert auf 8');
  assert.deepEqual(maskFromJson(maskToJson(m)).bits, m.bits);
});

test('Solver: Rechteck 2:1 wird perfekt gelegt, Quadrat nahezu', () => {
  const rect = solve(maskFromPolys([[[0, 0], [2, 0], [2, 1], [0, 1]]]), { seed: 'r', restarts: 8, iters: 12000, topK: 1 });
  assert.ok(rect[0].iou > 0.999, `Rechteck IoU ${rect[0].iou}`);
  checkAssembly(rect[0].pls, 7, 'rechteck');
  const sq = solve(maskFromPolys([[[0, 0], [1, 0], [1, 1], [0, 1]]]), { seed: 's', restarts: 8, iters: 12000, topK: 1 });
  assert.ok(sq[0].iou > 0.93, `Quadrat IoU ${sq[0].iou}`);
  const again = solve(maskFromPolys([[[0, 0], [2, 0], [2, 1], [0, 1]]]), { seed: 'r', restarts: 8, iters: 12000, topK: 1 });
  assert.deepEqual(again[0].pls, rect[0].pls, 'Solver deterministisch');
});

test('Solver: mehrere Sätze (14 Teile)', () => {
  const m = maskFromPolys([[[0, 0], [4, 0], [4, 1], [0, 1]]]);
  const s = solve(m, { sets: 2, seed: 'two', restarts: 4, iters: 8000, topK: 1 });
  checkAssembly(s[0].pls, 14, 'sets2');
  assert.ok(s[0].iou > 0.8, `IoU ${s[0].iou}`);
});

test('Gebackene Pakete: alle Lösungen gültig', () => {
  const dir = 'web/data/packs';
  const index = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'));
  const ids = new Set(); let n = 0, sols = 0;
  for (const e of index) {
    const pack = JSON.parse(fs.readFileSync(`${dir}/${e.id}.json`, 'utf8'));
    assert.equal(pack.format, 'tangram-pack/1');
    for (const f of pack.figures) {
      assert.ok(!ids.has(f.id), `doppelte Figur-ID ${f.id}`); ids.add(f.id); n++;
      assert.ok(f.sols.length >= 1);
      for (const s of f.sols) {
        checkAssembly(s.p, 7, `${f.id}`); sols++;
        assert.ok(s.iou > 0.45 && s.iou <= 1, `${f.id}: IoU ${s.iou}`);
      }
    }
  }
  console.log(`   ${n} Figuren, ${sols} Lösungen geprüft`);
  assert.ok(n >= 400);
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
