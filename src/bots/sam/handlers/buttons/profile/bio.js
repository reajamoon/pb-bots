import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { parseButtonId } from '../../../../../shared/utils/buttonId.js';
import { parseProfileSettingsCustomId, buildModalCustomId, buildInputCustomId, getProfileMessageId } from '../../../../../shared/utils/messageTracking.js';

export async function handleBio(interaction) {
    const targetUserId = interaction.user.id;
    // Use robust utility for messageId
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Build modal custom ID with message tracking if available
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
