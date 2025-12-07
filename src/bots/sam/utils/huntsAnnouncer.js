import { InteractionFlags } from 'discord.js';
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

export function getSamAnnouncer(interaction) {
  const sendEphemeral = async (_botName, _userId, content, { flags } = {}) => {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: flags ?? InteractionFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: flags ?? InteractionFlags.Ephemeral });
    }
  };
  const sendPublic = async (_botName, _userId, content) => {
    try {
      const { Config } = await import('../../../models/index.js');
      const cfg = await Config.findOne({ where: { key: 'fic_queue_channel_id' } });
      const targetId = cfg?.value;
      let channel = null;
      if (targetId && interaction.client) {
        channel = await interaction.client.channels.fetch(targetId).catch(() => null);
      }
      // Fallback to current channel if no configured queue channel
      channel = channel || interaction.channel;
      if (channel?.send) await channel.send({ content });
    } catch {
      const channel = interaction.channel;
      if (channel?.send) await channel.send({ content });
    }
  };
  return makeAnnouncer({ sendEphemeral, sendPublic });
}
