import fs from 'fs';
import path from 'path';

const migrationsDir = path.resolve(process.cwd(), 'migrations');
const backupDir = path.resolve(process.cwd(), 'backup/migrations-duplicates');
fs.mkdirSync(backupDir, { recursive: true });

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));

// Map timestamp prefix to its files
const map = new Map();
for (const f of files) {
  const match = f.match(/^(\d{14,})-(.+)\.(c?js)$/);
  if (!match) continue;
  const ts = match[1];
  const list = map.get(ts) || [];
  list.push(f);
  map.set(ts, list);
}

let moved = 0;
for (const [ts, list] of map.entries()) {
  const js = list.find(f => f.endsWith('.js'));
  const cjs = list.find(f => f.endsWith('.cjs'));
  if (js && cjs) {
    const src = path.join(migrationsDir, js);
    const dest = path.join(backupDir, js);
    fs.renameSync(src, dest);
    console.log(`[migrations] Moved duplicate .js migration to backup: ${js}`);
    moved++;
  }
}

if (moved === 0) {
  console.log('[migrations] No duplicate .js migrations to move.');
} else {
  console.log(`[migrations] Moved ${moved} duplicate .js migration(s) to ${backupDir}`);
}
