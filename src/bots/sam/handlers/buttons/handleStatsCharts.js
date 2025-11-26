
import Discord from 'discord.js';
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import { getStatsChartCache } from '../../utils/statsChartCache.js';
import { buildStatsButtonId } from '../../utils/statsButtonId.js';
import handleStats from '../../commands/recHandlers/statsHandler.js';

// Handles the "View Charts" and "Back to Stats" buttons for stats
export async function handleStatsChartsButton(interaction, options = {}) {
    // Determine if this is a back button or a view charts button
    const isBack = interaction.customId && interaction.customId.startsWith('stats_charts_back:');
    const cacheKey = isBack
        ? interaction.customId.slice('stats_charts_back:'.length)
        : (options.cacheKey || (interaction.customId && interaction.customId.split(':').slice(1).join(':')));

    if (isBack) {
        // Restore the stats embed (re-run handleStats, but edit the message)
        // Use the original interaction user
        await handleStats({ ...interaction, editReply: interaction.editReply.bind(interaction), user: interaction.user });
        return;
    }

    // Normal "View Charts" button: replace the message with the chart images and a back button
    const fileMetas = options.files || getStatsChartCache(cacheKey) || [];
    const files = fileMetas
        .filter(f => f && f.path && f.name)
        .map(f => new AttachmentBuilder(f.path, { name: f.name }));
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`stats_charts_back:${cacheKey}`)
            .setLabel('Back to Stats')
            .setStyle(ButtonStyle.Secondary)
    );
    if (files.length > 0) {
        await interaction.update({
            content: 'Here are the charts:',
            embeds: [],
            files,
            components: [backRow],
            attachments: []
        });
    } else {
        await interaction.update({
            content: 'No charts available.',
            embeds: [],
            files: [],
            components: [backRow],
            attachments: []
        });
    }
}
