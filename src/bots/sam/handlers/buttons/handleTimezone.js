import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { buildModalCustomId, getProfileMessageId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for the set timezone button, shows the timezone modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleTimezone(interaction) {
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
    const modalCustomId = buildModalCustomId('timezone', originalMessageId);

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Timezone');

    const timezoneInput = new TextInputBuilder()
        .setCustomId('timezone_input')
        .setLabel('Timezone (City, UTC offset, or abbreviation)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Examples: New York, UTC-5, EST, Los Angeles')
        .setRequired(true)
        .setMaxLength(50);

    const firstActionRow = new ActionRowBuilder().addComponents(timezoneInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
