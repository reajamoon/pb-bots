/**
 * Simple check to flag member-facing strings outside bot-local folders.
 * Scans shared code for likely hard-coded messages and warns.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sharedDir = path.join(root, 'src', 'shared');

const MESSAGE_HINTS = [
  /reply|send|update|ephemeral|content|description/i,
  /MessageFlags\.Ephemeral|InteractionFlags\.Ephemeral|\b64\b/, // ephemeral flag usage
];

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && /\.(js|mjs|ts)$/.test(e.name)) yield full;
  }
}

function hasMemberFacingStrings(code) {
  // crude heuristic: presence of quotes near Discord fields
  return MESSAGE_HINTS.some((r) => r.test(code)) && /["'`].{3,}/.test(code);
}

let issues = [];
for (const file of walk(sharedDir)) {
  const code = fs.readFileSync(file, 'utf8');
  if (hasMemberFacingStrings(code)) {
    issues.push(file);
  }
}

if (issues.length) {
  console.warn('\n[bot-text-scope] Potential member-facing strings found in shared code:');
  for (const f of issues) console.warn(' - ' + path.relative(root, f));
  console.warn('\nMove member-facing text into bot-local folders (sam/dean/cas).');
  process.exitCode = 1;
} else {
  console.log('[bot-text-scope] OK: no obvious member-facing strings in shared code.');
}