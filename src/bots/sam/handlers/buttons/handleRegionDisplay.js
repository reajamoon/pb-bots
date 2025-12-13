import Discord from 'discord.js';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import { buildButtonId } from '../../../../shared/utils/buttonId.js';
import { User } from '../../../../models/index.js';
import logger from '../../../../shared/utils/logger.js';
import { getProfileMessageId } from '../../../../shared/utils/messageTracking.js';
import { performDualUpdate } from '../../../../shared/utils/dualUpdate.js';

/**
 * Handler for toggling region display in the profile.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleRegionDisplay(interaction) {
    const { customId, user } = interaction;
    // Extract original profile card message ID (if present in the customId)
    let originalMessageId = getProfileMessageId(interaction, customId);
    // Validate that the messageId points to a real profile card message for this user
    if (originalMessageId) {
        try {
            const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
            const originalEmbed = originalMessage?.embeds?.[0];
            const userIdField = originalEmbed?.fields?.find(field => field.name === 'User ID');
            if (!userIdField || userIdField.value !== user.id) {
                logger.warn('[RegionDisplay] originalMessageId did not match user profile; disabling dual update', { originalMessageId, userId: user.id });
                originalMessageId = null;
            }
        } catch (error) {
            logger.warn('[RegionDisplay] Could not fetch original profile message; disabling dual update', { originalMessageId, error: error?.message });
            originalMessageId = null;
        }
    }

    try {
        const dbUser = await User.findByPk(user.id);
        if (!dbUser) {
            return await interaction.reply({
                content: '❌ **User not found in database.**',
                flags: 64
            });
        }
        // Toggle region display setting
        const newRegionDisplay = !dbUser.regionDisplay;
        await dbUser.update({ regionDisplay: newRegionDisplay });
        // Confirmation message
        const statusText = newRegionDisplay ? 'shown' : 'hidden';
        const description = newRegionDisplay
            ? '✅ **Region will now be shown in your profile.**\n\n' +
              (dbUser.timezoneHidden ?
                'Since your timezone is hidden, region will appear as a separate field.' :
                'Region will appear under your timezone field.')
            : '❌ **Region is now hidden from your profile.**';
        const confirmEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔧 Profile Settings - Region Display')
            .setDescription(description)
            .setFooter({
                text: `Region Display: ${statusText}`,
                iconURL: user.displayAvatarURL()
            })
            .setTimestamp();
        // Back button
        const backButtonCustomId = await buildButtonId({
            action: 'back_to_profile_settings',
            context: 'profile_settings',
            primaryId: user.id,
            secondaryId: originalMessageId || ''
        });
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(backButtonCustomId)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );
        // Ephemeral response
        const ephemeralResponse = {
            embeds: [confirmEmbed],
            components: [backButton]
        };
        await performDualUpdate(
            interaction,
            { ...ephemeralResponse, flags: 64 },
            originalMessageId,
            'region display toggle'
        );
    } catch (error) {
        console.error('Error handling region display toggle:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error')
            .setDescription('An error occurred while updating your region display setting. Please try again.')
            .setTimestamp();
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(originalMessageId ? `profile_settings_${user.id}_${originalMessageId}` : `profile_settings_${user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );
        await performDualUpdate(
            interaction,
            { embeds: [errorEmbed], components: [backButton], flags: 64 },
            originalMessageId,
            'region display toggle (error)'
        );
    }
}
