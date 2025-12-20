import Discord from 'discord.js';
const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = Discord;
import { Op } from 'sequelize';
import { DeanSprints, GuildSprintSettings, User, Project, ProjectMember, Wordcount } from '../../../models/index.js';

import { formatSprintIdentifier } from '../text/sprintText.js';
import { setInteractionState } from '../utils/interactionState.js';

import { sumNet } from '../../../shared/utils/wordcountMath.js';

import fs from 'fs';
import path from 'path';

function loadProjectPublicIdWords() {
  try {
    const filePath = path.resolve(process.cwd(), 'config', 'projectPublicIdWords.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [];
    return parsed
      .map(w => String(w || '').trim().toUpperCase())
      .filter(w => w && /^[A-Z0-9]{2,24}$/.test(w));
  } catch (e) {
    return [];
  }
}

const PROJECT_PUBLIC_ID_WORDS = loadProjectPublicIdWords();

function makeToken(length = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function buildActiveSprintCandidates(rows) {
  const nowMs = Date.now();
  const candidates = rows.map(row => {
    const startsAtMs = row.startedAt ? new Date(row.startedAt).getTime() : nowMs;
    const endsAtMs = startsAtMs + (Number(row.durationMinutes) || 0) * 60000;
    return { row, endsAtMs };
  });
  // Spec: team first, then solo; within group soonest ending first.
  candidates.sort((a, b) => {
    const aTeam = a.row.type === 'team' ? 0 : 1;
    const bTeam = b.row.type === 'team' ? 0 : 1;
    if (aTeam !== bTeam) return aTeam - bTeam;
    return a.endsAtMs - b.endsAtMs;
  });
  return candidates;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad3(n) {
  const s = String(n);
  if (s.length >= 3) return s.slice(-3);
  return s.padStart(3, '0');
}

function makePublicIdCandidate() {
  const words = PROJECT_PUBLIC_ID_WORDS.length ? PROJECT_PUBLIC_ID_WORDS : ['PROJECT'];
  const word = words[randInt(0, words.length - 1)];
  const num = pad3(randInt(0, 999));
  return `${word}-${num}`;
}

function extractPublicId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const match = str.match(/\b([A-Za-z0-9]{2,24}-\d{3})\b/);
  if (!match) return null;
  return match[1].toUpperCase();
}

async function ensureProjectHasPublicId(project) {
  if (!project || project.publicId) return project;
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = makePublicIdCandidate();
    const existing = await Project.findOne({ where: { publicId: candidate } }).catch(() => null);
    if (existing) continue;
    try {
      await project.update({ publicId: candidate });
      return project;
    } catch (e) {
      continue;
    }
  }
  return project;
}

async function canAccessProject({ discordId, project }) {
  if (!project) return false;
  if (project.ownerId === discordId) return true;
  const member = await ProjectMember.findOne({ where: { projectId: project.id, userId: discordId } }).catch(() => null);
  return Boolean(member);
}

async function resolveProjectForUser({ discordId, projectInputRaw }) {
  const input = String(projectInputRaw || '').trim();
  if (!input) return null;

  // Try UUID
  const uuidMatch = input.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
    const p = await Project.findByPk(uuidMatch[0]).catch(() => null);
    if (p && await canAccessProject({ discordId, project: p })) return p;
  }

  // Try publicId
  const publicId = extractPublicId(input);
  if (publicId) {
    const p = await Project.findOne({ where: { publicId } }).catch(() => null);
    if (p && await canAccessProject({ discordId, project: p })) return p;
  }

  // Try exact name: owned first, then membership list
  const owned = await Project.findOne({ where: { ownerId: discordId, name: input } }).catch(() => null);
  if (owned) return owned;

  const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'project' }] }).catch(() => []);
  return memberships.map(m => m.project).find(p => p?.name === input) || null;
}

export const data = new SlashCommandBuilder()
  .setName('project')
  .setDescription('Manage writing projects and collaborators')
  .addSubcommand(sub => sub
    .setName('create')
    .setDescription('Create a new project')
    .addStringOption(opt => opt.setName('name').setDescription('Project name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('info')
    .setDescription('Show details and recent totals for a project')
    .addStringOption(opt => opt.setName('project').setDescription('Project code, ID, or Name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List your projects'))
  .addSubcommand(sub => sub
    .setName('invite')
    .setDescription('Invite a member to your project')
    .addUserOption(opt => opt.setName('member').setDescription('User to invite').setRequired(true))
    .addStringOption(opt => opt.setName('project').setDescription('Project code, ID, or Name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove a member from your project')
    .addUserOption(opt => opt.setName('member').setDescription('User to remove').setRequired(true))
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm removal')))
  .addSubcommand(sub => sub
    .setName('transfer')
    .setDescription('Transfer project ownership to a member')
    .addUserOption(opt => opt.setName('member').setDescription('New owner').setRequired(true))
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm transfer')))
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Leave the current project')
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm leave')))
  .addSubcommand(sub => sub
    .setName('use')
    .setDescription('Use a project for your active sprint')
    .addStringOption(opt => opt.setName('project').setDescription('Project code, ID, or Name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('members')
    .setDescription('List project members'))
  .addSubcommandGroup(group => group
    .setName('wc')
    .setDescription('Manage a project wordcount directly')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add words directly to a project (outside a sprint)')
      .addIntegerOption(opt => opt.setName('new-words').setDescription('Words added (positive)').setRequired(true))
      .addStringOption(opt => opt.setName('project').setDescription('Project code, ID, or Name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set your current wordcount for a project (outside a sprint)')
      .addIntegerOption(opt => opt.setName('count').setDescription('Current wordcount').setRequired(true))
      .addStringOption(opt => opt.setName('project').setDescription('Project code, ID, or Name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('show')
      .setDescription('Show your current project wordcount (outside a sprint)')
      .addStringOption(opt => opt.setName('project').setDescription('Project code, ID, or Name').setRequired(true)))
  )

export async function execute(interaction) {
  try {
    const guildId = interaction.guildId;
    const subName = interaction.options.getSubcommand();
    const subGroup = interaction.options.getSubcommandGroup(false);
    const discordId = interaction.user.id;

    // Ensure user row exists
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Default defer to avoid timeouts; keep all replies public
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    // Helper to robustly extract a UUID from user input (handles trailing punctuation)
    function extractUuid(input) {
      if (!input) return null;
      const str = String(input).trim();
      const match = str.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
      return match ? match[0] : null;
    }

    if (subName === 'create') {
      const name = interaction.options.getString('name');
      let project = await Project.create({ ownerId: discordId, name });
      project = await ensureProjectHasPublicId(project);
      await ProjectMember.create({ projectId: project.id, userId: discordId, role: 'owner' });
      return interaction.editReply({ content: `Done. Project **${name}** is live. Code: **${project.publicId || project.id}**.` });
    }

    if (subName === 'info') {
      const projectInputRaw = interaction.options.getString('project');
      const uuid = extractUuid(projectInputRaw);
      const projectInput = projectInputRaw?.trim();
      // If no argument, return all projects owned or joined by user
      if (!projectInput) {
        // Get all owned projects
        const ownedProjects = await Project.findAll({ where: { ownerId: discordId } });
        // Get all joined projects (excluding owned)
        const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'project' }] });
        const joinedProjects = memberships.map(m => m.project).filter(p => p && p.ownerId !== discordId);
        const allProjects = [...ownedProjects, ...joinedProjects];
        if (allProjects.length === 0) {
          return interaction.editReply({ content: "You don’t have any projects yet. Spin one up with `/project create`." });
        }
        // Build a summary embed listing all projects
        const Discord = await import('discord.js');
        const { EmbedBuilder } = Discord;
        const embed = new EmbedBuilder()
          .setTitle('Your Projects')
          .setDescription('All projects you own or have joined.')
          .setColor(0x5865F2)
          .addFields(
            ...allProjects.map(p => ({
              name: p.name,
              value: `Code: ${p.publicId || p.id}\nOwner: ${p.ownerId === discordId ? 'You' : p.ownerId}\nCreated: <t:${Math.floor(new Date(p.createdAt).getTime() / 1000)}:F>`
            }))
          );
        return interaction.editReply({ embeds: [embed] });
      }
      let project = null;
      if (uuid) project = await Project.findByPk(uuid);
      if (!project) project = await resolveProjectForUser({ discordId, projectInputRaw: projectInput });
      if (!project) {
        return interaction.editReply({ content: "Nope. Can’t find that project. Try `/project list`." });
      }
      project = await ensureProjectHasPublicId(project);
      const members = await ProjectMember.findAll({ where: { projectId: project.id } });
      const ownerTag = interaction.client.users.cache.get(project.ownerId)?.tag ?? project.ownerId;
      const activeSprints = await DeanSprints.findAll({ where: { projectId: project.id, status: 'processing' }, order: [['startedAt', 'DESC']], limit: 10 }).catch(() => []);
      const activeSprintCount = activeSprints.length;
      const channelIds = [...new Set(activeSprints.map(s => s.channelId).filter(Boolean))];
      const channelMention = channelIds.length === 1 ? `<#${channelIds[0]}>` : null;
      const mods = members.filter(m => m.role === 'mod').length;
      // Recent totals: last sprint totals + last 7 days aggregate
      let lastSprintTotal = 0;
      const lastSprint = await DeanSprints.findOne({ where: { projectId: project.id }, order: [['updatedAt', 'DESC']] }).catch(() => null);
      if (lastSprint) {
        const rows = await Wordcount.findAll({ where: { sprintId: lastSprint.id }, order: [['recordedAt', 'ASC']] });
        lastSprintTotal = sumNet(rows);
      }
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentRows = await Wordcount.findAll({ where: { projectId: project.id, recordedAt: { [Op.gte]: since } } }).catch(() => []);
      // All-time total across all members for this project
      const allRows = await Wordcount.findAll({ where: { projectId: project.id } }).catch(() => []);
      const allTotal = sumNet(allRows);
      const weekTotal = sumNet(recentRows);
      // Build embed
      const Discord = await import('discord.js');
      const { EmbedBuilder } = Discord;
      // Try to get owner's role color
      let embedColor = 0x5865F2;
      try {
        if (interaction.guild) {
          const ownerMember = await interaction.guild.members.fetch(project.ownerId);
          if (ownerMember && ownerMember.roles && ownerMember.roles.color) {
            embedColor = ownerMember.roles.color.hexColor || embedColor;
          } else if (ownerMember && ownerMember.displayHexColor && ownerMember.displayHexColor !== '#000000') {
            embedColor = ownerMember.displayHexColor;
          }
        }
      } catch {}
      const embed = new EmbedBuilder()
        .setTitle(`Project: ${project.name}`)
        .setDescription('Project details and stats.')
        .setColor(embedColor)
        .addFields(
          { name: 'Code', value: project.publicId || project.id, inline: true },
          { name: 'Owner', value: ownerTag, inline: true },
          { name: 'Members', value: `${members.length} (mods: ${mods})`, inline: true },
          { name: 'Active Sprint', value: activeSprintCount ? (activeSprintCount === 1 ? `Yes, in ${channelMention || 'this server'}` : `Yes (${activeSprintCount})`) : 'No', inline: true },
          { name: 'Last Sprint Net', value: `${lastSprintTotal} words`, inline: true },
          { name: 'Current Net', value: `${allTotal} words`, inline: true },
          { name: '7-Day Net', value: `${weekTotal} words`, inline: true }
        )
        .setTimestamp(project.createdAt)
        .setFooter({ text: `Project code: ${project.publicId || project.id} • Created: <t:${Math.floor(new Date(project.createdAt).getTime() / 1000)}:F>` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (subGroup === 'wc') {
      // Resolve project: required, can be ID or Name
      let projectInputRaw = interaction.options.getString('project');
      const uuid = extractUuid(projectInputRaw);
      let projectInput = projectInputRaw?.trim();
      let project = null;
      if (uuid) project = await Project.findByPk(uuid);
      if (!project) project = await resolveProjectForUser({ discordId, projectInputRaw: projectInput });
      if (!project) {
        await interaction.followUp({ content: 'Nope. Use the project code, UUID, or exact name.', flags: MessageFlags.Ephemeral });
        return;
      }
      project = await ensureProjectHasPublicId(project);
      const projectId = project.id;
      // Validate membership
      const membership = await ProjectMember.findOne({ where: { projectId, userId: discordId } });
      if (!membership) {
        await interaction.followUp({ content: 'You’re not on that project, buddy. Get invited first with `/project invite` or ask the owner to pull you in.', flags: MessageFlags.Ephemeral });
        return;
      }
      const leaf = interaction.options.getSubcommand();
      if (leaf === 'add') {
        const words = interaction.options.getInteger('new-words');
        if (words <= 0) {
          await interaction.followUp({ content: 'New words gotta be a positive number, buddy. If you need to change your total words use `/project wc set` instead, or you can use `/sprint wc undo` if you wanna undo the last wordcount change you made.', flags: MessageFlags.Ephemeral });
          return;
        }
        await Wordcount.create({
          userId: discordId,
          projectId,
          sprintId: null,
          countStart: null,
          countEnd: null,
          delta: words,
          recordedAt: new Date(),
        });
        return interaction.editReply({ content: `Logged **+${words}** to that project. Keep it moving.` });
      } else if (leaf === 'set') {
        const count = interaction.options.getInteger('count');
        if (count < 0) {
          await interaction.followUp({ content: "Wordcount's gotta be at least zero, buddy. If you want to bump numbers, use `/project wc add`. If you need to undo a bad update, try `/sprint wc undo`.", flags: MessageFlags.Ephemeral });
          return;
        }
        const rows = await Wordcount.findAll({ where: { projectId, userId: discordId }, order: [['recordedAt', 'ASC']] });
        const current = sumNet(rows);
        const delta = count - current;
        if (delta === 0) {
          await interaction.followUp({ content: `You’re already at **${count}** on this project.`, flags: MessageFlags.Ephemeral });
          return;
        }
        await Wordcount.create({
          userId: discordId,
          projectId,
          sprintId: null,
          countStart: current,
          countEnd: count,
          delta,
          recordedAt: new Date(),
        });
        return interaction.editReply({ content: `Locked **${count}**. (${delta >= 0 ? '+' : ''}${delta})` });
      } else if (leaf === 'show') {
        const rows = await Wordcount.findAll({ where: { projectId, userId: discordId }, order: [['recordedAt', 'ASC']] });
        const current = sumNet(rows);
        return interaction.editReply({ content: `You’re sitting at **${current}** on **${project.name}** (${project.publicId || project.id}). Keep pace.` });
      }
    }

    if (subName === 'list') {
      const memberships = await ProjectMember.findAll({ where: { userId: discordId }, limit: 50 });
      if (!memberships.length) {
        return interaction.editReply({ content: "You’re not on any projects yet. Spin one up with `/project create`." });
      }
      const ids = memberships.map(m => m.projectId);
      const projects = await Project.findAll({ where: { id: { [Op.in]: ids } } });
      for (const p of projects) await ensureProjectHasPublicId(p);
      const lines = projects.map(p => `• **${p.name}** (${p.publicId || p.id})`).join('\n');
      return interaction.editReply({ content: `Your projects:\n${lines}` });
    }

    if (subName === 'invite') {
      // Resolve target project: prefer provided option; else active sprint's project
      const projectInputRaw = interaction.options.getString('project');
      const uuid = extractUuid(projectInputRaw);
      const projectInput = projectInputRaw?.trim();
      let project = null;
      if (projectInput) {
        if (uuid) {
          project = await Project.findByPk(uuid);
        }
        if (!project) {
          project = await resolveProjectForUser({ discordId, projectInputRaw: projectInput });
        }
      } else {
        const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] }).catch(() => []);
        if (actives.length === 1) {
          const active = actives[0];
          if (active && active.projectId) project = await Project.findByPk(active.projectId);
        } else if (actives.length > 1) {
          const member = interaction.options.getUser('member');
          const token = makeToken();
          setInteractionState(token, { guildId, userId: discordId, action: 'invite', memberId: member?.id || null });

          const candidates = buildActiveSprintCandidates(actives);
          const select = new StringSelectMenuBuilder()
            .setCustomId(`projectActiveSprintPick_${token}`)
            .setPlaceholder('Pick a sprint')
            .setMinValues(1)
            .setMaxValues(1);

          const nowMs = Date.now();
          for (const c of candidates.slice(0, 25)) {
            const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
            const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
            const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
            select.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
                .setDescription(`Ends in ${minsLeft}m`.slice(0, 100))
                .setValue(String(c.row.id))
            );
          }

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.editReply({
            content: 'Which sprint are we using for this project action? Pick one. I am not guessing.',
            components: [row],
            allowedMentions: { parse: [] },
          });
        }
      }
      if (!project) {
          return interaction.editReply({ content: 'No target project. Pass `project:` (code, ID, or exact name), or link one to your sprint. You can create a new project with `/project create`.' });
      }
        project = await ensureProjectHasPublicId(project);
      // Permission: owner or mod on the target project, or elevated global permission
      const requester = await User.findOne({ where: { discordId } });
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const isPrivileged = level !== 'member';
      const isOwner = project.ownerId === discordId;
      const membership = await ProjectMember.findOne({ where: { projectId: project.id, userId: discordId } });
      const isMod = membership?.role === 'mod';
      if (!isOwner && !isMod && !isPrivileged) {
        return interaction.editReply({ content: 'Only the owner or a mod can invite folks. Flag a mod if you need backup.' });
      }
      const member = interaction.options.getUser('member');
      await ProjectMember.findOrCreate({ where: { projectId: project.id, userId: member.id }, defaults: { role: 'member' } });
      return interaction.editReply({ content: `Nice pull. <@${member.id}> is on **${project.name}**. Welcome aboard.` });
    }

    if (subName === 'remove') {
      const member = interaction.options.getUser('member');
      const confirm = interaction.options.getBoolean('confirm') ?? false;
      if (!confirm) {
        return interaction.editReply({ content: `You sure you wanna boot <@${member.id}>? Re-run with **confirm:true**.` });
      }

      let active = null;
      const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] }).catch(() => []);
      if (actives.length === 1) {
        active = actives[0];
      } else if (actives.length > 1) {
        const token = makeToken();
        setInteractionState(token, { guildId, userId: discordId, action: 'remove', memberId: member?.id || null });

        const candidates = buildActiveSprintCandidates(actives);
        const select = new StringSelectMenuBuilder()
          .setCustomId(`projectActiveSprintPick_${token}`)
          .setPlaceholder('Pick a sprint')
          .setMinValues(1)
          .setMaxValues(1);

        const nowMs = Date.now();
        for (const c of candidates.slice(0, 25)) {
          const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
          const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
          const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
          select.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
              .setDescription(`Ends in ${minsLeft}m`.slice(0, 100))
              .setValue(String(c.row.id))
          );
        }

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.editReply({
          content: 'Which sprint are we using for this project action? Pick one. I am not guessing.',
          components: [row],
          allowedMentions: { parse: [] },
        });
      }

      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked to this sprint, champ.' });
      }
      const requester = await User.findOne({ where: { discordId } });
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const project = await Project.findByPk(active.projectId);
      const isOwner = project && project.ownerId === discordId;
      const isPrivileged = level !== 'member';
      if (!isOwner && !isPrivileged) {
        return interaction.editReply({ content: 'Heads up: only the owner or a mod can boot folks.' });
      }
      await ProjectMember.destroy({ where: { projectId: active.projectId, userId: member.id } });
      return interaction.editReply({ content: `Alright. <@${member.id}> is off the roster. Keep it rolling.` });
    }

    if (subName === 'leave') {
      const confirm = interaction.options.getBoolean('confirm') ?? false;
      if (!confirm) {
        return interaction.editReply({ content: 'You sure you wanna bail on this project? Re-run with **confirm:true**.' });
      }

      let active = null;
      const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] }).catch(() => []);
      if (actives.length === 1) {
        active = actives[0];
      } else if (actives.length > 1) {
        const token = makeToken();
        setInteractionState(token, { guildId, userId: discordId, action: 'leaveProject' });

        const candidates = buildActiveSprintCandidates(actives);
        const select = new StringSelectMenuBuilder()
          .setCustomId(`projectActiveSprintPick_${token}`)
          .setPlaceholder('Pick a sprint')
          .setMinValues(1)
          .setMaxValues(1);

        const nowMs = Date.now();
        for (const c of candidates.slice(0, 25)) {
          const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
          const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
          const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
          select.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
              .setDescription(`Ends in ${minsLeft}m`.slice(0, 100))
              .setValue(String(c.row.id))
          );
        }

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.editReply({
          content: 'Which sprint are we using for this project action? Pick one. I am not guessing.',
          components: [row],
          allowedMentions: { parse: [] },
        });
      }

      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked to this sprint, champ.' });
      }
      const projectId = active.projectId;
      const project = await Project.findByPk(projectId);
      if (project && project.ownerId === discordId) {
        return interaction.editReply({ content: "You’re the owner, buddy. Transfer ownership first or end the project." });
      }
      await ProjectMember.destroy({ where: { projectId, userId: discordId } });
      await active.update({ projectId: null });
      return interaction.editReply({ content: 'You’re off the crew. Sprint unlinked from that project.' });
    }

    if (subName === 'use') {
      const projectInput = interaction.options.getString('project');
      const uuid = extractUuid(projectInput);
      let project = uuid ? await Project.findByPk(uuid) : null;
      if (!project) {
        project = await resolveProjectForUser({ discordId, projectInputRaw: projectInput });
      }
        if (!project) {
          await interaction.followUp({ content: "Nope. Try `/project list` or create a new one with `/project create`.", flags: MessageFlags.Ephemeral });
          return;
        }
      project = await ensureProjectHasPublicId(project);
      const projectId = project.id;

      let active = null;
      const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] }).catch(() => []);
      if (actives.length === 1) {
        active = actives[0];
      } else if (actives.length > 1) {
        const token = makeToken();
        setInteractionState(token, { guildId, userId: discordId, action: 'use', projectId });

        const candidates = buildActiveSprintCandidates(actives);
        const select = new StringSelectMenuBuilder()
          .setCustomId(`projectActiveSprintPick_${token}`)
          .setPlaceholder('Pick a sprint')
          .setMinValues(1)
          .setMaxValues(1);

        const nowMs = Date.now();
        for (const c of candidates.slice(0, 25)) {
          const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
          const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
          const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
          select.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
              .setDescription(`Ends in ${minsLeft}m`.slice(0, 100))
              .setValue(String(c.row.id))
          );
        }

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.editReply({
          content: 'Which sprint are we linking? Pick one. I am not guessing.',
          components: [row],
          allowedMentions: { parse: [] },
        });
      }

      if (!active) {
        await interaction.followUp({ content: 'No active sprint right now. Kick one off with `/sprint start`.', flags: MessageFlags.Ephemeral });
        return;
      }
      const member = await ProjectMember.findOne({ where: { projectId, userId: discordId } });
      if (!member) {
        await interaction.followUp({ content: 'You’re not on that project, buddy. Get invited first.', flags: MessageFlags.Ephemeral });
        return;
      }
      await active.update({ projectId });
      return interaction.editReply({ content: `Locked this sprint to **${project.name}** (${project.publicId || project.id}). Let’s get those pages.` });
    }

    if (subName === 'members') {

      let active = null;
      const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] }).catch(() => []);
      if (actives.length === 1) {
        active = actives[0];
      } else if (actives.length > 1) {
        const token = makeToken();
        setInteractionState(token, { guildId, userId: discordId, action: 'members' });

        const candidates = buildActiveSprintCandidates(actives);
        const select = new StringSelectMenuBuilder()
          .setCustomId(`projectActiveSprintPick_${token}`)
          .setPlaceholder('Pick a sprint')
          .setMinValues(1)
          .setMaxValues(1);

        const nowMs = Date.now();
        for (const c of candidates.slice(0, 25)) {
          const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
          const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
          const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
          select.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
              .setDescription(`Ends in ${minsLeft}m`.slice(0, 100))
              .setValue(String(c.row.id))
          );
        }

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.editReply({
          content: 'Which sprint are we using for this project action? Pick one. I am not guessing.',
          components: [row],
          allowedMentions: { parse: [] },
        });
      }

      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No active project on this sprint. Use `/project use` to link one, or create with `/project create`.' });
      }
      const members = await ProjectMember.findAll({ where: { projectId: active.projectId }, limit: 50 });
      const list = members.map(m => `• <@${m.userId}> (${m.role})`).join('\n') || 'Just you right now. That’s fine, solo hero arc.';
      return interaction.editReply({ content: `Crew roll call:\n${list}` });
    }
  } catch (err) {
    console.error('[Dean/project] Command error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Yeah, that's on me. Try that again in a sec." });
      } else {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec." });
      }
    } catch {}
  }
}
