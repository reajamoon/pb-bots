import { User } from '../../models/index.js';
import fireTrigger from './triggerEngine.js';

/**
 * Evaluate whether the user has completed profile setup and fire Hunt trigger if so.
 * Criteria: birthday set (any privacy mode) plus at least two among bio, pronouns, timezone, region.
 *
 * @param {string} userId Discord user ID
 * @param {Object} options Optional context, e.g., interaction for announcer routing
 */
export default async function maybeTriggerProfileSetupComplete(userId, options = {}) {
  const { interaction, announceFactory } = options;
  const user = await User.findOne({ where: { discordId: userId } });
  if (!user) return;
  const hasBirthday = !!user.birthday;
  const fields = [user.bio, user.pronouns, user.timezone, user.region];
  const count = fields.filter(v => !!v && String(v).trim().length > 0).length;
  if (hasBirthday && count >= 2) {
    let announce;
    if (announceFactory) announce = announceFactory;
    else if (interaction) {
      const makeSamAnnouncer = (await import('../../bots/sam/utils/huntsAnnouncer.js')).default;
      announce = makeSamAnnouncer({ interaction });
    }
    await fireTrigger('sam.profile.setupComplete', { userId, announce });
  }
}
