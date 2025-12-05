#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();

function isJs(file) {
  return file.endsWith('.js') || file.endsWith('.mjs');
}

async function walk(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p, acc);
    } else if (isJs(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function rel(from, to) {
  return path.relative(from, to).replace(/\\/g, '/');
}

async function main() {
  const srcDir = path.join(ROOT, 'src');
  const targets = [
    path.join(srcDir, 'shared', 'emojiStore.js'),
    path.join(srcDir, 'shared', 'utils', 'logger.js'),
    path.join(srcDir, 'shared', 'utils', 'buttonId.js'),
    path.join(srcDir, 'shared', 'utils', 'permissionLevel.js'),
    path.join(srcDir, 'shared', 'utils', 'modLockUtils.js'),
    path.join(srcDir, 'shared', 'utils', 'globalModlockUtils.js'),
    path.join(srcDir, 'shared', 'utils', 'dateIso.js'),
    path.join(srcDir, 'shared', 'utils', 'interactionNavigation.js'),
    path.join(srcDir, 'shared', 'utils', 'messageTracking.js'),
    path.join(srcDir, 'shared', 'utils', 'timezoneValidator.js'),
    path.join(srcDir, 'shared', 'utils', 'validateAttachment.js'),
    path.join(srcDir, 'shared', 'utils', 'regionValidator.js'),
    path.join(srcDir, 'shared', 'utils', 'dualUpdate.js'),
  ];
  const files = await walk(srcDir);
  const problems = [];

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect imports referencing targeted shared modules via relative paths
      const m = line.match(/import\s+[^;]*from\s+['\"](\.{1,2}\/[^'\"]*)['\"]/);
      if (m) {
        const importPath = m[1];
        const fileDir = path.dirname(file);
        const resolved = path.normalize(path.join(fileDir, importPath));
        for (const target of targets) {
          if (path.basename(resolved) === path.basename(target)) {
            const expectedRel = rel(fileDir, target);
            const expectedImport = expectedRel.startsWith('.') ? expectedRel : './' + expectedRel;
            if (path.normalize(resolved) !== path.normalize(target)) {
              problems.push({ file, line: i + 1, importPath, expectedImport });
            }
          }
        }
        // Case-sensitivity guard: enforce expected helper names for modlock utils
        const base = path.basename(resolved);
        if (base.toLowerCase().includes('modlockutils')) {
          const allowed = new Set(['modlockUtils.js', 'modLockUtils.js', 'globalModlockUtils.js']);
          if (!allowed.has(base)) {
            problems.push({ file, line: i + 1, importPath, expectedImport: '<use exact casing: shared/utils/globalModlockUtils.js or shared/utils/modLockUtils.js>' });
          }
        }
      }
      // Models rule: allow models/index.js via any relative path; warn on direct model file imports
      const mModels = line.match(/from\s+['\"](\.{1,2}\/[^'\"]*models\/(.+?))['\"]/);
      if (mModels) {
        const importPath = mModels[1];
        const tail = mModels[2];
        if (!tail.endsWith('index.js')) {
          problems.push({ file, line: i + 1, importPath, expectedImport: '<use models/index.js>' });
        }
      }
    }
  }

  if (problems.length) {
    console.error('[lint:relative-imports] Found incorrect relative import paths:');
    for (const p of problems) {
      console.error(`- ${p.file}:${p.line} uses '${p.importPath}' -> expected '${p.expectedImport}'`);
    }
    process.exit(1);
  } else {
    console.log('[lint:relative-imports] emojiStore imports look good.');
  }
}

main().catch(err => {
  console.error('[lint:relative-imports] Error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
