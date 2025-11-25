import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { parseButtonId } from '../../../../../shared/utils/buttonId.js';
import { buildModalCustomId, buildSelectMenuCustomId, buildInputCustomId, getProfileMessageId } from '../../../../../shared/utils/messageTracking.js';

export async function handleRegion(interaction) {
    // Always extract the message ID from the incoming customId
    const targetUserId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // When building the modal, always include the extracted message ID
    const modalCustomId = originalMessageId ? buildModalCustomId('region', originalMessageId) : 'region_modal';

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Region');

    const regionInput = new TextInputBuilder()
        .setCustomId('region_input')
        .setLabel('Region, Country, or Timezone Area')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., California, Canada, Japan, Europe, Pacific Time')
        .setRequired(false)
        .setMaxLength(50);

    const firstActionRow = new ActionRowBuilder().addComponents(regionInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
