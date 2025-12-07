import { Config, HuntProgress } from '../../../models/index.js';
import { Op } from 'sequelize';
import { fireTrigger } from '../../../shared/hunts/triggerEngine.js';
import { getSamAnnouncer } from '../utils/huntsAnnouncer.js';

export default {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    try {
      if (user.bot) return;
      const messageIdCfg = await Config.findOne({ where: { key: 'rec_guidelines_message_id' } });
      const roleIdCfg = await Config.findOne({ where: { key: 'rec_guidelines_role_id' } });
      const targetMessageId = messageIdCfg?.value;
      const targetRoleId = roleIdCfg?.value;
      if (!targetMessageId || !targetRoleId) return;
      if (reaction.message.id !== targetMessageId) return;

      const guild = reaction.message.guild;
      if (!guild) return;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;
      const role = guild.roles.cache.get(targetRoleId) || await guild.roles.fetch(targetRoleId).catch(() => null);
      if (!role) return;

      const announce = getSamAnnouncer({
        replied: false,
        deferred: false,
        reply: async ({ content, flags }) => reaction.message.channel?.send({ content, flags }),
        followUp: async ({ content, flags }) => reaction.message.channel?.send({ content, flags }),
        channel: reaction.message.channel,
      });

      // Skip if already unlocked to avoid duplicate announce/grant
      const already = await HuntProgress.findOne({ where: { userId: user.id, huntKey: 'library_card_guidelines', unlockedAt: { [Op.not]: null } } }).catch(() => null);
      if (already) return;

      const grantRole = async (uid) => {
        if (uid !== user.id) return;
        await member.roles.add(role.id).catch(() => {});
      };

      await fireTrigger('system.reaction.special', { userId: user.id, announce, grantRole });
    } catch (err) {
      console.warn('[hunts] messageReactionAdd handler error:', err);
    }
  }
};
