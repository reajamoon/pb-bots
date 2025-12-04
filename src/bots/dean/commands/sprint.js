import { SlashCommandBuilder, InteractionFlags } from 'discord.js';
import GuildSprintSettings from '../../../models/GuildSprintSettings.js';

export const data = new SlashCommandBuilder()
  .setName('sprint')
  .setDescription('Start or manage a writing sprint')
  .addSubcommand(sub => sub
    .setName('start')
    .setDescription('Start a sprint in this channel')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label'))
    .addBooleanOption(opt => opt.setName('ephemeral').setDescription('Respond privately (default is public)')))
  .addSubcommand(sub => sub
    .setName('end')
    .setDescription('End your active sprint'))
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('Show current sprint status'));

export async function execute(interaction) {
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
  const flags = ephemeral ? InteractionFlags.Ephemeral : undefined;
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  const settings = await GuildSprintSettings.findOne({ where: { guildId } });
  if (settings) {
    const allowed = Array.isArray(settings.allowedChannelIds) ? settings.allowedChannelIds.includes(channelId) : true;
    const blocked = Array.isArray(settings.blockedChannelIds) && settings.blockedChannelIds.includes(channelId);
    if (blocked || !allowed) {
      return interaction.reply({ content: 'Sprints are not enabled in this channel.', flags });
    }
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'start') {
    const minutes = interaction.options.getInteger('minutes');
    const label = interaction.options.getString('label') ?? undefined;
    await interaction.reply({ content: `Sprint started for ${minutes} minutes${label ? `: ${label}` : ''}.`, flags });
    // TODO: Persist sprint row and schedule notifications
  } else if (sub === 'end') {
    await interaction.reply({ content: 'Your sprint has ended.', flags });
    // TODO: Update sprint status
  } else if (sub === 'status') {
    await interaction.reply({ content: 'No active sprint found.', flags });
    // TODO: Fetch and display actual status
  }
}
