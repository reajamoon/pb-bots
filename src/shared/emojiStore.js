/**
 * Centralized custom emoji store for the single-guild workspace.
 *
 * Loads guild emojis once and provides stable lookups by canonical names.
 * Use this to replace default emojis in user-facing messages across bots.
 */
import { Collection } from 'discord.js';

const EMOJI_CACHE = {
  guildId: null,
  byId: new Map(),
  byName: new Map(),
  loadedAt: null
};

/**
 * Normalize emoji names for lookup consistency.
 * - Lowercase
 * - Strip common prefixes like `PB__`
 * - Replace spaces/underscores with single underscores
 */
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^pb__/, '')
    .replace(/\s+/g, '_')
    .replace(/__+/g, '_');
}

/**
 * Initialize emoji store by fetching emojis from the single configured guild.
 * Reads guild id from `CAS_GUILD_ID`, `SAM_GUILD_ID`, or `GUILD_ID`.
 */
export async function initEmojiStore(client, guildId) {
  const defaultGuildId = guildId || process.env.CAS_GUILD_ID || process.env.SAM_GUILD_ID || process.env.GUILD_ID;
  if (!defaultGuildId) return false;
  const guild = client.guilds.cache.get(defaultGuildId) || await client.guilds.fetch(defaultGuildId).catch(() => null);
  if (!guild) return false;
  // Populate cache
  try {
    await guild.emojis.fetch();
  } catch {}
  const coll = guild.emojis.cache instanceof Collection ? guild.emojis.cache : new Collection();
  EMOJI_CACHE.guildId = defaultGuildId;
  EMOJI_CACHE.byId.clear();
  EMOJI_CACHE.byName.clear();
  coll.forEach(e => {
    const info = {
      id: e.id,
      name: e.name,
      normalized: normalizeName(e.name),
      animated: !!e.animated,
      mention: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`
    };
    EMOJI_CACHE.byId.set(e.id, info);
    EMOJI_CACHE.byName.set(info.normalized, info);
  });
  EMOJI_CACHE.loadedAt = Date.now();
  return true;
}

/**
 * Get an emoji by canonical (normalized) name.
 * Falls back to a provided default string if not found.
 * @param {string} name
 * @param {string} fallback Optional fallback, e.g., "🤗"
 */
export function emoji(name, fallback = '') {
  const key = normalizeName(name);
  const entry = EMOJI_CACHE.byName.get(key);
  return entry ? entry.mention : fallback;
}

/**
 * Utility to check if the store is initialized.
 */
export function emojiStoreReady() {
  return EMOJI_CACHE.byName.size > 0;
}

/**
 * Convenience: common emoji aliases used across bots.
 * Add or adjust these names to your hand-drawn set.
 */
export const EMOJIS = {
  // Animated hugstiel (Cas hug) example: PB__aHugstiel
  cas_hug: 'ahugstiel',
  // Common faces or reactions
  sam_ok: 'sam_ok',
  dean_wtf: 'dean_wtf',
  jack_smile: 'jack_smile',
  // Status
  check: 'check',
  lock: 'lock'
};

// Cas-focused aliases (normalized names)
// Static
EMOJIS.cas_blep = 'casblep';
EMOJIS.cas_blush = 'casblush';
EMOJIS.cas_dom = 'casdom';
EMOJIS.cas_headtilt = 'casheadtilt';
EMOJIS.cas_halo = 'cashalo';
EMOJIS.cas_kiss = 'caskiss';
EMOJIS.cas_levi = 'caslevi';
EMOJIS.cas_lol = 'caslol';
EMOJIS.cas_shadeslol = 'casshadeslol';
EMOJIS.cas_smite = 'cassmite';
// Animated (prefix 'a')
EMOJIS.a_bongo_sob = 'abongosob';
EMOJIS.a_cas_blep = 'acasblep';
EMOJIS.a_cas_hearts_rainbow = 'acasheartsrainbow';
EMOJIS.a_cas_kiss_rainbow = 'acaskissrainbow';
EMOJIS.a_cas_nom = 'acasnom';
EMOJIS.a_cas_pap = 'acaspap';
EMOJIS.a_cas_sob_rainbow = 'acassobrainbow';
EMOJIS.a_cas_sob_blood = 'acassobblood';
EMOJIS.a_cas_wtf_zoom_eyes = 'acaswtfzoomeyes';
EMOJIS.a_cas_fetti = 'acasfetti';
EMOJIS.a_bongo_hearts = 'abongohearts';
EMOJIS.a_bongo_blade = 'abongoblade';
// PB__ prefixed (normalize strips pb__)
EMOJIS.cas_tea = 'teacas';
EMOJIS.cas_excuseyou = 'excuseyou';
EMOJIS.cas_empty_take_me_now = 'emptytakemenow';
EMOJIS.cas_bot = 'casbot';

// Misc alias set (neutral)
EMOJIS.kudos_100 = '100kudos';
EMOJIS.cope_100 = '100cope';
EMOJIS.hugstiel = 'ahugstiel';
EMOJIS.i_love_pb = 'ailovepb';
EMOJIS.welcome = 'awelcome';
EMOJIS.destiel = 'adestiel';
EMOJIS.salt_shaker = 'asalt';
EMOJIS.boot = 'boot';
EMOJIS.bullet_1 = 'bullet1';
EMOJIS.bullet_2 = 'bullet2';
EMOJIS.burn = 'burn';
EMOJIS.destiel_heart = 'destielheart';
EMOJIS.hug_destiel = 'hugdestiel';
EMOJIS.important = 'important';
EMOJIS.handprint = 'handprint';
EMOJIS.loving_broom = 'lovingbroom';
EMOJIS.molotov = 'molotov';
EMOJIS.pompom = 'pompom';
EMOJIS.pie = 'pie';
EMOJIS.pink_panties = 'pinkpanties';
EMOJIS.pbj_heart = 'pbj_heart';
EMOJIS.salt = 'salt';
EMOJIS.salty_pls = 'saltypls';
EMOJIS.ship_destiel = 'shipdestiel';
EMOJIS.wings = 'wings';
EMOJIS.wings_cas = 'wingscas';
EMOJIS.wings_rainbow = 'wingsrainbow';
EMOJIS.ao3_no = 'ao3_no';
EMOJIS.ao3_yes = 'ao3_yes';
EMOJIS.cat_femslash = 'cat_femslash';
EMOJIS.cat_gen = 'cat_gen';
EMOJIS.cat_het = 'cat_het';
EMOJIS.cat_multi = 'cat_multi';
EMOJIS.cat_other = 'cat_other';
EMOJIS.cat_slash = 'cat_slash';
EMOJIS.cuntdown_1 = 'cuntdown1';
EMOJIS.cuntdown_2 = 'cuntdown2';
EMOJIS.cuntdown_3 = 'cuntdown3';
EMOJIS.rating_explicit = 'ratingexplicit';
EMOJIS.rating_general = 'ratinggeneral';
EMOJIS.rating_mature = 'ratingmature';
EMOJIS.rating_teen = 'ratingteen';
EMOJIS.warn_external = 'warn_external';
EMOJIS.warn_maybe = 'warn_maybe';
EMOJIS.warn_yes = 'warn_yes';

// Dean-focused aliases (normalized names)
// PB__ prefixed (normalize strips pb__)
EMOJIS.dean_fuck = 'fuck';
EMOJIS.dean_zoinks = 'zoinks';
EMOJIS.a_dean_spit = 'adeanspit';
EMOJIS.dean_bot = 'deanbot';
EMOJIS.dean_gay_loading = 'gayloading';
EMOJIS.dean_doing_amazing_sweetie = 'doingamazingsweetie';
EMOJIS.dean_judging_you = 'judgingyou';
EMOJIS.dean_tea_jensen = 'teajensen';
EMOJIS.dean_uhhhhh = 'uhhhhh';
EMOJIS.dean_unff = 'unff';
// Animated (prefix 'a')
EMOJIS.a_bongo_pie = 'abongopie';
EMOJIS.a_dean_blep = 'adeanblep';
EMOJIS.a_dean_bonk = 'adeanbonk';
EMOJIS.a_dean_chef_kiss = 'adeanchefkiss';
EMOJIS.a_dean_morning = 'adeanmorning';
EMOJIS.a_dean_nod = 'adeannod';
EMOJIS.a_dean_nom_pie = 'adeannompie';
EMOJIS.a_dean_rage = 'adeanrage';
EMOJIS.a_dean_sweat = 'adeansweat';
EMOJIS.a_dean_zoom_eyes_right = 'adeanzoomeyesright';
// Static Dean set
EMOJIS.dean_drool = 'deandrool';
EMOJIS.dean_fuck_off = 'deanfuckoff';
EMOJIS.dean_heart = 'deanheart';
EMOJIS.dean_kiss = 'deankiss';
EMOJIS.dean_lol = 'deanlol';
EMOJIS.dean_nosebleed = 'deannosebleed';
EMOJIS.dean_shade = 'deanshade';
EMOJIS.dean_shades = 'deanshades';
EMOJIS.dean_shades_cry = 'deanshadescry';
EMOJIS.dean_shades_panic = 'deanshadespanic';
EMOJIS.dean_tear = 'deantear';
EMOJIS.demon_dean = 'demondean';

// Sam-focused aliases
EMOJIS.sam_bitchface = 'bitchface';
EMOJIS.sam_live_laugh_love = 'livelaughlove';
EMOJIS.sam_is_done = 'samisdone';
EMOJIS.sam_on_demon_blood_again = 'sammysonthedemonbloodagain';
EMOJIS.sam_bot = 'sambot';
EMOJIS.sam_schniff = 'schniff';
EMOJIS.sam_tea_jared = 'teajared';
EMOJIS.a_sam_bongo_salad = 'asambongosalad';
EMOJIS.a_sam_salad_smash = 'asamsaladsmash';
EMOJIS.a_sam_shipper = 'asamshipper';
EMOJIS.a_sam_smooch = 'asamsmooch';
EMOJIS.sam_goodbye = 'samgoodbye';
EMOJIS.sam_my_salad = 'samMYSALAD';
EMOJIS.sam_grimace = 'samgrimmace';
EMOJIS.sam_heart = 'samheart';
EMOJIS.sam_kiss = 'samkiss';
EMOJIS.sam_lol = 'samlol';
EMOJIS.sam_nerd = 'samnerd';
EMOJIS.sam_party_city = 'sampartycity';
EMOJIS.sam_shades = 'samshades';
EMOJIS.sam_shipper = 'samshipper';
EMOJIS.sam_thunk = 'samthunk';
EMOJIS.sam_unamoosed = 'samunamoosed';
EMOJIS.sam_anime = 'sanime';

// Jack-focused aliases
EMOJIS.a_jack_party = 'ajackparty';
EMOJIS.a_jack_nom_cookie2 = 'ajacknomcookie2';
EMOJIS.a_jack_nom_cookie = 'ajacknomcookie';
EMOJIS.a_jack_nom_books = 'ajacknombooks';
EMOJIS.a_jack_cocaine = 'ajackcocaine';
EMOJIS.a_jack_cheer = 'ajackcheer';
EMOJIS.jack_hello = 'jackhello';
EMOJIS.jack_belph = 'jackbelph';
EMOJIS.jack_shades = 'jackshades';
EMOJIS.jack_uwu = 'jackuwu';
