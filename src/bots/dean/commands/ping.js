import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Dean: simple health check');

async function execute(interaction) {
  await interaction.reply({ content: 'Dean is online and listening.' });
}

export { data };
export default { data, execute };
