import fs from 'node:fs';
import { maskFromJson } from '../web/js/core/mask.js';
import { solve } from '../web/js/core/fit.js';
const pack = JSON.parse(fs.readFileSync('web/data/packs/tiere.json', 'utf8'));
const out = {};
const t0 = Date.now();
for (const fi of [0, 5, 12]) {
  const fig = pack.figures[fi];
  out[fig.id] = solve(maskFromJson(fig.mask), { sets: 1, seed: `test:${fig.id}`, restarts: 3, iters: 6000, topK: 3 });
}
console.log('ms=' + (Date.now() - t0));
console.log('JSON>>' + JSON.stringify(out));
