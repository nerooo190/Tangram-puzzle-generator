import { solve } from './core/fit.js';
import { maskFromJson } from './core/mask.js';

self.onmessage = (e) => {
  const { id, mask, sets, seed, topK, restarts, iters } = e.data;
  try {
    const sols = solve(maskFromJson(mask), { sets, seed, topK, restarts, iters });
    self.postMessage({ id, sols });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
