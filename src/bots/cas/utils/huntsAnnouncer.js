import Discord from 'discord.js';
const { InteractionFlags } = Discord;
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

function buildCasAnnouncer(interactionOrChannel) {
  const sendEphemeral = async (_botName, _userId, content, { flags } = {}) => {
    const i = interactionOrChannel;
    if (i?.reply) {
      if (i.replied || i.deferred) {
        await i.followUp({ content, flags: flags ?? InteractionFlags.Ephemeral });
      } else {
        await i.reply({ content, flags: flags ?? InteractionFlags.Ephemeral });
      }
    }
  };
  const sendPublic = async (_botName, _userId, content) => {
    try {
      const { Config } = await import('../../../models/index.js');
      const cfg = await Config.findOne({ where: { key: 'fic_queue_channel_id' } });
      const targetId = cfg?.value;
      let channel = null;
      const client = (interactionOrChannel?.client) || (interactionOrChannel?.channel?.client);
      if (targetId && client) {
        channel = await client.channels.fetch(targetId).catch((e) => { try { console.warn(`[hunts] Cas announcer failed to fetch queue channel ${targetId}:`, e?.message || e); } catch {} return null; });
      }
      // Restrict to queue channel: prefer configured; fallback to current only if not set/fetchable
      channel = channel || interactionOrChannel?.channel || interactionOrChannel;
      try { console.log(`[hunts] Cas announcer sending public to channelId=${channel?.id || 'unknown'} (queueId=${targetId || 'none'})`); } catch {}
      if (channel?.send) await channel.send({ content });
    } catch {
      const channel = interactionOrChannel?.channel || interactionOrChannel;
      try { console.warn('[hunts] Cas announcer fell back to interactionOrChannel'); } catch {}
      if (channel?.send) await channel.send({ content });
    }
  };
  return makeAnnouncer({ sendEphemeral, sendPublic });
}

export default function makeCasAnnouncer(interactionOrChannel) {
  return buildCasAnnouncer(interactionOrChannel);
}
