import { Service, parseIndex, fmt, validatePack } from './data.js';
import { Board, COLORS } from './board.js';
import { placementVerts, bbox } from './core/geom.js';
import { glyphToMask, splitGlyphs } from './glyph.js';
import { maskToJson } from './core/mask.js';
import { PATTERNS } from './core/generate.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const service = new Service();
const board = new Board($('board'), {
  onSelect: (p) => { for (const id of ['rotL', 'rotR', 'flipBtn']) $(id).disabled = !p; },
  onStart: startTimer,
  onProgress: (c) => { $('progress').textContent = `${Math.min(100, Math.round(c * 100))} %`; },
  onSolved: onSolved,
});

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

/** Zweistufige Bestätigung im Seitenkontext (alert/confirm gibt es im Artifact nicht). */
function confirmTwice(btn, label, action) {
  if (btn.dataset.armed) { clearTimeout(Number(btn.dataset.armed)); delete btn.dataset.armed; btn.textContent = btn.dataset.orig; action(); return; }
  btn.dataset.orig = btn.textContent;
  btn.textContent = label;
  btn.dataset.armed = String(setTimeout(() => { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; }, 3000));
}

const BIG = 1000000000000000000000n;
const GAL = 12;
const state = { cat: null, n: 0n, sets: 1, token: 0, galOpen: false, puzzle: null };
let solved = new Set(store.get('tangram.solved.v1', []));
let timerId = null, timerStart = 0, winTimer = null;

// ---------------------------------------------------------------- Kategorien
function renderCategories() {
  const filter = $('catSearch').value.trim().toLowerCase();
  const list = $('catList');
  list.replaceChildren();
  const groups = [['known', 'Bekannte Formen'], ['abstract', 'Abstrakt (unendlich)'], ['pattern', 'Muster'], ['custom', 'Meine Kategorien']];
  for (const [g, title] of groups) {
    const items = service.categories().filter((c) => c.group === g && (!filter || c.name.toLowerCase().includes(filter)));
    if (!items.length) continue;
    const h = document.createElement('div');
    h.className = 'cat-group'; h.textContent = title;
    list.appendChild(h);
    for (const c of items) {
      const b = document.createElement('button');
      b.className = 'cat';
      b.setAttribute('aria-current', String(state.cat && state.cat.id === c.id));
      b.innerHTML = `<span class="ic"></span><span class="nm"></span><span class="ct"></span>`;
      b.children[0].textContent = c.icon; b.children[1].textContent = c.name;
      b.children[2].textContent = c.count ? String(c.count) : '∞';
      b.addEventListener('click', () => { selectCategory(c.id); closeMenu(); });
      if (c.custom) {
        const e = document.createElement('span');
        e.textContent = '✎'; e.title = 'Bearbeiten'; e.style.cursor = 'pointer';
        e.addEventListener('click', (ev) => { ev.stopPropagation(); openCatDialog(c); });
        b.appendChild(e);
      }
      list.appendChild(b);
    }
  }
}

/** Beschriftet die Teile-Auswahl: bei Mustern ist die Teilezahl ein Vielfaches der Grundfigur. */
function updateSetsLabels(cat) {
  const mult = cat.group === 'pattern' ? PATTERNS[cat.pattern].mult : 1;
  for (const o of $('setsSel').options) o.textContent = String(7 * Number(o.value) * mult);
}

function selectCategory(id, n = 0n) {
  const cat = service.category(id) || service.category('alle') || service.categories()[0];
  state.cat = cat;
  $('catIcon').textContent = cat.icon; $('catName').textContent = cat.name;
  updateSetsLabels(cat);
  renderCategories();
  go(n);
}

// ---------------------------------------------------------------- Navigation
function writeHash() {
  try { history.replaceState(null, '', `#${state.cat.id}/${state.n}/${state.sets}`); } catch { /* eingebettet: nicht erlaubt */ }
  store.set('tangram.last', { c: state.cat.id, n: String(state.n), s: state.sets });
}

function go(n) {
  if (n < 0n) n = 0n;
  state.n = n;
  $('numInput').value = fmt(n);
  writeHash();
  loadPuzzle();
  if (state.galOpen) renderGallery();
}

async function loadPuzzle() {
  const my = ++state.token;
  const cat = state.cat, n = state.n, sets = state.sets;
  hideWin();
  stopTimer();
  $('timer').textContent = '0:00';
  $('progress').textContent = '0 %';
  let pz = service.peek(cat, n, sets);
  if (!pz) {
    $('loading').hidden = false;
    try { pz = await service.get(cat, n, sets); } catch (e) { console.error(e); if (my === state.token) { $('pzTitle').textContent = 'Fehler beim Berechnen'; $('loading').hidden = true; } return; }
  }
  if (my !== state.token) return;
  $('loading').hidden = true;
  state.puzzle = pz;
  $('pzTitle').textContent = pz.title;
  const quality = pz.iou ? ` · Ähnlichkeit ${Math.round(pz.iou * 100)} %` : '';
  $('pzSub').textContent = `${pz.subtitle}${quality}`;
  $('hintGlyph').textContent = pz.glyph || '';
  $('board').classList.remove('solved');
  board.load(pz);
  for (const id of ['rotL', 'rotR', 'flipBtn']) $(id).disabled = true;
  $('board').focus({ preventScroll: true });
}

// ---------------------------------------------------------------- Zeit / Gewinn
function startTimer() {
  stopTimer();
  timerStart = performance.now();
  timerId = setInterval(() => { $('timer').textContent = clock(performance.now() - timerStart); }, 500);
}
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
function clock(ms) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function onSolved(r) {
  stopTimer();
  $('timer').textContent = clock(r.ms);
  $('progress').textContent = '100 %';
  const key = state.puzzle.key;
  if (!r.gaveUp) { solved.add(key); store.set('tangram.solved.v1', [...solved].slice(-5000)); updateSolvedCount(); }
  const parts = [];
  if (r.gaveUp) parts.push('Lösung angezeigt');
  else parts.push(`Zeit ${clock(r.ms)}`, `${r.moves} Züge`, r.hints ? `${r.hints} Tipp${r.hints > 1 ? 's' : ''}` : 'ohne Tipp');
  $('winText').textContent = parts.join(' · ');
  const tok = state.token;
  clearTimeout(winTimer);
  winTimer = setTimeout(() => { if (tok === state.token) { $('win').hidden = false; $('winNext').focus(); } }, 650);
}
function hideWin() { clearTimeout(winTimer); $('win').hidden = true; }
function updateSolvedCount() { $('solvedCount').textContent = `✓ ${solved.size}`; }

// ---------------------------------------------------------------- Galerie
function thumbSvg(pls) {
  const polys = pls.map(placementVerts);
  const b = bbox(polys), pad = 0.4;
  const vb = [b[0] - pad, b[1] - pad, b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad];
  const s = Math.max(vb[2], vb[3]);
  vb[0] -= (s - vb[2]) / 2; vb[1] -= (s - vb[3]) / 2; vb[2] = s; vb[3] = s;
  const pts = (v) => v.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
  return `<svg viewBox="${vb.map((x) => x.toFixed(3)).join(' ')}" aria-hidden="true">${polys.map((v, i) => `<polygon points="${pts(v)}" fill="${COLORS[pls[i][0]]}" stroke="var(--sil)" stroke-width="${(s / 90).toFixed(3)}" stroke-linejoin="round"/>`).join('')}</svg>`;
}

let galToken = 0;
async function renderGallery() {
  const my = ++galToken;
  const cat = state.cat, sets = state.sets;
  const start = (state.n / BigInt(GAL)) * BigInt(GAL);
  $('galRange').textContent = `Nr. ${fmt(start)} – ${fmt(start + BigInt(GAL - 1))}`;
  const grid = $('galGrid');
  grid.replaceChildren();
  const cells = [];
  for (let i = 0; i < GAL; i++) {
    const n = start + BigInt(i);
    const d = document.createElement('button');
    d.className = 'thumb' + (n === state.n ? ' cur' : '');
    d.innerHTML = '<div class="ph"></div><div class="lbl"></div>';
    d.querySelector('.ph').textContent = cat.figures ? cat.figures[Number(n % BigInt(cat.figures.length))].glyph : '…';
    d.querySelector('.lbl').textContent = `Nr. ${fmt(n)}`;
    d.addEventListener('click', () => { toggleGallery(false); go(n); });
    grid.appendChild(d); cells.push([n, d]);
  }
  for (const [n, d] of cells) {
    if (my !== galToken) return;
    let pz = service.peek(cat, n, sets);
    if (!pz) { try { pz = await service.get(cat, n, sets); } catch { continue; } }
    if (my !== galToken) return;
    d.querySelector('.ph').outerHTML = thumbSvg(pz.pls);
    const lbl = d.querySelector('.lbl'); lbl.textContent = `${pz.title}`;
    lbl.title = `Nr. ${fmt(n)}`;
    if (solved.has(pz.key)) d.insertAdjacentHTML('beforeend', '<span class="ok">✓</span>');
  }
}
function toggleGallery(open) {
  state.galOpen = open;
  $('playView').hidden = open; $('galView').hidden = !open;
  $('galBtn').setAttribute('aria-pressed', String(open));
  if (open) renderGallery(); else galToken++;
}

// ---------------------------------------------------------------- Eigene Kategorien
let editing = null;
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'kategorie'; }
function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

function openCatDialog(cat) {
  editing = cat || null;
  $('catNameInp').value = cat ? cat.name : '';
  $('catIconInp').value = cat ? cat.icon : '';
  $('catGlyphs').value = cat ? cat.figures.map((f) => f.glyph).join('\n') : '';
  $('catMsg').textContent = '';
  $('catExport').hidden = !cat; $('catDelete').hidden = !cat; $('catJson').hidden = true; $('catCopy').hidden = true;
  $('catDlg').showModal();
}

async function saveCategory(ev) {
  ev.preventDefault();
  const name = $('catNameInp').value.trim();
  const glyphs = splitGlyphs($('catGlyphs').value);
  if (!name) return;
  if (!glyphs.length) { $('catMsg').textContent = 'Bitte mindestens eine Form eingeben.'; return; }
  $('catSave').disabled = true;
  const figures = [], failed = [];
  for (const g of glyphs.slice(0, 200)) {
    const known = editing && editing.figures.find((f) => f.glyph === g);
    if (known) { figures.push({ id: known.id, name: known.name, glyph: known.glyph, mask: known.mask, sols: known.sols }); continue; }
    let m = null;
    try { m = glyphToMask(g); } catch { m = null; }
    if (!m) { failed.push(g); continue; }
    figures.push({ id: `c${hash32(name + g)}`, name: g, glyph: g, mask: maskToJson(m) });
  }
  $('catSave').disabled = false;
  if (!figures.length) { $('catMsg').textContent = `Keine dieser Formen ließ sich rastern: ${failed.join(' ')}`; return; }
  const id = editing ? editing.id : `eig-${slug(name)}-${hash32(name)}`;
  service.addCustom({ format: 'tangram-pack/1', id, name, icon: $('catIconInp').value.trim() || '⭐', figures });
  $('catDlg').close();
  selectCategory(id, 0n);
  if (failed.length) toast(`Nicht darstellbar (übersprungen): ${failed.join(' ')}`);
}

async function exportCategory() {
  if (!editing) return;
  const cat = service.category(editing.id);
  $('catExport').disabled = true;
  const figures = [];
  for (let i = 0; i < cat.figures.length; i++) {
    const f = cat.figures[i];
    $('catMsg').textContent = `Berechne Lösungen ${i + 1}/${cat.figures.length}…`;
    let sols = f.sols;
    if (!sols || sols.length < 4) {
      const res = await service.solveMask(f._mask, 1, `${f.id}:export`, 6, { restarts: 24, iters: 20000 });
      sols = res.map((s) => ({ iou: s.iou, p: s.pls }));
    }
    figures.push({ id: f.id, name: f.name, glyph: f.glyph, mask: f.mask, sols });
  }
  const pack = { format: 'tangram-pack/1', id: cat.id, name: cat.name, icon: cat.icon, figures };
  const json = JSON.stringify(pack);
  if (window.__TANGRAM_PACKS__) {
    // Einzeldatei-Build (Artifact): Downloads sind dort gesperrt -> Paket als kopierbarer Text
    $('catJson').value = json; $('catJson').hidden = false; $('catCopy').hidden = false;
    $('catMsg').textContent = 'Paket fertig. Kopiere den Text und speichere ihn als .json-Datei (auch für Godot nutzbar).';
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = `tangram-pack-${slug(cat.name)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('catMsg').textContent = 'Paket gespeichert – auch für die Godot-Version nutzbar.';
  }
  $('catExport').disabled = false;
}

async function importPack(file) {
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Datei zu groß');
    const pack = validatePack(JSON.parse(await file.text()));
    const id = service.categories().some((c) => c.id === pack.id && !c.custom) ? `imp-${pack.id}` : pack.id;
    service.addCustom({ ...pack, id });
    selectCategory(id, 0n);
  } catch (e) { toast(`Import fehlgeschlagen: ${e.message}`); }
}

// ---------------------------------------------------------------- Menü (mobil)
function closeMenu() { $('side').classList.remove('open'); $('scrim').hidden = true; }

// ---------------------------------------------------------------- Ereignisse
function randomBig() {
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  const v = (BigInt(a[0]) << 64n) | (BigInt(a[1]) << 32n) | BigInt(a[2]);
  return v % (BIG + 1n);
}

function wire() {
  $('catSearch').addEventListener('input', renderCategories);
  $('firstBtn').addEventListener('click', () => go(0n));
  $('prevBtn').addEventListener('click', () => go(state.n - 1n));
  $('nextBtn').addEventListener('click', () => go(state.n + 1n));
  $('randBtn').addEventListener('click', () => go(randomBig()));
  $('bigBtn').addEventListener('click', () => go(BIG));
  $('numInput').addEventListener('change', () => go(parseIndex($('numInput').value)));
  $('numInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { go(parseIndex($('numInput').value)); $('board').focus(); } });
  $('numInput').addEventListener('focus', (e) => e.target.select());
  $('setsSel').addEventListener('change', () => { state.sets = Number($('setsSel').value); go(state.n); });
  $('galBtn').addEventListener('click', () => toggleGallery(!state.galOpen));
  $('galPrev').addEventListener('click', () => { state.n = state.n >= BigInt(GAL) ? state.n - BigInt(GAL) : 0n; go(state.n); });
  $('galNext').addEventListener('click', () => go(state.n + BigInt(GAL)));
  $('rotL').addEventListener('click', () => board.rotate(-1));
  $('rotR').addEventListener('click', () => board.rotate(1));
  $('flipBtn').addEventListener('click', () => board.flip());
  $('hintBtn').addEventListener('click', () => board.hint());
  $('shuffleBtn').addEventListener('click', () => board.shuffle());
  $('solveBtn').addEventListener('click', (e) => confirmTwice(e.currentTarget, '👁 Wirklich zeigen?', () => board.showSolution()));
  $('winNext').addEventListener('click', () => go(state.n + 1n));
  $('winClose').addEventListener('click', hideWin);
  $('newCatBtn').addEventListener('click', () => openCatDialog(null));
  $('catForm').addEventListener('submit', saveCategory);
  $('catCancel').addEventListener('click', () => $('catDlg').close());
  $('catExport').addEventListener('click', exportCategory);
  $('catCopy').addEventListener('click', async () => {
    const t = $('catJson');
    try { await navigator.clipboard.writeText(t.value); toast('Paket kopiert'); } catch { t.select(); toast('Text markiert – mit Strg/Cmd+C kopieren'); }
  });
  $('catDelete').addEventListener('click', (e) => confirmTwice(e.currentTarget, 'Sicher löschen?', () => {
    if (editing) { service.removeCustom(editing.id); $('catDlg').close(); selectCategory('alle', 0n); }
  }));
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => { if (e.target.files[0]) importPack(e.target.files[0]); e.target.value = ''; });
  $('helpBtn').addEventListener('click', () => $('helpDlg').showModal());
  $('menuBtn').addEventListener('click', () => { $('side').classList.add('open'); $('scrim').hidden = false; });
  $('scrim').addEventListener('click', closeMenu);
  window.addEventListener('hashchange', () => { const t = parseHash(); if (t && (t.c !== state.cat.id || t.n !== state.n || t.s !== state.sets)) applyTarget(t); });
  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.querySelector('dialog[open]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { board.rotate(e.shiftKey ? -1 : 1); e.preventDefault(); }
    else if (k === 'f') { board.flip(); e.preventDefault(); }
    else if (k === 'h') board.hint();
    else if (k === 'n') go(state.n + 1n);
    else if (k === 'p') go(state.n - 1n);
    else if (k === 'escape') board.select(null);
    else if (k.startsWith('arrow')) {
      const d = e.shiftKey ? 0.25 : 0.05;
      board.nudge(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0);
      e.preventDefault();
    }
  });
}

function parseHash() {
  const m = location.hash.slice(1).split('/');
  if (m.length < 2 || !m[0]) return null;
  const sets = Math.min(4, Math.max(1, Number(m[2]) || 1));
  return { c: decodeURIComponent(m[0]), n: parseIndex(m[1]), s: sets };
}
function applyTarget(t) {
  state.sets = t.s; $('setsSel').value = String(t.s);
  selectCategory(t.c, t.n);
}

async function main() {
  await service.load();
  if (!service.packs.length) {
    const msg = location.protocol === 'file:'
      ? 'Bitte über einen Webserver öffnen (z. B. „python3 -m http.server -d web“), nicht per Doppelklick – sonst fehlen die Formen-Pakete.'
      : 'Die Formen-Pakete konnten nicht geladen werden. Abstrakte Kategorien und Muster funktionieren trotzdem.';
    const b = document.createElement('div');
    b.className = 'notice'; b.textContent = msg;
    document.querySelector('.main').prepend(b);
  }
  wire();
  updateSolvedCount();
  const t = parseHash() || (() => { const l = store.get('tangram.last', null); return l ? { c: l.c, n: BigInt(l.n), s: l.s } : { c: 'alle', n: 0n, s: 1 }; })();
  applyTarget(t);
  window.__tangram = { service, board, state, go, selectCategory };   // für Tests / Konsole
}
main();
