// Utility to fetch all locked fields for a given recommendation or series from ModLock
import { ModLock } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Returns a Set of all locked fields for a given recommendation.
 * Looks up locks by ao3ID and seriesID.
 * Includes 'ALL' if the whole rec is locked.
 * @param {Object} recommendation - Recommendation object with ao3ID and seriesID
 * @returns {Promise<Set<string>>}
 */
export async function getLockedFieldsForRec(recommendation) {
  if (!recommendation) return new Set();
  
  const whereConditions = [];
  
  // Add condition for ao3ID if it exists
  if (recommendation.ao3ID) {
    whereConditions.push({ ao3ID: recommendation.ao3ID });
  }
  
  // Add condition for seriesId if it exists  
  if (recommendation.seriesId) {
    whereConditions.push({ seriesId: recommendation.seriesId });
  }
  
  // If no identifiers, return empty set
  if (whereConditions.length === 0) return new Set();
  
  const locks = await ModLock.findAll({
    where: {
      [Op.or]: whereConditions,
      locked: true
    },
    attributes: ['field'],
  });
  
  return new Set(locks.map(l => l.field));
}