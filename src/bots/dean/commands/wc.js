import Discord from 'discord.js';
const { SlashCommandBuilder } = Discord;
import { handleSprintWc } from '../utils/handleSprintWc.js';

export const data = new SlashCommandBuilder()
  .setName('wc')
  .setDescription('Log words for your active sprint')
  .addSubcommand(sub => sub
    .setName('baseline')
    .setDescription('Set your starting baseline (absolute total) for this sprint')
    .addIntegerOption(opt => opt.setName('count').setDescription('Your starting absolute total').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Set your current absolute wordcount')
    .addIntegerOption(opt => opt.setName('count').setDescription('Current absolute total').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add words to your current sprint total')
    .addIntegerOption(opt => opt.setName('new-words').setDescription('Words added (positive)').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('show')
    .setDescription('Show your current sprint wordcount'))
  .addSubcommand(sub => sub
    .setName('summary')
    .setDescription('Show sprint totals so far'))
  .addSubcommand(sub => sub
    .setName('undo')
    .setDescription('Undo your last wordcount entry'));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    return handleSprintWc(interaction, { guildId: interaction.guildId });
  } catch (err) {
    console.error('[Dean/wc] Command error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Yeah, that's on me. Try that again in a sec." });
      } else {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec.", flags: 64 });
      }
    } catch (e) {}
  }
}
