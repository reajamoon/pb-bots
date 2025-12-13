import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { buildModalCustomId, getProfileMessageId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for the set birthday button, shows the birthday modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleBirthday(interaction) {
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
    const modalCustomId = buildModalCustomId('birthday', originalMessageId);

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Birthday');

    const birthdayInput = new TextInputBuilder()
        .setCustomId('birthday_input')
        .setLabel('Birthday (MM/DD or MM/DD/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Examples: 12/25, 12/25/1995, or 12/25/95')
        .setRequired(true)
        .setMaxLength(10);

    const firstActionRow = new ActionRowBuilder().addComponents(birthdayInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
