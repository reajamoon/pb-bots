import { Config, HuntProgress } from '../../../models/index.js';
import { Op } from 'sequelize';
import { fireTrigger } from '../../../shared/hunts/triggerEngine.js';
import makeSamAnnouncer from '../utils/huntsAnnouncer.js';

export default {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    try {
      try {
        console.log(`[hunts] messageReactionAdd: received reaction on messageId=${reaction?.message?.id} by userId=${user?.id} emoji=${reaction?.emoji?.name || reaction?.emoji?.id}`);
      } catch {}
      if (user.bot) return;
      const messageIdCfg = await Config.findOne({ where: { key: 'rec_guidelines_message_id' } });
      const roleIdCfg = await Config.findOne({ where: { key: 'rec_guidelines_role_id' } });
      const targetMessageId = messageIdCfg?.value;
      const targetRoleId = roleIdCfg?.value;
      try { console.log(`[hunts] reaction config: targetMessageId=${targetMessageId} targetRoleId=${targetRoleId}`); } catch {}
      if (!targetMessageId || !targetRoleId) return;
      if (reaction.message.id !== targetMessageId) {
        try { console.log(`[hunts] reaction: messageId mismatch (got ${reaction.message.id} expected ${targetMessageId})`); } catch {}
        return;
      }

      const guild = reaction.message.guild;
      if (!guild) return;
      const member = await guild.members.fetch(user.id).catch((e) => { try { console.warn('[hunts] reaction: failed to fetch member:', e?.message || e); } catch {} return null; });
      if (!member) return;
      const role = guild.roles.cache.get(targetRoleId) || await guild.roles.fetch(targetRoleId).catch((e) => { try { console.warn('[hunts] reaction: failed to fetch role:', e?.message || e); } catch {} return null; });
      try { console.log(`[hunts] reaction: resolved guild=${guild?.id} member=${member?.id} role=${role?.id}`); } catch {}
      if (!role) return;

      const announce = makeSamAnnouncer({ interaction: {
        replied: false,
        deferred: false,
        reply: async ({ content, flags }) => reaction.message.channel?.send({ content, flags }),
        followUp: async ({ content, flags }) => reaction.message.channel?.send({ content, flags }),
        channel: reaction.message.channel,
        client: reaction.message.client,
      }});

      // Do not skip on already-unlocked: still grant role; announce logic is handled in triggerEngine
      const already = await HuntProgress.findOne({ where: { userId: user.id, huntKey: 'library_card_guidelines', unlockedAt: { [Op.not]: null } } }).catch(() => null);
      try { console.log(`[hunts] reaction: alreadyUnlocked=${!!already}`); } catch {}

      const grantRole = async (uid) => {
        if (uid !== user.id) return;
        try { console.log(`[hunts] reaction: granting role ${role.id} to user ${user.id}`); } catch {}
        await member.roles.add(role.id).then(() => {
          try { console.log('[hunts] reaction: role granted successfully'); } catch {}
        }).catch((e) => { try { console.warn('[hunts] reaction: role grant failed:', e?.message || e); } catch {} });
      };

      try { console.log('[hunts] messageReactionAdd: firing system.reaction.special'); } catch {}
      await fireTrigger('system.reaction.special', { userId: user.id, announce, grantRole });
      try { console.log('[hunts] messageReactionAdd: fired successfully'); } catch {}
    } catch (err) {
      console.warn('[hunts] messageReactionAdd handler error:', err);
    }
  }
};
