import { Hunt, HuntProgress } from '../../models/index.js';

export const HUNTS = [
  {
    key: 'first_rec_sent',
    name: 'Baby In A Trench Coat',
    description: 'Send your first recommendation.',
    category: 'community',
    points: 10,
    rarity: 'common',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'ten_recs_sent',
    name: 'Carry On',
    description: 'Send ten recommendations.',
    category: 'community',
    points: 25,
    rarity: 'rare',
    threshold: 10,
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'first_sprint',
    name: "Hunter's Kit",
    description: 'Complete your first Dean sprint.',
    category: 'writing',
    points: 10,
    rarity: 'common',
    announcer: 'dean',
    visibility: 'public',
  },
  {
    key: 'research_trip_uses',
    name: 'Research Trip',
    description: 'Search recommendations ten times.',
    category: 'reading',
    points: 15,
    rarity: 'common',
    threshold: 10,
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'letters_from_heaven_5k',
    name: 'Letters From Heaven',
    description: 'Write 5k words in a sprint.',
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
    description: 'Log 3 consecutive sprint days.',
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
    description: 'Complete a multi-step lore hunt across reading and writing.',
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
    description: 'React to the Rec Guidelines message to get your library card.',
    category: 'library',
    points: 15,
    rarity: 'rare',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'first_profile_use',
    name: 'Hunter Profile',
    description: 'Open or use your profile for the first time.',
    category: 'profile',
    points: 10,
    rarity: 'common',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'profile_setup_complete',
    name: "Hunter's Journal Setup",
    description: 'Fill out your profile essentials to complete setup.',
    category: 'profile',
    points: 20,
    rarity: 'rare',
    announcer: 'sam',
    visibility: 'public',
  },
  {
    key: 'hunters_network_join',
    name: "Hunter's Network",
    description: 'Connect to the Hunter’s Network (join a team sprint).',
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
  const hunt = await Hunt.findByPk(key);
  if (!hunt) throw new Error(`Unknown hunt: ${key}`);
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

export async function incrementHuntProgress(userId, key, amount = 1) {
  const hunt = await Hunt.findByPk(key);
  if (!hunt) throw new Error(`Unknown hunt: ${key}`);
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
