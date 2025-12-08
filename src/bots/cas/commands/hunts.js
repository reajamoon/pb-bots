import Discord from 'discord.js';
const { SlashCommandBuilder, InteractionFlags, PermissionsBitField } = Discord;
import { HUNTS, awardHunt, getHuntMeta } from '../../../shared/hunts/registry.js';

export const data = new SlashCommandBuilder()
  .setName('hunts')
  .setDescription('Admin: manage/force hunts (Cas)')
  .addSubcommand(sub => sub
    .setName('force')
    .setDescription('Force-award a hunt and optionally announce')
    .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    .addStringOption(opt => {
      const o = opt.setName('key').setDescription('Hunt key').setRequired(true);
      const choices = HUNTS.slice(0, 25).map(h => ({ name: `${h.key} (${h.name})`, value: h.key }));
      for (const c of choices) o.addChoices(c);
      return o;
    })
    .addBooleanOption(opt => opt.setName('announce').setDescription('Send public announcement').setRequired(false))
    .addStringOption(opt => opt.setName('channel_id').setDescription('Optional channel ID to announce in'))
  );

export async function execute(interaction) {
  try {
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

    const res = await awardHunt(userId, key);
    const meta = getHuntMeta(key);
    const unlockedTxt = res.unlocked ? 'unlocked now' : 'already unlocked';

    if (doAnnounce && meta?.visibility !== 'silent') {
      let announceFn = null;
      let channel = interaction.channel;
      if (channelId) channel = await interaction.client.channels.fetch(channelId).catch(() => interaction.channel);
      const botKey = meta?.announcer || 'cas';
      if (botKey === 'cas') {
        const makeCasAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        announceFn = makeCasAnnouncer(channel || interaction);
      } else if (botKey === 'dean') {
        const makeDeanAnnouncer = (await import('../../dean/utils/huntsAnnouncer.js')).default;
        announceFn = makeDeanAnnouncer(channel || interaction);
      } else if (botKey === 'sam') {
        const makeSamAnnouncer = (await import('../../sam/utils/huntsAnnouncer.js')).default;
        announceFn = makeSamAnnouncer({ interaction, channel: channel || interaction.channel });
      }
      if (typeof announceFn === 'function') {
        await announceFn(botKey, userId, res.hunt || { key, name: meta?.name, description: meta?.description });
      }
    }

    await interaction.editReply({ content: `Hunt '${key}' for <@${userId}>: ${unlockedTxt}.${doAnnounce ? ' Announcement sent (if possible).' : ''}` });
  } catch (err) {
    console.error('[cas/hunts force] error:', err);
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
