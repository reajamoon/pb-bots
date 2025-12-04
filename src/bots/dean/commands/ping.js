import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Dean: simple health check');

async function execute(interaction) {
  const { MessageFlags } = await import('discord.js');
  await interaction.reply({ content: 'Dean is online and listening.', flags: MessageFlags.Ephemeral });
}

export { data };
export default { data, execute };
