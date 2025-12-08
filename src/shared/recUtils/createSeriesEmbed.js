import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { getAo3RatingColor } from './ao3/ao3TagColors.js';
import { formatRatingWithEmoji, formatArchiveWarnings } from './ao3Emojis.js';
import { detectSiteAndExtractIDs } from './processUserMetadata.js';

// ================== UTILITY FUNCTIONS ==================

/**
 * Check if a string is in title case (Where Each Word Is Capitalized)
 */
function isTitleCase(str) {
    const words = str.split(' ');
    return words.every(word => {
        if (word.length === 0) return true;
        // First character should be uppercase, rest lowercase (except for apostrophes/hyphens)
        const firstChar = word.charAt(0);
        const rest = word.slice(1);
        return firstChar === firstChar.toUpperCase() &&
               rest.split(/[-']/).every(part => part === part.toLowerCase());
    });
}

/**
 * Find the oldest work in a series by date - use this instead of array position
 * to ensure prequels aren't falsely selected as primary works
 */
function findOldestWork(works) {
    if (!works || works.length === 0) return null;
    // Sort works by: publishedDate (earliest first), then updatedDate, then createdAt
    return works.sort((a, b) => {
        // Try published date first
        if (a.publishedDate && b.publishedDate) {
            const dateA = new Date(a.publishedDate);
            const dateB = new Date(b.publishedDate);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
        }
        // If published dates are same/missing, try updated date
        if (a.updatedDate && b.updatedDate) {
            const dateA = new Date(a.updatedDate);
            const dateB = new Date(b.updatedDate);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
        }
        // Final fallback: creation date in database
        if (a.createdAt && b.createdAt) {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateA.getTime() - dateB.getTime();
        }
        return 0;
    })[0];
}

/**
 * Get color based on rating, with fallback to primary work
 */
function getSeriesRatingColor(rating, series) {
    if (rating) return getAo3RatingColor(rating.toLowerCase());

    // Fallback: compute aggregate rating from works (use highest severity)
    if (series && series.works && series.works.length > 0) {
        const ratingOrder = ['not rated', 'general audiences', 'teen and up audiences', 'mature', 'explicit'];
        let maxIndex = 0;
        for (const work of series.works) {
            const r = (work.rating || '').toLowerCase();
            const idx = ratingOrder.indexOf(r);
            if (idx > maxIndex) maxIndex = idx;
        }
        return getAo3RatingColor(ratingOrder[maxIndex] || 'not rated');
    }
    return getAo3RatingColor('not rated');
}

/**
 * Format word count with proper number formatting
 */
function formatWordCount(wordCount) {
    if (!wordCount) return 'N/A';
    if (typeof wordCount === 'string') {
        wordCount = parseInt(wordCount.replace(/,/g, ''), 10);
    }
    return (typeof wordCount === 'number' && !isNaN(wordCount)) ? wordCount.toLocaleString() : 'N/A';
}

/**
 * Format numbers with locale-specific formatting
 */
function formatNumber(num) {
    if (!num) return null;
    if (typeof num === 'string') {
        num = parseInt(num.replace(/,/g, ''), 10);
    }
    return (typeof num === 'number' && !isNaN(num)) ? num.toLocaleString() : null;
}

/**
 * Format date string to readable format
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
        return dateStr; // Return original if parsing fails
    }
}

/**
 * Get site-specific link content for the Series Link field
 */
function getSiteLinkContent(url) {
    const siteInfo = detectSiteAndExtractIDs(url);
    if (siteInfo && siteInfo.site) {
        switch (siteInfo.site) {
            case 'ao3': return '[Read on AO3 Here]';
            case 'ffnet': return '[Read on FF.net Here]';
            case 'wattpad': return '[Read on Wattpad Here]';
            case 'tumblr': return '[Read on Tumblr Here]';
            case 'dreamwidth': return '[Read on Dreamwidth Here]';
            case 'livejournal': return '[Read on LiveJournal Here]';
            default: return '[Read Here]';
        }
    }
    return '[Read Here]';
}

// ================== TAG PROCESSING ==================

/**
 * Combine and deduplicate tags from series works and user metadata, prioritizing title case
 */
function processTagsForEmbed(series) {
    const allTags = [];

    // Add tags from all works in the series
    if (series.works && Array.isArray(series.works)) {
        for (const work of series.works) {
            if (work.tags) {
                if (Array.isArray(work.tags)) {
                    allTags.push(...work.tags);
                } else if (typeof work.tags === 'string') {
                    const parts = work.tags.split(/\s*[|,]\s*/).filter(Boolean);
                    allTags.push(...parts);
                }
            }
        }
    }

    // Add all users' additional tags from UserFicMetadata
    if (series.userMetadata && series.userMetadata.length > 0) {
        for (const userMeta of series.userMetadata) {
            if (userMeta.additional_tags) {
                if (Array.isArray(userMeta.additional_tags)) {
                    allTags.push(...userMeta.additional_tags);
                } else if (typeof userMeta.additional_tags === 'string') {
                    const parts = userMeta.additional_tags.split(/\s*[|,]\s*/).filter(Boolean);
                    allTags.push(...parts);
                }
            }
        }
    }

    if (allTags.length === 0) return null;

    // Deduplicate using normalized versions but prioritize title case for display
    const seen = new Set();
    const uniqueTags = [];

    for (const tag of allTags) {
        const normalized = tag.trim().toLowerCase();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            uniqueTags.push(tag);
        } else {
            // We've seen this tag before, but check if this version is title case
            const existingIndex = uniqueTags.findIndex(existing => existing.toLowerCase() === normalized);
            if (existingIndex >= 0 && isTitleCase(tag) && !isTitleCase(uniqueTags[existingIndex])) {
                uniqueTags[existingIndex] = tag;
            }
        }
    }

    const tagText = uniqueTags.join(', ');
    return tagText.length > 1024 ? tagText.slice(0, 1021) + '...' : tagText;
}

// ================== USER NOTES PROCESSING ==================

/**
 * Get randomized user notes from UserFicMetadata for the series
 */
function getRandomUserNotes(series) {
    if (!series.userMetadata || series.userMetadata.length === 0) return null;

    const usersWithNotes = series.userMetadata.filter(meta => meta.rec_note);
    if (usersWithNotes.length === 0) return null;

    // Randomize which user's notes to show
    const randomUserMeta = usersWithNotes[Math.floor(Math.random() * usersWithNotes.length)];
    return randomUserMeta.rec_note || null;
}

// ================== MAIN EMBED FUNCTION ==================

/**
 * Creates an embed for a series from the Series table
 * @param {Object} series - Series object from database
 * @returns {EmbedBuilder}
 */
export function createSeriesEmbed(series, options = {}) {
    if (!series) {
        throw new Error('Series data is required');
    }

    const { preferredUserId, userId, overrideNotes, includeAdditionalTags } = options;
    const targetUserId = preferredUserId || userId || null;

    // Build author description line with fallback to primary work
    let author = Array.isArray(series.authors) ? series.authors.join(', ') : series.author;
    if (!author && series.works && series.works.length > 0) {
        // Fallback: get author from primary work
        const primaryWork = series.works.find(work => !work.notPrimaryWork) || findOldestWork(series.works);
        if (primaryWork) {
            author = Array.isArray(primaryWork.authors) ? primaryWork.authors.join(', ') : primaryWork.author;
        }
    }
    author = author || 'Unknown Author';
    const authorLine = `**Series by:** ${author}`;

    // Add summary if available, separated by newlines
    let description = authorLine;
    if (series.summary) {
        const summaryText = series.summary.length > 400 ? series.summary.substring(0, 400) + '...' : series.summary;
        description += `\n\n>>> ${summaryText}`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`📚 ${series.name || 'Untitled Series'}`)
        .setURL(series.url || '')
        .setDescription(description)
        .setColor(getSeriesRatingColor(series.rating, series));

    // Series Link, Rating, Status row (inline group)
    if (series.url) {
        let linkContent;
        // Handle deleted series - show "Deleted" text and add backup link if available
        if (series.deleted) {
            linkContent = 'Deleted';
            if (series.attachmentUrl) {
                linkContent += ` • [📎 Backup Available](${series.attachmentUrl})`;
            }
        } else {
            linkContent = getSiteLinkContent(series.url).replace(/\[(.+)\]/, `[$1](${series.url})`);
        }
        embed.addFields({ name: '🔗 Series Link', value: linkContent, inline: true });
    }
    // Get rating and status with fallback to aggregate from works
    let seriesRating = series.rating;
    let seriesStatus = series.status;
    
    if (series.works && series.works.length > 0) {
        // Aggregate rating: pick highest severity across all works
        if (!seriesRating) {
            const ratingOrder = ['not rated', 'general audiences', 'teen and up audiences', 'mature', 'explicit'];
            let maxIndex = 0;
            for (const work of series.works) {
                const r = (work.rating || '').toLowerCase();
                const idx = ratingOrder.indexOf(r);
                if (idx > maxIndex) maxIndex = idx;
            }
            seriesRating = ['Not Rated', 'General Audiences', 'Teen And Up Audiences', 'Mature', 'Explicit'][maxIndex];
        }
        // Status fallback to primary work if missing
        if (!seriesStatus) {
            const primaryWork = series.works.find(work => !work.notPrimaryWork) || findOldestWork(series.works);
            if (primaryWork) seriesStatus = primaryWork.status;
        }
    }
    
    embed.addFields({ name: 'Rating', value: formatRatingWithEmoji(seriesRating), inline: true });
    embed.addFields({ name: 'Status', value: seriesStatus || 'Unknown', inline: true });

    // Works, Words, Published/Updated row (inline group)
    embed.addFields({ name: 'Works', value: series.workCount ? series.workCount.toString() : 'Unknown', inline: true });
    embed.addFields({ name: 'Words', value: formatWordCount(series.wordCount), inline: true });
    
    // Published date - use series started date or fallback to oldest work
    let publishedDate = series.publishedDate;
    if (!publishedDate && series.works && series.works.length > 0) {
        const oldestWork = findOldestWork(series.works);
        if (oldestWork && oldestWork.publishedDate) {
            publishedDate = oldestWork.publishedDate;
        }
    }
    
    if (publishedDate) {
        embed.addFields({ name: 'Published', value: formatDate(publishedDate), inline: true });
    } else if (series.updatedDate) {
        embed.addFields({ name: 'Updated', value: formatDate(series.updatedDate), inline: true });
    }

    // Archive Warnings (aggregate from works)
    if (series.works && Array.isArray(series.works)) {
        const allWarnings = [];
        for (const work of series.works) {
            if (work.archiveWarnings && Array.isArray(work.archiveWarnings)) {
                allWarnings.push(...work.archiveWarnings);
            }
        }
        // Only show warnings if there are actual warnings beyond "no archive warnings apply"
        const significantWarnings = allWarnings.filter(w =>
            w && w.toLowerCase() !== 'no archive warnings apply'
        );
        if (significantWarnings.length > 0) {
            // Remove duplicates while preserving original case
            const uniqueWarnings = [...new Set(significantWarnings)];
            const formattedWarnings = formatArchiveWarnings(uniqueWarnings);
            if (formattedWarnings) {
                embed.addFields({ name: 'Archive Warnings', value: formattedWarnings, inline: false });
            }
        }
        // If all works have "no archive warnings apply", don't show anything (hidden)
        // If any work has "creator chose not to use archive warnings", it will be included and formatted with the maybe emoji
    }

    // Works in Series (show first 4 works, with 5th line as 'and N more') - MOVED BEFORE TAGS
    if (series.works && Array.isArray(series.works) && series.works.length > 0) {
        const maxWorksToShow = 4;

        // Build an order map from series.series_works (AO3 order) if present
        const orderMap = new Map(); // ao3ID -> index (1-based)
        if (Array.isArray(series.series_works) && series.series_works.length > 0) {
            for (let i = 0; i < series.series_works.length; i++) {
                const sw = series.series_works[i];
                const site = detectSiteAndExtractIDs(sw.url || '');
                if (site && site.site === 'ao3' && site.ao3ID) {
                    orderMap.set(Number(site.ao3ID), i + 1);
                }
            }
        }

        // Order works: by explicit part if present; else by AO3 order from orderMap; else by publishedDate asc
        const orderedWorks = [...series.works].sort((a, b) => {
            const partA = a.part || null;
            const partB = b.part || null;
            if (partA != null && partB != null && partA !== partB) return partA - partB;

            const idxA = orderMap.size ? (orderMap.get(Number(a.ao3ID)) || Infinity) : Infinity;
            const idxB = orderMap.size ? (orderMap.get(Number(b.ao3ID)) || Infinity) : Infinity;
            if (idxA !== idxB) return idxA - idxB;

            const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : Infinity;
            const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;

            // Final fallback: createdAt
            const cA = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
            const cB = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
            return cA - cB;
        });

        const worksToDisplay = orderedWorks.slice(0, maxWorksToShow);
        let worksList = '';
        for (let i = 0; i < worksToDisplay.length; i++) {
            const work = worksToDisplay[i];
            const title = work.title || `Work ${i + 1}`;
            const url = work.url || `https://archiveofourown.org/works/${work.ao3ID || work.id}`;
            // Determine display number: prefer explicit part, else AO3 index from orderMap, else position in this list
            let displayNum = work.part || orderMap.get(Number(work.ao3ID)) || (i + 1);
            worksList += `${displayNum}. [${title}](${url})\n`;
        }

        // Add 'and N more' line if there are more than 4 works
        if (series.workCount && series.workCount > maxWorksToShow) {
            worksList += `... and ${series.workCount - maxWorksToShow} more works`;
        } else if (series.works.length > maxWorksToShow) {
            worksList += `... and ${series.works.length - maxWorksToShow} more works`;
        }

        embed.addFields({ name: `Works in Series (${series.workCount || series.works.length})`, value: worksList.trim(), inline: false });
    }

    // Tags (optionally include extra tags passed in)
    const seriesForTags = { ...series };
    if (includeAdditionalTags && Array.isArray(includeAdditionalTags) && includeAdditionalTags.length) {
        const extra = Array.isArray(includeAdditionalTags) ? includeAdditionalTags : [];
        seriesForTags.userMetadata = Array.isArray(series.userMetadata) ? series.userMetadata.map(m => ({ ...m })) : [];
        seriesForTags.userMetadata.push({ additional_tags: extra });
    }
    const tagText = processTagsForEmbed(seriesForTags);
    if (tagText) {
        embed.addFields({ name: 'Tags', value: tagText, inline: false });
    }

    // Engagement stats (aggregate from all works)
    if (series.works && Array.isArray(series.works)) {
        let totalHits = 0;
        let totalKudos = 0;
        let totalBookmarks = 0;
        let totalComments = 0;
        
        for (const work of series.works) {
            totalHits += work.hits ? parseInt(work.hits) || 0 : 0;
            totalKudos += work.kudos ? parseInt(work.kudos) || 0 : 0;
            totalBookmarks += work.bookmarks ? parseInt(work.bookmarks) || 0 : 0;
            totalComments += work.comments ? parseInt(work.comments) || 0 : 0;
        }
        
        if (totalHits || totalKudos || totalBookmarks) {
            embed.addFields({ name: 'Total Hits', value: formatNumber(totalHits) || 'N/A', inline: true });
            embed.addFields({ name: 'Total Kudos', value: formatNumber(totalKudos) || 'N/A', inline: true });
            embed.addFields({ name: 'Total Bookmarks', value: formatNumber(totalBookmarks) || 'N/A', inline: true });
        }
    }

    // Recommender Notes and footer attribution
    let chosenNote = null;
    let chosenUserName = null;
    if (overrideNotes && typeof overrideNotes === 'string' && overrideNotes.trim()) {
        chosenNote = overrideNotes.trim();
        if (targetUserId && Array.isArray(series.userMetadata)) {
            const meta = series.userMetadata.find(m => String(m.userID) === String(targetUserId));
            if (meta && meta.user && meta.user.username) {
                chosenUserName = meta.user.username;
            }
        }
    } else if (targetUserId && Array.isArray(series.userMetadata)) {
        const meta = series.userMetadata.find(m => String(m.userID) === String(targetUserId) && m.rec_note);
        if (meta) {
            chosenNote = meta.rec_note;
            chosenUserName = (meta.user && meta.user.username) || null;
        }
    }
    if (!chosenNote) {
        if (Array.isArray(series.userMetadata)) {
            const usersWithNotes = series.userMetadata.filter(m => m && m.rec_note);
            if (usersWithNotes.length > 0) {
                const meta = usersWithNotes[Math.floor(Math.random() * usersWithNotes.length)];
                chosenNote = meta.rec_note;
                chosenUserName = (meta.user && meta.user.username) || null;
            }
        }
    }
    if (chosenNote) {
        embed.addFields({ name: 'Recommender Notes:', value: chosenNote, inline: false });
    }

    // Footer attribution prefers note owner; fallback to series/work recommender
    let recommenderName = chosenUserName || series.recommendedByUsername;
    if (!recommenderName && series.works && series.works.length > 0) {
        const firstWork = series.works[0];
        recommenderName = firstWork.recommendedByUsername;
    }
    recommenderName = recommenderName || 'unknown';
    embed.setFooter({ text: `From the Profound Bond Library • Recommended by ${recommenderName} • Series ID: S${series.id}` });

    return embed;
}