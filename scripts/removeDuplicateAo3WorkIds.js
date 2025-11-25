// removeDuplicateAo3WorkIds.js
// Script to remove newer duplicates of AO3 workIDs in recommendations
import { Recommendation, sequelize } from '../src/models/index.js';

function extractAO3WorkId(url) {
  const match = url && url.match(/\/works\/(\d+)/);
  return match ? match[1] : null;
}

async function main() {
  await sequelize.authenticate();
  const recs = await Recommendation.findAll();
  const byAo3Id = {};
  for (const rec of recs) {
    const ao3Id = extractAO3WorkId(rec.url);
    if (!ao3Id) continue;
    if (!byAo3Id[ao3Id]) byAo3Id[ao3Id] = [];
    byAo3Id[ao3Id].push(rec);
  }
  let removed = 0;
  for (const [ao3Id, recs] of Object.entries(byAo3Id)) {
    if (recs.length > 1) {
      // Sort by createdAt ascending (oldest first)
      recs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      // Keep the oldest, remove the rest
      const toRemove = recs.slice(1);
      for (const rec of toRemove) {
        await rec.destroy();
        console.log(`Removed duplicate Recommendation id=${rec.id}, AO3 workID=${ao3Id}, URL=${rec.url}`);
        removed++;
      }
    }
  }
  if (removed === 0) {
    console.log('No duplicates found to remove.');
  } else {
    console.log(`Removed ${removed} duplicate recommendations.`);
  }
  process.exit(0);
}

main();
