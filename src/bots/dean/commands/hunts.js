import Discord from 'discord.js';
const { SlashCommandBuilder, InteractionFlags, PermissionsBitField } = Discord;
import { HUNTS, awardHunt, getHuntMeta } from '../../../shared/hunts/registry.js';

export const data = new SlashCommandBuilder()
  .setName('hunts')
  .setDescription('Admin: manage/force hunts (Dean)')
  .addSubcommand(sub => sub
    .setName('force')
    .setDescription('Force-award a hunt and optionally announce')
    .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    .addStringOption(opt => {
      const o = opt.setName('key').setDescription('Hunt key').setRequired(true);
      // Provide choices from registry (<=25 is fine)
      const choices = HUNTS.slice(0, 25).map(h => ({ name: `${h.key} (${h.name})`, value: h.key }));
      for (const c of choices) o.addChoices(c);
      return o;
    })
    .addBooleanOption(opt => opt.setName('announce').setDescription('Send public announcement').setRequired(false))
    .addStringOption(opt => opt.setName('channel_id').setDescription('Optional channel ID to announce in'))
  );

export async function execute(interaction) {
  try {
    // Admin/mod only
    const member = interaction.member;
    const hasAdmin = member?.permissions?.has?.(PermissionsBitField.Flags.Administrator);
    if (!hasAdmin) {
      await interaction.reply({ content: 'You need admin to use this.', flags: InteractionFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: InteractionFlags.Ephemeral });

    const user = interaction.options.getUser('user', true);
    const userId = user.id;
    const key = interaction.options.getString('key', true);
    const doAnnounce = interaction.options.getBoolean('announce') ?? true;
    const channelId = interaction.options.getString('channel_id') || null;

    // Award (idempotent: returns unlocked=false if already had it)
    const res = await awardHunt(userId, key);
    const meta = getHuntMeta(key);
    const unlockedTxt = res.unlocked ? 'unlocked now' : 'already unlocked';

    // Optional announce, public
    if (doAnnounce && meta?.visibility !== 'silent') {
      let announceFn = null;
      if ((meta?.announcer || 'dean') === 'dean') {
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        let channel = interaction.channel;
        if (channelId) channel = await interaction.client.channels.fetch(channelId).catch(() => interaction.channel);
        announceFn = makeDeanAnnouncer(channel || interaction);
      } else if (meta?.announcer === 'sam') {
        const makeSamAnnouncer = (await import('../../sam/utils/huntsAnnouncer.js')).default;
        let channel = interaction.channel;
        if (channelId) channel = await interaction.client.channels.fetch(channelId).catch(() => interaction.channel);
        announceFn = makeSamAnnouncer({ interaction, channel: channel || interaction.channel });
      } else if (meta?.announcer === 'cas') {
        const makeCasAnnouncer = (await import('../../cas/utils/huntsAnnouncer.js')).default;
        let channel = interaction.channel;
        if (channelId) channel = await interaction.client.channels.fetch(channelId).catch(() => interaction.channel);
        announceFn = makeCasAnnouncer(channel || interaction);
      }
      if (typeof announceFn === 'function') {
        await announceFn(meta?.announcer || 'dean', userId, res.hunt || { key, name: meta?.name, description: meta?.description });
      }
    }

    await interaction.editReply({ content: `Hunt '${key}' for <@${userId}>: ${unlockedTxt}.${doAnnounce ? ' Announcement sent (if possible).' : ''}` });
  } catch (err) {
    console.error('[dean/hunts force] error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'Failed to force award. Check logs.' });
      } else {
        await interaction.reply({ content: 'Failed to force award. Check logs.', flags: InteractionFlags.Ephemeral });
      }
    } catch {}
  }
}

export default { data, execute };
