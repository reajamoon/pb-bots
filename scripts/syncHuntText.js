import 'dotenv/config';
import { sequelize, Hunt } from '../src/models/index.js';
import { HUNTS } from '../src/shared/hunts/registry.js';

async function main() {
  try {
    console.log('[syncHuntText] Starting...');
    await sequelize.authenticate();
    let updated = 0;
    for (const meta of HUNTS) {
      const row = await Hunt.findByPk(meta.key);
      if (!row) {
        console.warn(`[syncHuntText] Missing hunt row for key='${meta.key}'. Skipping.`);
        continue;
      }
      const next = {
        name: meta.name,
        description: meta.description,
        category: meta.category,
        points: meta.points ?? row.points,
        hidden: !!meta.hidden,
      };
      const needsUpdate = (
        row.name !== next.name ||
        row.description !== next.description ||
        row.category !== next.category ||
        row.points !== next.points ||
        row.hidden !== next.hidden
      );
      if (needsUpdate) {
        await row.update(next);
        updated += 1;
        console.log(`[syncHuntText] Updated '${meta.key}' -> name='${next.name}'`);
      }
    }
    console.log(`[syncHuntText] Done. Updated ${updated} hunts.`);
    process.exit(0);
  } catch (e) {
    console.error('[syncHuntText] Failed:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

main();
