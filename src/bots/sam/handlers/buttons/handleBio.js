import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { buildModalCustomId, getProfileMessageId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for the set bio button, shows the bio modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleBio(interaction) {
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
    const modalCustomId = buildModalCustomId('bio', originalMessageId);

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Bio');

    const bioInput = new TextInputBuilder()
        .setCustomId('bio_input')
        .setLabel('Bio (1000 characters max)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Tell us about yourself! Interests, fandoms, anything you want to share.')
        .setRequired(true)
        .setMaxLength(1000);

    const firstActionRow = new ActionRowBuilder().addComponents(bioInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
