const { MessageFlags } = require('discord.js');

// Search isn’t done yet. Just let folks know.
async function handleSearchRecommendations(interaction) {
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }
    await interaction.deferReply();
    await interaction.editReply({ content: 'Search functionality coming soon! For now, use `/rec random` with filters.' });
}

module.exports = handleSearchRecommendations;
