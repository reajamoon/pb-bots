// Utility for global modlock field checks using Config table
import { Config } from '../models/index.js';
let globalModlockedFieldsCache = null;

/**
 * Loads and caches the global modlocked fields from the Config table.
 * Expects Config row with key 'global_modlocked_fields' and value as comma-separated field names.
 * @returns {Promise<Set<string>>}
 */
export async function getGlobalModlockedFields() {
  if (globalModlockedFieldsCache) return globalModlockedFieldsCache;
  const configEntry = await Config.findOne({ where: { key: 'global_modlocked_fields' } });
  if (!configEntry) {
    globalModlockedFieldsCache = new Set();
    return globalModlockedFieldsCache;
  }
  globalModlockedFieldsCache = new Set(
    configEntry.value.split(',').map(f => f.trim()).filter(Boolean)
  );
  return globalModlockedFieldsCache;
}

/**
 * Checks if a field is globally modlocked.
 * @param {string} fieldName
 * @returns {Promise<boolean>}
 */
export async function isFieldGloballyModlocked(fieldName) {
  const fields = await getGlobalModlockedFields();
  return fields.has(fieldName);
}

/**
 * (Optional) Call this to clear the cache if config changes at runtime.
 */
export function clearGlobalModlockedFieldsCache() {
  globalModlockedFieldsCache = null;
}