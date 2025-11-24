
import { EmbedBuilder } from 'discord.js';
import { createHelpWithBackButton } from './profileHelpButtons.js';
import fs from 'fs';
import path from 'path';
const helpTexts = JSON.parse(fs.readFileSync(path.join(path.dirname(import.meta.url.replace('file://', '')), '../../../shared/text/helpTexts.json'), 'utf8'));

/**
 * Create timezone/region help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createTimezoneRegionHelp(interaction) {
    const tzText = helpTexts.timezone_region;
    const embed = new EmbedBuilder()
        .setTitle(tzText.title)
        .setDescription(tzText.description)
        .addFields(...tzText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createTimezoneRegionHelp };
