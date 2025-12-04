import { sequelize, User } from '../src/models/index.js';
import logger from '../src/shared/utils/logger.js';
import { toIso } from '../src/shared/utils/dateIso.js';

async function run() {
  try {
    await sequelize.authenticate();
    const users = await User.findAll({ attributes: ['discordId', 'birthday'] });
    let updated = 0;
    for (const u of users) {
      const b = u.birthday;
      if (!b) continue;
      const iso = toIso(String(b));
      if (iso && iso !== b) {
        await User.update({ birthday: iso }, { where: { discordId: u.discordId } });
        updated++;
        logger.info(`[normalize-birthdays] ${u.discordId}: ${b} -> ${iso}`);
      }
    }
    logger.info(`[normalize-birthdays] Completed. Updated ${updated} users.`);
    await sequelize.close();
  } catch (err) {
    logger.error('[normalize-birthdays] Error:', err);
    process.exitCode = 1;
  }
}

run();