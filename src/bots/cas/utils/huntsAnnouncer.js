import Discord from 'discord.js';
const { InteractionFlags } = Discord;
import { makeAnnouncer } from '../../../shared/hunts/announce.js';

export function getCasAnnouncer(interactionOrChannel) {
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
    const channel = interactionOrChannel?.channel || interactionOrChannel;
    if (channel?.send) await channel.send({ content });
  };
  return makeAnnouncer({ sendEphemeral, sendPublic });
}
