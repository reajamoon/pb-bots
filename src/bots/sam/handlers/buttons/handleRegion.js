import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { buildModalCustomId, getProfileMessageId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for the set region button, shows the region modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleRegion(interaction) {
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
    const modalCustomId = buildModalCustomId('region', originalMessageId);

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
