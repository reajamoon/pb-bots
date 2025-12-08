// Pure public convention: do not use ephemerals or suppress flags
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

function buildCasAnnouncer(interactionOrChannel) {
  const sendEphemeral = async (_botName, _userId, content) => {
    const i = interactionOrChannel;
    if (i?.reply) {
      if (i.replied || i.deferred) {
        await i.followUp({ content });
      } else {
        await i.reply({ content });
      }
    }
  };
  const sendPublic = async (_botName, _userId, contentOrOpts) => {
    try {
      const { Config } = await import('../../../models/index.js');
      const cfg = await Config.findOne({ where: { key: 'fic_queue_channel_id' } });
      const targetId = cfg?.value;
      let channel = null;
      const client = (interactionOrChannel?.client) || (interactionOrChannel?.channel?.client);
      if (targetId && client) {
        channel = await client.channels.fetch(targetId).catch((e) => { try { console.warn(`[hunts] Cas announcer failed to fetch queue channel ${targetId}:`, e?.message || e); } catch {} return null; });
      }
      // Prefer configured queue channel; fallback order: hard-coded, then current
      if (!channel) {
        const HARD_FALLBACK_ID = '1446674019242869010';
        if (client) {
          channel = await client.channels.fetch(HARD_FALLBACK_ID).catch(() => null);
        }
      }
      channel = channel || interactionOrChannel?.channel || interactionOrChannel;
      try { console.log(`[hunts] Cas announcer sending public to channelId=${channel?.id || 'unknown'} (queueId=${targetId || 'none'})`); } catch {}
      if (channel?.send) {
        const payload = typeof contentOrOpts === 'string' ? { content: contentOrOpts } : { content: contentOrOpts.content, embeds: contentOrOpts.embed ? [contentOrOpts.embed] : contentOrOpts.embeds };
        await channel.send(payload);
      }
    } catch {
      const channel = interactionOrChannel?.channel || interactionOrChannel;
      try { console.warn('[hunts] Cas announcer fell back to interactionOrChannel'); } catch {}
      if (channel?.send) {
        const payload = typeof contentOrOpts === 'string' ? { content: contentOrOpts } : { content: contentOrOpts.content, embeds: contentOrOpts.embed ? [contentOrOpts.embed] : contentOrOpts.embeds };
        await channel.send(payload);
      }
    }
  };
  return makeAnnouncer({ sendEphemeral, sendPublic });
}

export default function makeCasAnnouncer(interactionOrChannel) {
  return buildCasAnnouncer(interactionOrChannel);
}
