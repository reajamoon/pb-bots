import Discord from 'discord.js';
const { MessageFlags, EmbedBuilder } = Discord;

// Bots should provide bot-specific voice wrappers; this is a shared shape.
// announce(botName, userId, hunt, options?) -> performs a member-facing pop.
export function makeAnnouncer({ sendEphemeral, sendPublic }) {
  return async function announce(botName, userId, hunt, opts = {}) {
    const title = `🎖️ Hunt Complete: ${hunt.name}`;
    const description = hunt.description || '';
    const embed = new EmbedBuilder()
      .setColor(0xD4AF37)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: 'Use /hunts to view your Hunter ID card.' });
    const content = `<@${userId}>`;
    await sendPublic(botName, userId, { content, embed });
  };
}
