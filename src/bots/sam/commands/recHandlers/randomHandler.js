const { MessageFlags } = require('discord.js');
const { Recommendation } = require('../../../../models');
const createRecommendationEmbed = require('../../../../shared/recUtils/createRecommendationEmbed');

// Picks a random fic from the library. Filters by tag if you want.
async function handleRandomRecommendation(interaction) {
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }
    await interaction.deferReply();
    const tagFilter = interaction.options.getString('tag');
    let recommendations = await Recommendation.findAll({
        order: require('sequelize').literal('RANDOM()')
    });
    // Filter out notPrimaryWork fics unless they were recommended individually (i.e., not just as part of a series)
    recommendations = recommendations.filter(rec => {
        if (!rec.notPrimaryWork) return true;
        // If it was recommended individually, it will have its own unique recommendedBy/recommendedByUsername/notes/etc.
        // We'll consider it individually recommended if it has non-empty notes or additionalTags, or if it was added by a different user than the series rec.
        // (You can adjust this logic as needed for your data model)
        if (rec.notes && rec.notes.trim()) return true;
        if (Array.isArray(rec.additionalTags) && rec.additionalTags.length > 0) return true;
        // Otherwise, skip it
        return false;
    });
    if (tagFilter) {
        recommendations = recommendations.filter(rec => {
            const allTags = rec.getParsedTags();
            return allTags.some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase()));
        });
    }
    if (recommendations.length === 0) {
        const noResultsMsg = tagFilter
            ? `I couldn't find any fics in our library matching that tag. Try a different search or check \`/rec stats\` to see what we have cataloged.`
            : `The Profound Bond library is empty! Be the first to add a Destiel fic with \`/rec add\`.`;
        return await interaction.editReply({ content: noResultsMsg });
    }
    const rec = recommendations[0];
    const embed = await createRecommendationEmbed(rec);
    await interaction.editReply({ embeds: [embed] });
}

module.exports = handleRandomRecommendation;
