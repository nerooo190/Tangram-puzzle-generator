// Tangram-Geometrie: Teile, Platzierungen, Kollision, Andocken.
//
// Koordinaten: y zeigt nach unten (wie Bildschirm / Godot). Polygone haben positive
// Shoelace-Fläche. Einheit: Kathete des kleinen Dreiecks = 1, ein Satz hat Fläche 8.
//
// Eine Platzierung ist  [typ, rot, flip, tx, ty]:
//   Eckpunkt = Rot(rot*45°) * Flip^flip * lokaler Punkt + (tx,ty)

export const SQ2 = Math.SQRT2;
export const H = Math.SQRT1_2;

export const T_SMALL = 0, T_MEDIUM = 1, T_LARGE = 2, T_SQUARE = 3, T_PARA = 4;

export const TYPES = [
  { id: 'ts', name: 'Kleines Dreieck', area: 0.5, chiral: false, verts: [[0, 0], [1, 0], [0, 1]] },
  { id: 'tm', name: 'Mittleres Dreieck', area: 1, chiral: false, verts: [[0, 0], [SQ2, 0], [0, SQ2]] },
  { id: 'tl', name: 'Großes Dreieck', area: 2, chiral: false, verts: [[0, 0], [2, 0], [0, 2]] },
  { id: 'sq', name: 'Quadrat', area: 1, chiral: false, verts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { id: 'pa', name: 'Parallelogramm', area: 1, chiral: true, verts: [[0, 0], [SQ2, 0], [SQ2 + H, H], [H, H]] },
];

/** Teile eines klassischen Sets in Baureihenfolge (große zuerst). */
export const KIT_ORDER = [T_LARGE, T_LARGE, T_MEDIUM, T_SQUARE, T_PARA, T_SMALL, T_SMALL];
export const SET_AREA = 8;

export function kitTypes(sets) {
  const out = [];
  for (let s = 0; s < sets; s++) for (const t of KIT_ORDER) out.push(t);
  return out;
}

export const COS = [1, H, 0, -H, -1, -H, 0, H];
export const SIN = [0, H, 1, H, 0, -H, -1, -H];

export function rotPt(rot, x, y) {
  return [x * COS[rot] - y * SIN[rot], x * SIN[rot] + y * COS[rot]];
}

function octant(dx, dy) {
  let o = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ((o % 8) + 8) % 8;
}

// ORIENT[typ][flip] = { v: Eckpunkte, oct: Kantenrichtung (0..7), len: Kantenlängen }
export const ORIENT = TYPES.map((t) => [0, 1].map((flip) => {
  let v = t.verts.map((p) => [p[0], p[1]]);
  if (flip) v = v.map((p) => [-p[0], p[1]]).reverse();
  const n = v.length;
  const oct = [], len = [];
  for (let j = 0; j < n; j++) {
    const dx = v[(j + 1) % n][0] - v[j][0], dy = v[(j + 1) % n][1] - v[j][1];
    oct.push(octant(dx, dy));
    len.push(Math.sqrt(dx * dx + dy * dy));
  }
  return { v, oct, len };
}));

export function placementVerts(pl) {
  const o = ORIENT[pl[0]][pl[2]];
  const rot = pl[1], tx = pl[3], ty = pl[4];
  const c = COS[rot], s = SIN[rot];
  const out = new Array(o.v.length);
  for (let i = 0; i < o.v.length; i++) {
    const x = o.v[i][0], y = o.v[i][1];
    out[i] = [x * c - y * s + tx, x * s + y * c + ty];
  }
  return out;
}

export function polyArea(v) {
  let a = 0;
  for (let i = 0; i < v.length; i++) {
    const p = v[i], q = v[(i + 1) % v.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function polyCentroid(v) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < v.length; i++) {
    const p = v[i], q = v[(i + 1) % v.length];
    const cr = p[0] * q[1] - q[0] * p[1];
    a += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export const EPS = 1e-7;

/** true, wenn sich zwei konvexe Polygone mit positiver Fläche überlappen. */
export function overlaps(A, B, eps = EPS) {
  for (let pass = 0; pass < 2; pass++) {
    const P = pass === 0 ? A : B, Q = pass === 0 ? B : A;
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const p = P[i], r = P[(i + 1) % n];
      const ex = r[0] - p[0], ey = r[1] - p[1];
      const l = Math.sqrt(ex * ex + ey * ey);
      const nx = ey / l, ny = -ex / l; // Außennormale
      let separated = true;
      for (let k = 0; k < Q.length; k++) {
        if (nx * (Q[k][0] - p[0]) + ny * (Q[k][1] - p[1]) < -eps) { separated = false; break; }
      }
      if (separated) return false;
    }
  }
  return true;
}

export function bbox(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const v of polys) for (const p of v) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

/** Länge, auf der zwei Polygone mit Kanten aneinanderliegen. */
export function contactLength(A, B, eps = 1e-6) {
  let total = 0;
  for (let i = 0; i < A.length; i++) {
    const p = A[i], q = A[(i + 1) % A.length];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const L = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / L, uy = dy / L;
    for (let k = 0; k < B.length; k++) {
      const r = B[k], s = B[(k + 1) % B.length];
      const c1 = ux * (r[1] - p[1]) - uy * (r[0] - p[0]);
      const c2 = ux * (s[1] - p[1]) - uy * (s[0] - p[0]);
      if (Math.abs(c1) > eps || Math.abs(c2) > eps) continue;
      const a = ux * (r[0] - p[0]) + uy * (r[1] - p[1]);
      const b = ux * (s[0] - p[0]) + uy * (s[1] - p[1]);
      const lo = Math.max(0, Math.min(a, b)), hi = Math.min(L, Math.max(a, b));
      if (hi - lo > eps) total += hi - lo;
    }
  }
  return total;
}

/**
 * Probiert zufällig, ein Teil `type` flächig an ein bereits liegendes Teil anzulegen.
 * placed: [{ pl, v }]. Liefert { pl, parent } oder null.
 */
export function sampleAttach(placed, type, rng, tries = 60) {
  const chiral = TYPES[type].chiral;
  for (let k = 0; k < tries; k++) {
    const qi = rng.int(placed.length);
    const q = placed[qi];
    const qo = ORIENT[q.pl[0]][q.pl[2]];
    const e = rng.int(q.v.length);
    const oq = (qo.oct[e] + q.pl[1]) & 7;
    const L = qo.len[e];
    const flip = chiral ? rng.int(2) : 0;
    const O = ORIENT[type][flip];
    const j = rng.int(O.v.length);
    const rot = (((oq + 4 - O.oct[j]) % 8) + 8) % 8;
    const M = O.len[j];
    const mode = rng.int(3);
    const u0 = mode === 0 ? 0 : (mode === 1 ? L - M : (L - M) / 2);
    const dx = COS[oq], dy = SIN[oq];
    const ax = q.v[e][0] + (u0 + M) * dx, ay = q.v[e][1] + (u0 + M) * dy;
    const rv = rotPt(rot, O.v[j][0], O.v[j][1]);
    const pl = [type, rot, flip, ax - rv[0], ay - rv[1]];
    const v = placementVerts(pl);
    let ok = true;
    for (let i = 0; i < placed.length; i++) {
      if (overlaps(v, placed[i].v)) { ok = false; break; }
    }
    if (ok) return { pl, v, parent: qi };
  }
  return null;
}

// ---- Gruppenelemente (Drehung/Spiegelung) für Platzierungen -------------------------
// Ein Element (k, m): Rot(k*45°) * Spiegel_x^m

/** Lineare Abbildung L(k,m) auf einen Punkt: Rot(k) * Mx^m (erst spiegeln, dann drehen). */
export function linearMap(k, m, x, y) {
  return rotPt(k, m ? -x : x, y);
}

/** Platzierung unter L(k,m) + Verschiebung (ux,uy). */
export function mapPlacement(pl, k, m, ux, uy) {
  const rot = (((k + (m ? -pl[1] : pl[1])) % 8) + 8) % 8;
  const flip = m ^ pl[2];
  const t = linearMap(k, m, pl[3], pl[4]);
  return [pl[0], rot, flip, t[0] + ux, t[1] + uy];
}

/** Gruppenprodukt (ra,fa)*(rb,fb) mit Elementen Rot(r)*Mx^f. */
export function gMul(ra, fa, rb, fb) {
  return [(((ra + (fa ? -rb : rb)) % 8) + 8) % 8, fa ^ fb];
}
export function gInv(r, f) {
  return f ? [r, 1] : [(8 - r) % 8, 0];
}

export function round6(x) { return Math.floor(x * 1e6 + 0.5) / 1e6; }

/** Verschiebt alle Platzierungen so, dass die Bounding-Box zentriert ist, und rundet. */
export function centerAndRound(pls) {
  const bb = bbox(pls.map(placementVerts));
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  return pls.map((p) => [p[0], p[1], p[2], round6(p[3] - cx), round6(p[4] - cy)]);
}

/** Konvexe Hülle (Monotone Chain), liefert Fläche. */
export function hullArea(polys) {
  const pts = [];
  for (const v of polys) for (const p of v) pts.push(p);
  pts.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return Math.abs(polyArea(lower.concat(upper)));
}
