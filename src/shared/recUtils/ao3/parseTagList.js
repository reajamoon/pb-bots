// Utility to extract an array of tag strings from a Cheerio <dd> element
// Usage: const tags = parseTagList($, ddElement);

import decodeHtmlEntities from '../decodeHtmlEntities.js';

/**
 * Extracts an array of tag strings from a Cheerio <dd> element containing AO3 tags.
 * @param {CheerioStatic} $ - The Cheerio instance.
 * @param {Cheerio} ddElement - The <dd> element containing <a class="tag"> children.
 * @returns {string[]} Array of tag strings.
 */
export function parseTagList($, ddElem) {
    if (!ddElem || ddElem.length === 0) return [];
    const tags = [];
    ddElem.find('a.tag').each((i, el) => {
        const tag = $(el).text().trim();
        if (tag) tags.push(decodeHtmlEntities(tag));
    });
    return tags;
}

// Named tag extraction functions for each AO3 tag type
// Each expects a Cheerio object for the <dl> or <dd> containing the relevant tags

// Freeform tags ("Additional Tags")
function excludeChapters($, selector) {
    // Select all matching elements not inside #chapters
    return $(selector).filter(function () {
        return $(this).closest('#chapters').length === 0;
    });
}

export function freeformTags($) {
    let tags = parseTagList($, excludeChapters($, 'dd.freeform.tags'));
    if (tags.length === 0) {
        // Fallback: find DD after DT 'Additional Tags'
        const dt = $("dl.meta.group dt").filter((i, el) => /additional\s+tags/i.test($(el).text()));
        if (dt.length) {
            const dd = dt.first().next('dd');
            tags = parseTagList($, dd);
        }
        // Global fallback: any '.tags' block outside chapters
        if (tags.length === 0) {
            tags = excludeChapters($, 'dd.tags a.tag').map((i, el) => $(el).text().trim()).get();
        }
    }
    return tags;
}

// Returns detailed link info for freeform tags to validate canonical slugs
export function freeformTagLinks($) {
    const links = [];
    const dd = excludeChapters($, 'dd.freeform.tags');
    const source = dd.length ? dd : (() => {
        const dt = $("dl.meta.group dt").filter((i, el) => /additional\s+tags/i.test($(el).text()));
        if (dt.length) {
            return dt.first().next('dd');
        }
        return excludeChapters($, 'dd.tags');
    })();
    source.find('a.tag').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        const slug = href.replace(/^.*\/tags\//, '').replace(/\/works.*$/, '').replace(/\?.*$/, '');
        if (text) links.push({ text: decodeHtmlEntities(text), href, slug });
    });
    return links;
}

export function archiveWarnings($) {
    let tags = parseTagList($, excludeChapters($, 'dd.warning.tags'));
    if (tags.length === 0) {
        const dt = $("dl.meta.group dt").filter((i, el) => /archive\s+warnings/i.test($(el).text()));
        if (dt.length) {
            const dd = dt.first().next('dd');
            tags = parseTagList($, dd);
        }
    }
    return tags;
}

export function relationshipTags($) {
    let tags = parseTagList($, excludeChapters($, 'dd.relationship.tags'));
    if (tags.length === 0) {
        const dt = $("dl.meta.group dt").filter((i, el) => /relationships?/i.test($(el).text()));
        if (dt.length) {
            const dd = dt.first().next('dd');
            tags = parseTagList($, dd);
        }
    }
    return tags;
}

export function relationshipTagLinks($) {
    const links = [];
    const dd = excludeChapters($, 'dd.relationship.tags');
    const source = dd.length ? dd : (() => {
        const dt = $("dl.meta.group dt").filter((i, el) => /relationships?/i.test($(el).text()));
        if (dt.length) return dt.first().next('dd');
        return excludeChapters($, 'dd.tags');
    })();
    source.find('a.tag').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        const rawSlug = href.replace(/^.*\/tags\//, '').replace(/\/works.*$/, '').replace(/\?.*$/, '');
        const slug = decodeURIComponent(rawSlug).toLowerCase();
        if (text) links.push({ text: decodeHtmlEntities(text), href, slug });
    });
    return links;
}

    // Normalize an AO3 canonical relationship slug to display text
    // e.g., 'Castiel*s*Dean%20Winchester' -> 'Castiel/Dean Winchester'
    export function normalizeRelationshipSlugToText(slug) {
        if (!slug) return '';
        let raw = String(slug);
        try { raw = decodeURIComponent(raw); } catch {}
        return raw.replace(/\+|%20/g, ' ').replace(/\*s\*/g, '/').trim();
    }

    // Normalize an AO3 canonical fandom slug to display text
    // e.g., 'Supernatural%20(TV%202005)' -> 'Supernatural (TV 2005)'
    export function normalizeFandomSlugToText(slug) {
        if (!slug) return '';
        let raw = String(slug);
        try { raw = decodeURIComponent(raw); } catch {}
        return raw.replace(/\+|%20/g, ' ').trim();
    }

export function characterTags($) {
    let tags = parseTagList($, excludeChapters($, 'dd.character.tags'));
    if (tags.length === 0) {
        const dt = $("dl.meta.group dt").filter((i, el) => /characters?/i.test($(el).text()));
        if (dt.length) {
            const dd = dt.first().next('dd');
            tags = parseTagList($, dd);
        }
    }
    return tags;
}

// Extract canonical validation signals directly from the AO3 DOM via cheerio
// Returns { hasMainlineSPN: boolean, hasSPNRpf: boolean, hasExplicitDeanCas: boolean,
//           fandomCanonicalTexts: string[], relationshipCanonicalTexts: string[] }
export function extractCanonicalValidation($) {
    const fandomLinks = fandomTagLinks($) || [];
    const relationshipLinks = relationshipTagLinks($) || [];
    const normSlug = s => {
        let raw = String(s || '');
        try { raw = decodeURIComponent(raw); } catch {}
        return raw.toLowerCase().replace(/\+|%20/g, ' ').trim();
    };
    const normText = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const MAIN_SPN_SLUGS = new Set([
        'supernatural (tv 2005)',
        'supernatural - all media types'
    ]);
    const REL_SPN_SLUGS = new Set([
        'castiel*s*dean winchester',
        'dean winchester*s*castiel'
    ]);
    const SHIP_TEXT_ALIASES = new Set([
        'castiel/dean winchester',
        'dean winchester/castiel',
        'destiel',
        'dean/cas',
        'cas/dean',
        'deancas'
    ]);

    const hasMainlineSPN = fandomLinks.some(l => MAIN_SPN_SLUGS.has(normSlug(l.slug)) || /\bsupernatural\b/.test(normSlug(l.slug)) || /\bsupernatural\b/.test(normText(l.text)));
    const hasSPNRpf = fandomLinks.some(l => normSlug(l.slug) === 'spn rpf' || normSlug(l.slug).includes('supernatural rpf'));

    const hasExplicitDeanCas = relationshipLinks.some(l => REL_SPN_SLUGS.has(normSlug(l.slug)) || SHIP_TEXT_ALIASES.has(normText(l.text)) || SHIP_TEXT_ALIASES.has(normText(normalizeRelationshipSlugToText(l.slug))));

    const fandomCanonicalTexts = fandomLinks.map(l => normalizeFandomSlugToText(l.slug));
    const relationshipCanonicalTexts = relationshipLinks.map(l => normalizeRelationshipSlugToText(l.slug));

    return { hasMainlineSPN, hasSPNRpf, hasExplicitDeanCas, fandomCanonicalTexts, relationshipCanonicalTexts };
}

export function categoryTags($) {
    let tags = parseTagList($, excludeChapters($, 'dd.category.tags'));
    if (tags.length === 0) {
        const dt = $("dl.meta.group dt").filter((i, el) => /categories?/i.test($(el).text()));
        if (dt.length) {
            const dd = dt.first().next('dd');
            tags = parseTagList($, dd);
        }
    }
    return tags;
}

export function fandomTags($) {
    let tags = parseTagList($, excludeChapters($, 'dd.fandom.tags'));
    if (tags.length === 0) {
        const dt = $("dl.meta.group dt").filter((i, el) => /fandoms?/i.test($(el).text()));
        if (dt.length) {
            const dd = dt.first().next('dd');
            tags = parseTagList($, dd);
        }
    }
    return tags;
}

export function fandomTagLinks($) {
    const links = [];
    const dd = excludeChapters($, 'dd.fandom.tags');
    const source = dd.length ? dd : (() => {
        const dt = $("dl.meta.group dt").filter((i, el) => /fandoms?/i.test($(el).text()));
        if (dt.length) return dt.first().next('dd');
        return excludeChapters($, 'dd.tags');
    })();
    source.find('a.tag').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        const rawSlug = href.replace(/^.*\/tags\//, '').replace(/\/works.*$/, '').replace(/\?.*$/, '');
        const slug = decodeURIComponent(rawSlug).toLowerCase();
        if (text) links.push({ text: decodeHtmlEntities(text), href, slug });
    });
    return links;
}

export function requiredTags($) {
    let tags = parseTagList($, excludeChapters($, 'dd.required.tags'));
    if (tags.length === 0) {
        const dt = $("dl.meta.group dt").filter((i, el) => /required\s+tags/i.test($(el).text()));
        if (dt.length) {
            const dd = dt.first().next('dd');
            tags = parseTagList($, dd);
        }
    }
    return tags;
}

// General utility for custom tag class
export function customTags($, dlElem, className) {
    return parseTagList($, dlElem.find(`dd.${className}.tags`));
}
