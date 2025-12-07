import { InteractionFlags } from 'discord.js';

// Bots should provide bot-specific voice wrappers; this is a shared shape.
// announce(botName, userId, hunt, options?) -> performs a member-facing pop.
export function makeAnnouncer({ sendEphemeral, sendPublic }) {
  return async function announce(botName, userId, hunt, opts = {}) {
    const content = `🎖️ Hunt Unlocked: ${hunt.name}\n${hunt.description}`;
    const ephemeral = opts.ephemeral !== undefined ? opts.ephemeral : true;
    if (ephemeral) {
      await sendEphemeral(botName, userId, content, { flags: InteractionFlags.Ephemeral });
    } else {
      await sendPublic(botName, userId, content);
    }
  };
}
