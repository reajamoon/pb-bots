
import Discord from 'discord.js';
const { MessageFlags } = Discord;
import { fetchRecWithSeries, fetchAllRecsWithSeries } from '../../../../models/index.js';
import { createRecEmbed } from '../../../../shared/recUtils/createRecEmbed.js';
import { createSeriesEmbed } from '../../../../shared/recUtils/createSeriesEmbed.js';
import { matchesTagWithSynonyms } from '../../../../utils/tagUtils.js';


// Helper: filter recommendations for risky/normal mode
function filterRecommendations(recs, { allowWIP, allowDeleted, allowAbandoned, risky }) {
    let filtered = recs;
    if (!risky) {
        filtered = filtered.filter(rec => {
            if (!rec.notPrimaryWork) return true;
            if (rec.notes && rec.notes.trim()) return true;
            if (Array.isArray(rec.additionalTags) && rec.additionalTags.length > 0) return true;
            return false;
        });
        filtered = filtered.filter(rec => {
            if (!allowDeleted && rec.deleted) return false;
            if (!allowWIP && rec.status && typeof rec.status === 'string') {
                const status = rec.status.trim().toLowerCase();
                if (status === 'work in progress' || status === 'wip' || status === 'incomplete') return false;
            }
            if (!allowAbandoned && rec.status && typeof rec.status === 'string') {
                const status = rec.status.trim().toLowerCase();
                if (status.includes('abandon') || status.includes('hiatus')) return false;
            }
            return true;
        });
    }
    return filtered;
}

// Helper: get tags from specified fields for flexible filtering
function getAllTagsFromFields(rec, tagFields = ['tags', 'additionalTags']) {
    const allTags = [];
    
    for (const field of tagFields) {
        const fieldTags = Array.isArray(rec[field]) ? rec[field] : [];
        allTags.push(...fieldTags);
    }
    
    return allTags.map(tag => tag.toLowerCase());
}

// Helper: filter by tag with advanced AND/OR/NOT logic
function filterByTag(recs, tagFilter) {
    if (!tagFilter) return recs;
    
    // Parse advanced tag syntax: support 'angst AND hurt/comfort NOT major character death'
    // and legacy 'angst+hurt/comfort, -major character death'
    // Search across all relevant tag fields for comprehensive filtering
    const searchTagFields = ['tags', 'archive_warnings', 'character_tags', 'fandom_tags', 'additionalTags'];
    
    let orGroups;
    if (tagFilter.includes(' OR ')) {
        // New syntax: split on OR first
        orGroups = tagFilter.split(' OR ').map(group => group.trim()).filter(Boolean);
    } else {
        // Legacy syntax: split on comma
        orGroups = tagFilter.split(',').map(group => group.trim()).filter(Boolean);
    }
    
    return recs.filter(rec => {
        const tagStrings = getAllTagsFromFields(rec, searchTagFields);
        
        // Check if rec matches any OR group
        return orGroups.some(group => {
            let workingGroup = group;
            const requiredTags = [];
            const excludedTags = [];
            
            // Extract NOT terms (new syntax)
            const notMatches = workingGroup.match(/\bNOT\s+([^\s]+(?:\s+[^\s]+)*?)(?=\s+(?:AND|OR|$)|$)/g);
            if (notMatches) {
                for (const notMatch of notMatches) {
                    const notTag = notMatch.replace(/^NOT\s+/, '').trim().toLowerCase();
                    if (notTag) excludedTags.push(notTag);
                    workingGroup = workingGroup.replace(notMatch, '').trim();
                }
            }
            
            // Extract legacy NOT terms (- prefix)
            const legacyNotMatches = workingGroup.match(/-([^,+\s]+)/g);
            if (legacyNotMatches) {
                for (const legacyNotMatch of legacyNotMatches) {
                    const notTag = legacyNotMatch.substring(1).toLowerCase();
                    if (notTag) excludedTags.push(notTag);
                    workingGroup = workingGroup.replace(legacyNotMatch, '').trim();
                }
            }
            
            // Clean up the working group
            workingGroup = workingGroup.replace(/\s+/g, ' ').trim();
            
            // Parse required tags
            if (workingGroup.includes(' AND ')) {
                // New syntax: AND group
                const andTags = workingGroup.split(' AND ').map(t => t.trim().toLowerCase()).filter(Boolean);
                requiredTags.push(...andTags);
            } else if (workingGroup.includes('+')) {
                // Legacy syntax: + for AND
                const andTags = workingGroup.split('+').map(t => t.trim().toLowerCase()).filter(Boolean);
                requiredTags.push(...andTags);
            } else if (workingGroup.length) {
                // Single tag
                requiredTags.push(workingGroup.toLowerCase());
            }
            
            // Check required tags (all must be present) with AU synonym support
            const hasAllRequired = requiredTags.length === 0 || requiredTags.every(tag => 
                matchesTagWithSynonyms(tagStrings, tag)
            );
            
            // Check excluded tags (none must be present) with AU synonym support
            const hasNoExcluded = excludedTags.length === 0 || !excludedTags.some(tag => 
                matchesTagWithSynonyms(tagStrings, tag)
            );
            
            return hasAllRequired && hasNoExcluded;
        });
    });
}

async function handleRandomRecommendation(interaction) {
    try {
        if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
            return await interaction.reply({
                content: 'That interaction took too long to process. Please try the command again.',
                flags: MessageFlags.Ephemeral
            });
        }
        await interaction.deferReply();
        const tagFilter = interaction.options.getString('tag');
        let recommendations = await fetchAllRecsWithSeries(true); // Fetch all recs with series info
        if (!Array.isArray(recommendations)) {
            await interaction.editReply({
                content: 'Sorry, there was a problem fetching recommendations. Please try again later.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Parse override options from command (e.g., allowWIP, allowDeleted, allowAbandoned)
        const allowWIP = !!interaction.options.getBoolean('allowWIP');
        const allowDeleted = !!interaction.options.getBoolean('allowDeleted');
        const allowAbandoned = !!interaction.options.getBoolean('allowAbandoned');
        const risky = !!interaction.options.getBoolean('risky');

        recommendations = filterRecommendations(recommendations, { allowWIP, allowDeleted, allowAbandoned, risky });
        recommendations = filterByTag(recommendations, tagFilter);

        if (recommendations.length === 0) {
            const noResultsMsg = tagFilter
                ? `I couldn't find any fics in our library matching that tag. Try a different search or check \`/rec stats\` to see what we have cataloged.`
                : `The Profound Bond library is empty! Be the first to add a Destiel fic with \`/rec add\`.`;
            return await interaction.editReply({ content: noResultsMsg });
        }
        const rec = recommendations[Math.floor(Math.random() * recommendations.length)];
        // Use fetchRecWithSeries to get full rec+series info
        let recWithSeries;
        try {
            recWithSeries = await fetchRecWithSeries(rec.id, true);
        } catch (err) {
            console.error('Error fetching rec with series:', err);
            return await interaction.editReply({ content: 'Sorry, there was a problem fetching this recommendation.' });
        }
        let embed = null;
        try {
            // Check if this recommendation has series data - if so, show series embed
            if (recWithSeries.series && recWithSeries.series.id) {
                const { fetchSeriesWithUserMetadata } = await import('../../../../models/index.js');
                const seriesWithUserMetadata = await fetchSeriesWithUserMetadata(recWithSeries.series.id);
                if (seriesWithUserMetadata) {
                    embed = createSeriesEmbed(seriesWithUserMetadata);
                } else {
                    // Fallback to regular series embed
                    embed = createSeriesEmbed(recWithSeries.series);
                }
            } else {
                // For individual work recommendations (even if part of a series)
                if (process.env.REC_EMBED_DEBUG) {
                    try {
                        console.debug('[sam:randomHandler] Pre-embed rec audit', {
                            id: recWithSeries.id,
                            hasSeries: !!recWithSeries.series,
                            tagsType: Array.isArray(recWithSeries.tags) ? 'array' : typeof recWithSeries.tags,
                            tagsLen: Array.isArray(recWithSeries.tags) ? recWithSeries.tags.length : (typeof recWithSeries.tags === 'string' ? recWithSeries.tags.length : 0),
                            userMetaCount: Array.isArray(recWithSeries.userMetadata) ? recWithSeries.userMetadata.length : 0
                        });
                    } catch {}
                }
                embed = createRecEmbed(recWithSeries);
            }
        } catch (err) {
            console.error('Error creating embed:', err);
        }
        if (!embed) {
            return await interaction.editReply({ content: 'Sorry, there was a problem displaying this recommendation.' });
        }
        // Post to fic_queue_channel (team-free-bots) and keep interaction clean
        try {
            const { Config } = await import('../../../../models/index.js');
            const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
            let targetChannel = null;
            if (queueCfg && queueCfg.value) {
                targetChannel = interaction.client.channels.cache.get(queueCfg.value) || await interaction.client.channels.fetch(queueCfg.value).catch(() => null);
            }
            if (!targetChannel) {
                // Fallback to current channel if config missing
                targetChannel = interaction.channel;
            }
            if (targetChannel) {
                await targetChannel.send({ embeds: [embed] });
                try { await interaction.deleteReply(); } catch {}
            } else {
                // As last resort, show embed in the interaction
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (e) {
            console.warn('[rec random] Failed to post to fic_queue_channel, falling back to interaction reply:', e);
            await interaction.editReply({ embeds: [embed] });
        }
    } catch (err) {
        console.error('Unexpected error in handleRandomRecommendation:', err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: 'Sorry, something went wrong with your random rec.' });
        } else {
            await interaction.reply({ content: 'Sorry, something went wrong with your random rec.', flags: MessageFlags.Ephemeral });
        }
    }
}

export default handleRandomRecommendation;
