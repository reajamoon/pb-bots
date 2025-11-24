
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { Config } from '../../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setficqueuechannel')
    .setDescription('Set this channel as the fic parsing queue notification channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }
    const channelId = interaction.channelId;
    await Config.upsert({ key: 'fic_queue_channel', value: channelId });
    return interaction.reply({ content: `Fic parsing queue notifications will now be sent in <#${channelId}>.`, ephemeral: false });
  },
};
