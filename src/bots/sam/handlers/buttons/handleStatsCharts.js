
import Discord from 'discord.js';
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import { getStatsChartCache } from '../../utils/statsChartCache.js';
import { buildStatsButtonId, parseStatsButtonId } from '../../utils/statsButtonId.new.js';
import handleStats from '../../commands/recHandlers/statsHandler.js';

// Handles the "View Charts" and "Back to Stats" buttons for stats
export async function handleStatsChartsButton(interaction, options = {}) {
    // Determine if this is a back button or a view charts button
    const isBack = interaction.customId && interaction.customId.startsWith('stats_charts_back:');
    // Parse context and messageId from customId
    const { context: cacheKey, messageId } = parseStatsButtonId(
        isBack ? interaction.customId.replace('stats_charts_back:', 'stats_charts:') : interaction.customId
    ) || {};
    // Only use the context (cacheKey) for cache lookup, ignore messageId
    const chartCacheKey = cacheKey;

    // Helper to update the correct message
    async function updateTargetMessage(payload) {
        if (messageId && interaction.channel && interaction.channel.messages) {
            try {
                const msg = await interaction.channel.messages.fetch(messageId);
                if (msg && msg.edit) {
                    await msg.edit(payload);
                    await interaction.deferUpdate();
                    return;
                }
            } catch (e) {
                // fallback to interaction.update
            }
        }
        await interaction.update(payload);
    }

    if (isBack) {
        // Restore the stats embed (re-run handleStats, but edit the correct message)
        const fakeInteraction = {
            ...interaction,
            editReply: updateTargetMessage,
            user: interaction.user
        };
        await handleStats(fakeInteraction);
        return;
    }

    // Normal "View Charts" button: replace the message with the chart images and a back button
    const fileMetas = options.files || getStatsChartCache(chartCacheKey) || [];
    const files = fileMetas
        .filter(f => f && f.path && f.name)
        .map(f => new AttachmentBuilder(f.path, { name: f.name }));
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildStatsButtonId(cacheKey, messageId ? messageId : (interaction.message && interaction.message.id ? interaction.message.id : ''))
                .replace('stats_charts:', 'stats_charts_back:'))
            .setLabel('Back to Stats')
            .setStyle(ButtonStyle.Secondary)
    );
    const payload = files.length > 0
        ? { content: 'Here are the charts:', embeds: [], files, components: [backRow], attachments: [] }
        : { content: 'No charts available.', embeds: [], files: [], components: [backRow], attachments: [] };
    await updateTargetMessage(payload);
}
