import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { buildModalCustomId } from '../../../../shared/utils/messageTracking.js';
import { parseButtonId } from '../../../../shared/utils/buttonId.js';

/**
 * Handler for the set timezone button, shows the timezone modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleTimezone(interaction) {
    const parsed = parseButtonId(interaction.customId);
    const originalMessageId = parsed?.secondaryId && /^\d{17,19}$/.test(parsed.secondaryId) ? parsed.secondaryId : null;
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
