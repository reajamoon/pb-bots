import { Hunt, HuntProgress } from '../../models/index.js';

export const HUNTS = [
  {
    key: 'first_rec_sent',
    name: 'Baby In A Trench Coat',
    description: 'Sent your first recommendation.',
    category: 'community',
    points: 10,
    rarity: 'common',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'ten_recs_sent',
    name: 'Carry On',
    description: 'Sent ten recommendations.',
    category: 'community',
    points: 25,
    rarity: 'rare',
    threshold: 10,
    announcer: 'sam',
    visibility: 'public',
    baseline: 'ufm_note_count',
    baselineMode: 'event', // apply within event window; fresh = since event start
    // Optional Config key providing the event window start ISO timestamp
    windowConfigKey: 'hunts_event_start_rec',
  },
  {
    key: 'first_sprint',
    name: "The Whistle Makes Me Their God.",
    description: 'Completed your first sprint.',
    category: 'writing',
    points: 10,
    rarity: 'common',
    announcer: 'dean',
    visibility: 'public',
  },
  {
    key: 'research_trip_uses',
    name: 'Research Trip',
    description: 'Searched recommendations ten times.',
    category: 'reading',
    points: 15,
    rarity: 'common',
    threshold: 10,
    announcer: 'sam',
    visibility: 'public',
    // baseline could be wired to historical search logs when available
    baseline: null,
    baselineMode: null, // default: start fresh; no historical reconciliation
  },
  {
    key: 'letters_from_heaven_5k',
    name: 'Letters From Heaven',
    description: 'Wrote 5k words in sprints.',
    category: 'writing',
    points: 30,
    rarity: 'rare',
    threshold: 5000,
    announcer: 'dean',
    visibility: 'public',
  },
  {
    key: 'heat_of_the_moment_streak3',
    name: 'Heat Of The Moment',
    description: 'Logged 3 consecutive sprint days.',
    category: 'writing',
    points: 25,
    rarity: 'rare',
    threshold: 3,
    type: 'streak',
    announcer: 'dean',
    visibility: 'public',
  },
  {
    key: 'dads_on_a_hunting_trip_narrative',
    name: "Dad's on a Hunting Trip...",
    description: 'Completed a multi-step lore hunt Reading, writing, and research.',
    category: 'lore',
    points: 50,
    rarity: 'legendary',
    hidden: true,
    type: 'narrative',
    announcer: 'cas',
    visibility: 'public',
    // Meta achievement: requires other hunts to be unlocked
    requires: ['research_trip_uses', 'first_rec_sent', 'first_sprint'],
  },
  {
    key: 'library_card_guidelines',
    name: 'Library Card',
    description: 'Reacted to the Rec Guidelines message & got your <@&1446947028172148847>!\nYou can use the `/rec add` and `/rec update` commands in #fic-recs with this!',
    category: 'library',
    points: 15,
    rarity: 'rare',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'first_profile_use',
    name: 'Hunter Profile',
    description: "Opened your Profile for the first time.",
    category: 'profile',
    points: 10,
    rarity: 'common',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'profile_setup_complete',
    name: "Hunter's Journal Setup",
    description: 'Filled out your profile essentials.',
    category: 'profile',
    points: 20,
    rarity: 'rare',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'i_poked_it',
    name: 'I poked it.',
    description: 'Toggled or set every Profile and Privacy setting at least once.',
    category: 'profile',
    points: 50,
    rarity: 'legendary',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'hunters_network_join',
    name: "Hunter's Network",
    description: 'Connected to the Hunter’s Network (join a team sprint).',
    category: 'community',
    points: 20,
    rarity: 'rare',
    announcer: 'dean',
    visibility: 'public',
  },
];

export async function ensureHuntsSeeded() {
  for (const h of HUNTS) {
    const existing = await Hunt.findByPk(h.key);
    if (!existing) {
      await Hunt.create({
        key: h.key,
        name: h.name,
        description: h.description,
        category: h.category,
        points: h.points ?? 0,
        hidden: !!h.hidden,
      });
    }
  }
}

export async function awardHunt(userId, key) {
  let hunt = await Hunt.findByPk(key);
  if (!hunt) {
    const meta = HUNTS.find(h => h.key === key);
    if (!meta) throw new Error(`Unknown hunt: ${key}`);
    // Lazily seed missing hunt row based on meta
    hunt = await Hunt.create({
      key: meta.key,
      name: meta.name,
      description: meta.description,
      category: meta.category,
      points: meta.points ?? 0,
      hidden: !!meta.hidden,
    });
  }
  const [prog] = await HuntProgress.findOrCreate({
    where: { userId, huntKey: key },
    defaults: { userId, huntKey: key, progress: 0 },
  });
  if (!prog.unlockedAt) {
    prog.unlockedAt = new Date();
    prog.progress = 1;
    await prog.save();
    return { unlocked: true, hunt };
  }
  return { unlocked: false, hunt };
}

// Force-complete a hunt: sets unlockedAt if the row exists but is not finished
export async function forceCompleteHunt(userId, key) {
  const prog = await HuntProgress.findOne({ where: { userId, huntKey: key } });
  if (!prog) {
    // If no row, delegate to awardHunt which seeds and unlocks
    return awardHunt(userId, key);
  }
  if (!prog.unlockedAt) {
    prog.unlockedAt = new Date();
    if (!prog.progress || prog.progress < 1) prog.progress = 1;
    await prog.save();
    return { unlocked: true };
  }
  return { unlocked: false };
}

export async function incrementHuntProgress(userId, key, amount = 1) {
  let hunt = await Hunt.findByPk(key);
  if (!hunt) {
    const meta = HUNTS.find(h => h.key === key);
    if (!meta) throw new Error(`Unknown hunt: ${key}`);
    // Lazily seed missing hunt row based on meta (align with awardHunt)
    hunt = await Hunt.create({
      key: meta.key,
      name: meta.name,
      description: meta.description,
      category: meta.category,
      points: meta.points ?? 0,
      hidden: !!meta.hidden,
    });
  }
  const [prog] = await HuntProgress.findOrCreate({
    where: { userId, huntKey: key },
    defaults: { userId, huntKey: key, progress: 0 },
  });
  prog.progress += amount;
  await prog.save();
  return prog;
}

export async function listUserHunts(userId) {
  return HuntProgress.findAll({
    where: { userId },
    include: [{ model: Hunt, as: 'hunt' }],
    order: [['unlockedAt', 'DESC'], ['updatedAt', 'DESC']],
  });
}

export async function isHuntUnlocked(userId, key) {
  const prog = await HuntProgress.findOne({ where: { userId, huntKey: key } });
  return !!(prog && prog.unlockedAt);
}

export function getHuntMeta(key) {
  return HUNTS.find(h => h.key === key);
}
