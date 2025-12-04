// normalizeAllAo3Urls.js
// Script to normalize all AO3 work and series URLs in recommendations and series tables
import { Recommendation, Series, sequelize } from '../src/models/index.js';
import { normalizeAO3Url } from '../src/shared/recUtils/normalizeAO3Url.js';

async function normalizeRecommendations() {
  const recs = await Recommendation.findAll();
  let updated = 0;
  for (const rec of recs) {
    const normUrl = normalizeAO3Url(rec.url);
    if (normUrl && normUrl !== rec.url) {
      rec.url = normUrl;
      await rec.save();
      console.log(`Updated Recommendation id=${rec.id} to normalized URL: ${normUrl}`);
      updated++;
    }
  }
  return updated;
}

async function normalizeSeries() {
  const seriesList = await Series.findAll();
  let updated = 0;
  for (const series of seriesList) {
    const normUrl = normalizeAO3Url(series.url);
    if (normUrl && normUrl !== series.url) {
      series.url = normUrl;
      await series.save();
      console.log(`Updated Series id=${series.id} to normalized URL: ${normUrl}`);
      updated++;
    }
  }
  return updated;
}

async function main() {
  await sequelize.authenticate();
  const recsUpdated = await normalizeRecommendations();
  const seriesUpdated = await normalizeSeries();
  console.log(`Normalization complete. Updated ${recsUpdated} recommendations and ${seriesUpdated} series URLs.`);
  process.exit(0);
}

main();
