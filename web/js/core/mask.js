// Silhouetten-Masken: Rasterbild -> normiertes Zellgitter (Fläche = 8 Einheiten² je Satz) + Base64-Packung.
//
// Maske: { w, h, c, bits: Uint8Array(w*h) }  Zelle (i,j) hat ihre Mitte bei
// x = (i + 0.5 - w/2) * c,  y = (j + 0.5 - h/2) * c  (y nach unten).

import { SET_AREA } from './geom.js';

export const DEFAULT_CELL = 0.08;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function packBits(bits) {
  const nbytes = Math.ceil(bits.length / 8);
  const bytes = new Uint8Array(nbytes);
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7);
  let out = '';
  for (let i = 0; i < nbytes; i += 3) {
    const a = bytes[i], b = i + 1 < nbytes ? bytes[i + 1] : 0, c = i + 2 < nbytes ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < nbytes ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < nbytes ? B64[c & 63] : '=';
  }
  return out;
}

export function unpackBits(str, count) {
  const lut = {};
  for (let i = 0; i < 64; i++) lut[B64[i]] = i;
  const bytes = [];
  for (let i = 0; i < str.length; i += 4) {
    const a = lut[str[i]], b = lut[str[i + 1]];
    const c = str[i + 2] === '=' ? 0 : lut[str[i + 2]], d = str[i + 3] === '=' ? 0 : lut[str[i + 3]];
    bytes.push((a << 2) | (b >> 4));
    if (str[i + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2));
    if (str[i + 3] !== '=') bytes.push(((c & 3) << 6) | d);
  }
  const bits = new Uint8Array(count);
  for (let i = 0; i < count; i++) bits[i] = (bytes[i >> 3] >> (i & 7)) & 1;
  return bits;
}

export function maskToJson(m) { return { w: m.w, h: m.h, c: Math.round(m.c * 1e6) / 1e6, bits: packBits(m.bits) }; }
export function maskFromJson(j) { return { w: j.w, h: j.h, c: j.c, bits: unpackBits(j.bits, j.w * j.h) }; }

/** Füllt eingeschlossene Löcher einer 0/1-Bitmap (W*H). Gibt neue Bitmap zurück. */
export function fillHoles(bin, W, H) {
  const out = new Uint8Array(bin);
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (k) => { if (!bin[k] && !seen[k]) { seen[k] = 1; stack.push(k); } };
  for (let i = 0; i < W; i++) { push(i); push((H - 1) * W + i); }
  for (let j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
  while (stack.length) {
    const k = stack.pop(), i = k % W, j = (k - i) / W;
    if (i > 0) push(k - 1); if (i < W - 1) push(k + 1);
    if (j > 0) push(k - W); if (j < H - 1) push(k + W);
  }
  for (let k = 0; k < W * H; k++) if (!bin[k] && !seen[k]) out[k] = 1;
  return out;
}

/** Hochaufgelöste 0/1-Bitmap -> normierte Maske (Fläche 8, Zellgröße ≈ cell). Gibt null bei leerem Bild. */
export function maskFromBitmap(bin, W, H, cell = DEFAULT_CELL, maxDim = 140) {
  const filled = fillHoles(bin, W, H);
  let x0 = W, y0 = H, x1 = -1, y1 = -1, area = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (filled[j * W + i]) {
      area++;
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
    }
  }
  if (area < 20) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const u = Math.sqrt(SET_AREA / area);          // Einheiten je Pixel
  const cpx = cell / u;                          // Zellgröße in Pixeln
  const w = Math.max(1, Math.ceil(bw / cpx - 1e-9)), h = Math.max(1, Math.ceil(bh / cpx - 1e-9));
  if (w > maxDim || h > maxDim) return null;
  // Integralbild
  const S = new Int32Array((W + 1) * (H + 1));
  for (let j = 0; j < H; j++) {
    let row = 0;
    for (let i = 0; i < W; i++) { row += filled[j * W + i]; S[(j + 1) * (W + 1) + i + 1] = S[j * (W + 1) + i + 1] + row; }
  }
  const sum = (ax, ay, bx, by) => { // [ax,bx) x [ay,by) ganzzahlig
    return S[by * (W + 1) + bx] - S[ay * (W + 1) + bx] - S[by * (W + 1) + ax] + S[ay * (W + 1) + ax];
  };
  const padX = (w * cpx - bw) / 2, padY = (h * cpx - bh) / 2;
  const bits = new Uint8Array(w * h);
  let ones = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ax = Math.max(0, Math.round(x0 - padX + i * cpx)), bx = Math.min(W, Math.round(x0 - padX + (i + 1) * cpx));
    const ay = Math.max(0, Math.round(y0 - padY + j * cpx)), by = Math.min(H, Math.round(y0 - padY + (j + 1) * cpx));
    if (bx <= ax || by <= ay) continue;
    if (sum(ax, ay, bx, by) * 2 >= (bx - ax) * (by - ay)) { bits[j * w + i] = 1; ones++; }
  }
  if (ones < 30) return null;
  return { w, h, c: Math.sqrt(SET_AREA / ones), bits };
}

/** Maske aus Polygonen (z. B. zum Testen). Polygone in Weltkoordinaten (Fläche beliebig, wird normiert). */
export function maskFromPolys(polys, cell = DEFAULT_CELL) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const v of polys) for (const p of v) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  const res = 400, sc = res / Math.max(x1 - x0, y1 - y0);
  const W = Math.ceil((x1 - x0) * sc) + 2, H = Math.ceil((y1 - y0) * sc) + 2;
  const bin = new Uint8Array(W * H);
  // einfache Punkt-in-Polygon-Rasterung (gerade-ungerade)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i - 0.5) / sc, y = y0 + (j - 0.5) / sc;
    let inside = false;
    for (const v of polys) {
      let ins = false;
      for (let a = 0, b = v.length - 1; a < v.length; b = a++) {
        if ((v[a][1] > y) !== (v[b][1] > y) && x < ((v[b][0] - v[a][0]) * (y - v[a][1])) / (v[b][1] - v[a][1]) + v[a][0]) ins = !ins;
      }
      if (ins) { inside = true; break; }
    }
    bin[j * W + i] = inside ? 1 : 0;
  }
  return maskFromBitmap(bin, W, H, cell);
}
