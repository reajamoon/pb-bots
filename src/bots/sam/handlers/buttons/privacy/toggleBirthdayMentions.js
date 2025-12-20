// Handler for toggling birthday mentions privacy setting
import { User } from '../../../../../models/index.js';
import { parsePrivacySettingsCustomId } from '../../../../../shared/utils/messageTracking.js';
import { buildPrivacySettingsMenu } from './privacyMenu.js';
import { performDualUpdate } from '../../../../../shared/utils/dualUpdate.js';
import logger from '../../../../../shared/utils/logger.js';
import { recordSettingPoke } from '../../../../../shared/hunts/pokedIt.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;

export default async function handleToggleBirthdayMentions(interaction) {
    // Ephemeral message flag pattern: use MessageFlags.Ephemeral if available, otherwise fallback to 64.
    const ephemeralFlag = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;
    try {
        // Extract the original profile card message ID (if present). In untracked contexts, this will be null.
        let originalMessageId = null;
        const parsed = parsePrivacySettingsCustomId(interaction.customId);
        if (parsed?.messageId && /^\d{17,19}$/.test(parsed.messageId)) {
            originalMessageId = parsed.messageId;
        }
        logger.debug('[toggleBirthdayMentions] Parsed original profile card message ID', { originalMessageId, customId: interaction.customId });
        // Robust messageId validation (fetch and check ownership). If it fails, fall back to untracked.
        if (originalMessageId) {
            try {
                const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
                const originalEmbed = originalMessage.embeds[0];
                if (!originalEmbed || !originalEmbed.fields) {
                    logger.warn(`Privacy: Original message ${originalMessageId} has no embed fields, treating as stale`);
                    originalMessageId = null;
                } else {
                    const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                    if (!userIdField || userIdField.value !== interaction.user.id) {
                        logger.warn(`Privacy: Original message ${originalMessageId} belongs to different user, treating as stale`);
                        originalMessageId = null;
                    }
                }
            } catch (fetchError) {
                logger.warn(`Privacy: Could not fetch original message ${originalMessageId}, treating as stale:`, fetchError);
                originalMessageId = null;
            }
        }

        const [user] = await User.findOrCreate({
            where: { discordId: interaction.user.id },
            defaults: {
                discordId: interaction.user.id,
                username: interaction.user.username,
                discriminator: interaction.user.discriminator || '0',
                avatar: interaction.user.avatar
            }
        });

        const currentValue = user.birthdayMentions !== false;
        await User.update(
            { birthdayMentions: !currentValue },
            { where: { discordId: interaction.user.id } }
        );

        await recordSettingPoke({
            userId: interaction.user.id,
            settingKey: 'privacy.toggle_birthday_mentions',
            interaction,
        });

        // Get updated user data and build refreshed menu
        const updatedUser = await User.findOne({ where: { discordId: interaction.user.id } });
        logger.debug('[toggleBirthdayMentions] Propagating original profile message ID to menu builder', { originalMessageId });
        const { components, embeds } = await buildPrivacySettingsMenu(updatedUser, interaction.user.id, originalMessageId, originalMessageId, interaction);

        // Use shared dual update system
        const dualUpdateSuccess = await performDualUpdate(
            interaction,
            { components, embeds, flags: ephemeralFlag },
            originalMessageId,
            'toggle birthday mentions'
        );

        logger.info(`User ${interaction.user.tag} ${!currentValue ? 'enabled' : 'disabled'} birthday mentions${dualUpdateSuccess ? ' (dual update)' : ' (menu only)'}`, { service: 'discord-bot' });
    } catch (error) {
        logger.error(`Error toggling birthday mentions for ${interaction.user.tag}:`, error);
        const errorMsg = 'Something went wrong updating your birthday mention setting. Want to try that again?';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMsg, flags: ephemeralFlag });
        } else {
            await interaction.reply({ content: errorMsg, flags: ephemeralFlag });
        }
    }
}