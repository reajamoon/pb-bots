import { awardHunt, incrementHuntProgress, HUNTS, getHuntMeta } from './registry.js';
import { Op } from 'sequelize';
import { metaRequirementsSatisfied } from './narrative.js';

// Declarative triggers registry; bots call fireTrigger with context
// Example trigger ids: 'sam.rec.sent', 'dean.sprint.completed', 'cas.search.used'
async function resolveAnnouncer(preferred, context) {
  // preferred: 'sam' | 'dean' | 'cas'
  // context may contain interaction or channel for routing
  try {
    if (preferred === 'sam') {
      const makeSamAnnouncer = (await import('../../bots/sam/utils/huntsAnnouncer.js')).default;
      return makeSamAnnouncer({ interaction: context?.interaction, channel: context?.channel });
    }
    if (preferred === 'dean') {
      const makeDeanAnnouncer = (await import('../../bots/dean/utils/huntsAnnouncer.js')).default;
      return makeDeanAnnouncer(context?.interaction || context?.channel);
    }
    if (preferred === 'cas') {
      const makeCasAnnouncer = (await import('../../bots/cas/utils/huntsAnnouncer.js')).default;
      return makeCasAnnouncer(context?.interaction || context?.channel);
    }
  } catch (e) {
    console.warn('[hunts] resolveAnnouncer failed, falling back to provided announcer:', e);
  }
  return context?.announce; // fallback
}

export const TRIGGERS = {
  'sam.rec.sent': [
    async ({ userId, announce, interaction, channel }) => {
      const res = await awardHunt(userId, 'first_rec_sent');
      try {
        console.log(`[hunts] sam.rec.sent award first_rec_sent userId=${userId} unlocked=${res?.unlocked} progressId=${res?.progress?.id} unlockedAt=${res?.progress?.unlockedAt}`);
      } catch {}
      if (res.unlocked) {
        const meta = getHuntMeta('first_rec_sent');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          const ann = await resolveAnnouncer(meta?.announcer || 'sam', { interaction, channel, announce });
          await ann(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
        }
      }
      await incrementHuntProgress(userId, 'ten_recs_sent', 1);
      // Grace-pop: backfill progress from historical user recs-with-notes if behind
      try {
        const { UserFicMetadata } = await import('../../models/index.js');
        const total = await UserFicMetadata.count({ where: { userID: userId, rec_note: { [Op.ne]: null } } });
        const prog = await incrementHuntProgress(userId, 'ten_recs_sent', 0);
        if (prog && typeof prog.progress === 'number' && total > prog.progress) {
          prog.progress = total;
          await prog.save();
          const meta = getHuntMeta('ten_recs_sent');
          if (meta?.threshold && !prog.unlockedAt && prog.progress >= meta.threshold) {
            const resT = await awardHunt(userId, 'ten_recs_sent');
            if (resT.unlocked) {
              const ephemeralT = meta?.visibility === 'ephemeral';
              if (meta?.visibility !== 'silent') {
                const annT = await resolveAnnouncer(meta?.announcer || 'sam', { interaction, channel, announce });
                await annT(meta?.announcer || 'sam', userId, resT.hunt, { ephemeral: ephemeralT });
              }
            }
          }
        }
      } catch (e) {
        console.warn('[hunts] grace-pop reconciliation failed:', e);
      }
      // Meta narrative: check Angel Blade requirements and auto-award
      try {
        const narr = getHuntMeta('dads_on_a_hunting_trip_narrative');
        if (narr?.requires && (await metaRequirementsSatisfied(userId, narr.requires))) {
          const resN = await awardHunt(userId, 'dads_on_a_hunting_trip_narrative');
          if (resN.unlocked) {
            const ephemeralN = narr?.visibility === 'ephemeral';
            if (narr?.visibility !== 'silent') {
              const annN = await resolveAnnouncer(narr?.announcer || 'cas', { interaction, channel, announce });
              await annN(narr?.announcer || 'cas', userId, resN.hunt, { ephemeral: ephemeralN });
            }
          }
        }
      } catch {}
    },
  ],
  'dean.sprint.completed': [
    async ({ userId, announce, interaction, channel }) => {
      const res = await awardHunt(userId, 'first_sprint');
      try {
        console.log(`[hunts] dean.sprint.completed award first_sprint userId=${userId} unlocked=${res?.unlocked} progressId=${res?.progress?.id} unlockedAt=${res?.progress?.unlockedAt}`);
      } catch {}
      if (res.unlocked) {
        const meta = getHuntMeta('first_sprint');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          const ann = await resolveAnnouncer(meta?.announcer || 'dean', { interaction, channel, announce });
          try {
            console.log('[hunts DEBUG] dean.sprint.completed announcer resolved:', {
              hasAnnouncer: typeof ann === 'function',
              bot: meta?.announcer || 'dean',
              channelId: interaction?.channel?.id || channel?.id || null,
            });
            if (typeof ann === 'function') {
              await ann(meta?.announcer || 'dean', userId, res.hunt, { ephemeral });
              console.log('[hunts DEBUG] dean.sprint.completed announcement attempted');
            } else {
              console.warn('[hunts DEBUG] No announcer function resolved for dean.sprint.completed');
            }
          } catch (e) {
            console.error('[hunts DEBUG] Announcer call failed for dean.sprint.completed:', e && e.message ? e.message : e);
          }
        }
      }
      // Streak check: 3 consecutive days with at least one sprint
      try {
        const { DeanSprints } = await import('../../models/index.js');
        const now = new Date();
        const startWindow = new Date(now.getTime());
        startWindow.setUTCDate(now.getUTCDate() - 2); // include today and previous 2 days
        startWindow.setUTCHours(0, 0, 0, 0);
        const endWindow = new Date(now.getTime());
        endWindow.setUTCHours(23, 59, 59, 999);
        const rows = await DeanSprints.findAll({
          where: { userId, status: 'done', updatedAt: { [Op.between]: [startWindow, endWindow] } },
          order: [['updatedAt', 'ASC']],
        });
        // Distinct UTC date keys
        const daysSet = new Set(rows.map(r => {
          const d = new Date(r.updatedAt);
          return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
        }));
        if (daysSet.size >= 3) {
          const res2 = await awardHunt(userId, 'heat_of_the_moment_streak3');
          if (res2.unlocked) {
            const meta2 = getHuntMeta('heat_of_the_moment_streak3');
            const ephemeral2 = meta2?.visibility === 'ephemeral';
            if (meta2?.visibility !== 'silent') {
              const ann2 = await resolveAnnouncer(meta2?.announcer || 'dean', { interaction, channel, announce });
              await ann2(meta2?.announcer || 'dean', userId, res2.hunt, { ephemeral: ephemeral2 });
            }
          }
        }
      } catch (e) {
        console.warn('[hunts] streak check failed:', e);
      }
      // Meta narrative: check Angel Blade requirements and auto-award
      try {
        const narr = getHuntMeta('dads_on_a_hunting_trip_narrative');
        if (narr?.requires && (await metaRequirementsSatisfied(userId, narr.requires))) {
          const resN = await awardHunt(userId, 'dads_on_a_hunting_trip_narrative');
          if (resN.unlocked) {
            const ephemeralN = narr?.visibility === 'ephemeral';
            if (narr?.visibility !== 'silent') {
              const annN = await resolveAnnouncer(narr?.announcer || 'cas', { interaction, channel, announce });
              await annN(narr?.announcer || 'cas', userId, resN.hunt, { ephemeral: ephemeralN });
            }
          }
        }
      } catch {}
    },
  ],
  // Sam rec: search used
  'sam.rec.search.used': [
    async ({ userId, announce, interaction, channel }) => {
      const prog = await incrementHuntProgress(userId, 'research_trip_uses', 1);
      const meta = getHuntMeta('research_trip_uses');
      if (meta?.threshold && prog.progress >= meta.threshold) {
        const res = await awardHunt(userId, 'research_trip_uses');
        if (res.unlocked) {
          const ephemeral = meta?.visibility === 'ephemeral';
          if (meta?.visibility !== 'silent') {
            const ann = await resolveAnnouncer(meta?.announcer || 'sam', { interaction, channel, announce });
            await ann(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
          }
        }
      }
      // Meta narrative: check Angel Blade requirements and auto-award
      try {
        const narr = getHuntMeta('dads_on_a_hunting_trip_narrative');
        if (narr?.requires && (await metaRequirementsSatisfied(userId, narr.requires))) {
          const resN = await awardHunt(userId, 'dads_on_a_hunting_trip_narrative');
          if (resN.unlocked) {
            const ephemeralN = narr?.visibility === 'ephemeral';
            if (narr?.visibility !== 'silent') {
              const annN = await resolveAnnouncer(narr?.announcer || 'cas', { interaction, channel, announce });
              await annN(narr?.announcer || 'cas', userId, resN.hunt, { ephemeral: ephemeralN });
            }
          }
        }
      } catch {}
    },
  ],

  // Dean sprint: check single-sprint total for 5k award
  'dean.sprint.wordcount.check': [
    async ({ userId, sprintTotal, announce, interaction, channel }) => {
      if (sprintTotal >= (getHuntMeta('letters_from_heaven_5k')?.threshold || 5000)) {
        const res = await awardHunt(userId, 'letters_from_heaven_5k');
        if (res.unlocked) {
          const meta = getHuntMeta('letters_from_heaven_5k');
          const ephemeral = meta?.visibility === 'ephemeral';
          if (meta?.visibility !== 'silent') {
            const ann = await resolveAnnouncer(meta?.announcer || 'dean', { interaction, channel, announce });
            try {
              console.log('[hunts DEBUG] dean streak announcer resolved:', {
                hasAnnouncer: typeof ann === 'function',
                bot: meta?.announcer || 'dean',
                channelId: interaction?.channel?.id || channel?.id || null,
              });
              if (typeof ann === 'function') {
                await ann(meta?.announcer || 'dean', userId, res.hunt, { ephemeral });
                console.log('[hunts DEBUG] dean streak announcement attempted');
              } else {
                console.warn('[hunts DEBUG] No announcer function resolved for dean streak');
              }
            } catch (e) {
              console.error('[hunts DEBUG] Announcer call failed for dean streak:', e && e.message ? e.message : e);
            }
          }
        }
      }
    },
  ],
  // Sam profile: first use
  'sam.profile.firstUse': [
    async ({ userId, announce, interaction, channel, forceAnnounce }) => {
      try {
        console.log(`[hunts] sam.profile.firstUse fired for userId=${userId}`);
      } catch {}
      const res = await awardHunt(userId, 'first_profile_use');
      try {
        console.log(`[hunts] awardHunt(first_profile_use) result for userId=${userId}: unlocked=${res?.unlocked} progressId=${res?.progress?.id} unlockedAt=${res?.progress?.unlockedAt}`);
      } catch {}
      if (res.unlocked || forceAnnounce) {
        const meta = getHuntMeta('first_profile_use');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          const ann = await resolveAnnouncer(meta?.announcer || 'sam', { interaction, channel, announce });
          await ann(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
        }
      }
    },
  ],
  // Sam profile: setup complete
  'sam.profile.setupComplete': [
    async ({ userId, announce, interaction, channel }) => {
      const res = await awardHunt(userId, 'profile_setup_complete');
      if (res.unlocked) {
        const meta = getHuntMeta('profile_setup_complete');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          const ann = await resolveAnnouncer(meta?.announcer || 'sam', { interaction, channel, announce });
          await ann(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
        }
      }
    },
  ],

  // Sam profile: poked all settings
  'sam.profile.iPokedIt': [
    async ({ userId, announce, interaction, channel }) => {
      const res = await awardHunt(userId, 'i_poked_it');
      if (res.unlocked) {
        const meta = getHuntMeta('i_poked_it');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          const ann = await resolveAnnouncer(meta?.announcer || 'sam', { interaction, channel, announce });
          await ann(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
        }
      }
    },
  ],
  // Dean team sprint: someone joined, award both host and joiner
  'dean.team.joined': [
    async ({ userId, hostId, announce, interaction, channel }) => {
      for (const uid of [userId, hostId]) {
        if (!uid) continue;
        const res = await awardHunt(uid, 'hunters_network_join');
        if (res.unlocked) {
          const meta = getHuntMeta('hunters_network_join');
          const ephemeral = meta?.visibility === 'ephemeral';
          if (meta?.visibility !== 'silent') {
            const ann = await resolveAnnouncer(meta?.announcer || 'dean', { interaction, channel, announce });
            await ann(meta?.announcer || 'dean', uid, res.hunt, { ephemeral });
          }
        }
      }
    },
  ],
  // Special reaction-based role grant
  'system.reaction.special': [
    async ({ userId, announce, grantRole }) => {
      const res = await awardHunt(userId, 'library_card_guidelines');
      if (res.unlocked) {
        if (announce) {
          const meta = getHuntMeta('library_card_guidelines');
          const ephemeral = meta?.visibility === 'ephemeral';
          if (meta?.visibility !== 'silent') {
            await announce(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
          }
        }
        if (grantRole) await grantRole(userId);
      }
    },
  ],
};

export async function fireTrigger(triggerId, context) {
  const handlers = TRIGGERS[triggerId] || [];
  for (const h of handlers) {
    await h(context);
  }
  // After handlers, evaluate thresholds for milestone-type hunts this trigger may affect
  try {
    const { userId } = context || {};
    if (!userId) return;
    // Map trigger to hunts with thresholds (simple heuristic)
    const relatedKeys = [];
    if (triggerId === 'sam.rec.sent') relatedKeys.push('ten_recs_sent');
    if (triggerId === 'cas.search.used') relatedKeys.push('research_trip_uses');
    // Grace-pop baseline reconciliation: if a hunt defines a baseline, set progress to baseline once
    async function reconcileBaseline(userId, key) {
      const meta = getHuntMeta(key);
      if (!meta || !meta.baseline) return;
      let baselineVal = 0;
      try {
        if (meta.baseline === 'ufm_note_count') {
          const { UserFicMetadata, Config } = await import('../../models/index.js');
          let where = { userID: userId, rec_note: { [Op.ne]: null } };
          if (meta.baselineMode === 'event' && meta.windowConfigKey) {
            try {
              const cfg = await Config.findOne({ where: { key: meta.windowConfigKey } });
              const startIso = cfg && cfg.value ? new Date(cfg.value) : null;
              if (startIso && !isNaN(startIso.getTime())) {
                where = { ...where, createdAt: { [Op.gte]: startIso } };
              }
            } catch {}
          }
          baselineVal = await UserFicMetadata.count({ where });
        }
        // Future baselines can be added here
      } catch (e) {
        console.warn(`[hunts] baseline computation failed for ${key}:`, e);
        return;
      }
      try {
        const prog = await incrementHuntProgress(userId, key, 0);
        // Only reconcile if explicitly historical or event window provided
        const allowReconcile = meta.baselineMode === 'historical' || meta.baselineMode === 'event';
        if (!allowReconcile) return;
        if (prog && typeof prog.progress === 'number' && baselineVal > prog.progress) {
          prog.progress = baselineVal;
          await prog.save();
        }
      } catch (e) {
        console.warn(`[hunts] baseline reconciliation failed for ${key}:`, e);
      }
    }
    // Evaluate each related hunt: if progress >= threshold, award
    for (const key of relatedKeys) {
      const meta = HUNTS.find(h => h.key === key);
      if (!meta || !meta.threshold) continue;
      // Reconcile baseline once before threshold check
      await reconcileBaseline(userId, key);
      const prog = await incrementHuntProgress(userId, key, 0); // fetch current
      try {
        console.log(`[hunts] threshold check key=${key} userId=${userId} progress=${prog?.progress || 0} threshold=${meta.threshold} unlockedAt=${prog?.unlockedAt || 'null'}`);
      } catch {}
      if ((prog?.progress || 0) >= meta.threshold && !prog.unlockedAt) {
        const res = await awardHunt(userId, key);
        try {
          console.log(`[hunts] threshold award key=${key} userId=${userId} unlocked=${res?.unlocked} progressId=${res?.progress?.id}`);
        } catch {}
        if (res.unlocked && context.announce) {
          const meta2 = getHuntMeta(key);
          const ephemeral2 = meta2?.visibility === 'ephemeral';
          if (meta2?.visibility !== 'silent') {
            await context.announce(meta2?.announcer || 'sam', userId, res.hunt, { ephemeral: ephemeral2 });
          }
        }
      }
    }
  } catch (e) {
    console.warn('[hunts] threshold evaluation failed:', e);
  }
}

// Provide a default export to satisfy dynamic imports expecting `.default`
export default fireTrigger;
