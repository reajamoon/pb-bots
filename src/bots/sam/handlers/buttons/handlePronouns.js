import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { parseButtonId } from '../../../../shared/utils/buttonId.js';
import { buildModalCustomId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for the set pronouns button, shows the pronouns modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handlePronouns(interaction) {
    const parsed = parseButtonId(interaction.customId);
    const originalMessageId = parsed?.secondaryId && /^\d{17,19}$/.test(parsed.secondaryId) ? parsed.secondaryId : null;
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
