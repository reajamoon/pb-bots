// Pure public convention: do not use ephemerals or suppress flags
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

function buildDeanAnnouncer(interactionOrChannel) {
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
    let channel = interactionOrChannel?.channel || interactionOrChannel;
    // Fallback: if we were given an Interaction but no channel object, attempt fetch
    if ((!channel || !channel.send) && interactionOrChannel?.channelId && interactionOrChannel?.client) {
      try {
        const fetched = await interactionOrChannel.client.channels.fetch(interactionOrChannel.channelId).catch(() => null);
        if (fetched && fetched.isTextBased()) channel = fetched;
      } catch {}
    }
    // Configured fallback: use fic queue channel (bot channel) when no context available
    if ((!channel || !channel.send) && interactionOrChannel?.client) {
      try {
        const { Config } = await import('../../../models/index.js');
        const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel_id' } });
        const fallbackId = queueCfg && queueCfg.value ? queueCfg.value : null;
        if (fallbackId) {
          const fetched = await interactionOrChannel.client.channels.fetch(fallbackId).catch(() => null);
          if (fetched && fetched.isTextBased()) channel = fetched;
        }
      } catch (e) {
        try { console.warn('[hunts/dean] Failed loading configured queue channel from Config:', e?.message || e); } catch {}
      }
    }
    if (channel?.send) {
      const payload = typeof contentOrOpts === 'string'
        ? { content: contentOrOpts }
        : { content: contentOrOpts.content, embeds: contentOrOpts.embed ? [contentOrOpts.embed] : (contentOrOpts.embeds || []) };
      try {
        console.log('[hunts/dean] sendPublic payload', {
          channelId: channel.id,
          hasEmbeds: !!payload.embeds && payload.embeds.length > 0,
          hasContent: !!payload.content
        });
        await channel.send(payload);
        console.log('[hunts/dean] public announcement sent');
      } catch (e) {
        console.warn('[hunts/dean] failed to send public announcement:', e && e.message ? e.message : e);
      }
    }
  };
  return makeAnnouncer({ sendEphemeral, sendPublic });
}

export default function makeDeanAnnouncer(interactionOrChannel) {
  return buildDeanAnnouncer(interactionOrChannel);
}
