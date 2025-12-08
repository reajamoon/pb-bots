import { SlashCommandBuilder } from 'discord.js';
import { emoji, EMOJIS } from '../../../shared/emojiStore.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Dean: simple health check');

async function execute(interaction) {
  await interaction.reply({ content: `${emoji(EMOJIS.a_dean_morning)} Yeah yeah, I'm awake.` });
}

export { data };
export default { data, execute };
