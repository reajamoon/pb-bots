import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { getAo3RatingColor } from './ao3/ao3TagColors.js';
import decodeHtmlEntities from './decodeHtmlEntities.js';
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
 * Get color based on rating
 */
function getRatingColor(rating) {
    if (!rating) return getAo3RatingColor('not rated');
    return getAo3RatingColor(rating.toLowerCase());
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
 * Get site-specific link content for the Story Link field
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
 * Use AO3 freeform tags from Recommendation.freeform_tags (preferred)
 * and legacy Recommendation.tags, plus member-added tags from
 * UserFicMetadata.additional_tags.
 * No fandom/character filtering — keep this builder simple.
 */
function processTagsForEmbed(rec) {
    const items = [];

    function add(val) {
        if (!val) return;
        if (Array.isArray(val)) {
            for (const t of val) {
                if (t != null && String(t).trim()) items.push(String(t).trim());
            }
        } else if (typeof val === 'string') {
            const parts = val.split(/\s*[|,]\s*/).map(s => s.trim()).filter(Boolean);
            for (const p of parts) items.push(p);
        }
    }

    // Collect intended sources: Recommendation.tags and member-added additional_tags
    if (process.env.REC_EMBED_DEBUG) {
        try {
            console.debug('[createRecEmbed] Tag sources:', {
                tagsType: Array.isArray(rec.tags) ? 'array' : typeof rec.tags,
                tagsLen: Array.isArray(rec.tags) ? rec.tags.length : (typeof rec.tags === 'string' ? rec.tags.length : 0),
                userMetaCount: Array.isArray(rec.userMetadata) ? rec.userMetadata.length : 0
            });
        } catch {}
    }
    add(rec.tags);
    if (Array.isArray(rec.userMetadata)) {
        for (const m of rec.userMetadata) add(m && m.additional_tags);
    }

    if (items.length === 0) return null;

    const seen = new Set();
    const out = [];
    for (const t of items) {
        const n = t.toLowerCase();
        if (!seen.has(n)) { seen.add(n); out.push(t); }
    }

    const tagText = out.join(', ');
    return tagText.length > 1024 ? tagText.slice(0, 1021) + '...' : tagText;
}

// ================== USER NOTES PROCESSING ==================

/**
 * Get randomized user notes from UserFicMetadata
 */
function getRandomUserNotes(rec) {
    if (!rec.userMetadata || rec.userMetadata.length === 0) return null;

    const usersWithNotes = rec.userMetadata.filter(meta => meta.rec_note);
    if (usersWithNotes.length === 0) return null;

    // Randomize which user's notes to show
    const randomUserMeta = usersWithNotes[Math.floor(Math.random() * usersWithNotes.length)];
    return randomUserMeta.rec_note || null;
}

// ================== MAIN EMBED FUNCTION ==================

/**
 * Creates an embed for an individual recommendation
 * @param {Object} rec - Recommendation object from database
 * @returns {EmbedBuilder}
 */
export function createRecEmbed(rec, options = {}) {
    if (!rec) {
        throw new Error('Recommendation data is required');
    }

    const { preferredUserId, userId, overrideNotes, includeAdditionalTags } = options;
    const targetUserId = preferredUserId || userId || null;

    // Normalize common snake_case vs camelCase fields for robustness
    const norm = {
        title: rec.title || rec.work_title || 'Untitled',
        url: rec.url || rec.work_url || '',
        rating: rec.rating || rec.work_rating || null,
        status: rec.status || rec.work_status || 'Unknown',
        publishedDate: rec.publishedDate || rec.published_date || null,
        chapters: rec.chapters || rec.chapter_count || null,
        wordCount: rec.wordCount || rec.word_count || null,
        hits: rec.hits ?? rec.hit_count ?? null,
        kudos: rec.kudos ?? rec.kudos_count ?? null,
        bookmarks: rec.bookmarks ?? rec.bookmark_count ?? null,
        summary: rec.summary || rec.work_summary || null,
        authors: Array.isArray(rec.authors) ? rec.authors : (Array.isArray(rec.author_list) ? rec.author_list : null),
        author: rec.author || rec.author_name || null,
        series: rec.series || rec.work_series || null,
        part: rec.part || rec.series_part || null,
        archiveWarnings: Array.isArray(rec.archiveWarnings) ? rec.archiveWarnings : (Array.isArray(rec.archive_warnings) ? rec.archive_warnings : null),
    };

    // Build author description line
    let author = Array.isArray(norm.authors) ? norm.authors.filter(Boolean) : [];
    // Dedupe and cap to prevent pathological duplicates from bad parses
    if (author.length) {
        const seen = new Set();
        author = author.filter(a => {
            const key = String(a).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    author = author.length ? author.join(', ') : (norm.author || 'Unknown Author');
    if (author.length > 200) author = author.slice(0, 197) + '...';
    const authorLine = `**By:** ${author}`;
    
    // Add summary if available, separated by newlines
    let description = authorLine;
        if (norm.summary) {
            let summaryText = decodeHtmlEntities(norm.summary);
            if (summaryText.length > 1024) summaryText = summaryText.substring(0, 1024);
            description += `\n\n>>> ${summaryText}`;
        }

    const embed = new EmbedBuilder()
        .setTitle(norm.title)
        .setURL(norm.url)
        .setDescription(description)
        .setColor(getRatingColor(norm.rating));

    // Story Link, Rating, Status row (inline group)
    if (norm.url) {
        let linkContent;
        // Handle deleted stories - show "Deleted" text and add backup link if available
        if (rec.deleted) {
            linkContent = 'Deleted';
            if (rec.attachmentUrl) {
                linkContent += ` • [📎 Backup Available](${rec.attachmentUrl})`;
            }
        } else {
            linkContent = getSiteLinkContent(norm.url).replace(/\[(.+)\]/, `[$1](${norm.url})`);
        }
        embed.addFields({ name: '🔗 Story Link', value: linkContent, inline: true });
    }
    embed.addFields({ name: 'Rating', value: formatRatingWithEmoji(norm.rating), inline: true });
    embed.addFields({ name: 'Status', value: norm.status, inline: true });

    // Published date, Chapters, Words row (inline group)
    if (norm.publishedDate) {
        embed.addFields({ name: 'Published', value: formatDate(norm.publishedDate), inline: true });
    }
    if (norm.chapters) {
        embed.addFields({ name: 'Chapters', value: norm.chapters.toString(), inline: true });
    }
    embed.addFields({ name: 'Words', value: formatWordCount(norm.wordCount), inline: true });

    // Archive Warnings
    const formattedWarnings = formatArchiveWarnings(norm.archiveWarnings);
    if (formattedWarnings) {
        embed.addFields({ name: 'Archive Warnings', value: formattedWarnings, inline: false });
    }

    // Series (if this work is part of a series)
    if (norm.series && norm.series.name && norm.series.url) {
        let seriesText = `[${norm.series.name}](${norm.series.url})`;
        if (norm.part) {
            seriesText = `Part ${norm.part} of ${seriesText}`;
        }
        embed.addFields({ name: '📚 Series', value: seriesText, inline: false });
    }

    // Tags (optionally include extra tags passed in)
    // Convert Sequelize model instance to plain object so fields like `tags` are accessible
    const recPlain = (rec && typeof rec.get === 'function') ? rec.get({ plain: true }) : rec;
    const recForTags = { ...recPlain };
    if (includeAdditionalTags && Array.isArray(includeAdditionalTags) && includeAdditionalTags.length) {
        const extra = Array.isArray(includeAdditionalTags) ? includeAdditionalTags : [];
        recForTags.userMetadata = Array.isArray(rec.userMetadata) ? rec.userMetadata.map(m => ({ ...m })) : [];
        // Attach a synthetic metadata entry to ensure extra tags are considered
        recForTags.userMetadata.push({ additional_tags: extra });
    }
    const tagText = processTagsForEmbed(recForTags);
    if (tagText) {
        embed.addFields({ name: 'Tags', value: tagText, inline: false });
    } else {
        // Explicitly clarify when no tags are present from AO3 or members
        embed.addFields({ name: 'Tags', value: 'This work has no tags.', inline: false });
    }

    // Engagement stats (Hits, Kudos, Bookmarks)
    if (norm.hits || norm.kudos || norm.bookmarks) {
        embed.addFields({ name: 'Hits', value: formatNumber(norm.hits) || 'N/A', inline: true });
        embed.addFields({ name: 'Kudos', value: formatNumber(norm.kudos) || 'N/A', inline: true });
        embed.addFields({ name: 'Bookmarks', value: formatNumber(norm.bookmarks) || 'N/A', inline: true });
    }

    // Recommender Notes and footer attribution
    let chosenNote = null;
    let chosenUserName = null;
    // If overrideNotes is supplied, use it, and prefer the target user's username if available
    if (overrideNotes && typeof overrideNotes === 'string' && overrideNotes.trim()) {
        chosenNote = overrideNotes.trim();
        if (targetUserId && Array.isArray(rec.userMetadata)) {
            const meta = rec.userMetadata.find(m => String(m.userID) === String(targetUserId));
            if (meta && meta.user && meta.user.username) {
                chosenUserName = meta.user.username;
            }
        }
    } else if (targetUserId && Array.isArray(rec.userMetadata)) {
        // Prefer the specified user's actual saved note if present
        const meta = rec.userMetadata.find(m => String(m.userID) === String(targetUserId) && m.rec_note);
        if (meta) {
            chosenNote = meta.rec_note;
            chosenUserName = (meta.user && meta.user.username) || null;
        }
    }
    // If still no note chosen, randomize from available notes
    if (!chosenNote) {
        if (Array.isArray(rec.userMetadata)) {
            const usersWithNotes = rec.userMetadata.filter(m => m && m.rec_note);
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

    // Footer with recommender info: tie to note owner when available
    const recommenderName = (chosenUserName || rec.recommendedByUsername || 'unknown');
    embed.setFooter({ text: `From the Profound Bond Library • Recommended by ${recommenderName} • ID: ${rec.id}` });

    return embed;
}