import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { listGuildEmojis, groupEmojisBySemantic, formatGroupedEmojiList, formatEmojiList } from '../../../shared/utils/emoji.js';

export default {
  data: new SlashCommandBuilder()
    .setName('emojis')
    .setDescription('List server custom emojis'),
  async execute(interaction) {
    const { MessageFlags } = await import('discord.js');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildId = interaction.guildId;
    const emojis = await listGuildEmojis(interaction.client, guildId);
    const groups = groupEmojisBySemantic(emojis);
    const text = formatGroupedEmojiList(groups);
    const content = text.length > 1900 ? text.slice(0, 1900) + '\n…' : text;
    const embed = new EmbedBuilder()
      .setColor(0x3b88c3)
      .setTitle('Server Custom Emojis')
      .setDescription(content);
    await interaction.editReply({ embeds: [embed] });
  }
};
