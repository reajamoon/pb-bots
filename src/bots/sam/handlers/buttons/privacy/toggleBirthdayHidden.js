// Handler for toggling birthday hidden privacy setting
import { User } from '../../../../../models/index.js';
import { parsePrivacySettingsCustomId } from '../../../../../shared/utils/messageTracking.js';
import { buildPrivacySettingsMenu } from './privacyMenu.js';
import { performDualUpdate } from '../../../../../shared/utils/dualUpdate.js';
import logger from '../../../../../shared/utils/logger.js';
import { recordSettingPoke } from '../../../../../shared/hunts/pokedIt.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;

export default async function handleToggleBirthdayHidden(interaction) {
    // Ephemeral message flag pattern: use MessageFlags.Ephemeral if available, otherwise fallback to 64.
    const ephemeralFlag = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;
    try {
        logger.debug('[toggleBirthdayHidden] Interaction received', { user: interaction.user.id, customId: interaction.customId });
        // Extract the original profile card message ID (if present). In untracked contexts, this will be null.
        let originalMessageId = null;
        const parsed = parsePrivacySettingsCustomId(interaction.customId);
        if (parsed?.messageId && /^\d{17,19}$/.test(parsed.messageId)) {
            originalMessageId = parsed.messageId;
        }
        logger.debug('[toggleBirthdayHidden] Parsed original profile card message ID', { originalMessageId, customId: interaction.customId });
        // Robust messageId validation (fetch and check ownership)
        if (originalMessageId) {
            try {
                logger.debug('[toggleBirthdayHidden] Attempting to fetch original message', { originalMessageId });
                const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
                logger.debug('[toggleBirthdayHidden] Fetched original message', { messageId: originalMessage.id, authorId: originalMessage.author.id });
                const originalEmbed = originalMessage.embeds[0];
                if (!originalEmbed || !originalEmbed.fields) {
                    logger.warn(`Privacy: Original message ${originalMessageId} has no embed fields, treating as stale`);
                    originalMessageId = null;
                } else {
                    const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                    logger.debug('[toggleBirthdayHidden] Embed fields', { fields: originalEmbed.fields });
                    if (!userIdField || userIdField.value !== interaction.user.id) {
                        logger.warn(`Privacy: Original message ${originalMessageId} belongs to different user, treating as stale`);
                        originalMessageId = null;
                    } else {
                        logger.debug('[toggleBirthdayHidden] Embed userId matches', { userIdField: userIdField.value });
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

        if (!user) {
            logger.error('[toggleBirthdayHidden] Failed to find or create user', { userId: interaction.user.id });
            throw new Error('Failed to find or create user');
        }

        const currentValue = user.birthdayHidden;
        logger.debug('[toggleBirthdayHidden] Current birthdayHidden value', { currentValue });

        // Toggle the value
        await user.update({ birthdayHidden: !currentValue });
        logger.debug('[toggleBirthdayHidden] Updated birthdayHidden value', { newValue: !currentValue });

        await recordSettingPoke({
            userId: interaction.user.id,
            settingKey: 'privacy.toggle_birthday_hidden',
            interaction,
        });

        // Get updated user data and build refreshed menu
        const updatedUser = await User.findOne({ where: { discordId: interaction.user.id } });
        logger.debug('[toggleBirthdayHidden] Fetched updated user', { updatedUser: updatedUser ? updatedUser.id : null });
        const { components, embeds } = await buildPrivacySettingsMenu(updatedUser, interaction.user.id, originalMessageId, originalMessageId, interaction);
        logger.debug('[toggleBirthdayHidden] Built menu options', { components, embeds });

        // Use shared dual update system
        const dualUpdateSuccess = await performDualUpdate(
            interaction,
            { components, embeds, flags: ephemeralFlag },
            originalMessageId,
            'toggle birthday hidden'
        );

        logger.info(`User ${interaction.user.tag} ${!currentValue ? 'hid' : 'showed'} profile birthday${dualUpdateSuccess ? ' (dual update)' : ' (menu only)'}`, { service: 'discord-bot' });
    } catch (error) {
        logger.error('[toggleBirthdayHidden] Error toggling birthday hidden for ' + interaction.user.tag, error);
        const errorMsg = 'Something went wrong updating your profile birthday setting. Want to try that again?';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMsg, flags: ephemeralFlag });
        } else {
            await interaction.reply({ content: errorMsg, flags: ephemeralFlag });
        }
    }
};