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
