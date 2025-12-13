import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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
  );

async function execute(interaction) {
  const { MessageFlags } = await import('discord.js');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const content = interaction.options.getString('message').trim();
  const topic = (interaction.options.getString('topic') || '').trim();

  const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
  const modmailChannelId = modmailConfig ? modmailConfig.value : null;
  if (!modmailChannelId) {
    return await interaction.editReply({ content: "I can't find my modmail configuration yet. Please ping a mod." });
  }

  const channel = interaction.client.channels.cache.get(modmailChannelId);
  if (!channel) {
    return await interaction.editReply({ content: "I couldn't find the modmail channel. Please ping a mod." });
  }

  // Post base message and start a thread for the user
  const base = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3b88c3)
        .setAuthor({ name: `Modmail — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(content)
        .setFooter({ text: `Opened by Cas • User ID: ${interaction.user.id}` })
        .setTimestamp(new Date())
    ]
  });
  const threadName = (topic ? `ModMail: ${topic.substring(0, 80)}` : `ModMail: ${interaction.user.username}`).substring(0, 100);
  const thread = await base.startThread({
    name: threadName,
    autoArchiveDuration: 1440,
    reason: 'User-initiated modmail'
  });

  // Persist relay mapping
  try {
    const created = await createModmailRelayWithNextTicket({
      botName: 'cas',
      userId: interaction.user.id,
      threadId: thread.id,
      baseMessageId: base.id,
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
