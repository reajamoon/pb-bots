// Handler for toggling full privacy mode
import { User } from '../../../../../models/index.js';
import { parsePrivacySettingsCustomId } from '../../../../../shared/utils/messageTracking.js';
import { buildPrivacySettingsMenu } from './privacyMenu.js';
import { performDualUpdate } from '../../../../../shared/utils/dualUpdate.js';
import logger from '../../../../../shared/utils/logger.js';
import Discord from 'discord.js';
const { InteractionFlags, EmbedBuilder } = Discord;

export default async function handleTogglePrivacyModeFull(interaction) {
    // Ephemeral message flag pattern: use InteractionFlags.Ephemeral if available, otherwise fallback to 64.
    // This ensures compatibility across discord.js versions and prevents undefined errors.
    const ephemeralFlag = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;
    try {
        let originalMessageId = null;
        const parsed = parsePrivacySettingsCustomId(interaction.customId);
        if (parsed?.messageId && /^\d{17,19}$/.test(parsed.messageId)) {
            originalMessageId = parsed.messageId;
        }
        let bypassDualUpdate = false;
        if (originalMessageId) {
            try {
                const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
                const originalEmbed = originalMessage.embeds[0];
                if (!originalEmbed || !originalEmbed.fields) {
                    originalMessageId = null;
                } else {
                    const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                    if (!userIdField || userIdField.value !== interaction.user.id) {
                        originalMessageId = null;
                    }
                }
            } catch (fetchError) {
                originalMessageId = null;
            }
        } else {
            bypassDualUpdate = true;
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

        const currentValue = user.birthdayPrivacyFull === true;

        const newValue = !currentValue;
        await User.update(
            { birthdayPrivacyFull: newValue },
            { where: { discordId: interaction.user.id } }
        );

        if (bypassDualUpdate) {
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFAA61A)
                .setDescription('⚠️ Your privacy setting was updated, but it won\'t show on your profile until a new profile is generated with `/profile`.');
            await interaction.reply({ embeds: [warningEmbed], flags: ephemeralFlag });
            return;
        }

        // Get updated user data and build refreshed menu
        const updatedUser = await User.findOne({ where: { discordId: interaction.user.id } });
        const { components, embeds } = await buildPrivacySettingsMenu(updatedUser, interaction.user.id, originalMessageId, originalMessageId, interaction);

        // Use shared dual update system
        await performDualUpdate(
            interaction,
            { components, embeds, flags: ephemeralFlag },
            originalMessageId,
            'toggle privacy mode full'
        );
    } catch (error) {
        logger.error(`Error toggling Privacy Mode (Full) for ${interaction.user.tag}:`, error);
        const errorMsg = 'Something went wrong updating your Privacy Mode (Full) setting. Want to try that again?';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMsg, flags: ephemeralFlag });
        } else {
            await interaction.reply({ content: errorMsg, flags: ephemeralFlag });
        }
    }
}