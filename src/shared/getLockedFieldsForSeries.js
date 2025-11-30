import { ModLock } from '../models/index.js';

/**
 * Get locked fields for a specific series
 * @param {Object} series - Series model instance
 * @returns {Set<string>} - Set of locked field names
 */
export async function getLockedFieldsForSeries(series) {
    if (!series || !series.ao3SeriesId) {
        return new Set();
    }

    try {
        const modLocks = await ModLock.findAll({
            where: {
                ao3ID: series.ao3SeriesId,
                // For series, we expect the type to be 'series' or similar
                // This allows for future expansion if we need different lock types
            }
        });

        const lockedFields = new Set();
        for (const lock of modLocks) {
            if (lock.fieldName === 'ALL') {
                lockedFields.add('ALL');
            } else {
                lockedFields.add(lock.fieldName);
            }
        }

        return lockedFields;
    } catch (error) {
        console.error('[getLockedFieldsForSeries] Error:', error);
        return new Set();
    }
}