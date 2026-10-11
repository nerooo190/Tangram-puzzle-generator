import { parentPort } from 'node:worker_threads';
import { maskFromJson } from '../web/js/core/mask.js';
import { solve } from '../web/js/core/fit.js';

parentPort.on('message', (task) => {
  const mask = maskFromJson(task.mask);
  const sols = solve(mask, { seed: `bake:${task.id}`, restarts: task.restarts, iters: task.iters, topK: task.topK });
  parentPort.postMessage({ id: task.id, sols });
});
