import { Op } from 'sequelize';
import { UserSettingPoke } from '../../models/index.js';
import fireTrigger from './triggerEngine.js';

export const POKED_IT_SETTING_KEYS = [
  // Profile Settings
  'profile.set_birthday',
  'profile.set_bio',
  'profile.set_timezone',
  'profile.set_region',
  'profile.toggle_region_display',
  'profile.set_pronouns',
  'profile.timezone_display',

  // Privacy Settings
  'privacy.toggle_birthday_mentions',
  'privacy.toggle_birthday_lists',
  'privacy.toggle_privacy_mode_full',
  'privacy.toggle_privacy_mode_age_hidden',
  'privacy.toggle_privacy_mode_year_hidden',
  'privacy.toggle_birthday_hidden',
];

export async function recordSettingPoke({ userId, settingKey, interaction }) {
  if (!userId || !settingKey) return { created: false };
  if (!POKED_IT_SETTING_KEYS.includes(settingKey)) return { created: false };

  try {
    const [row, created] = await UserSettingPoke.findOrCreate({
      where: { userId, settingKey },
      defaults: { userId, settingKey },
    });

    if (!created) return { created: false, row };

    const count = await UserSettingPoke.count({
      where: {
        userId,
        settingKey: { [Op.in]: POKED_IT_SETTING_KEYS },
      },
    });

    if (count >= POKED_IT_SETTING_KEYS.length) {
      await fireTrigger('sam.profile.iPokedIt', {
        userId,
        interaction,
        channel: interaction?.channel,
      });
    }

    return { created: true, row, count };
  } catch {
    return { created: false };
  }
}
