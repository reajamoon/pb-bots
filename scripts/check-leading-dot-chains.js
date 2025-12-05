import { readFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';

function listJsFiles(dir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...listJsFiles(full));
    else if (e.isFile() && e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function checkFile(path) {
  const src = readFileSync(path, 'utf8');
  const lines = src.split(/\r?\n/);
  let issues = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('.')) {
      // Find previous non-empty, non-comment line
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === '') j--;
      const prev = j >= 0 ? lines[j].trim() : '';
      // If previous line ends with a semicolon, the leading '.' is a broken chain
      if (prev.endsWith(';')) {
        issues.push({ line: i + 1, prevLine: j + 1, snippet: trimmed });
      }
    }
  }
  if (issues.length) {
    console.error(`Leading dot after semicolon detected in ${path}:`);
    for (const it of issues) {
      console.error(`  line ${it.line}: ${it.snippet} (prev line ${it.prevLine} ends with ';')`);
    }
    return true;
  }
  return false;
}

function main() {
  const root = process.cwd();
  const files = listJsFiles(join(root, 'src'));
  let hasIssues = false;
  for (const f of files) {
    if (checkFile(f)) hasIssues = true;
  }
  if (hasIssues) {
    console.error('\nBroken method chains found. Fix lines starting with \'\.\' after a semicolon.');
    process.exit(1);
  } else {
    console.log('No broken method chains found.');
  }
}

main();