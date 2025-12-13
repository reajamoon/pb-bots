import Discord from 'discord.js';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = Discord;
import { parseButtonId } from '../../../../shared/utils/buttonId.js';
import { buildModalCustomId, decodeMessageId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for the set pronouns button, shows the pronouns modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handlePronouns(interaction) {
    const parsed = parseButtonId(interaction.customId);
    let originalMessageId = null;
    if (parsed?.secondaryId) {
        if (/^\d{17,19}$/.test(parsed.secondaryId)) {
            originalMessageId = parsed.secondaryId;
        } else if (/^[A-Za-z0-9+/=]+$/.test(parsed.secondaryId) && parsed.secondaryId.length > 16) {
            // Some older/newer flows may pass base64-encoded message IDs
            const decoded = decodeMessageId(parsed.secondaryId);
            if (/^\d{17,19}$/.test(decoded)) {
                originalMessageId = decoded;
            }
        }
    }
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
