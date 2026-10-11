// Solver: legt einen Satz Tangram-Teile (Simulated Annealing) so, dass die Silhouette einer Zielmaske
// möglichst gut getroffen wird (Maß: IoU). Rein deterministisch bei gleichem Seed.

import { Rng } from './prng.js';
import {
  kitTypes, TYPES, placementVerts, sampleAttach, overlaps, polyArea, polyCentroid, mapPlacement,
  gMul, gInv, linearMap, rotPt, round6, COS, SIN,
} from './geom.js';

function prepare(mask, sets) {
  const { w, h, c, bits } = mask;
  const P = new Int32Array(h * (w + 1));
  let ones = 0, sx = 0, sy = 0;
  for (let j = 0; j < h; j++) {
    let run = 0;
    for (let i = 0; i < w; i++) {
      if (bits[j * w + i]) { run++; ones++; sx += i; sy += j; }
      P[j * (w + 1) + i + 1] = run;
    }
  }
  const cw = c * Math.sqrt(sets);
  return { w, h, c, cw, P, ones, tcx: sx / ones, tcy: sy / ones, totalCells: (8 * sets) / (cw * cw) };
}

const QX = new Float64Array(8), QY = new Float64Array(8);

/** IoU der Polygone (in Assembly-Koordinaten) nach Drehung g und Zentroid-Ausrichtung (+Verschiebung in Zellen). */
function evalIoU(T, polys, g, sx, sy, cA) {
  const cs = COS[g], sn = SIN[g], inv = 1 / T.cw;
  // kleiner Versatz verhindert exakte Gleichstände (Kante genau auf Zellmitte) -> keine Doppelzählung
  const ox = T.tcx + sx + 0.01371, oy = T.tcy + sy + 0.00913;
  let inter = 0;
  const { w, h, P } = T;
  for (let k = 0; k < polys.length; k++) {
    const v = polys[k], n = v.length;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = v[i][0] - cA[0], y = v[i][1] - cA[1];
      const qx = (x * cs - y * sn) * inv + ox, qy = (x * sn + y * cs) * inv + oy;
      QX[i] = qx; QY[i] = qy;
      if (qy < ymin) ymin = qy; if (qy > ymax) ymax = qy;
    }
    let j0 = Math.ceil(ymin), j1 = Math.ceil(ymax) - 1;
    if (j0 < 0) j0 = 0; if (j1 > h - 1) j1 = h - 1;
    for (let j = j0; j <= j1; j++) {
      let xl = Infinity, xr = -Infinity;
      for (let e = 0; e < n; e++) {
        const e2 = e + 1 === n ? 0 : e + 1;
        const py = QY[e], qy2 = QY[e2];
        if ((py <= j && qy2 > j) || (qy2 <= j && py > j)) {
          const x = QX[e] + ((j - py) * (QX[e2] - QX[e])) / (qy2 - py);
          if (x < xl) xl = x; if (x > xr) xr = x;
        }
      }
      if (xl > xr) continue;
      let i0 = Math.ceil(xl), i1 = Math.ceil(xr) - 1;
      if (i0 < 0) i0 = 0; if (i1 > w - 1) i1 = w - 1;
      if (i1 >= i0) inter += P[j * (w + 1) + i1 + 1] - P[j * (w + 1) + i0];
    }
  }
  return inter / (T.ones + T.totalCells - inter);
}

/** exp(x) für x <= 0 nur mit Grundrechenarten (bit-genau auf allen Plattformen, auch in GDScript). */
export function expNeg(x) {
  if (x < -30) return 0;
  const y = x / 64;
  let t = 1 + y * (1 + y * (1 / 2 + y * (1 / 6 + y * (1 / 24 + y * (1 / 120 + y * (1 / 720))))));
  for (let i = 0; i < 6; i++) t *= t;
  return t;
}

function powInt(x, m) {
  let r = 1, b = x;
  while (m > 0) { if (m & 1) r *= b; b *= b; m >>= 1; }
  return r;
}

/** r mit r^m = t1/t0 (nur Multiplikationen/Vergleiche -> plattformunabhängig identisch). */
export function geoRatio(t0, t1, m) {
  const target = t1 / t0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (powInt(mid, m) > target) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function centroidOf(polys) {
  let A = 0, cx = 0, cy = 0;
  for (const v of polys) {
    const a = polyArea(v), c = polyCentroid(v);
    A += a; cx += a * c[0]; cy += a * c[1];
  }
  return [cx / A, cy / A];
}

function buildInitial(rng, types) {
  for (;;) {
    const pls = [], vs = [], parent = [-1];
    const first = [types[0], rng.int(8), TYPES[types[0]].chiral ? rng.int(2) : 0, 0, 0];
    pls.push(first); vs.push(placementVerts(first));
    let ok = true;
    for (let i = 1; i < types.length; i++) {
      const placed = pls.map((pl, k) => ({ pl, v: vs[k] }));
      const c = sampleAttach(placed, types[i], rng, 60);
      if (!c) { ok = false; break; }
      pls.push(c.pl); vs.push(c.v); parent.push(c.parent);
    }
    if (ok) return { pls, vs, parent };
  }
}

function descendants(parent, i) {
  const inD = new Array(parent.length).fill(false);
  inD[i] = true;
  let changed = true;
  while (changed) {
    changed = false;
    for (let k = 0; k < parent.length; k++) if (!inD[k] && parent[k] >= 0 && inD[parent[k]]) { inD[k] = true; changed = true; }
  }
  return inD;
}

/** Schneidet Teilbaum ab und hängt ihn starr woanders an. Liefert neuen Zustand oder null. */
function graft(S, types, rng) {
  const n = S.pls.length;
  const i = 1 + rng.int(n - 1);
  const inD = descendants(S.parent, i);
  const rest = [];
  for (let k = 0; k < n; k++) if (!inD[k]) rest.push(k);
  const placed = rest.map((k) => ({ pl: S.pls[k], v: S.vs[k] }));
  const c = sampleAttach(placed, types[i], rng, 25);
  if (!c) return null;
  const old = S.pls[i];
  const inv = gInv(old[1], old[2]);
  const L = gMul(c.pl[1], c.pl[2], inv[0], inv[1]);
  const lt = linearMap(L[0], L[1], old[3], old[4]);
  const ux = c.pl[3] - lt[0], uy = c.pl[4] - lt[1];
  const pls = S.pls.slice(), vs = S.vs.slice(), parent = S.parent.slice();
  for (let k = 0; k < n; k++) {
    if (!inD[k]) continue;
    pls[k] = k === i ? c.pl : mapPlacement(S.pls[k], L[0], L[1], ux, uy);
    vs[k] = k === i ? c.v : placementVerts(pls[k]);
  }
  parent[i] = rest[c.parent];
  for (let k = 0; k < n; k++) {
    if (!inD[k] || k === i) continue;
    for (let r = 0; r < rest.length; r++) if (overlaps(vs[k], vs[rest[r]])) return null;
  }
  return { pls, vs, parent };
}

function mirrorAll(S) {
  const pls = S.pls.map((p) => mapPlacement(p, 0, 1, 0, 0));
  return { pls, vs: pls.map(placementVerts), parent: S.parent };
}

function key(pls) {
  return pls.map((p) => {
    const v = placementVerts(p).map((q) => `${Math.round(q[0] * 1000)},${Math.round(q[1] * 1000)}`).sort();
    return `${p[0]}:${v.join(';')}`;
  }).sort().join('|');
}

function anneal(T, types, rng, iters, t0, t1) {
  let S = buildInitial(rng, types), g = rng.int(8);
  let cA = centroidOf(S.vs);
  let cur = evalIoU(T, S.vs, g, 0, 0, cA);
  let best = { S, g, iou: cur };
  const ratio = geoRatio(t0, t1, Math.max(1, iters - 1));
  let temp = t0;
  for (let it = 0; it < iters; it++, temp *= ratio) {
    const r = rng.float();
    let S2 = S, g2 = g;
    if (r < 0.08) g2 = (g + 1 + rng.int(7)) & 7;
    else if (r < 0.10) S2 = mirrorAll(S);
    else { S2 = graft(S, types, rng); if (!S2) continue; }
    const cA2 = S2 === S ? cA : centroidOf(S2.vs);
    const val = evalIoU(T, S2.vs, g2, 0, 0, cA2);
    const d = val - cur;
    if (d >= 0 || rng.float() < expNeg(d / temp)) {
      S = S2; g = g2; cA = cA2; cur = val;
      if (cur > best.iou) best = { S, g, iou: cur };
    }
  }
  return best;
}

/** Feinjustierung der Verschiebung (in Zellen). */
function polish(T, S, g) {
  const cA = centroidOf(S.vs);
  let bx = 0, by = 0, bv = evalIoU(T, S.vs, g, 0, 0, cA);
  for (const step of [2, 1, 0.5, 0.25]) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, -step], [step, -step], [-step, step]]) {
        const v = evalIoU(T, S.vs, g, bx + dx, by + dy, cA);
        if (v > bv + 1e-12) { bv = v; bx += dx; by += dy; moved = true; }
      }
    }
  }
  return { sx: bx, sy: by, iou: bv, cA };
}

/** Wandelt Zustand in Platzierungen im Maskenrahmen (Welteinheiten) um. */
function toFrame(T, S, g, sx, sy, cA) {
  const r = rotPt(g, cA[0], cA[1]);
  const ux = (T.tcx + sx + 0.5 - T.w / 2) * T.cw - r[0];
  const uy = (T.tcy + sy + 0.5 - T.h / 2) * T.cw - r[1];
  return S.pls.map((p) => {
    const q = mapPlacement(p, g, 0, ux, uy);
    return [q[0], q[1], q[2], round6(q[3]), round6(q[4])];
  });
}

/**
 * mask: {w,h,c,bits}. opts: { sets=1, seed='x', restarts=8, iters=12000, topK=8 }
 * Liefert [{ iou, pls }] sortiert nach IoU, ohne Duplikate.
 */
export function solve(mask, opts = {}) {
  const { sets = 1, seed = 'fit', restarts = 8, iters = 12000, topK = 8 } = opts;
  const T = prepare(mask, sets);
  const types = kitTypes(sets);
  const rng = new Rng(String(seed));
  const results = [];
  for (let r = 0; r < restarts; r++) {
    const best = anneal(T, types, rng, iters, 0.05, 0.003);
    const pol = polish(T, best.S, best.g);
    const pls = toFrame(T, best.S, best.g, pol.sx, pol.sy, pol.cA);
    results.push({ iou: pol.iou, pls });
    if (opts.onProgress) opts.onProgress((r + 1) / restarts);
  }
  results.sort((a, b) => b.iou - a.iou);
  const seen = new Set(), out = [];
  for (const r of results) {
    const k = key(r.pls);
    if (seen.has(k)) continue;
    seen.add(k); out.push({ iou: Math.round(r.iou * 10000) / 10000, pls: r.pls });
    if (out.length >= topK) break;
  }
  return out;
}
