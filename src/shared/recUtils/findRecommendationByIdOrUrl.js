// Finds a rec by ID, URL, or AO3 work number. If you pass in more than one, expect sass.

import { Op } from 'sequelize';
import updateMessages from '../text/updateMessages.js';
import normalizeAO3Url from './normalizeAO3Url.js';
import { Recommendation, Series, RecommendationFields } from '../../models/index.js';


/**
 * Finds a recommendation by a single identifier (ID, URL, or AO3 Work ID as string).
 * @param {object} interaction - Discord interaction object
 * @param {string} identifier - ID, URL, or AO3 Work ID
 * @returns {Promise<object>} Recommendation instance
 * @throws {Error} If not found or invalid input
 */

async function findRecommendationByIdOrUrl(interaction, identifier) {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
        throw new Error(updateMessages.needIdentifier);
    }
    let recommendation = null;

    // Check for series ID with S prefix (e.g., S123)
    // Series IDs should be handled by calling code, not this function
    if (/^S\d+$/i.test(identifier)) {
        throw new Error(`Series ID ${identifier} should be handled separately. This function is for recommendations only.`);
    }

    // Try as integer ID for recommendations
    if (/^\d+$/.test(identifier)) {
        const idNum = parseInt(identifier, 10);
        recommendation = await Recommendation.findOne({ where: { [RecommendationFields.id]: idNum } });
        if (recommendation) return recommendation;
    }
    // Try as AO3 Work ID (if identifier is a number and not found as rec ID)
    if (/^\d+$/.test(identifier)) {
        recommendation = await Recommendation.findOne({
            where: {
                [RecommendationFields.url]: {
                    [Op.like]: `%archiveofourown.org/works/${identifier}%`
                }
            }
        });
        if (recommendation) return recommendation;
    }
    // Try as URL
    if (/^https?:\/\//.test(identifier)) {
        const normalizedUrl = normalizeAO3Url(identifier);

        // Check if it's a series URL - should be handled by calling code
        const seriesMatch = normalizedUrl.match(/archiveofourown\.org\/series\/(\d+)/);
        if (seriesMatch) {
            throw new Error(`Series URL ${normalizedUrl} should be handled separately. This function is for recommendations only.`);
        } else {
            // Regular work URL
            recommendation = await Recommendation.findOne({ where: { [RecommendationFields.url]: normalizedUrl } });
            if (recommendation) return recommendation;
        }
    }
    // Try as exact case-sensitive title
    recommendation = await Recommendation.findOne({ where: { [RecommendationFields.title]: identifier } });
    if (recommendation) return recommendation;
    throw new Error(updateMessages.notFound(identifier));
}

export default findRecommendationByIdOrUrl;
