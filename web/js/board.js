// Spielbrett (SVG): Silhouette, Teile ziehen / drehen / spiegeln, Einrasten, Tipp, Lösung, Gewinnprüfung.

import {
  TYPES, placementVerts, polyCentroid, mapPlacement, rotPt, bbox, round6,
} from './core/geom.js';
import { fillPoly } from './core/raster.js';

const NS = 'http://www.w3.org/2000/svg';
// Farbe je Teiltyp: klein, mittel, groß, Quadrat, Parallelogramm
export const COLORS = ['#ef476f', '#06b6d4', '#ffb703', '#8ac926', '#6366f1'];
const SNAP = 0.32;

function el(name, attrs = {}) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
const pts = (v) => v.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(' ');

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (k > 0 ? (255 - c) * k : c * k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export class Board {
  constructor(svg, handlers = {}) {
    this.svg = svg;
    this.h = handlers;
    this.pieces = [];
    this.sel = null;
    this.drag = null;
    this.solved = false;
    this.moves = 0;
    this.hints = 0;
    this.gaveUp = false;
    svg.addEventListener('pointerdown', (e) => this.#down(e));
    svg.addEventListener('pointermove', (e) => this.#move(e));
    svg.addEventListener('pointerup', (e) => this.#up(e));
    svg.addEventListener('pointercancel', (e) => this.#up(e));
    svg.addEventListener('wheel', (e) => {
      if (!this.sel || this.solved) return;
      e.preventDefault();
      this.rotate(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    svg.addEventListener('dblclick', (e) => {
      const p = this.#pieceAt(e.target);
      if (p && !this.solved) { this.select(p); this.rotate(1); }
    });
  }

  load(puzzle) {
    this.puzzle = puzzle;
    this.solved = false; this.gaveUp = false; this.moves = 0; this.hints = 0;
    this.sel = null;
    this.svg.replaceChildren();
    this.solPls = puzzle.pls.map((p) => p.slice());
    this.solPolys = this.solPls.map(placementVerts);
    this.defs = el('defs');
    this.svg.appendChild(this.defs);
    this.silG = el('g', { class: 'sil' });
    this.ghostG = el('g', { class: 'ghost' });
    this.pieceG = el('g', { class: 'pieces' });
    this.svg.append(this.silG, this.ghostG, this.pieceG);
    for (const v of this.solPolys) this.silG.appendChild(el('polygon', { points: pts(v) }));
    // Teile anlegen
    const counts = {};
    this.pieces = puzzle.pls.map((pl, i) => {
      const t = pl[0];
      counts[t] = (counts[t] || 0) + 1;
      const color = shade(COLORS[t], ((counts[t] - 1) % 3) * 0.14);
      const poly = el('polygon', { class: 'piece', fill: color, 'data-i': i });
      this.pieceG.appendChild(poly);
      return { i, type: t, pl: [t, 0, 0, 0, 0], el: poly, color };
    });
    this.#scatter();
    this.#fitView();
    this.#renderAll();
    this.startTime = null;
  }

  // ---- Anordnung der Teile ---------------------------------------------------------
  #scatter() {
    const bb = bbox(this.solPolys);
    const W = bb[2] - bb[0], Hh = bb[3] - bb[1];
    const rect = this.svg.getBoundingClientRect();
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1.4;
    const right = aspect > 1.3;
    // zufällige Ausrichtung
    for (const p of this.pieces) {
      const rot = Math.floor(Math.random() * 8);
      const flip = TYPES[p.type].chiral ? Math.floor(Math.random() * 2) : 0;
      p.pl = [p.type, rot, flip, 0, 0];
    }
    const items = this.pieces.map((p) => {
      const b = bbox([placementVerts(p.pl)]);
      return { p, w: b[2] - b[0], h: b[3] - b[1], b };
    }).sort((a, b) => b.h - a.h);
    const gap = 0.35;
    const area = items.reduce((s, it) => s + (it.w + gap) * (it.h + gap), 0);
    const rowW = right ? Math.max(5.5, Math.sqrt(area) * 1.1) : Math.max(W, 6, Math.sqrt(area) * 1.2);
    let x = 0, y = 0, rowH = 0, maxX = 0;
    const place = [];
    for (const it of items) {
      if (x + it.w > rowW && x > 0) { x = 0; y += rowH + gap; rowH = 0; }
      place.push({ it, x, y });
      x += it.w + gap; rowH = Math.max(rowH, it.h); maxX = Math.max(maxX, x - gap);
    }
    const trayW = maxX, trayH = y + rowH;
    const ox = right ? bb[2] + 1.2 : bb[0] + (W - trayW) / 2;
    const oy = right ? bb[1] + (Hh - trayH) / 2 : bb[3] + 1.2;
    for (const { it, x: px, y: py } of place) {
      it.p.pl[3] += ox + px - it.b[0];
      it.p.pl[4] += oy + py - it.b[1];
    }
    this.tray = [ox, oy, ox + trayW, oy + trayH];
  }

  #fitView() {
    const all = this.solPolys.concat(this.pieces.map((p) => placementVerts(p.pl)));
    const b = bbox(all);
    const pad = 1.2;
    this.view = [b[0] - pad, b[1] - pad, b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad];
    this.svg.setAttribute('viewBox', this.view.join(' '));
    this.#fixStroke();
  }

  #fixStroke() {
    // Strichstärke relativ zur Ansichtsgröße
    const s = Math.max(this.view[2], this.view[3]);
    this.svg.style.setProperty('--sw', (s / 260).toFixed(4));
  }

  // ---- Zeichnen --------------------------------------------------------------------
  #renderPiece(p) {
    p.verts = placementVerts(p.pl);
    p.el.setAttribute('points', pts(p.verts));
  }
  #renderAll() {
    for (const p of this.pieces) this.#renderPiece(p);
    for (const p of this.pieces) p.el.classList.toggle('sel', p === this.sel);
  }

  // ---- Auswahl & Transformationen --------------------------------------------------
  #pieceAt(target) {
    const i = target && target.dataset ? target.dataset.i : undefined;
    return i === undefined ? null : this.pieces[Number(i)];
  }
  select(p) {
    this.sel = p;
    if (p) this.pieceG.appendChild(p.el);
    for (const q of this.pieces) q.el.classList.toggle('sel', q === p);
    if (this.h.onSelect) this.h.onSelect(p);
  }
  rotate(k) {
    const p = this.sel;
    if (!p || this.solved) return;
    const c = polyCentroid(placementVerts(p.pl));
    const r = rotPt(((k % 8) + 8) % 8, c[0], c[1]);
    p.pl = mapPlacement(p.pl, ((k % 8) + 8) % 8, 0, c[0] - r[0], c[1] - r[1]);
    this.#afterChange(p);
  }
  flip() {
    const p = this.sel;
    if (!p || this.solved) return;
    const c = polyCentroid(placementVerts(p.pl));
    p.pl = mapPlacement(p.pl, 0, 1, 2 * c[0], 0);
    this.#afterChange(p);
  }
  nudge(dx, dy) {
    const p = this.sel;
    if (!p || this.solved) return;
    p.pl = [p.pl[0], p.pl[1], p.pl[2], p.pl[3] + dx, p.pl[4] + dy];
    this.#afterChange(p, true);
  }
  #afterChange(p, noSnap) {
    this.moves++;
    this.#renderPiece(p);
    if (!noSnap) this.#snap(p);
    this.#checkSolved();
    this.#touch();
  }

  // ---- Zeigerereignisse ------------------------------------------------------------
  #world(e) {
    const m = this.svg.getScreenCTM().inverse();
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(m);
    return [q.x, q.y];
  }
  #down(e) {
    if (this.solved) return;
    const p = this.#pieceAt(e.target);
    if (!p) { this.select(null); return; }
    e.preventDefault();
    this.select(p);
    const w = this.#world(e);
    this.drag = { p, ox: w[0] - p.pl[3], oy: w[1] - p.pl[4], moved: false, id: e.pointerId };
    this.svg.setPointerCapture(e.pointerId);
    p.el.classList.add('drag');
    this.#touch();
  }
  #move(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const w = this.#world(e);
    const p = this.drag.p;
    p.pl = [p.pl[0], p.pl[1], p.pl[2], w[0] - this.drag.ox, w[1] - this.drag.oy];
    this.drag.moved = true;
    this.#renderPiece(p);
  }
  #up(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const { p, moved } = this.drag;
    this.drag = null;
    p.el.classList.remove('drag');
    if (moved) { this.moves++; this.#snap(p); this.#checkSolved(); }
  }
  #touch() { if (this.startTime === null) { this.startTime = performance.now(); if (this.h.onStart) this.h.onStart(); } }

  // ---- Einrasten -------------------------------------------------------------------
  #snap(p) {
    const anchors = [];
    for (const v of this.solPolys) for (const q of v) anchors.push(q);
    for (const o of this.pieces) if (o !== p) for (const q of o.verts) anchors.push(q);
    // Verschiebung wählen, bei der die meisten Ecken des Teils zugleich auf Ankerpunkte fallen;
    // bei Gleichstand die kürzeste. (Nur das nächste Eckenpaar zu nehmen, rastet bei dichten Ecken falsch ein.)
    let best = null, bestScore = 0, bestDist = Infinity;
    for (const v of p.verts) for (const a of anchors) {
      const tx = a[0] - v[0], ty = a[1] - v[1], d = Math.hypot(tx, ty);
      if (d >= SNAP) continue;
      let score = 0;
      for (const w of p.verts) {
        for (const a2 of anchors) if (Math.hypot(w[0] + tx - a2[0], w[1] + ty - a2[1]) < 0.03) { score++; break; }
      }
      if (score > bestScore || (score === bestScore && d < bestDist)) { best = [tx, ty]; bestScore = score; bestDist = d; }
    }
    if (best) {
      p.pl = [p.pl[0], p.pl[1], p.pl[2], round6(p.pl[3] + best[0]), round6(p.pl[4] + best[1])];
      this.#renderPiece(p);
    }
  }

  // ---- Gewinnprüfung ---------------------------------------------------------------
  coverage() {
    const bb = bbox(this.solPolys);
    const c = 0.05, x0 = bb[0] - 1, y0 = bb[1] - 1;
    const W = Math.ceil((bb[2] - bb[0] + 2) / c), Hh = Math.ceil((bb[3] - bb[1] + 2) / c);
    const sil = new Uint8Array(W * Hh), cov = new Uint8Array(W * Hh);
    for (const v of this.solPolys) fillPoly(sil, v, x0, y0, c, W, Hh);
    for (const p of this.pieces) fillPoly(cov, placementVerts(p.pl), x0, y0, c, W, Hh);
    let s = 0, hit = 0, spill = 0;
    for (let k = 0; k < sil.length; k++) {
      if (sil[k]) { s++; if (cov[k]) hit++; } else if (cov[k]) spill++;
    }
    return { covered: hit / s, spill: spill / s };
  }
  #checkSolved() {
    const { covered, spill } = this.coverage();
    if (this.h.onProgress) this.h.onProgress(covered);
    if (!this.solved && covered >= 0.97 && spill <= 0.03) {
      this.solved = true;
      this.select(null);
      this.svg.classList.add('solved');
      if (this.h.onSolved) this.h.onSolved({ moves: this.moves, hints: this.hints, gaveUp: this.gaveUp, ms: this.startTime === null ? 0 : performance.now() - this.startTime });
    }
  }

  // ---- Hilfen ----------------------------------------------------------------------
  #assignment() {
    // ordnet jedem Lösungsteil ein Spielteil gleichen Typs zu (zuerst bereits korrekt liegende)
    const used = new Set(), res = new Array(this.solPls.length).fill(null);
    const close = (a, b) => a.every((q) => b.some((r) => Math.hypot(q[0] - r[0], q[1] - r[1]) < 0.06));
    this.solPls.forEach((sp, si) => {
      for (const p of this.pieces) {
        if (used.has(p) || p.type !== sp[0]) continue;
        if (close(placementVerts(p.pl), this.solPolys[si])) { used.add(p); res[si] = p; break; }
      }
    });
    this.solPls.forEach((sp, si) => {
      if (res[si]) return;
      let best = null, bd = Infinity;
      const sc = polyCentroid(this.solPolys[si]);
      for (const p of this.pieces) {
        if (used.has(p) || p.type !== sp[0]) continue;
        const c = polyCentroid(placementVerts(p.pl));
        const d = Math.hypot(c[0] - sc[0], c[1] - sc[1]);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { used.add(best); res[si] = best; }
    });
    return res;
  }
  hint() {
    if (this.solved) return false;
    const asg = this.#assignment();
    const close = (a, b) => a.every((q) => b.some((r) => Math.hypot(q[0] - r[0], q[1] - r[1]) < 0.06));
    let target = null;
    const pref = this.sel ? asg.findIndex((p) => p === this.sel) : -1;
    if (pref >= 0 && !close(placementVerts(this.sel.pl), this.solPolys[pref])) target = pref;
    if (target === null) target = asg.findIndex((p, si) => p && !close(placementVerts(p.pl), this.solPolys[si]));
    if (target < 0 || target === null) return false;
    this.hints++;
    this.ghostG.replaceChildren();
    const g = el('polygon', { points: pts(this.solPolys[target]), fill: asg[target].color, class: 'ghost-poly' });
    this.ghostG.appendChild(g);
    clearTimeout(this.ghostTimer);
    this.ghostTimer = setTimeout(() => this.ghostG.replaceChildren(), 3500);
    return true;
  }
  showSolution() {
    if (this.solved) return;
    const asg = this.#assignment();
    asg.forEach((p, si) => { if (p) { p.pl = this.solPls[si].slice(); } });
    this.gaveUp = true;
    this.#renderAll();
    this.#checkSolved();
  }
  shuffle() {
    if (this.solved) return;
    this.#scatter();
    this.#fitView();
    this.#renderAll();
    this.select(null);
  }

  rotationOfSelected() { return this.sel ? this.sel.pl[1] : null; }
}

