import Discord from 'discord.js';
const { SlashCommandBuilder } = Discord;
import { handleWc } from '../utils/handleWc.js';

export const data = new SlashCommandBuilder()
  .setName('wc')
  .setDescription('Log words for your active sprint')
  .addSubcommand(sub => sub
    .setName('baseline')
    .setDescription('Set your starting baseline (absolute total) for this sprint')
    .addIntegerOption(opt => opt.setName('count').setDescription('Your starting absolute total').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Set your current wordcount')
    .addIntegerOption(opt => opt.setName('count').setDescription('Current total').setRequired(true))
    .addStringOption(opt => opt
      .setName('scope')
      .setDescription('What you are setting')
      .setRequired(false)
      .addChoices(
        { name: 'Sprint', value: 'sprint' },
        { name: 'Project', value: 'project' },
      ))
    .addStringOption(opt => opt
      .setName('project')
      .setDescription('Project code, ID, or exact name (for scope=project)')
      .setRequired(false)))
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add words to your current sprint total')
    .addIntegerOption(opt => opt.setName('new-words').setDescription('Words added (positive)').setRequired(true))
    .addStringOption(opt => opt
      .setName('scope')
      .setDescription('What you are adding to')
      .setRequired(false)
      .addChoices(
        { name: 'Sprint', value: 'sprint' },
        { name: 'Project', value: 'project' },
      ))
    .addStringOption(opt => opt
      .setName('project')
      .setDescription('Project code, ID, or exact name (for scope=project)')
      .setRequired(false)))
  .addSubcommand(sub => sub
    .setName('show')
    .setDescription('Show your current wordcount')
    .addStringOption(opt => opt
      .setName('scope')
      .setDescription('What you are viewing')
      .setRequired(false)
      .addChoices(
        { name: 'Sprint', value: 'sprint' },
        { name: 'Project', value: 'project' },
      ))
    .addStringOption(opt => opt
      .setName('project')
      .setDescription('Project code, ID, or exact name (for scope=project)')
      .setRequired(false)))
  .addSubcommand(sub => sub
    .setName('summary')
    .setDescription('Show totals so far')
    .addStringOption(opt => opt
      .setName('scope')
      .setDescription('What you are summarizing')
      .setRequired(false)
      .addChoices(
        { name: 'Sprint', value: 'sprint' },
        { name: 'Project', value: 'project' },
      ))
    .addStringOption(opt => opt
      .setName('project')
      .setDescription('Project code, ID, or exact name (for scope=project)')
      .setRequired(false)))
  .addSubcommand(sub => sub
    .setName('undo')
    .setDescription('Undo your last wordcount entry')
    .addStringOption(opt => opt
      .setName('scope')
      .setDescription('What you are undoing')
      .setRequired(false)
      .addChoices(
        { name: 'Sprint', value: 'sprint' },
        { name: 'Project', value: 'project' },
      ))
    .addStringOption(opt => opt
      .setName('project')
      .setDescription('Project code, ID, or exact name (for scope=project)')
      .setRequired(false)));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    return handleWc(interaction, { guildId: interaction.guildId });
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
