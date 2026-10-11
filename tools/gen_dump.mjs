import { generateAbstract, generatePattern, STYLES, PATTERNS } from '../web/js/core/generate.js';
const out = {};
for (const style of Object.keys(STYLES)) for (let i = 0; i < 40; i++) out[`abs:${style}:${i}`] = generateAbstract(`${style}:${i}:1`, style, 1);
for (const style of Object.keys(STYLES)) for (let sets = 2; sets <= 3; sets++) out[`abs${sets}:${style}`] = generateAbstract(`${style}:1000000000000000000000:${sets}`, style, sets);
for (const kind of Object.keys(PATTERNS)) for (let i = 0; i < 20; i++) out[`pat:${kind}:${i}`] = generatePattern(`${kind}:${i}:1`, kind, 1);
for (const kind of Object.keys(PATTERNS)) out[`pat2:${kind}`] = generatePattern(`${kind}:77:2`, kind, 2);
console.log('JSON>>' + JSON.stringify(out));
