import Discord from 'discord.js';
const { InteractionFlags } = Discord;
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

function buildDeanAnnouncer(interactionOrChannel) {
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
  const sendPublic = async (_botName, _userId, contentOrOpts) => {
    const channel = interactionOrChannel?.channel || interactionOrChannel;
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
