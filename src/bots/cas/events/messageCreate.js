import { Config, ModmailRelay } from '../../../models/index.js';
import { EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { createModmailRelayWithNextTicket } from '../../../shared/utils/modmailTicketAllocator.js';

async function resolveRelayThread({ client, channel, relay }) {
  if (!relay?.thread_id) return null;

  let thread = client.channels.cache.get(relay.thread_id);

  if (!thread && channel && channel.threads && typeof channel.threads.fetch === 'function') {
    try {
      const fetched = await channel.threads.fetch(relay.thread_id);
      thread = fetched || null;
    } catch {}
  }

  if (!thread) {
    try {
      thread = await client.channels.fetch(relay.thread_id);
    } catch {}
  }

  if (!thread && relay.base_message_id && channel) {
    try {
      const baseMsg = await channel.messages.fetch(relay.base_message_id);
      if (baseMsg && baseMsg.hasThread) {
        thread = baseMsg.thread;
      }
    } catch {}
  }

  if (thread && typeof thread.isThread === 'function' && thread.isThread()) {
    return thread;
  }

  return null;
}

export default async function onMessageCreate(message) {
  try {
    // Only handle DMs from users to Cas
    if (message.author.bot) return;
    const isDM = message.channel.type === 1; /* DM channel in discord.js v14 */

    const client = message.client;
    if (isDM) {
      // Resolve modmail channel early (used for thread lookups and creation)
      const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
      const modmailChannelId = modmailConfig ? modmailConfig.value : null;
      let channel = modmailChannelId ? client.channels.cache.get(modmailChannelId) : null;
      if (!channel && modmailChannelId) {
        try {
          channel = await client.channels.fetch(modmailChannelId);
        } catch {}
      }
      if (!channel) {
        await message.reply("I don't have modmail configured yet. Please ping a mod.");
        return;
      }

      // Find existing open relays for this user and prefer Cas-owned threads
      let relay = null;
      const relays = await ModmailRelay.findAll({
        where: { user_id: message.author.id, open: true, bot_name: 'cas' },
        order: [
          ['last_user_message_at', 'DESC'],
          ['last_relayed_at', 'DESC'],
          ['created_at', 'DESC'],
        ],
      });
      for (const r of relays) {
        const th = await resolveRelayThread({ client, channel, relay: r });
        if (!th) continue;
        // Only reuse threads created by Cas
        if (th.ownerId === client.user.id) {
          relay = r;
          break;
        }
      }

    // If a relay exists, try to use its thread; if it's a Sam-owned thread, do not post into it
    if (relay) {
      const existingThread = await resolveRelayThread({ client, channel, relay });
      let ownerMismatch = false;
      if (existingThread && typeof existingThread.isThread === 'function' && existingThread.isThread()) {
        ownerMismatch = existingThread.ownerId && existingThread.ownerId !== client.user.id;
      }
      if (ownerMismatch) {
        // Respect Sam-owned threads: acknowledge and do not recreate/post in main channel
        await message.react('✅');
        await message.reply('I see your message. Your modmail is currently being handled by the other librarian; they\'ll reply in that thread.');
        return;
      }
      // If thread can't be resolved here, keep the relay and let the DM handler
      // recreate and update it under the same ticket.
    }

    if (isDM && !relay) {
      // Create a new modmail thread
      const baseEmbed = new EmbedBuilder()
        .setColor(0x3b88c3)
        .setAuthor({ name: `Modmail — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content)
        .addFields(
          { name: 'Thread Commands', value: '`@ticket` • show ticket details\n`@relay <message>` • DM the user\n`@close` • close this ticket' }
        )
        .setFooter({ text: `Opened by Cas • User ID: ${message.author.id}` })
        .setTimestamp(new Date());
      const threadName = `ModMail: ${message.author.username}`.substring(0, 100);
      let base = null;
      let thread = null;
      // If modmail channel is a Forum, create a thread directly with the embed
      try {
        console.log('[cas.modmail] Creating thread. Channel type:', channel.type, 'Forum?', channel.type === ChannelType.GuildForum, 'User:', message.author.id);
        if (channel.type === ChannelType.GuildForum) {
          thread = await channel.threads.create({
            name: threadName,
            autoArchiveDuration: 1440,
            reason: 'User-initiated modmail (DM)',
            message: { embeds: [baseEmbed] }
          });
          console.log('[cas.modmail] Forum thread created:', (thread && thread.id) || null);
          try {
            const starter = await thread.fetchStarterMessage();
            if (starter) {
              base = { id: starter.id };
            }
          } catch {}
        } else {
          const perms = channel.permissionsFor(client.user);
          if (!perms || (!perms.has(PermissionFlagsBits.CreatePublicThreads) && !perms.has(PermissionFlagsBits.CreatePrivateThreads))) {
            base = await channel.send({ embeds: [baseEmbed] });
            await message.reply("I can’t create threads in this channel. Please grant thread permissions or ping a mod.");
            console.warn('[cas.modmail] Missing thread permissions. Base message id:', base ? base.id : null);
            return;
          }
          base = await channel.send({ embeds: [baseEmbed] });
          console.log('[cas.modmail] Base message sent. base.id:', base ? base.id : null);
          // On regular text channels, start a public thread by default
          try {
            thread = await base.startThread({ name: threadName, autoArchiveDuration: 1440, reason: 'User-initiated modmail (DM)' });
          } catch (startErr) {
            console.warn('[cas.modmail] base.startThread failed, attempting channel.threads.create fallback:', startErr);
            try {
              thread = await channel.threads.create({
                name: threadName,
                autoArchiveDuration: 1440,
                reason: 'User-initiated modmail (DM)',
                startMessage: base,
              });
            } catch (fallbackErr) {
              console.error('[cas.modmail] Fallback thread creation failed:', fallbackErr);
              throw fallbackErr;
            }
          }
          console.log('[cas.modmail] startThread result:', (thread && thread.id) || null, 'isThread?', (thread && typeof thread.isThread === 'function') ? thread.isThread() : null, 'ownerId:', (thread && thread.ownerId) || null);
          if (!thread || !thread.isThread()) {
            await message.reply("I sent the modmail message but couldn’t start the thread. Please ping a mod.");
            console.error('[cas.modmail] startThread failed to return a ThreadChannel. base.id:', base ? base.id : null);
            return;
          }
        }
      } catch (e) {
        console.error('[cas.modmail] Exception during thread creation:', e);
        await message.reply("I couldn't start a modmail thread here. Please ping a mod.");
        return;
      }
      // Always post an intro message inside the thread and use its ID as anchor
      try {
        const intro = new EmbedBuilder()
          .setColor(0x3b88c3)
          .setTitle('Modmail Opened')
          .setDescription('Use these to manage this ticket:')
          .addFields(
            { name: 'Show Ticket', value: '`@ticket` or `/ticket`', inline: true },
            { name: 'Relay to User', value: '`@relay <message>`', inline: true },
            { name: 'Close Ticket', value: '`@close` or `/close`', inline: true }
          )
          .setTimestamp(new Date());
        const introMsg = await thread.send({ embeds: [intro] });
        // If we don't have a parent/base message id, fall back to the thread's intro id
        base = base || { id: introMsg.id };
      } catch {}

      const created = await createModmailRelayWithNextTicket({
        botName: 'cas',
        userId: message.author.id,
        threadId: thread.id,
        baseMessageId: base ? base.id : null,
        ficUrl: null,
      });
      relay = created.relay;

      console.log('[cas.modmail] Relay created:', {
        user_id: message.author.id,
        ticket: created.ticket,
        base_message_id: base ? base.id : null,
        thread_id: thread ? thread.id : null,
      });
      await message.reply(`I’ve opened a thread for you. Your ticket is ${created.ticket}. The moderators will reply shortly.`);
    } else if (isDM) {
      // Post into existing Cas-owned thread
      const thread = await resolveRelayThread({ client, channel, relay });
      if (thread && typeof thread.isThread === 'function' && thread.isThread()) {
        await thread.send({ content: `<@${message.author.id}>: ${message.content}` });
        await relay.update({ last_user_message_at: new Date() });
        await message.react('✅');
      } else {
        // Thread missing; recreate a Cas-owned thread (avoid posting multiple bases)
        const { EmbedBuilder } = await import('discord.js');
        const resumeEmbed = new EmbedBuilder()
          .setColor(0x3b88c3)
          .setAuthor({ name: `Modmail — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
          .setDescription(message.content)
          .addFields(
            { name: 'Thread Commands', value: '`@ticket` • show ticket details\n`@relay <message>` • DM the user\n`@close` • close this ticket' }
          )
          .setFooter({ text: `Resumed by Cas • User ID: ${message.author.id}` })
          .setTimestamp(new Date());
        
        const threadName2 = `ModMail: ${message.author.username}`.substring(0, 100);
        let base2 = null;
        let thread2 = null;
        try {
          if (channel.type === ChannelType.GuildForum) {
            thread2 = await channel.threads.create({
              name: threadName2,
              autoArchiveDuration: 1440,
              reason: 'Resume modmail (thread missing)',
              message: { embeds: [resumeEmbed] }
            });
          } else {
            const perms2 = channel.permissionsFor(client.user);
            if (!perms2 || (!perms2.has(PermissionFlagsBits.CreatePublicThreads) && !perms2.has(PermissionFlagsBits.CreatePrivateThreads))) {
              base2 = await channel.send({ embeds: [resumeEmbed] });
              await message.reply("I can’t create threads in this channel. Please grant thread permissions or ping a mod.");
              return;
            }
            base2 = await channel.send({ embeds: [resumeEmbed] });
            thread2 = await base2.startThread({ name: threadName2, autoArchiveDuration: 1440, reason: 'Resume modmail (thread missing)' });
            if (!thread2 || !thread2.isThread()) {
              await message.reply("I sent the modmail message but couldn’t start the thread. Please ping a mod.");
              return;
            }
          }
        } catch (e) {
          await message.reply("I couldn't reopen the modmail thread. Please ping a mod.");
          return;
        }
        // Post an intro in the reopened thread and use it as anchor if needed
        try {
          const intro2 = new EmbedBuilder()
            .setColor(0x3b88c3)
            .setTitle('Modmail Resumed')
            .setDescription('Use these to manage this ticket:')
            .addFields(
              { name: 'Show Ticket', value: '`@ticket` or `/ticket`', inline: true },
              { name: 'Relay to User', value: '`@relay <message>`', inline: true },
              { name: 'Close Ticket', value: '`@close` or `/close`', inline: true }
            )
            .setTimestamp(new Date());
          const introMsg2 = await thread2.send({ embeds: [intro2] });
          await relay.update({ base_message_id: base2 ? base2.id : introMsg2.id, thread_id: thread2.id, last_user_message_at: new Date() });
        } catch {
          await relay.update({ base_message_id: base2 ? base2.id : null, thread_id: thread2.id, last_user_message_at: new Date() });
        }
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
        // Only handle commands in threads owned by Cas
        if (message.channel.ownerId !== message.client.user.id) {
          return;
        }
        const content = (message.content || '').trim();
        if (/^(@ticket|\/ticket)/i.test(content)) {
          const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id } });
          if (!relayEntry) {
            await message.reply('No ticket associated with this thread.');
            return;
          }
          const opened = relayEntry.created_at ? new Date(relayEntry.created_at).toLocaleString() : 'unknown';
          const closed = relayEntry.closed_at ? new Date(relayEntry.closed_at).toLocaleString() : '—';
          const { EmbedBuilder } = await import('discord.js');
          const info = new EmbedBuilder()
            .setColor(0x3b88c3)
            .setTitle('Ticket Details')
            .setDescription('Here’s what I’ve got for this ticket:')
            .addFields(
              { name: 'Ticket', value: `${relayEntry.ticket_number || 'N/A'}`, inline: true },
              { name: 'Status', value: `${relayEntry.status || (relayEntry.open ? 'open' : 'closed')}`, inline: true },
              { name: 'Opened', value: `${opened}`, inline: false },
              { name: 'Closed', value: `${closed}`, inline: false },
            )
            .setFooter({ text: 'Cas — Use @relay to DM the user, @close to end.' })
            .setTimestamp(new Date());
          await message.reply({ embeds: [info] });
          return;
        }
        if (/^(@close|\/close)/i.test(content)) {
          const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id, open: true } });
          if (!relayEntry) {
            await message.reply('No open ticket found for this thread.');
            return;
          }
          await ModmailRelay.update({ open: false, status: 'closed', closed_at: new Date() }, { where: { thread_id: message.channel.id } });
          await message.reply('Ticket closed. I won’t relay further messages from the user to this thread.');
          return;
        }
        if (/^(@relay|\/relay)/i.test(content)) {
          const relayMsg = content.replace(/^(@cas\s+relay|@relay|\/relay)/i, '').trim();
          if (!relayMsg) {
            await message.reply('Add a message after `@relay` to DM the user.');
            return;
          }
          // Find relay by this thread
          let relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id, open: true } });
          if (!relayEntry) {
            // Fallback: try to extract user ID from thread starter or first embed
            try {
              const starter = await message.channel.fetchStarterMessage().catch(() => null);
              let userId = null;
              const tryEmbeds = [];
              if (starter && starter.embeds && starter.embeds.length) tryEmbeds.push(...starter.embeds);
              // Also look at the first few messages for an intro embed
              const msgs = await message.channel.messages.fetch({ limit: 5 }).catch(() => null);
              if (msgs) {
                for (const m of msgs.values()) {
                  if (m.embeds && m.embeds.length) tryEmbeds.push(...m.embeds);
                }
              }
              for (const e of tryEmbeds) {
                const footerText = e.footer && e.footer.text ? e.footer.text : '';
                const match = footerText.match(/User ID:\s*(\d{5,})/i);
                if (match) { userId = match[1]; break; }
              }
              if (userId) {
                // Persist a repair entry so future lookups work reliably
                try {
                  await ModmailRelay.upsert({
                    user_id: userId,
                    bot_name: 'cas',
                    thread_id: message.channel.id,
                    base_message_id: starter ? starter.id : null,
                    open: true,
                    status: 'open',
                    last_relayed_at: new Date(),
                    created_at: new Date()
                  });
                } catch {}
                relayEntry = { user_id: userId, thread_id: message.channel.id, open: true };
              }
            } catch {}
          }
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
