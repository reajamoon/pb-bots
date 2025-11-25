// backfillAo3Fields.js
// Script to backfill ao3ID for recommendations and ao3SeriesId, authors, workCount, wordCount, status for series
import { Recommendation, Series, sequelize } from '../src/models/index.js';

function extractAO3WorkId(url) {
  const match = url && url.match(/\/works\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
function extractAO3SeriesId(url) {
  const match = url && url.match(/\/series\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function backfillRecommendations() {
  const recs = await Recommendation.findAll();
  for (const rec of recs) {
    const ao3ID = extractAO3WorkId(rec.url);
    if (ao3ID && rec.ao3ID !== ao3ID) {
      rec.ao3ID = ao3ID;
      await rec.save();
      console.log(`Updated Recommendation ${rec.id} with ao3ID ${ao3ID}`);
    }
  }
}

async function backfillSeries() {
  const seriesList = await Series.findAll();
  for (const series of seriesList) {
    const ao3SeriesId = extractAO3SeriesId(series.url);
    let changed = false;
    if (ao3SeriesId && series.ao3SeriesId !== ao3SeriesId) {
      series.ao3SeriesId = ao3SeriesId;
      changed = true;
    }
    // Try to backfill authors, workCount, wordCount, status from recommendations
    const works = await Recommendation.findAll({ where: { seriesId: series.id } });
    if (works.length) {
      // Authors: union of all authors arrays
      const allAuthors = Array.from(new Set(works.flatMap(w => Array.isArray(w.authors) ? w.authors : [])));
      if (allAuthors.length && JSON.stringify(series.authors) !== JSON.stringify(allAuthors)) {
        series.authors = allAuthors;
        changed = true;
      }
      // workCount
      if (series.workCount !== works.length) {
        series.workCount = works.length;
        changed = true;
      }
      // wordCount: sum of all wordCounts
      const totalWords = works.reduce((sum, w) => sum + (w.wordCount || 0), 0);
      if (series.wordCount !== totalWords) {
        series.wordCount = totalWords;
        changed = true;
      }
      // status: if all works are complete, mark as 'Complete', else 'In Progress'
      const allComplete = works.every(w => w.status && /complete/i.test(w.status));
      const newStatus = allComplete ? 'Complete' : 'In Progress';
      if (series.status !== newStatus) {
        series.status = newStatus;
        changed = true;
      }
    }
    if (changed) {
      await series.save();
      console.log(`Updated Series ${series.id} with AO3/meta fields`);
    }
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    await backfillRecommendations();
    await backfillSeries();
    console.log('Backfill complete.');
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

main();
