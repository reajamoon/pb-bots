import Discord from 'discord.js';
const {
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} = Discord;

import { Op } from 'sequelize';
import { Project, ProjectMember, Wordcount } from '../../../models/index.js';
import {
  wcProjectPickerPromptText,
  wcNoProjectsText,
  wcConfirmSetPromptText,
  wcConfirmAddPromptText,
  wcConfirmUndoPromptText,
} from '../text/wcText.js';
import { setInteractionState } from './interactionState.js';
import { handleSprintWc } from './handleSprintWc.js';

function makeToken(length = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function sumNet(rows) {
  return rows.reduce((acc, r) => {
    const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
    return acc + (Number.isFinite(d) ? d : 0);
  }, 0);
}

function sumPositive(rows) {
  return rows.reduce((acc, r) => {
    const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
    return acc + (d > 0 ? d : 0);
  }, 0);
}

function extractPublicId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const match = str.match(/\b([A-Za-z0-9]{2,24}-\d{3})\b/);
  if (!match) return null;
  return match[1].toUpperCase();
}

async function getUserProjects(discordId) {
  const memberships = await ProjectMember.findAll({ where: { userId: discordId }, limit: 100 }).catch(() => []);
  if (!memberships.length) return [];

  const projectIds = [...new Set(memberships.map(m => m.projectId).filter(Boolean))];
  if (!projectIds.length) return [];

  const projects = await Project.findAll({ where: { id: { [Op.in]: projectIds } }, limit: 100 }).catch(() => []);
  return projects;
}

async function resolveProjectFromInput({ discordId, projectInputRaw }) {
  if (!projectInputRaw) return null;
  const projectInput = String(projectInputRaw).trim();
  if (!projectInput) return null;

  // Try UUID
  const uuidMatch = projectInput.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
    const p = await Project.findByPk(uuidMatch[0]).catch(() => null);
    if (p) {
      const member = await ProjectMember.findOne({ where: { projectId: p.id, userId: discordId } }).catch(() => null);
      if (member || p.ownerId === discordId) return p;
    }
  }

  // Try publicId (CODE-123)
  const publicId = extractPublicId(projectInput);
  if (publicId) {
    const p = await Project.findOne({ where: { publicId } }).catch(() => null);
    if (p) {
      const member = await ProjectMember.findOne({ where: { projectId: p.id, userId: discordId } }).catch(() => null);
      if (member || p.ownerId === discordId) return p;
    }
  }

  // Try exact name among owned or joined
  const owned = await Project.findOne({ where: { ownerId: discordId, name: projectInput } }).catch(() => null);
  if (owned) return owned;

  const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'project' }] }).catch(() => []);
  const joined = memberships.map(m => m.project).find(p => p?.name === projectInput) || null;
  return joined;
}

async function sortProjectsByRecentUse({ projects, discordId }) {
  if (!projects.length) return projects;

  const projectIds = projects.map(p => p.id);
  const recentRows = await Wordcount.findAll({
    where: {
      userId: discordId,
      projectId: { [Op.in]: projectIds },
    },
    order: [['recordedAt', 'DESC']],
    limit: 200,
  }).catch(() => []);

  const lastUsedMsByProjectId = new Map();
  for (const r of recentRows) {
    if (!r?.projectId) continue;
    if (lastUsedMsByProjectId.has(r.projectId)) continue;
    const t = r.recordedAt ? new Date(r.recordedAt).getTime() : null;
    if (t) lastUsedMsByProjectId.set(r.projectId, t);
  }

  return [...projects].sort((a, b) => {
    const aT = lastUsedMsByProjectId.get(a.id) || 0;
    const bT = lastUsedMsByProjectId.get(b.id) || 0;
    if (aT !== bT) return bT - aT;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

export async function handleWc(
  interaction,
  {
    guildId,
    forcedScope,
    forcedProjectId,
    forcedTargetId,
    forcedSubcommand,
    forcedOptions,
    forcedUndoWordcountId,
    confirmed,
  } = {}
) {
  const discordId = interaction.user.id;
  const subName = forcedSubcommand ?? interaction.options?.getSubcommand?.();

  // Only /wc set, /wc add, /wc undo, /wc show, and /wc summary need scope right now; all other subcommands remain sprint-scoped.
  const scopeRaw = forcedScope ?? (forcedOptions?.scope ?? interaction.options?.getString?.('scope'));
  const scope = (typeof scopeRaw === 'string' && scopeRaw) ? scopeRaw.toLowerCase() : 'sprint';

  if (!((subName === 'set' || subName === 'add' || subName === 'undo' || subName === 'show' || subName === 'summary') && scope === 'project')) {
    return handleSprintWc(interaction, {
      guildId,
      forcedTargetId,
      forcedSubcommand,
      forcedOptions,
      forcedUndoWordcountId,
      confirmed,
    });
  }

  // Parse inputs for project scope
  const count = subName === 'set'
    ? (forcedOptions ? forcedOptions.count : (interaction.options?.getInteger?.('count') ?? null))
    : null;
  const newWords = subName === 'add'
    ? (forcedOptions ? forcedOptions.newWords : (interaction.options?.getInteger?.('new-words') ?? null))
    : null;

  if (subName === 'set') {
    if (typeof count !== 'number') {
      return interaction.editReply({ content: 'I need a number for that. Try `/wc set count:123 scope:project`.' });
    }
    if (count < 0) {
      await interaction.followUp({ content: "Wordcount's gotta be at least zero, buddy.", flags: MessageFlags.Ephemeral });
      return;
    }
  }

  if (subName === 'add') {
    if (typeof newWords !== 'number') {
      return interaction.editReply({ content: 'I need a number for that. Try `/wc add new-words:123 scope:project`.' });
    }
    if (newWords <= 0) {
      await interaction.followUp({ content: 'That has to be a positive number, champ.', flags: MessageFlags.Ephemeral });
      return;
    }
  }

  if (subName === 'show') {
    // No numeric inputs.
  }

  if (subName === 'summary') {
    // No numeric inputs.
  }

  let project = null;
  if (forcedProjectId) {
    project = await Project.findByPk(forcedProjectId).catch(() => null);
  } else {
    const projectInputRaw = forcedOptions?.project ?? interaction.options?.getString?.('project');
    project = await resolveProjectFromInput({ discordId, projectInputRaw });
  }

  if (!project) {
    // Picker flow
    const projects = await getUserProjects(discordId);
    if (!projects.length) {
      return interaction.editReply({ content: wcNoProjectsText(), allowedMentions: { parse: [] } });
    }

    const sorted = await sortProjectsByRecentUse({ projects, discordId });

    const token = makeToken();
    setInteractionState(token, {
      guildId: guildId ?? interaction.guildId,
      userId: discordId,
      scope: 'project',
      subcommand: subName,
      options: {
        scope: 'project',
        count,
        newWords,
        project: null,
      },
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId(`wcProjectPick_${token}`)
      .setPlaceholder('Pick a project')
      .setMinValues(1)
      .setMaxValues(1);

    for (const p of sorted.slice(0, 25)) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(String(p.name || 'Unnamed project').slice(0, 100))
          .setDescription(String(p.publicId || p.id).slice(0, 100))
          .setValue(String(p.id))
      );
    }

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.editReply({
      content: wcProjectPickerPromptText(),
      components: [row],
      allowedMentions: { parse: [] },
    });
  }

  // Ensure membership (or owner)
  const member = await ProjectMember.findOne({ where: { projectId: project.id, userId: discordId } }).catch(() => null);
  if (!member && project.ownerId !== discordId) {
    await interaction.followUp({ content: "You're not on that project, buddy. Get invited first.", flags: MessageFlags.Ephemeral });
    return;
  }

  const rows = await Wordcount.findAll({ where: { projectId: project.id, userId: discordId }, order: [['recordedAt', 'ASC']] }).catch(() => []);
  const currentNet = sumNet(rows);

  if (subName === 'show') {
    const last = await Wordcount.findOne({ where: { projectId: project.id, userId: discordId }, order: [['recordedAt', 'DESC']] }).catch(() => null);
    const lastAt = last?.recordedAt ? new Date(last.recordedAt) : null;
    const lastLine = lastAt ? `\nLast update: ${lastAt.toLocaleString()}` : '\nLast update: none yet';
    return interaction.editReply({
      content: `Project: **${project.name}**\nCurrent total: **${currentNet}**${lastLine}`,
      components: [],
      allowedMentions: { parse: [] },
    });
  }

  if (subName === 'summary') {
    const updates = rows.length;
    const totalGained = sumPositive(rows);
    const maxGain = rows.reduce((max, r) => {
      const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
      return d > max ? d : max;
    }, 0);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dayRows = await Wordcount.findAll({
      where: {
        userId: discordId,
        projectId: project.id,
        recordedAt: { [Op.gte]: startOfDay },
      },
      order: [['recordedAt', 'ASC']],
    }).catch(() => []);
    const dayGained = sumPositive(dayRows);

    const content = [
      `Project: **${project.name}**`,
      `Current total: **${currentNet}**`,
      `Total gained (all time): **${totalGained}**`,
      `Total gained today: **${dayGained}**`,
      `Updates: **${updates}**`,
      `Best single update: **${maxGain}**`,
    ].join('\n');

    return interaction.editReply({ content, components: [], allowedMentions: { parse: [] } });
  }

  if (subName === 'undo') {
    const last = forcedUndoWordcountId
      ? await Wordcount.findOne({ where: { id: forcedUndoWordcountId, projectId: project.id, userId: discordId } }).catch(() => null)
      : await Wordcount.findOne({ where: { projectId: project.id, userId: discordId }, order: [['recordedAt', 'DESC']] }).catch(() => null);

    if (!last) {
      await interaction.followUp({ content: 'No wordcount to undo for that project, partner.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!confirmed) {
      const token = makeToken();
      const entryAmountSigned = `${last.delta >= 0 ? '+' : ''}${last.delta}`;
      const entryTimestamp = (last.recordedAt ? new Date(last.recordedAt) : new Date()).toLocaleString();
      const prompt = wcConfirmUndoPromptText({
        targetLabel: project.name,
        entryType: 'WC',
        entryAmountSigned,
        entryTimestamp,
      });

      setInteractionState(token, {
        guildId: guildId ?? interaction.guildId,
        userId: discordId,
        scope: 'project',
        projectId: project.id,
        subcommand: 'undo',
        options: {
          scope: 'project',
          count: null,
          newWords: null,
          project: project.id,
        },
        undoWordcountId: last.id,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wcConfirm_confirm_${token}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`wcConfirm_cancel_${token}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: prompt, components: [row], allowedMentions: { parse: [] } });
    }

    await last.destroy();
    const remaining = await Wordcount.findAll({ where: { projectId: project.id, userId: discordId }, order: [['recordedAt', 'ASC']] }).catch(() => []);
    const next = sumNet(remaining);
    return interaction.editReply({ content: `Undone. **${project.name}** is now at **${next}**.`, components: [], allowedMentions: { parse: [] } });
  }

  if (subName === 'set') {
    const delta = count - currentNet;
    const deltaSigned = `${delta >= 0 ? '+' : ''}${delta}`;

    if (!confirmed) {
      const token = makeToken();

      const prompt = wcConfirmSetPromptText({
        targetLabel: project.name,
        newX: count,
        currentNet,
        deltaSigned,
      });

      setInteractionState(token, {
        guildId: guildId ?? interaction.guildId,
        userId: discordId,
        scope: 'project',
        projectId: project.id,
        subcommand: 'set',
        options: {
          scope: 'project',
          count,
          newWords: null,
          project: project.id,
        },
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wcConfirm_confirm_${token}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`wcConfirm_cancel_${token}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: prompt, components: [row], allowedMentions: { parse: [] } });
    }

    await Wordcount.create({
      userId: discordId,
      projectId: project.id,
      sprintId: null,
      countStart: currentNet,
      countEnd: count,
      delta,
      recordedAt: new Date(),
    });

    return interaction.editReply({
      content: `Alright. **${project.name}** is now at **${count}**. (${deltaSigned})`,
      allowedMentions: { parse: [] },
    });
  }

  // subName === 'add'
  const next = currentNet + newWords;
  const deltaSigned = `+${newWords}`;

  if (!confirmed) {
    const token = makeToken();

    const prompt = wcConfirmAddPromptText({
      targetLabel: project.name,
      addingN: newWords,
      currentNet,
      newX: next,
    });

    setInteractionState(token, {
      guildId: guildId ?? interaction.guildId,
      userId: discordId,
      scope: 'project',
      projectId: project.id,
      subcommand: 'add',
      options: {
        scope: 'project',
        count: null,
        newWords,
        project: project.id,
      },
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wcConfirm_confirm_${token}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`wcConfirm_cancel_${token}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({ content: prompt, components: [row], allowedMentions: { parse: [] } });
  }

  await Wordcount.create({
    userId: discordId,
    projectId: project.id,
    sprintId: null,
    countStart: currentNet,
    countEnd: next,
    delta: newWords,
    recordedAt: new Date(),
  });

  return interaction.editReply({
    content: `Alright. **${project.name}** ${deltaSigned}. Now at **${next}**.`,
    allowedMentions: { parse: [] },
  });
}

export default { handleWc };
