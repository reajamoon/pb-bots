import Discord from 'discord.js';
const { SlashCommandBuilder, EmbedBuilder } = Discord;
import { listUserHunts, isHuntUnlocked, HUNTS } from '../../../shared/hunts/registry.js';
import { renderHunterCardPNG } from '../../../shared/hunts/cardRenderer.js';
import { AttachmentBuilder } from 'discord.js';

function computeTotals(progressRows) {
  let points = 0;
  const completed = [];
  for (const row of progressRows) {
    if (row.unlockedAt && row.hunt) {
      points += row.hunt.points || 0;
      completed.push(row.hunt.name);
    }
  }
  return { points, completed };
}

async function getNarrativeProgress(userId) {
  const narratives = HUNTS.filter(h => h.type === 'narrative');
  const items = [];
  for (const n of narratives) {
    const unlocked = await isHuntUnlocked(userId, n.key);
    if (unlocked) {
      items.push({ name: n.name, status: 'completed' });
      continue;
    }
    const reqs = Array.isArray(n.requires) ? n.requires : [];
    let done = 0;
    for (const r of reqs) {
      const ok = await isHuntUnlocked(userId, r);
      if (ok) done += 1;
    }
    items.push({ name: n.name, status: 'ongoing', done, total: reqs.length });
  }
  return items;
}

export default {
  data: new SlashCommandBuilder()
    .setName('hunts')
    .setDescription('Show your Hunter Card: points, completed hunts, and ongoing narratives')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('View hunts for another user')
        .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    // Fetch guild-specific member for server avatar preference
    let member = null;
    try {
      const guild = interaction.guild;
      if (guild) {
        member = await guild.members.fetch(targetUser.id).catch(() => null);
      }
    } catch {}
    await interaction.deferReply();
    const progressRows = await listUserHunts(targetUser.id);
    const { points, completed } = computeTotals(progressRows);
    const narratives = await getNarrativeProgress(targetUser.id);

    // Removed embed; only send generated hunter card PNG

    // Narrative info is rendered inside the PNG via cardRenderer

    // Try to render PNG badge; fallback to embed if renderer fails
    try {
      const buffer = await renderHunterCardPNG({
        user: targetUser,
        member,
        points,
        completed,
        narratives,
      });
      const attachment = new AttachmentBuilder(buffer, { name: 'hunter-card.png' });
      await interaction.editReply({ files: [attachment] });
    } catch (e) {
      // Fallback: minimal text if renderer fails
      await interaction.editReply({ content: `Here is your Hunter Card, <@${targetUser.id}>. (PNG renderer failed)` });
    }
  }
};
