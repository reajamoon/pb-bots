
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { createHelpWithBackButton } from './profileHelpButtons.js';
import fs from 'fs';
import path from 'path';
const helpTexts = JSON.parse(fs.readFileSync(path.join(path.dirname(import.meta.url.replace('file://', '')), '../../../shared/text/helpTexts.json'), 'utf8'));

/**
 * Create bio help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createBioHelp(interaction) {
    const bioText = helpTexts.bio;
    const embed = new EmbedBuilder()
        .setTitle(bioText.title)
        .setDescription(bioText.description)
        .addFields(...bioText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createBioHelp };
