// Schätzt per Geburtstagsparadoxon, wie viele *verschiedene* Figuren (bis auf Drehung/Spiegelung/Verschiebung)
// der Generator erzeugen kann. Aufruf: node tools/space-estimate.mjs [n7=60000] [n14=12000]
import { generateAbstract, generatePattern } from '../web/js/core/generate.js';
import { mapPlacement, placementVerts, bbox } from '../web/js/core/geom.js';

function canon(pls) {
  let best = null;
  for (let m = 0; m < 2; m++) for (let k = 0; k < 8; k++) {
    const q = pls.map((p) => mapPlacement(p, k, m, 0, 0));
    const polys = q.map(placementVerts);
    const bb = bbox(polys);
    const key = polys.map((v) => v.map((p) => `${Math.round((p[0] - bb[0]) * 1000)},${Math.round((p[1] - bb[1]) * 1000)}`).sort().join(';')).sort().join('|');
    if (best === null || key < best) best = key;
  }
  return best;
}

function measure(label, n, gen) {
  const seen = new Set();
  const t = Date.now();
  for (let i = 0; i < n; i++) seen.add(canon(gen(i)));
  const dup = n - seen.size;
  const est = dup > 0 ? Math.round((n * n) / (2 * dup)) : null;
  console.log(`${label}: ${n} Seeds -> ${seen.size} verschiedene (${dup} Dubletten), geschätzter Raum ≈ ${est ? est.toExponential(2) : `> ${(n * n / 2).toExponential(1)}`}  [${Math.round((Date.now() - t) / 1000)}s]`);
  return est;
}

const n7 = Number(process.argv[2] || 60000), n14 = Number(process.argv[3] || 12000);
measure('7 Teile  (Zufall)   ', n7, (i) => generateAbstract(`frei:${i}:1`, 'frei', 1));
measure('7 Teile  (Kompakt)  ', Math.min(n7, 30000), (i) => generateAbstract(`kompakt:${i}:1`, 'kompakt', 1));
measure('14 Teile (Zufall)   ', n14, (i) => generateAbstract(`frei:${i}:2`, 'frei', 2));
measure('14 Teile (Spiegel)  ', n14, (i) => generatePattern(`spiegel:${i}:1`, 'spiegel', 1));
measure('28 Teile (Spiegel 2x)', Math.min(n14, 6000), (i) => generatePattern(`spiegel:${i}:2`, 'spiegel', 2));
