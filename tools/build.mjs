import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
mkdirSync('dist', { recursive: true });
const r = await build({ entryPoints: ['src/entry.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('src/index.html', 'utf8').replace('/*GAME*/', () => js);
writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
