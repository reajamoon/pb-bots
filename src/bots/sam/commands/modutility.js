
import { SlashCommandBuilder } from 'discord.js';
import { Recommendation, ModLock, User } from '../../../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('modutility')
    .setDescription('Moderator utility commands for rec modlocking and admin actions.')
    .addSubcommand(sub =>
      sub.setName('setmodlock')
        .setDescription('Set a modlock on a recommendation field')
        .addStringOption(opt =>
          opt.setName('rec_id')
            .setDescription('Recommendation ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('field')
            .setDescription('Field to lock (e.g. title, tags, ALL)')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clearmodlock')
        .setDescription('Clear a modlock on a recommendation field')
        .addStringOption(opt =>
          opt.setName('rec_id')
            .setDescription('Recommendation ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('field')
            .setDescription('Field to unlock (e.g. title, tags, ALL)')
            .setRequired(true))
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setmodlock') {
      const recId = interaction.options.getString('rec_id');
      const field = interaction.options.getString('field');
      const userId = interaction.user.id;
      const rec = await Recommendation.findByPk(recId);
      if (!rec) {
        return await interaction.reply({ content: `Recommendation ID ${recId} not found.`, ephemeral: true });
      }
      // Fetch user and determine permission level
      const user = await User.findOne({ where: { discordId: userId } });
      let level = 'mod';
      if (user && user.permissionLevel) {
        if (user.permissionLevel === 'superadmin') level = 'superadmin';
        else if (user.permissionLevel === 'admin') level = 'admin';
        else level = 'mod';
      }
      await ModLock.upsert({
        recommendationId: recId,
        field,
        locked: true,
        lockLevel: level,
        lockedBy: userId,
        lockedAt: new Date(),
        unlockedBy: null,
        unlockedAt: null
      });
      return await interaction.reply({ content: `Locked field "${field}" on rec ID ${recId} at level ${level}.`, ephemeral: true });
    } else if (sub === 'clearmodlock') {
      const recId = interaction.options.getString('rec_id');
      const field = interaction.options.getString('field');
      const userId = interaction.user.id;
      const rec = await Recommendation.findByPk(recId);
      if (!rec) {
        return await interaction.reply({ content: `Recommendation ID ${recId} not found.`, ephemeral: true });
      }
      const lock = await ModLock.findOne({ where: { recommendationId: recId, field, locked: true } });
      if (!lock) {
        return await interaction.reply({ content: `No active lock found for field "${field}" on rec ID ${recId}.`, ephemeral: true });
      }
      await lock.update({ locked: false, unlockedBy: userId, unlockedAt: new Date() });
      return await interaction.reply({ content: `Unlocked field "${field}" on rec ID ${recId}.`, ephemeral: true });
    }
  },
};
