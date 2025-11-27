// Utility to fetch all locked fields for a given recommendationId from ModLock
import { ModLock } from '../models/index.js';

/**
 * Returns a Set of all locked fields for a given recommendationId.
 * Includes 'ALL' if the whole rec is locked.
 * @param {number} recommendationId
 * @returns {Promise<Set<string>>}
 */
export async function getLockedFieldsForRec(recommendationId) {
  if (!recommendationId) return new Set();
  const locks = await ModLock.findAll({
    where: { recommendationId, locked: true },
    attributes: ['field'],
  });
  return new Set(locks.map(l => l.field));
}