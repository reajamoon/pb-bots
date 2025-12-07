import { awardHunt, incrementHuntProgress, HUNTS, getHuntMeta } from './registry.js';
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
      if (res.unlocked) {
        const meta = getHuntMeta('first_rec_sent');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          const ann = await resolveAnnouncer(meta?.announcer || 'sam', { interaction, channel, announce });
          await ann(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
        }
      }
      await incrementHuntProgress(userId, 'ten_recs_sent', 1);
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
      if (res.unlocked) {
        const meta = getHuntMeta('first_sprint');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          const ann = await resolveAnnouncer(meta?.announcer || 'dean', { interaction, channel, announce });
          await ann(meta?.announcer || 'dean', userId, res.hunt, { ephemeral });
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
          where: { userId, status: 'done', updatedAt: { $between: [startWindow, endWindow] } },
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
            await ann(meta?.announcer || 'dean', userId, res.hunt, { ephemeral });
          }
        }
      }
    },
  ],
  // Sam profile: first use
  'sam.profile.firstUse': [
    async ({ userId, announce, interaction, channel }) => {
      const res = await awardHunt(userId, 'first_profile_use');
      if (res.unlocked) {
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
      if (res.unlocked && announce) {
        const meta = getHuntMeta('library_card_guidelines');
        const ephemeral = meta?.visibility === 'ephemeral';
        if (meta?.visibility !== 'silent') {
          await announce(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
        }
      }
      if (grantRole) await grantRole(userId);
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
    // Evaluate each related hunt: if progress >= threshold, award
    for (const key of relatedKeys) {
      const meta = HUNTS.find(h => h.key === key);
      if (!meta || !meta.threshold) continue;
      const prog = await incrementHuntProgress(userId, key, 0); // fetch current
      if ((prog?.progress || 0) >= meta.threshold && !prog.unlockedAt) {
        const res = await awardHunt(userId, key);
        if (res.unlocked && context.announce) {
          const meta = getHuntMeta(key);
          const ephemeral = meta?.visibility === 'ephemeral';
          if (meta?.visibility !== 'silent') {
            await context.announce(meta?.announcer || 'sam', userId, res.hunt, { ephemeral });
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
