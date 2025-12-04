import { Config, ModmailRelay } from '../../../../src/models/index.js';

export default async function onMessageCreate(message) {
  try {
    // Only handle DMs from users to Cas
    if (message.author.bot) return;
    const isDM = message.channel.type === 1; /* DM channel in discord.js v14 */

    const client = message.client;
    if (isDM) {
      // Find existing open relay for this user
      let relay = await ModmailRelay.findOne({ where: { user_id: message.author.id, open: true } });

    // Resolve modmail channel
    const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
    const modmailChannelId = modmailConfig ? modmailConfig.value : null;
    const channel = modmailChannelId ? client.channels.cache.get(modmailChannelId) : null;
    if (!channel) {
      await message.reply("I don't have modmail configured yet. Please ping a mod.");
      return;
    }

    // If a relay exists but the thread belongs to another bot (e.g., Sam), ignore it
    if (relay) {
      const existingThread = client.channels.cache.get(relay.thread_id);
      if (existingThread && existingThread.isThread()) {
        // Only reuse threads created by Cas
        if (existingThread.ownerId !== client.user.id) {
          relay = null; // force new thread creation for Cas
        }
      } else {
        // Missing thread; allow recreation below
        relay = null;
      }
    }

    if (isDM && !relay) {
      // Create a new modmail thread
      const { EmbedBuilder } = await import('discord.js');
      const base = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b88c3)
            .setAuthor({ name: `Modmail — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content)
            .setFooter({ text: `Opened by Cas • User ID: ${message.author.id}` })
            .setTimestamp(new Date())
        ]
      });
      const threadName = `ModMail: ${message.author.username}`.substring(0, 100);
      const thread = await base.startThread({ name: threadName, autoArchiveDuration: 1440, reason: 'User-initiated modmail (DM)' });
      relay = await ModmailRelay.create({
        user_id: message.author.id,
        fic_url: null,
        base_message_id: base.id,
        thread_id: thread.id,
        open: true,
        last_user_message_at: new Date()
      });
      await message.reply('I’ve opened a thread for you. The moderators will reply shortly.');
    } else if (isDM) {
      // Post into existing Cas-owned thread
      const thread = client.channels.cache.get(relay.thread_id);
      if (thread && thread.isThread()) {
        await thread.send({ content: `<@${message.author.id}>: ${message.content}` });
        await relay.update({ last_user_message_at: new Date() });
        await message.react('✅');
      } else {
        // Thread missing; recreate a Cas-owned thread
        const { EmbedBuilder } = await import('discord.js');
        const base = await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3b88c3)
              .setAuthor({ name: `Modmail — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
              .setDescription(message.content)
              .setFooter({ text: `Resumed by Cas • User ID: ${message.author.id}` })
              .setTimestamp(new Date())
            ]
          });
        const threadName = `ModMail: ${message.author.username}`.substring(0, 100);
        const thread = await base.startThread({ name: threadName, autoArchiveDuration: 1440, reason: 'Resume modmail (thread missing)' });
        await relay.update({ base_message_id: base.id, thread_id: thread.id, last_user_message_at: new Date() });
        await message.reply('Your modmail thread was missing; I’ve reopened it.');
      }
    }

    // End DM handling
    }

    // Handle relay messages from mods inside Cas-owned modmail threads
    if (typeof message.channel.isThread === 'function' && message.channel.isThread()) {
      const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
      const modmailChannelId = modmailConfig ? modmailConfig.value : null;
      const parent = message.channel.parent;
      if (parent && parent.id === modmailChannelId) {
        const content = (message.content || '').trim();
        if (/^(@relay|@cas\s+relay|\/relay)/i.test(content)) {
          const relayMsg = content.replace(/^(@cas\s+relay|@relay|\/relay)/i, '').trim();
          if (!relayMsg) {
            await message.reply('Add a message after `@relay` to DM the user.');
            return;
          }
          // Find relay by this thread
          const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id, open: true } });
          if (!relayEntry) {
            await message.reply('I could not find the user for this thread.');
            return;
          }
          try {
            const dmUser = await client.users.fetch(relayEntry.user_id);
            const { EmbedBuilder } = await import('discord.js');
            await dmUser.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x3b88c3)
                  .setDescription(relayMsg)
                  .setFooter({ text: 'Cas — Moderator relay' })
                  .setTimestamp(new Date())
              ]
            });
            await message.reply('I’ve delivered your message.');
            await ModmailRelay.update({ last_relayed_at: new Date() }, { where: { thread_id: message.channel.id } });
          } catch (err) {
            await message.reply("Couldn't DM the user; they may have DMs off.");
          }
        }
      }
    }
  } catch (err) {
    console.error('[cas] messageCreate modmail relay error:', err);
  }
}
