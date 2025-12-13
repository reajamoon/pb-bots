// Pure public convention: do not use ephemerals or suppress flags
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

function buildSamAnnouncer(interaction) {
  const sendEphemeral = async (_botName, _userId, content) => {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content });
    } else {
      await interaction.reply({ content });
    }
  };
  const sendPublic = async (_botName, _userId, contentOrOpts) => {
    try {
      const { Config } = await import('../../../models/index.js');
      const cfg = await Config.findOne({ where: { key: 'fic_queue_channel_id' } });
      const targetId = cfg?.value;
      let channel = null;
      if (targetId && interaction.client) {
        channel = await interaction.client.channels.fetch(targetId).catch((e) => { try { console.warn(`[hunts] Sam announcer failed to fetch queue channel ${targetId}:`, e?.message || e); } catch {} return null; });
      }
      if (targetId) {
        // Queue channel required when configured; do NOT fallback
        if (!channel) {
          try { console.warn(`[hunts] Sam announcer: queue channel ${targetId} not available; aborting public send`); } catch {}
          return;
        }
        try { console.log(`[hunts] Sam announcer sending public to QUEUE channelId=${channel.id} (queueId=${targetId})`); } catch {}
        const payload = typeof contentOrOpts === 'string' ? { content: contentOrOpts } : { content: contentOrOpts.content, embeds: contentOrOpts.embed ? [contentOrOpts.embed] : contentOrOpts.embeds };
        await channel.send(payload).catch((e) => { try { console.warn('[hunts] Sam announcer: send to queue failed:', e?.message || e); } catch {} });
        return;
      }
      // No configured queue channel; fallback to hardcoded channel, then current
      let fallback = null;
      const HARD_FALLBACK_ID = '1446674019242869010';
      if (interaction.client) {
        fallback = await interaction.client.channels.fetch(HARD_FALLBACK_ID).catch(() => null);
      }
      fallback = fallback || interaction.channel;
      try { console.log(`[hunts] Sam announcer sending public to fallback channelId=${fallback?.id || 'unknown'} (queueId=none; hardFallbackId=${HARD_FALLBACK_ID})`); } catch {}
      if (fallback?.send) {
        const payload = typeof contentOrOpts === 'string' ? { content: contentOrOpts } : { content: contentOrOpts.content, embeds: contentOrOpts.embed ? [contentOrOpts.embed] : contentOrOpts.embeds };
        await fallback.send(payload);
      }
    } catch (err) {
      const channel = interaction.channel;
      try { console.warn('[hunts] Sam announcer fell back to interaction.channel in catch:', err?.message || err); } catch {}
      if (channel?.send) {
        const payload = typeof contentOrOpts === 'string' ? { content: contentOrOpts } : { content: contentOrOpts.content, embeds: contentOrOpts.embed ? [contentOrOpts.embed] : contentOrOpts.embeds };
        await channel.send(payload);
      }
    }
  };
  return makeAnnouncer({ sendEphemeral, sendPublic });
}

export default function makeSamAnnouncer({ interaction }) {
  return buildSamAnnouncer(interaction);
}
