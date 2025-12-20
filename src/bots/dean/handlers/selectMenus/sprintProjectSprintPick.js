import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { Op } from 'sequelize';
import { DeanSprints, Project, ProjectMember } from '../../../../models/index.js';
import { getInteractionState, deleteInteractionState, setInteractionState } from '../../utils/interactionState.js';
import { formatSprintIdentifier } from '../../text/sprintText.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

function makeToken(length = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function extractPublicId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const match = str.match(/\b([A-Za-z0-9]{2,24}-\d{3})\b/);
  if (!match) return null;
  return match[1].toUpperCase();
}

async function getUserProjects(discordId) {
  const owned = await Project.findAll({ where: { ownerId: discordId }, limit: 100 }).catch(() => []);
  const memberships = await ProjectMember.findAll({ where: { userId: discordId }, limit: 200 }).catch(() => []);
  const memberProjectIds = [...new Set(memberships.map(m => m.projectId).filter(Boolean))];
  const memberProjects = memberProjectIds.length
    ? await Project.findAll({ where: { id: { [Op.in]: memberProjectIds } }, limit: 200 }).catch(() => [])
    : [];
  const byId = new Map();
  for (const p of [...owned, ...memberProjects]) {
    if (p?.id) byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

async function resolveProjectFromInput({ discordId, projectInputRaw }) {
  if (!projectInputRaw) return null;
  const projectInput = String(projectInputRaw).trim();
  if (!projectInput) return null;

  const uuidMatch = projectInput.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
    const p = await Project.findByPk(uuidMatch[0]).catch(() => null);
    if (p) {
      const member = await ProjectMember.findOne({ where: { projectId: p.id, userId: discordId } }).catch(() => null);
      if (member || p.ownerId === discordId) return p;
    }
  }

  const publicId = extractPublicId(projectInput);
  if (publicId) {
    const p = await Project.findOne({ where: { publicId } }).catch(() => null);
    if (p) {
      const member = await ProjectMember.findOne({ where: { projectId: p.id, userId: discordId } }).catch(() => null);
      if (member || p.ownerId === discordId) return p;
    }
  }

  const owned = await Project.findOne({ where: { ownerId: discordId, name: projectInput } }).catch(() => null);
  if (owned) return owned;

  const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'project' }] }).catch(() => []);
  const joined = memberships.map(m => m.project).find(p => p?.name === projectInput) || null;
  return joined;
}

export async function execute(interaction) {
  const customId = interaction.customId || '';
  const parts = customId.split('_');
  const token = parts.length > 1 ? parts.slice(1).join('_') : '';

  if (!token) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'That picker is missing context. Try the command again.', flags: EPHEMERAL_FLAG });
    }
    return;
  }

  const state = getInteractionState(token);
  if (!state || state.userId !== interaction.user.id) {
    await interaction.reply({ content: 'That picker is stale. Run the command again.', flags: EPHEMERAL_FLAG });
    return;
  }
  deleteInteractionState(token);

  const picked = interaction.values?.[0];
  const pickedId = Number(picked);
  if (!Number.isFinite(pickedId)) {
    await interaction.reply({ content: 'That selection did not look right. Try again.', flags: EPHEMERAL_FLAG });
    return;
  }

  const sprint = await DeanSprints.findByPk(pickedId).catch(() => null);
  if (!sprint || sprint.guildId !== state.guildId || sprint.userId !== state.userId || sprint.status !== 'processing') {
    await interaction.reply({ content: 'I cannot find that sprint entry anymore. Try the command again.', flags: EPHEMERAL_FLAG });
    return;
  }

  const sprintIdentifier = formatSprintIdentifier({ type: sprint.type, groupId: sprint.groupId, label: sprint.label, startedAt: sprint.startedAt });

  if (state.sprintProjectVerb === 'clear') {
    await sprint.update({ projectId: null });
    await interaction.update({ content: `Alright. Unlinked: ${sprintIdentifier}`, components: [], allowedMentions: { parse: [] } });
    return;
  }

  // Verb: use
  const projectInputRaw = state.projectInputRaw;
  const resolved = await resolveProjectFromInput({ discordId: state.userId, projectInputRaw });
  if (resolved) {
    await sprint.update({ projectId: resolved.id });
    await interaction.update({ content: `Alright. Linked: ${sprintIdentifier}\nProject: **${resolved.name}**`, components: [], allowedMentions: { parse: [] } });
    return;
  }

  const projects = await getUserProjects(state.userId);
  if (!projects.length) {
    await interaction.update({ content: "You don't have any projects yet. Make one with `/project create`.", components: [], allowedMentions: { parse: [] } });
    return;
  }

  const nextToken = makeToken();
  setInteractionState(nextToken, {
    guildId: state.guildId,
    userId: state.userId,
    sprintProjectVerb: 'use',
    sprintId: sprint.id,
  });

  const select = new Discord.StringSelectMenuBuilder()
    .setCustomId(`sprintProjectProjectPick_${nextToken}`)
    .setPlaceholder('Pick a project')
    .setMinValues(1)
    .setMaxValues(1);

  for (const p of projects.slice(0, 25)) {
    select.addOptions(
      new Discord.StringSelectMenuOptionBuilder()
        .setLabel(String(p.name || 'Unnamed project').slice(0, 100))
        .setDescription(String(p.publicId || p.id).slice(0, 100))
        .setValue(String(p.id))
    );
  }

  const row = new Discord.ActionRowBuilder().addComponents(select);
  await interaction.update({ content: `Which project for ${sprintIdentifier}?`, components: [row], allowedMentions: { parse: [] } });
}

export default { execute };
