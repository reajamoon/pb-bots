
import { EmbedBuilder } from 'discord.js';
import { createHelpWithBackButton } from './profileHelpButtons.js';
import fs from 'fs';
import path from 'path';
const helpTexts = JSON.parse(fs.readFileSync(path.join(path.dirname(import.meta.url.replace('file://', '')), '../../../shared/text/helpTexts.json'), 'utf8'));

/**
 * Create birthday help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createBirthdayHelp(interaction) {
    const birthdayText = helpTexts.birthday;
    const embed = new EmbedBuilder()
        .setTitle(birthdayText.title)
        .setDescription(birthdayText.description)
        .addFields(...birthdayText.fields)
        .setColor(0x5865F2);
    return createHelpWithBackButton(embed, interaction);
}

export { createBirthdayHelp };
