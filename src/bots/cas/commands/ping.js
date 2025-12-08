import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Simple health check');

async function execute(interaction) {
  const { MessageFlags } = await import('discord.js');
  await interaction.reply({ content: "I'm online and watching.", flags: MessageFlags.Ephemeral });
}
export { data };
export default { data, execute };
