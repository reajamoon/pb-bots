import fs from 'fs';
import path from 'path';

const migrationsDir = path.resolve(process.cwd(), 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));

// Map timestamp prefix to extensions present
const map = new Map();
for (const f of files) {
  const match = f.match(/^(\d{14,})-(.+)\.(c?js)$/);
  if (!match) continue;
  const ts = match[1];
  const ext = match[3];
  const arr = map.get(ts) || new Set();
  arr.add(ext);
  map.set(ts, arr);
}

let hasMixed = false;
for (const [ts, exts] of map.entries()) {
  if (exts.has('js') && exts.has('cjs')) {
    hasMixed = true;
    const jsFile = files.find(f => f.startsWith(ts) && f.endsWith('.js'));
    const cjsFile = files.find(f => f.startsWith(ts) && f.endsWith('.cjs'));
    console.error(`[migrations] Mixed extensions for timestamp ${ts}: ${jsFile} and ${cjsFile}`);
  }
}

if (hasMixed) {
  console.error('[migrations] Detected mixed .js and .cjs migrations for the same timestamps. Standardize to .cjs only.');
  process.exit(2);
} else {
  console.log('[migrations] Extensions look clean.');
}
