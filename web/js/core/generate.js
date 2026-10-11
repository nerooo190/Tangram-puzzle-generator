// Prozeduraler Generator: beliebig viele abstrakte Tangram-Figuren und Muster aus einer Seed-Zahl.

import { Rng } from './prng.js';
import {
  TYPES, KIT_ORDER, kitTypes, ORIENT, placementVerts, sampleAttach, overlaps, bbox, hullArea,
  centerAndRound, contactLength, mapPlacement, linearMap, round6, polyArea,
} from './geom.js';
import { hasHole } from './raster.js';

export const STYLES = {
  frei: { name: 'Zufall', desc: 'Völlig frei zusammengesteckt', shuffle: true, k: 1 },
  kompakt: { name: 'Kompakt', desc: 'Dichte, runde Silhouetten', shuffle: false, k: 10, mode: 'compact' },
  lang: { name: 'Lang & schlank', desc: 'Gestreckte Figuren', shuffle: true, k: 10, mode: 'long' },
  verzweigt: { name: 'Verzweigt', desc: 'Zackige Figuren mit Armen', shuffle: true, k: 10, mode: 'spiky' },
};

function score(mode, polys) {
  const area = polys.reduce((s, v) => s + polyArea(v), 0);
  const hull = hullArea(polys);
  if (mode === 'compact') return area / hull;
  if (mode === 'spiky') return -area / hull;
  const bb = bbox(polys);
  const w = bb[2] - bb[0], h = bb[3] - bb[1];
  return Math.max(w, h) / Math.sqrt(area);
}

/** Baut einmal eine zusammenhängende Anordnung. Liefert Platzierungen oder null. */
function buildOnce(rng, types, style) {
  const st = STYLES[style];
  const order = types.slice();
  if (st.shuffle) rng.shuffle(order);
  const placed = [{ pl: [order[0], rng.int(8), 0, 0, 0], v: null }];
  if (TYPES[order[0]].chiral) placed[0].pl[2] = rng.int(2);
  placed[0].v = placementVerts(placed[0].pl);
  for (let i = 1; i < order.length; i++) {
    let best = null, bestScore = -Infinity;
    for (let k = 0; k < st.k; k++) {
      const c = sampleAttach(placed, order[i], rng, 60);
      if (!c) continue;
      if (st.k === 1) { best = c; break; }
      const s = score(st.mode, placed.map((p) => p.v).concat([c.v]));
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (!best) return null;
    placed.push({ pl: best.pl, v: best.v });
  }
  return placed.map((p) => p.pl);
}

/** Abstrakte Figur. seed: beliebiger String (z. B. "kompakt:123456789012345678901"). */
export function generateAbstract(seed, style = 'frei', sets = 1) {
  const rng = new Rng(seed);
  const types = kitTypes(sets);
  for (let attempt = 0; attempt < 200; attempt++) {
    const pls = buildOnce(rng, types, style);
    if (!pls) continue;
    if (hasHole(pls.map(placementVerts))) continue;
    return centerAndRound(pls);
  }
  return null;
}

// ---- Muster (symmetrische Kompositionen) -------------------------------------------

export const PATTERNS = {
  spiegel: { name: 'Spiegel', desc: 'Achsensymmetrisch (2 Sätze)', sets: 2 },
  vier: { name: 'Kaleidoskop', desc: 'Vierfach gespiegelt (4 Sätze)', sets: 4 },
  punkt: { name: 'Punktsymmetrie', desc: 'Um 180° gedreht (2 Sätze)', sets: 2 },
};

function mapAll(pls, k, m, ux, uy) { return pls.map((p) => mapPlacement(p, k, m, ux, uy)); }

function connected(polys) {
  const n = polys.length, seen = new Array(n).fill(false), st = [0];
  seen[0] = true; let cnt = 1;
  while (st.length) {
    const i = st.pop();
    for (let j = 0; j < n; j++) if (!seen[j] && contactLength(polys[i], polys[j]) > 1e-6) { seen[j] = true; cnt++; st.push(j); }
  }
  return cnt === n;
}

export function generatePattern(seed, kind = 'spiegel') {
  const rng = new Rng(seed);
  const baseSets = kind === 'vier' ? 1 : 1;
  const types = kitTypes(baseSets);
  const styleNames = ['frei', 'kompakt', 'lang'];
  for (let attempt = 0; attempt < 300; attempt++) {
    const base = buildOnce(rng, types, styleNames[rng.int(3)]);
    if (!base) continue;
    let all = null;
    if (kind === 'spiegel' || kind === 'vier') {
      const bb = bbox(base.map(placementVerts));
      // Spiegelung an der rechten Kante: x -> 2*xmax - x
      let cur = base.concat(mapAll(base, 0, 1, 2 * bb[2], 0));
      if (kind === 'vier') {
        const bb2 = bbox(cur.map(placementVerts));
        // Spiegelung an der unteren Kante: y -> 2*ymax - y  (= Rot(4) * Mx, dann verschieben)
        cur = cur.concat(mapAll(cur, 4, 1, 0, 2 * bb2[3]));
      }
      all = cur;
    } else {
      // Punktsymmetrie: Drehung um 180° um die Mitte einer freien Außenkante
      const polys = base.map(placementVerts);
      const cands = [];
      for (let i = 0; i < polys.length; i++) {
        const v = polys[i];
        for (let e = 0; e < v.length; e++) {
          const p = v[e], q = v[(e + 1) % v.length];
          let free = true;
          for (let j = 0; j < polys.length && free; j++) {
            if (j === i) continue;
            if (contactLength([p, q, [q[0] + 1e-9, q[1] + 1e-9]], polys[j]) > 1e-6) free = false;
          }
          if (free) cands.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
        }
      }
      rng.shuffle(cands);
      for (const m of cands) {
        const rotated = base.map((p) => mapPlacement(p, 4, 0, 2 * m[0], 2 * m[1]));
        const rp = rotated.map(placementVerts);
        let ok = true;
        for (let a = 0; a < rp.length && ok; a++) for (let b = 0; b < polys.length; b++) {
          if (overlaps(rp[a], polys[b])) { ok = false; break; }
        }
        if (ok) { all = base.concat(rotated); break; }
      }
      if (!all) continue;
    }
    const polys = all.map(placementVerts);
    // Kein Überlapp zwischen den Kopien, Zusammenhang, keine Löcher
    let ok = true;
    for (let a = 0; a < polys.length && ok; a++) for (let b = a + 1; b < polys.length; b++) {
      if (overlaps(polys[a], polys[b])) { ok = false; break; }
    }
    if (!ok || !connected(polys) || hasHole(polys)) continue;
    return centerAndRound(all);
  }
  return null;
}

export { linearMap, round6, KIT_ORDER, ORIENT };
