import { generateAbstract, generatePattern, STYLES, PATTERNS } from '../web/js/core/generate.js';
const out = {};
for (const style of Object.keys(STYLES)) for (let i = 0; i < 3; i++) out[`abs:${style}:${i}`] = generateAbstract(`${style}:${i}:1`, style, 1);
for (const style of ['frei', 'kompakt']) out[`abs2:${style}`] = generateAbstract(`${style}:1000000000000000000000:2`, style, 2);
for (const kind of Object.keys(PATTERNS)) for (let i = 0; i < 3; i++) out[`pat:${kind}:${i}`] = generatePattern(`${kind}:${i}`, kind);
console.log('JSON>>' + JSON.stringify(out));
