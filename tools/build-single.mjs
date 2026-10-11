// Baut die Web-App als EINE HTML-Datei (Pakete eingebettet, Solver als Blob-Worker).
// Aufruf: ESBUILD=/pfad/zu/esbuild-modul node tools/build-single.mjs <ausgabe.html>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.ESBUILD_DIR ? path.join(process.env.ESBUILD_DIR, 'x.js') : import.meta.url);
const esbuild = require('esbuild');
const out = process.argv[2] || 'dist/tangram.html';
const opts = { bundle: true, format: 'iife', minify: true, target: 'es2022', write: false, legalComments: 'none' };
const app = (await esbuild.build({ ...opts, entryPoints: ['web/js/app.js'] })).outputFiles[0].text;
const worker = (await esbuild.build({ ...opts, entryPoints: ['web/js/fit.worker.js'] })).outputFiles[0].text;

const dir = 'web/data/packs';
const packs = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8')).map((e) => JSON.parse(fs.readFileSync(`${dir}/${e.id}.json`, 'utf8')));
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

const html = fs.readFileSync('web/index.html', 'utf8');
const css = fs.readFileSync('web/style.css', 'utf8');
const title = html.match(/<title>(.*?)<\/title>/)[1];
const fonts = [...html.matchAll(/<link[^>]+(?:preconnect|fonts\.googleapis\.com\/css2)[^>]*>/g)].map((m) => m[0]).join('\n');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');

const page = `<title>${title}</title>
${fonts}
<style>
${css}
</style>
${body}
<script>window.__TANGRAM_PACKS__=${safe(JSON.stringify(packs))};window.__TANGRAM_WORKER_SRC__=${safe(JSON.stringify(worker))};</script>
<script>${safe(app)}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1048576).toFixed(2)} MB`);
