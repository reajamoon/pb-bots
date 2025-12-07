import { HuntProgress } from '../../models/index.js';
import { isHuntUnlocked } from './registry.js';

// Narrative hunts: track discrete step keys inside progress via JSON
// We reuse HuntProgress.progress to store count and HuntProgress.meta as JSON of steps

export async function getNarrativeState(userId, huntKey) {
  const row = await HuntProgress.findOne({ where: { userId, huntKey } });
  if (!row) return { steps: {}, count: 0, unlockedAt: null };
  const meta = (row.meta && typeof row.meta === 'object') ? row.meta : {};
  const steps = meta.steps || {};
  const count = Object.values(steps).filter(Boolean).length;
  return { steps, count, unlockedAt: row.unlockedAt || null, row };
}

export async function markNarrativeStep(userId, huntKey, stepId) {
  let row = await HuntProgress.findOne({ where: { userId, huntKey } });
  if (!row) {
    row = await HuntProgress.create({ userId, huntKey, progress: 0, meta: { steps: {} } });
  }
  const meta = (row.meta && typeof row.meta === 'object') ? row.meta : {};
  meta.steps = meta.steps || {};
  if (meta.steps[stepId]) return { updated: false, row }; // already marked
  meta.steps[stepId] = true;
  row.meta = meta;
  row.progress = (row.progress || 0) + 1;
  await row.save();
  return { updated: true, row };
}

export function isNarrativeComplete(state, requiredSteps) {
  return requiredSteps.every(s => state.steps[s]);
}

// Meta-achievement helper: unlock when all required hunts are already unlocked
export async function metaRequirementsSatisfied(userId, requiredHuntKeys = []) {
  if (!requiredHuntKeys || !requiredHuntKeys.length) return false;
  for (const key of requiredHuntKeys) {
    const ok = await isHuntUnlocked(userId, key);
    if (!ok) return false;
  }
  return true;
}
