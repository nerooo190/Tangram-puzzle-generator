// Datenschicht: Kategorien, Pakete (Packs), eigene Kategorien und der Puzzle-Dienst.
// Jede Puzzle-Nummer ist eine beliebig große ganze Zahl (BigInt).

import { generateAbstract, generatePattern, STYLES, PATTERNS } from './core/generate.js';
import { maskFromJson, maskToJson } from './core/mask.js';

export const PROC = [
  { id: 'zufall', name: 'Zufall', icon: '🎲', group: 'abstract', style: 'frei', desc: STYLES.frei.desc },
  { id: 'kompakt', name: 'Kompakt', icon: '🟦', group: 'abstract', style: 'kompakt', desc: STYLES.kompakt.desc },
  { id: 'lang', name: 'Lang & schlank', icon: '📏', group: 'abstract', style: 'lang', desc: STYLES.lang.desc },
  { id: 'verzweigt', name: 'Verzweigt', icon: '🌿', group: 'abstract', style: 'verzweigt', desc: STYLES.verzweigt.desc },
  { id: 'spiegel', name: 'Spiegel-Muster', icon: '🦋', group: 'pattern', pattern: 'spiegel', desc: PATTERNS.spiegel.desc },
  { id: 'kaleidoskop', name: 'Kaleidoskop', icon: '❄️', group: 'pattern', pattern: 'vier', desc: PATTERNS.vier.desc },
  { id: 'punkt', name: 'Punktsymmetrie', icon: '☯️', group: 'pattern', pattern: 'punkt', desc: PATTERNS.punkt.desc },
];

const CUSTOM_KEY = 'tangram.custom.v1';

export function parseIndex(text) {
  const digits = String(text).replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return 0n;
  return BigInt(digits.slice(0, 200));
}
export function fmt(n) { return n.toLocaleString('de-DE'); }

export class Service {
  constructor() {
    this.packs = [];          // [{id,name,icon,figures:[...]}]
    this.custom = [];         // eigene Kategorien (gleiches Format wie Packs, evtl. ohne sols)
    this.worker = null;
    this.jobs = new Map();    // key -> Promise
    this.cache = new Map();   // key -> Puzzle
    this.seq = 0;
    this.pending = new Map();
  }

  async load() {
    try {
      const idx = await (await fetch('data/packs/index.json')).json();
      this.packs = await Promise.all(idx.map(async (e) => {
        const p = await (await fetch(`data/packs/${e.id}.json`)).json();
        return this.#prepPack(p);
      }));
    } catch (err) {
      console.warn('Packs konnten nicht geladen werden', err);
    }
    this.#loadCustom();
  }

  #prepPack(p) {
    for (const f of p.figures) { f._mask = f.mask ? maskFromJson(f.mask) : null; }
    return p;
  }

  #loadCustom() {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
      this.custom = raw.map((p) => this.#prepPack(p));
    } catch { this.custom = []; }
  }
  saveCustom() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(this.custom.map((p) => ({ ...p, figures: p.figures.map(({ _mask, ...f }) => f) })))); } catch { /* ignore */ }
  }

  addCustom(pack) {
    const i = this.custom.findIndex((c) => c.id === pack.id);
    const prepped = this.#prepPack(pack);
    if (i >= 0) this.custom[i] = prepped; else this.custom.push(prepped);
    this.saveCustom();
    this.#dropCache(pack.id);
  }
  removeCustom(id) { this.custom = this.custom.filter((c) => c.id !== id); this.saveCustom(); this.#dropCache(id); }
  #dropCache(catId) { for (const k of [...this.cache.keys()]) if (k.startsWith(`${catId}|`)) this.cache.delete(k); }

  /** Alle Kategorien für die Seitenleiste. */
  categories() {
    const all = this.packs.flatMap((p) => p.figures);
    const out = [];
    if (all.length) out.push({ id: 'alle', name: 'Alle bekannten Formen', icon: '🌍', group: 'known', figures: all, count: all.length });
    for (const p of this.packs) out.push({ id: p.id, name: p.name, icon: p.icon, group: 'known', figures: p.figures, count: p.figures.length });
    for (const c of PROC) out.push({ ...c });
    for (const p of this.custom) out.push({ id: p.id, name: p.name, icon: p.icon || '⭐', group: 'custom', figures: p.figures, count: p.figures.length, custom: true });
    return out;
  }
  category(id) { return this.categories().find((c) => c.id === id); }

  static key(catId, n, sets) { return `${catId}|${n}|${sets}`; }

  /** Sofort verfügbares Puzzle oder null (wenn der Solver erst rechnen muss). */
  peek(cat, n, sets) {
    const key = Service.key(cat.id, n, sets);
    if (this.cache.has(key)) return this.cache.get(key);
    let pz = null;
    if (cat.figures) {
      const F = BigInt(cat.figures.length);
      const fig = cat.figures[Number(n % F)];
      const v = n / F;
      if (sets === 1 && fig.sols && v < BigInt(fig.sols.length)) {
        const s = fig.sols[Number(v)];
        pz = this.#make(cat, n, sets, fig.name, `Variante ${fmt(v + 1n)}`, fig.glyph, s.p, s.iou);
      }
    } else if (cat.group === 'abstract') {
      const pls = generateAbstract(`${cat.id}:${n}:${sets}`, cat.style, sets);
      if (pls) pz = this.#make(cat, n, sets, `${cat.name} Nr. ${fmt(n)}`, `${sets * 7} Teile`, '', pls, null);
    } else if (cat.group === 'pattern') {
      const pls = generatePattern(`${cat.id}:${n}:${sets}`, cat.pattern, sets);
      if (pls) pz = this.#make(cat, n, sets, `${cat.name} Nr. ${fmt(n)}`, `${pls.length} Teile`, '', pls, null);
    }
    if (pz) this.cache.set(key, pz);
    return pz;
  }

  #make(cat, n, sets, title, subtitle, glyph, pls, iou) {
    return { key: Service.key(cat.id, n, sets), catId: cat.id, index: n, sets, title, subtitle, glyph, pls, iou };
  }

  /** Puzzle holen; ggf. im Hintergrund berechnen (Solver im Web Worker). */
  async get(cat, n, sets) {
    const p = this.peek(cat, n, sets);
    if (p) return p;
    if (!cat.figures) throw new Error('Puzzle konnte nicht erzeugt werden');
    const key = Service.key(cat.id, n, sets);
    if (this.jobs.has(key)) return this.jobs.get(key);
    const F = BigInt(cat.figures.length);
    const fig = cat.figures[Number(n % F)];
    const v = n / F;
    const job = this.#solve(fig._mask, sets, `${fig.id}:${v}:${sets}`).then((sol) => {
      const pz = this.#make(cat, n, sets, fig.name, `Variante ${fmt(v + 1n)}${sets > 1 ? ` · ${sets * 7} Teile` : ''}`, fig.glyph, sol.pls, sol.iou);
      this.cache.set(key, pz);
      this.jobs.delete(key);
      return pz;
    }, (e) => { this.jobs.delete(key); throw e; });
    this.jobs.set(key, job);
    return job;
  }

  #solve(mask, sets, seed, topK = 1, quality = { restarts: 10, iters: 14000 }) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./fit.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { id, sols, error } = e.data;
        const p = this.pending.get(id);
        if (!p) return;
        this.pending.delete(id);
        if (error || !sols || !sols.length) p.reject(new Error(error || 'keine Lösung')); else p.resolve(topK === 1 ? sols[0] : sols);
      };
    }
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, mask: maskToJson(mask), sets, seed, topK, ...quality });
    });
  }

  /** Berechnet Lösungen für eine Maske (für eigene Formen / Export). */
  solveMask(mask, sets, seed, topK, quality) { return this.#solve(mask, sets, seed, topK, quality); }
}
