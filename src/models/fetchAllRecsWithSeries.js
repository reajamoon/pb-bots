// Utility to fetch all Recommendations with their Series info (and optionally all works in the series)
import { Recommendation, Series } from './index.js';

/**
 * Fetch all recommendations, including their series info (if any).
 * Optionally, fetch all works in the series (ordered by part).
 * @param {boolean} includeSeriesWorks - If true, also include all works in the series
 * @returns {Promise<Recommendation[]>} Array of recommendations with .series (and .series.works if requested)
 */
export async function fetchAllRecsWithSeries(includeSeriesWorks = false) {
  const include = [
    {
      model: Series,
      as: 'series',
      ...(includeSeriesWorks
        ? { include: [{ model: Recommendation, as: 'works', order: [['part', 'ASC']] }] }
        : {})
    }
  ];
  return Recommendation.findAll({ include });
}
