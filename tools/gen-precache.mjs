// Regenerates the PRECACHE list in sw.js from the files on disk and bumps the cache version.
// Run after adding/removing app files:  node tools/gen-precache.mjs
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const include = /\.(html|js|css|webp|jpg|png|svg|webmanifest)$/;
const skipDirs = new Set(['kiosk', 'tools', 'node_modules', '.git', 'docs']);
const skipFiles = new Set(['sw.js', 'server.js']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!skipDirs.has(name)) walk(p, out); }
    else if (include.test(name) && !skipFiles.has(name)) out.push('./' + relative(root, p).split('\\').join('/'));
  }
  return out;
}

const files = ['./', ...walk(root).sort()];
const swPath = join(root, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n${files.map((f) => `  '${f}',`).join('\n')}\n];`);
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = 'isla-${Date.now().toString(36)}';`);
writeFileSync(swPath, sw);
console.log(`sw.js: ${files.length} files precached`);
