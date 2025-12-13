import Discord from 'discord.js';
const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import { getProfileMessageId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for showing the timezone display preference menu.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleTimezoneDisplay(interaction) {
    // Robustly extract the original profile card message ID.
    // The timezone_display button customId includes it as the last segment.
    const messageId = getProfileMessageId(interaction, interaction.customId);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(messageId ? `timezone_display_select_${messageId}` : 'timezone_display_select')
        .setPlaceholder('Choose how to display your timezone')
        .addOptions([
            {
                label: 'Full Name (America/New_York)',
                description: 'Show the complete IANA timezone name',
                value: 'iana',
                emoji: '🌍'
            },
            {
                label: 'UTC Offset (UTC-5)',
                description: 'Show as UTC offset from Greenwich',
                value: 'offset',
                emoji: '⏰'
            },
            {
                label: 'Short Code (EST)',
                description: 'Show just the timezone abbreviation',
                value: 'short',
                emoji: '🏷️'
            },
            {
                label: 'Combined (UTC-08:00) Pacific Time',
                description: 'Show offset and readable name together',
                value: 'combined',
                emoji: '🕐'
            },
            {
                label: 'Hidden',
                description: 'Don\'t show timezone on your profile',
                value: 'hidden',
                emoji: '🚫'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    // Back goes to Profile Settings (this keeps message tracking intact)
    const backButtonCustomId = messageId
        ? `profile_settings_${interaction.user.id}_${messageId}`
        : `profile_settings_${interaction.user.id}`;
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(backButtonCustomId)
                .setLabel('← Back to Profile Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️')
        );

    await interaction.update({
        content: '⚙️ **Timezone Display Preferences**\nChoose how you want your timezone to appear on your profile:',
        components: [row, backButton],
        embeds: []
    });
}
