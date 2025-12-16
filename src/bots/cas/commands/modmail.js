import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import { Config, ModmailRelay } from '../../../models/index.js';
import { createModmailRelayWithNextTicket } from '../../../shared/utils/modmailTicketAllocator.js';

const data = new SlashCommandBuilder()
  .setName('modmail')
  .setDescription('Contact the moderators via modmail')
  .addStringOption(opt =>
    opt.setName('message')
      .setDescription('What do you want to tell the mods?')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('topic')
      .setDescription('Optional short topic for the thread title')
      .setRequired(false)
  )
  .addAttachmentOption(opt =>
    opt.setName('file1')
      .setDescription('Attach an image or file (optional)')
      .setRequired(false)
  )
  .addAttachmentOption(opt =>
    opt.setName('file2')
      .setDescription('Attach another image or file (optional)')
      .setRequired(false)
  )
  .addAttachmentOption(opt =>
    opt.setName('file3')
      .setDescription('Attach another image or file (optional)')
      .setRequired(false)
  );

async function execute(interaction) {
  const { MessageFlags } = await import('discord.js');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const contentRaw = interaction.options.getString('message');
  const content = (contentRaw ? contentRaw.trim() : '');
  const topic = (interaction.options.getString('topic') || '').trim();
  const filesFromOpts = ['file1','file2','file3']
    .map(n => interaction.options.getAttachment(n))
    .filter(Boolean);
  const filePayload = filesFromOpts.length
    ? filesFromOpts.map(a => ({ attachment: a.url, name: a.name }))
    : [];
  // Require non-empty text; provide a helpful message, especially for attachment-only attempts
  if (!content || content.length === 0) {
    const msg = filePayload.length
      ? 'Please include a brief description with your attachment(s).'
      : 'Please include a brief description of your request.';
    return await interaction.editReply({ content: msg });
  }

  const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
  const modmailChannelId = modmailConfig ? modmailConfig.value : null;
  if (!modmailChannelId) {
    return await interaction.editReply({ content: "I can't find my modmail configuration yet. Please ping a mod." });
  }

  let channel = interaction.client.channels.cache.get(modmailChannelId);
  if (!channel) {
    try { channel = await interaction.client.channels.fetch(modmailChannelId); } catch {}
    if (!channel) {
      return await interaction.editReply({ content: "I couldn't find the modmail channel. Please ping a mod." });
    }
  }

  const description = content || (filePayload.length ? 'Attachment(s) included below.' : '');
  const openEmbed = new EmbedBuilder()
    .setColor(0x3b88c3)
    .setAuthor({ name: `Modmail — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setDescription(description)
    .setFooter({ text: `Opened by Cas • User ID: ${interaction.user.id}` })
    .setTimestamp(new Date());

  const threadBaseName = (topic ? `ModMail: ${topic.substring(0, 80)}` : `ModMail: ${interaction.user.username}`).substring(0, 100);
  let base = null;
  let thread = null;
  try {
    if (channel.type === ChannelType.GuildForum) {
      try {
        thread = await channel.threads.create({
          name: threadBaseName,
          autoArchiveDuration: 1440,
          reason: 'User-initiated modmail',
          message: { embeds: [openEmbed], files: filePayload }
        });
      } catch (forumErr) {
        // Fallback: create without files, append links
        const links = filePayload.length
          ? `\n\nAttachments:\n` + filePayload.map(f => `• ${f.name || 'file'} — ${f.attachment}`).join('\n')
          : '';
        const fallbackEmbed = new EmbedBuilder()
          .setColor(0x3b88c3)
          .setAuthor({ name: `Modmail — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setDescription((description || '') + links)
          .setFooter({ text: `Opened by Cas • User ID: ${interaction.user.id}` })
          .setTimestamp(new Date());
        thread = await channel.threads.create({
          name: threadBaseName,
          autoArchiveDuration: 1440,
          reason: 'User-initiated modmail',
          message: { embeds: [fallbackEmbed] }
        });
      }
      try {
        const starter = await thread.fetchStarterMessage();
        if (starter) base = starter;
      } catch {}
    } else {
      try {
        base = await channel.send({ embeds: [openEmbed], files: filePayload });
      } catch (sendErr) {
        // Fallback to links if file upload fails
        const links = filePayload.length
          ? `\n\nAttachments:\n` + filePayload.map(f => `• ${f.name || 'file'} — ${f.attachment}`).join('\n')
          : '';
        const fallback = new EmbedBuilder()
          .setColor(0x3b88c3)
          .setAuthor({ name: `Modmail — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setDescription((description || '') + links)
          .setFooter({ text: `Opened by Cas • User ID: ${interaction.user.id}` })
          .setTimestamp(new Date());
        base = await channel.send({ embeds: [fallback] });
      }
      try {
        thread = await base.startThread({ name: threadBaseName, autoArchiveDuration: 1440, reason: 'User-initiated modmail' });
      } catch (startErr) {
        try {
          thread = await channel.threads.create({ name: threadBaseName, autoArchiveDuration: 1440, reason: 'User-initiated modmail', startMessage: base });
        } catch (fallbackErr) {
          throw fallbackErr;
        }
      }
    }
  } catch (e) {
    return await interaction.editReply({ content: "I couldn't open a modmail thread here. Please ping a mod." });
  }

  // Persist relay mapping
  try {
    const created = await createModmailRelayWithNextTicket({
      botName: 'cas',
      userId: interaction.user.id,
      threadId: thread.id,
      baseMessageId: base ? base.id : null,
      ficUrl: null,
    });

    await thread.send(`Ticket: ${created.ticket}`);
  } catch (persistErr) {
    console.warn('[cas/modmail] Failed to persist ModMailRelay entry:', persistErr);
  }

  await interaction.editReply({ content: "I've opened a thread for you. The moderators will reply shortly." });
}

export { data };
export default { data, execute };
