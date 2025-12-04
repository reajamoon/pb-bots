import { Collection } from 'discord.js';

/**
 * List custom emojis for a guild.
 * @param {import('discord.js').Client} client - Discord.js client
 * @param {string} guildId - Target guild ID
 * @returns {Promise<Array<{id:string,name:string,animated:boolean,mention:string}>>}
 */
export async function listGuildEmojis(client, guildId, { filter } = {}) {
  const defaultGuildId = guildId || process.env.CAS_GUILD_ID || process.env.SAM_GUILD_ID || process.env.GUILD_ID;
  if (!defaultGuildId) return [];
  const guild = client.guilds.cache.get(defaultGuildId) || await client.guilds.fetch(defaultGuildId).catch(() => null);
  if (!guild) return [];
  const emojis = guild.emojis.cache instanceof Collection ? guild.emojis.cache : new Collection();
  // Ensure cache is populated
  if (emojis.size === 0) {
    try {
      await guild.emojis.fetch();
    } catch {}
  }
  let list = guild.emojis.cache.map(e => ({
    id: e.id,
    name: e.name,
    animated: !!e.animated,
    mention: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`
  }));
  if (filter instanceof RegExp) {
    list = list.filter(e => filter.test(e.name));
  }
  return list;
}

/**
 * Render emojis into a simple text list.
 * @param {Array<{id:string,name:string,animated:boolean,mention:string}>} emojis
 * @returns {string}
 */
export function formatEmojiList(emojis) {
  if (!emojis || emojis.length === 0) return 'No custom emojis found.';
  return emojis
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(e => `${e.mention}  ${e.name} (${e.animated ? 'animated' : 'static'})`)
    .join('\n');
}

/**
 * Build semantic groups by bot names and common keywords.
 * Returns an object with keys { cas, sam, dean, other }.
 */
export function groupEmojisBySemantic(emojis) {
  const groups = { cas: [], sam: [], dean: [], other: [] };
  for (const e of (emojis || [])) {
    const n = e.name.toLowerCase();
    if (n.includes('cas')) groups.cas.push(e);
    else if (n.includes('sam')) groups.sam.push(e);
    else if (n.includes('dean')) groups.dean.push(e);
    else groups.other.push(e);
  }
  return groups;
}

/**
 * Render grouped emojis into sections.
 */
export function formatGroupedEmojiList(groups) {
  const sec = [];
  const push = (title, list) => {
    if (!list || list.length === 0) return;
    sec.push(`**${title}**`);
    sec.push(formatEmojiList(list));
  };
  push('Cas', groups.cas);
  push('Sam', groups.sam);
  push('Dean', groups.dean);
  push('Other', groups.other);
  return sec.join('\n\n');
}
