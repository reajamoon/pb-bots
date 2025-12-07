import Discord from 'discord.js';
const { InteractionFlags } = Discord;
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

function buildSamAnnouncer(interaction) {
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
        channel = await interaction.client.channels.fetch(targetId).catch((e) => { try { console.warn(`[hunts] Sam announcer failed to fetch queue channel ${targetId}:`, e?.message || e); } catch {} return null; });
      }
      // Fallback to current channel if no configured queue channel
      channel = channel || interaction.channel;
      try { console.log(`[hunts] Sam announcer sending public to channelId=${channel?.id || 'unknown'} (queueId=${targetId || 'none'})`); } catch {}
      if (channel?.send) {
        await channel.send({ content });
      } else {
        try { console.warn('[hunts] Sam announcer: no send() on resolved channel'); } catch {}
      }
    } catch {
      const channel = interaction.channel;
      try { console.warn('[hunts] Sam announcer fell back to interaction.channel in catch'); } catch {}
      if (channel?.send) await channel.send({ content });
    }
  };
  return makeAnnouncer({ sendEphemeral, sendPublic });
}

export default function makeSamAnnouncer({ interaction }) {
  return buildSamAnnouncer(interaction);
}
