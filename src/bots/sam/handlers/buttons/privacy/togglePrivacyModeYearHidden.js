// Handler for toggling year-hidden privacy mode (hide age + Chinese zodiac)
import { User } from '../../../../../models/index.js';
import { parsePrivacySettingsCustomId } from '../../../../../shared/utils/messageTracking.js';
import { buildPrivacySettingsMenu } from './privacyMenu.js';
import { performDualUpdate } from '../../../../../shared/utils/dualUpdate.js';
import logger from '../../../../../shared/utils/logger.js';
import Discord from 'discord.js';
const { InteractionFlags, EmbedBuilder } = Discord;

export default async function handleTogglePrivacyModeYearHidden(interaction) {
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
            } catch {
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

        const birthYear = user.birthday ? parseInt(String(user.birthday).split('-')[0], 10) : null;
        const hasRealBirthYear = Number.isFinite(birthYear) && birthYear >= 1920 && birthYear <= new Date().getFullYear();
        const isPrivacyModeStrict = user.birthdayYearHidden === true && birthYear === 1900;

        if (isPrivacyModeStrict || !hasRealBirthYear) {
            await interaction.reply({
                content: `**Privacy Mode (Year Hidden) isn’t available right now**\n\n` +
                       `This toggle only works if your birthday includes a real birth year.\n\n` +
                       `If you set your birthday without a year (like 12/25), you’re in Privacy Mode (Strict) - age and Chinese zodiac are already hidden.\n` +
                       `To make this toggle available, update your birthday to include a year (like 12/25/2001).`,
                flags: ephemeralFlag
            });
            return;
        }

        const currentValue = user.birthdayYearHidden === true;
        const newValue = !currentValue;
        await User.update(
            { birthdayYearHidden: newValue },
            { where: { discordId: interaction.user.id } }
        );

        if (bypassDualUpdate) {
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFAA61A)
                .setDescription('⚠️ Your privacy mode was updated, but it won\'t show on your profile until a new profile is generated.');
            await interaction.reply({ embeds: [warningEmbed], flags: ephemeralFlag });
            return;
        }

        const updatedUser = await User.findOne({ where: { discordId: interaction.user.id } });
        const { components, embeds } = await buildPrivacySettingsMenu(updatedUser, interaction.user.id, originalMessageId, originalMessageId, interaction);

        await performDualUpdate(
            interaction,
            { components, embeds, flags: ephemeralFlag },
            originalMessageId,
            'toggle privacy mode year hidden'
        );
    } catch (error) {
        logger.error(`Error toggling Privacy Mode (Year Hidden) for ${interaction.user.tag}:`, error);
        const errorMsg = 'Something went wrong updating your Privacy Mode (Year Hidden) setting. Want to try that again?';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMsg, flags: ephemeralFlag });
        } else {
            await interaction.reply({ content: errorMsg, flags: ephemeralFlag });
        }
    }
}
