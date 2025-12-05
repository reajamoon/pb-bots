import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';

const root = process.cwd();

function listJsFiles(dir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (e.isFile() && e.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function checkFile(path) {
  const src = readFileSync(path, 'utf8');
  const lines = src.split(/\r?\n/);
  const seen = new Map();
  let issues = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('import')) continue;
    // Normalize whitespace for simple comparison
    const norm = line.replace(/\s+/g, ' ');
    if (seen.has(norm)) {
      issues.push({ line: i + 1, import: line });
    } else {
      seen.set(norm, true);
    }
  }
  if (issues.length) {
    console.error(`Duplicate import declarations in ${path}:`);
    for (const it of issues) {
      console.error(`  line ${it.line}: ${it.import}`);
    }
    return true;
  }
  return false;
}

function main() {
  const srcDir = join(root, 'src');
  const files = listJsFiles(srcDir);
  let hasIssues = false;
  for (const f of files) {
    if (checkFile(f)) hasIssues = true;
  }
  if (hasIssues) {
    console.error('\nFound duplicate import declarations. Please remove duplicates.');
    process.exit(1);
  } else {
    console.log('No duplicate import declarations found.');
  }
}

main();