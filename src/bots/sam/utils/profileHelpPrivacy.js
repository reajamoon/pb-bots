
import { EmbedBuilder } from 'discord.js';
import { createHelpWithBackButton } from './profileHelpButtons.js';
import fs from 'fs';
import path from 'path';
const helpTexts = JSON.parse(fs.readFileSync(path.join(path.dirname(import.meta.url.replace('file://', '')), '../../../shared/text/helpTexts.json'), 'utf8'));

/**
 * Create privacy help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createPrivacyHelp(interaction) {
    const privacyText = helpTexts.privacy;
    const embed = new EmbedBuilder()
        .setTitle(privacyText.title)
        .setDescription(privacyText.description)
        .addFields(...privacyText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createPrivacyHelp };
