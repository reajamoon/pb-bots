import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { buildModalCustomId, buildInputCustomId, getProfileMessageId } from '../../../../../shared/utils/messageTracking.js';

export async function handlePronouns(interaction) {
    const targetUserId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Build modal custom ID with message tracking if available
    const modalCustomId = buildModalCustomId('pronouns', originalMessageId);

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Pronouns');

    const pronounsInput = new TextInputBuilder()
        .setCustomId('pronouns_input')
        .setLabel('Pronouns')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Examples: they/them, she/her, he/him, any pronouns')
        .setRequired(true)
        .setMaxLength(50);

    const firstActionRow = new ActionRowBuilder().addComponents(pronounsInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
