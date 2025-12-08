// Finds a Series or Recommendation by ID, URL, or AO3 identifier
// Returns an object with {type: 'series'|'recommendation', record: Series|Recommendation}

import { Op } from 'sequelize';
import updateMessages from '../text/updateMessages.js';
import normalizeAO3Url from './normalizeAO3Url.js';
import { Recommendation, Series, SeriesFields, RecommendationFields } from '../../models/index.js';

/**
 * Finds a series or recommendation by identifier
 * @param {object} interaction - Discord interaction object
 * @param {string} identifier - ID, URL, or AO3 Work/Series ID
 * @returns {Promise<{type: 'series'|'recommendation', record: Series|Recommendation}>}
 * @throws {Error} If not found or invalid input
 */
async function findSeriesOrRecommendationByIdOrUrl(interaction, identifier) {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
        throw new Error(updateMessages.needIdentifier);
    }

    // Check for series ID with S prefix (e.g., S123)
    if (/^S\d+$/i.test(identifier)) {
        const seriesIdNum = parseInt(identifier.substring(1), 10);
        const series = await Series.findByPk(seriesIdNum);
        if (series) {
            return { type: 'series', record: series };
        }
        throw new Error(`Series S${seriesIdNum} not found.`);
    }

    // Try as integer ID for recommendations
    if (/^\d+$/.test(identifier)) {
        const idNum = parseInt(identifier, 10);
        const recommendation = await Recommendation.findByPk(idNum);
        if (recommendation) {
            return { type: 'recommendation', record: recommendation };
        }

        // Try as AO3 Work ID if not found as rec ID
        const recByAO3 = await Recommendation.findOne({
            where: {
                [RecommendationFields.url]: {
                    [Op.like]: `%archiveofourown.org/works/${identifier}%`
                }
            }
        });
        if (recByAO3) {
            return { type: 'recommendation', record: recByAO3 };
        }
    }

    // Try as URL
    if (/^https?:\/\//.test(identifier)) {
        const normalizedUrl = normalizeAO3Url(identifier);

        // Check if it's a series URL
        const seriesMatch = normalizedUrl.match(/archiveofourown\.org\/series\/(\d+)/);
        if (seriesMatch) {
            const ao3SeriesId = parseInt(seriesMatch[1], 10);
            const series = await Series.findOne({ where: { [SeriesFields.ao3SeriesId]: ao3SeriesId } });
            if (series) {
                return { type: 'series', record: series };
            }
            throw new Error(`Series with AO3 ID ${ao3SeriesId} not found.`);
        } else {
            // Regular work URL
            const recommendation = await Recommendation.findOne({ where: { [RecommendationFields.url]: normalizedUrl } });
            if (recommendation) {
                return { type: 'recommendation', record: recommendation };
            }
        }
    }

    // Try as exact case-sensitive title
    const recommendation = await Recommendation.findOne({ where: { [RecommendationFields.title]: identifier } });
    if (recommendation) {
        return { type: 'recommendation', record: recommendation };
    }

    throw new Error(updateMessages.notFound(identifier));
}

export default findSeriesOrRecommendationByIdOrUrl;