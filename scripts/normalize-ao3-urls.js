// scripts/normalize-ao3-urls.js
// Usage: node scripts/normalize-ao3-urls.js
// Normalizes AO3 URLs in the Recommendation table by removing trailing /chapters/* and deduplicates, keeping the oldest entry.

const { Recommendation } = require('../src/models');
const { Op } = require('sequelize');

function normalizeAo3Url(url) {
    // Only normalize AO3 URLs
    if (!url) return url;
    const ao3Match = url.match(/^https?:\/\/(www\.)?archiveofourown\.org\/works\/\d+(\/chapters\/\d+)?/);
    if (!ao3Match) return url;
    // Remove /chapters/*
    return url.replace(/(\/works\/\d+)(\/chapters\/\d+)?/, '$1');
}

async function main() {
    const recs = await Recommendation.findAll({ order: [['createdAt', 'ASC']] });
    // Step 1: Normalize all URLs in memory
    for (const rec of recs) {
        rec._normalizedUrl = normalizeAo3Url(rec.url);
    }
    // Step 2: Group by normalized URL, keep oldest, mark others for deletion
    const seen = new Map(); // normalizedUrl -> Recommendation (oldest)
    const toDelete = [];
    for (const rec of recs) {
        const normUrl = rec._normalizedUrl;
        if (seen.has(normUrl)) {
            toDelete.push(rec.id);
        } else {
            seen.set(normUrl, rec);
        }
    }
    // Step 3: Delete duplicates
    if (toDelete.length) {
        await Recommendation.destroy({ where: { id: { [Op.in]: toDelete } } });
    }
    // Step 4: Update remaining recs to have normalized URL if needed
    let updated = 0;
    for (const rec of seen.values()) {
        if (rec.url !== rec._normalizedUrl) {
            rec.url = rec._normalizedUrl;
            await rec.save();
            updated++;
        }
    }
    console.log(`Normalized ${updated} URLs. Removed ${toDelete.length} duplicates.`);
}

main().catch(e => { console.error(e); process.exit(1); });
