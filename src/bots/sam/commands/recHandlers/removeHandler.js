import Discord from 'discord.js';
const { MessageFlags } = Discord;
import { Recommendation, Series } from '../../../../models/index.js';
import findRecommendationByIdOrUrl from '../../../../shared/recUtils/findRecommendationByIdOrUrl.js';

// Removes a rec from the library. Only owner or mods can do it.
export default async function handleRemoveRecommendation(interaction) {
    // Make sure the interaction didn't time out before starting
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) { // 14 minutes to be safe
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply();
    
    const identifier = interaction.options.getString('identifier');
    try {
        // Check if it's a series identifier (S123 or series URL)
        if (/^S\d+$/i.test(identifier)) {
            // Series ID - remove the series itself
            const seriesIdNum = parseInt(identifier.substring(1), 10);
            const series = await Series.findByPk(seriesIdNum);
            if (!series) {
                return await interaction.editReply({
                    content: `Series S${seriesIdNum} not found.`
                });
            }
            
            // Only mods can remove series
            const isAdmin = interaction.member.permissions.has('ManageMessages');
            if (!isAdmin) {
                return await interaction.editReply({
                    content: 'Only moderators can remove series records.'
                });
            }
            
            // Remove all recommendations that belong to this series
            const seriesRecs = await Recommendation.findAll({ 
                where: { seriesId: series.id } 
            });
            for (const rec of seriesRecs) {
                await rec.destroy();
            }
            
            // Remove the series record itself
            await series.destroy();
            
            return await interaction.editReply({
                content: `Successfully removed series "${series.name}" and all ${seriesRecs.length} associated recommendations.`
            });
            
        } else if (/^https?:\/\/.*archiveofourown\.org\/series\/\d+/.test(identifier)) {
            // Series URL - extract AO3 series ID and find the series
            const seriesMatch = identifier.match(/archiveofourown\.org\/series\/(\d+)/);
            const ao3SeriesId = parseInt(seriesMatch[1], 10);
            const series = await Series.findOne({ where: { ao3SeriesId } });
            if (!series) {
                return await interaction.editReply({
                    content: `Series with AO3 ID ${ao3SeriesId} not found.`
                });
            }
            
            // Only mods can remove series
            const isAdmin = interaction.member.permissions.has('ManageMessages');
            if (!isAdmin) {
                return await interaction.editReply({
                    content: 'Only moderators can remove series records.'
                });
            }
            
            // Remove all recommendations that belong to this series
            const seriesRecs = await Recommendation.findAll({ 
                where: { seriesId: series.id } 
            });
            for (const rec of seriesRecs) {
                await rec.destroy();
            }
            
            // Remove the series record itself
            await series.destroy();
            
            return await interaction.editReply({
                content: `Successfully removed series "${series.name}" and all ${seriesRecs.length} associated recommendations.`
            });
            
        } else {
            // Regular recommendation - use existing logic
            const recommendation = await findRecommendationByIdOrUrl(interaction, identifier);
            if (!recommendation) {
                return await interaction.editReply({
                    content: 'Recommendation not found. Please check your identifier and try again.'
                });
            }
            
            // Only let the owner or a mod remove the rec
            const isOwner = recommendation.recommendedBy === interaction.user.id;
            const isAdmin = interaction.member.permissions.has('ManageMessages');
            if (!isOwner && !isAdmin) {
                return await interaction.editReply({
                    content: `That recommendation was added by ${recommendation.recommendedByUsername}. You can only remove your own recommendations unless you're a moderator.`
                });
            }
            
            // Remove individual recommendation
            await recommendation.destroy();
            
            await interaction.editReply({
                content: `Successfully removed "${recommendation.title}" from the Profound Bond library.`
            });
        }
    } catch (error) {
        return await interaction.editReply({
            content: error.message || 'There was an error removing the recommendation. Please try again.'
        });
    }
}
