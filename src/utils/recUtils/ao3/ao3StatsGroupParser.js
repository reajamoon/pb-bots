
const AO3_FIELD_MAP = require('./ao3FieldMap');

/**
 * Parses all <dt>/<dd> pairs in the document to extract AO3 stats fields, not just in stats blocks.
 * Prevents duplication by only setting a field if it is not already set.
 * @param {CheerioStatic} $ - Cheerio root
 * @returns {{ stats: Object, unknownStats: Object }}
 */
function parseStatsGroup($) {
    const stats = {};
    const unknownStats = {};
    let lastLabel = null;
    // Find all <dt> and <dd> pairs in the document, regardless of parent
    const allDtDd = [];
    $('dt, dd').each((i, el) => {
        allDtDd.push(el);
    });
    allDtDd.forEach((el) => {
        const $el = $(el);
        if (el.tagName === 'dt') {
            let label = $el.text().replace(/[:\s\(\)]+/g, '_').toLowerCase().replace(/_+$/,'').replace(/^_+/, '');
            lastLabel = label;
        } else if (el.tagName === 'dd' && lastLabel) {
            let val = $el.text().replace(/,/g, '').trim();
            let num = parseInt(val, 10);
            let value = isNaN(num) ? val : num;
            const mapped = AO3_FIELD_MAP[lastLabel] || lastLabel;
            if ([
                'published', 'updated', 'completed'
            ].includes(mapped)) {
                // For date fields, only overwrite if newer
                const prev = stats[mapped];
                let prevDate = prev instanceof Date ? prev : (typeof prev === 'string' && /^\d{4}-\d{2}-\d{2}/.test(prev) ? new Date(prev) : null);
                let newDate = value instanceof Date ? value : (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(value) : null);
                if (!prevDate || (newDate && newDate > prevDate)) {
                    stats[mapped] = value;
                }
            } else if ([
                'words', 'chapters', 'comments', 'kudos', 'bookmarks', 'hits'
            ].includes(mapped)) {
                // For numeric/string stats, only overwrite if different
                if (stats[mapped] !== value) {
                    stats[mapped] = value;
                }
            } else {
                unknownStats[mapped] = value;
            }
            lastLabel = null;
        }
    });
    return { stats, unknownStats };
}

module.exports = { parseStatsGroup };
