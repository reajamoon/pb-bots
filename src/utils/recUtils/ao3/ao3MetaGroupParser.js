// ao3MetaGroupParser.js
// Extracts and parses AO3 meta group block into a metadata object

const decodeHtmlEntities = require('../decodeHtmlEntities');


// Import shared AO3 field map
const AO3_FIELD_MAP = require('./ao3FieldMap');

/**
 * Parses all <dt>/<dd> pairs in the entire Cheerio document to extract AO3 metadata fields.
 * @param {CheerioStatic} $ - Cheerio root
 * @returns {Object} metadata
 */
function parseMetaGroup($) {
    const metadata = {};
    const metaFields = {};
    let lastLabel = null;
    let warnings = [];
    const unknownFields = {};
    // Find all <dt> and <dd> pairs in the document, regardless of parent
    const allDtDd = [];
    $('dt, dd').each((i, el) => {
        allDtDd.push(el);
    });
    allDtDd.forEach((el) => {
        const $el = $(el);
        if (el.tagName === 'dt') {
            let label = $el.text().replace(/[:\s\(\)]+/g, '_').toLowerCase().replace(/_+$/,'').replace(/^_+/, '');
            if (lastLabel) {
                warnings.push(`Warning: <dt> '${lastLabel}' missing corresponding <dd> in meta block.`);
            }
            lastLabel = label;
        } else if (el.tagName === 'dd' && lastLabel) {
            if (lastLabel === 'stats') {
                lastLabel = null;
                return;
            }
            if (AO3_FIELD_MAP[lastLabel]) {
                metaFields[lastLabel] = $el;
            } else {
                const value = $el.text().replace(/\s+/g, ' ').trim();
                unknownFields[lastLabel] = decodeHtmlEntities(value);
                warnings.push(`Unknown meta field: '${lastLabel}' found in meta block.`);
            }
            lastLabel = null;
        }
    });
    if (lastLabel) {
        warnings.push(`Warning: <dt> '${lastLabel}' missing corresponding <dd> at end of meta block.`);
    }
    if (warnings.length > 0) metadata.warnings = warnings;
    if (Object.keys(unknownFields).length > 0) metadata.unknownFields = unknownFields;
    metadata.metaFields = metaFields;
    return metadata;
}

module.exports = { parseMetaGroup };
