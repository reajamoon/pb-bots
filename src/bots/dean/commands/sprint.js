import Discord from 'discord.js';
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = Discord;
import { DeanSprints, GuildSprintSettings, User, sequelize, Wordcount, Project, ProjectMember } from '../../../models/index.js';
import { Op } from 'sequelize';
import { startSoloEmbed, hostTeamEmbed, listEmbeds, formatListLine, notEnabledInChannelText, noActiveTeamText, alreadyActiveSprintText, noActiveSprintText, notInTeamSprintText, hostsUseEndText, selectAChannelText, onlyStaffSetChannelText, sprintChannelSetText, formatSprintIdentifier, sprintJoinText, sprintJoinTrackTimeText, sprintLeaveText, sprintStatusWordsText, sprintStatusTimeText, sprintStatusMixedText, sprintEndedWordsText, sprintEndedEmbed } from '../text/sprintText.js';
import { scheduleSprintNotifications } from '../sprintScheduler.js';
import { handleSprintWc } from '../utils/handleSprintWc.js';
import { setInteractionState } from '../utils/interactionState.js';
import { sumNet } from '../../../shared/utils/wordcountMath.js';

import fs from 'fs';
import path from 'path';

const DEFAULT_HUNT_CODES = [
  'ALIEN',
  'ANGEL',
  'BANSHEE',
  'CHANGELING',
  'CHUPACABRA',
  'CURSE',
  'DEMON',
  'DJINN',
  'DRAGON',
  'FAIRY',
  'FISHTACO',
  'GHOST',
  'GHOUL',
  'HELLHOUND',
  'HORSEMAN',
  'JEFFERSON-STARSHIP',
  'KITSUNE',
  'KRAKEN',
  'LAMIA',
  'LEVIATHAN',
  'MANTICORE',
  'MANDRAGORA',
  'NACHZEHRER',
  'NEPHILIM',
  'PIGEON',
  'POLTERGEIST',
  'RAKSHASA',
  'REAPER',
  'RUGARU',
  'SCARECROW',
  'SHAPESHIFTER',
  'SIREN',
  'STARSHIP',
  'TRICKSTER',
  'VAMPIRE',
  'VAMPIRATE',
  'WEREPIRE',
  'WEREWOLF',
  'WRAITH',
  'WITCH',
  'ZOMBIE',
];

function loadSprintHuntCodes() {
  try {
    const filePath = path.resolve(process.cwd(), 'config', 'sprintHuntCodes.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.codes) ? parsed.codes : []);
    const normalized = arr
      .map(c => String(c || '').trim().toUpperCase())
      .filter(c => c && /^[A-Z0-9-]{2,24}$/.test(c));
    return normalized.length ? [...new Set(normalized)] : DEFAULT_HUNT_CODES;
  } catch {
    return DEFAULT_HUNT_CODES;
  }
}

const SPRINT_HUNT_CODES = loadSprintHuntCodes();

function makeFallbackJoinCode(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

async function pickUniqueTeamHuntCode({ guildId }) {
  const active = await DeanSprints.findAll({
    where: { guildId, status: 'processing', type: 'team', groupId: { [Op.ne]: null } },
    attributes: ['groupId'],
  }).catch(() => []);
  const used = new Set(active.map(r => String(r.groupId || '').trim().toUpperCase()).filter(Boolean));

  const available = SPRINT_HUNT_CODES.filter(code => !used.has(code));
  if (available.length) {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Fallback behavior (spec): pool exhausted or collisions - use a generated code.
  for (let i = 0; i < 50; i++) {
    const candidate = makeFallbackJoinCode(6);
    if (!used.has(candidate)) return candidate;
  }
  // Last resort: return something stable-ish even if collisions exist.
  return makeFallbackJoinCode(8);
}

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

  // Try exact name among owned
  const owned = await Project.findOne({ where: { ownerId: discordId, name: projectInput } }).catch(() => null);
  if (owned) return owned;

  // Try exact name among joined
  const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'project' }] }).catch(() => []);
  const joined = memberships.map(m => m.project).find(p => p?.name === projectInput) || null;
  return joined;
}

export const data = new SlashCommandBuilder()
  .setName('sprint')
  .setDescription('Start or manage a writing sprint')
  .addSubcommand(sub => sub
    .setName('start')
    .setDescription('Start a sprint in this channel')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addIntegerOption(opt => opt.setName('start_in').setDescription('Delay start by N minutes (default 1; set to 0 to start now)').setRequired(false))
    .addStringOption(opt => opt.setName('mode')
      .setDescription('Sprint mode (default: words)')
      .addChoices(
        { name: 'words', value: 'words' },
        { name: 'time', value: 'time' },
        { name: 'mixed', value: 'mixed' },
      )
      .setRequired(false))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('host')
    .setDescription('Host a team sprint')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addIntegerOption(opt => opt.setName('start_in').setDescription('Delay start by N minutes (default 1; set to 0 to start now)').setRequired(false))
    .addBooleanOption(opt => opt.setName('pings').setDescription('Enable pre-start reminder pings during the delay (team only)').setRequired(false))
    .addStringOption(opt => opt.setName('mode')
      .setDescription('Sprint mode (default: words)')
      .addChoices(
        { name: 'words', value: 'words' },
        { name: 'time', value: 'time' },
        { name: 'mixed', value: 'mixed' },
      )
      .setRequired(false))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('join')
    .setDescription('Join the active team sprint in this channel')
    .addStringOption(opt => opt.setName('code').setDescription('Host code').setRequired(true))
    .addStringOption(opt => opt.setName('track')
      .setDescription('How you want to track this sprint (only used for words-mode team sprints)')
      .addChoices(
        { name: 'words', value: 'words' },
        { name: 'time', value: 'time' },
      )
      .setRequired(false)))
  .addSubcommand(sub => sub
    .setName('end')
    .setDescription('End your active sprint'))
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('Show current sprint status'))
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Leave the current team sprint')
  )
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List active sprints in this channel'));

  // Wordcount management
data.addSubcommandGroup(group => group
  .setName('wc')
  .setDescription('Manage wordcounts during sprints')
  .addSubcommand(sub => sub
    .setName('baseline')
    .setDescription('Set your starting baseline (absolute total) for this sprint')
    .addIntegerOption(opt => opt.setName('count').setDescription('Your starting absolute total').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Set your current wordcount')
    .addIntegerOption(opt => opt.setName('count').setDescription('Current wordcount').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Add to your current wordcount')
    .addIntegerOption(opt => opt.setName('new-words').setDescription('Words added (positive)').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('show')
    .setDescription('Show your wordcount for the active sprint'))
  .addSubcommand(sub => sub
    .setName('summary')
    .setDescription('Show totals for the current sprint'))
  .addSubcommand(sub => sub
    .setName('undo')
    .setDescription('Undo your last wordcount entry'))
);

// Project linking (kept lightweight here; full management is under /project)
data.addSubcommandGroup(group => group
  .setName('project')
  .setDescription('Link a project to your sprint')
  .addSubcommand(sub => sub
    .setName('use')
    .setDescription('Use a project for your sprint')
    .addStringOption(opt => opt.setName('project').setDescription('Project code, ID, or exact name (optional, will prompt)').setRequired(false))
    // Back-compat with older registrations
    .addStringOption(opt => opt.setName('project_id').setDescription('Project ID (legacy)').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('clear')
    .setDescription('Unlink your sprint from any project'))
);

  // Admin/mod-only: set default sprint channel for this guild
data.addSubcommand(sub => sub
  .setName('setchannel')
  .setDescription('Set the default channel where sprints run')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to host sprints').setRequired(true))
  .addBooleanOption(opt => opt.setName('allow_threads').setDescription('Allow threads by default (true)'))
);

export async function execute(interaction) {
  try {
    const flags = undefined;
    const guildId = interaction.guildId;
    const channel = interaction.channel;
    const channelId = channel ? channel.id : undefined;
    const threadId = (channel && typeof channel.isThread === 'function' && channel.isThread()) ? channel.id : undefined;
    // Decide ephemeral before deferring: confirmations or wrong-channel
    // Keep replies public unless we detect wrong-channel; confirmations now live under /project
    const wantsConfirmEphemeral = false;

    const settings = await GuildSprintSettings.findOne({ where: { guildId } });
    let wrongChannel = false;
    if (settings) {
      const allowed = Array.isArray(settings.allowedChannelIds) ? settings.allowedChannelIds.includes(channelId) : true;
      const blocked = Array.isArray(settings.blockedChannelIds) && settings.blockedChannelIds.includes(channelId);
      wrongChannel = blocked || !allowed;
    }
    await interaction.deferReply();

    if (settings) {
      const allowed = Array.isArray(settings.allowedChannelIds) ? settings.allowedChannelIds.includes(channelId) : true;
      const blocked = Array.isArray(settings.blockedChannelIds) && settings.blockedChannelIds.includes(channelId);
      if (blocked || !allowed) {
        let mention = '';
        if (settings.defaultSummaryChannelId) {
          mention = `<#${settings.defaultSummaryChannelId}>`;
        } else if (Array.isArray(settings.allowedChannelIds) && settings.allowedChannelIds.length) {
          mention = `<#${settings.allowedChannelIds[0]}>`;
        } else if (interaction.guild && interaction.guild.channels && interaction.guild.channels.cache) {
          const sprintsChan = interaction.guild.channels.cache.find(ch => ch.name === 'sprints' && typeof ch.isTextBased === 'function' && ch.isTextBased());
          if (sprintsChan) mention = `<#${sprintsChan.id}>`;
        }
        if (!mention) {
          // Single-server fallback to main sprint channel
          mention = '<#392787812073734144>';
        }
        return interaction.editReply({ content: notEnabledInChannelText(mention) });
      }
    }

  const sub = interaction.options.getSubcommand();
  const subGroup = interaction.options.getSubcommandGroup(false);

  function baselineNudgeText() {
    return "Quick heads up: if you're using absolute totals, set a baseline with `/sprint wc baseline count:YOUR_START` so `/sprint wc set` doesn't count your whole draft as sprint words.";
  }

  function normalizeMode(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'time' || v === 'mixed' || v === 'words') return v;
    return 'words';
  }

  function defaultTrackForMode(mode) {
    return mode === 'time' ? 'time' : 'words';
  }

  if (sub === 'start') {
    const minutes = interaction.options.getInteger('minutes');
    const startInRaw = interaction.options.getInteger('start_in');
    const startDelayMinutes = Math.max(0, Math.min(180, (typeof startInRaw === 'number' ? startInRaw : 1)));
    const mode = normalizeMode(interaction.options.getString('mode'));
    const track = defaultTrackForMode(mode);
    const label = interaction.options.getString('label') ?? undefined;

    // Upsert the user row if needed (using discordId)
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Persist the sprint row
    const startedAt = new Date(Date.now() + startDelayMinutes * 60000);
    const sprint = await DeanSprints.create({
      userId: discordId,
      guildId,
      channelId,
      threadId,
      type: 'solo',
      visibility: 'public',
      mode,
      track,
      startedAt,
      durationMinutes: minutes,
      status: 'processing',
      label,
      joinedAt: startedAt,
      startDelayMinutes,
      preStartPingsEnabled: false,
    });

    await interaction.editReply({ embeds: [startSoloEmbed(minutes, label, 'public', startDelayMinutes)] });
    if (mode !== 'time') {
      await interaction.followUp({ content: baselineNudgeText(), allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    }
    await scheduleSprintNotifications(sprint, interaction.client);
    return;
  } else if (sub === 'host') {
    const minutes = interaction.options.getInteger('minutes');
    const startInRaw = interaction.options.getInteger('start_in');
    const startDelayMinutes = Math.max(0, Math.min(180, (typeof startInRaw === 'number' ? startInRaw : 1)));
    const preStartPingsEnabled = interaction.options.getBoolean('pings') ?? false;
    const mode = normalizeMode(interaction.options.getString('mode'));
    const track = defaultTrackForMode(mode);
    const label = interaction.options.getString('label') ?? undefined;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Assign a hunt code from the pool; must be unique among concurrently active team sprints.
    const groupId = await pickUniqueTeamHuntCode({ guildId });
    const startedAt = new Date(Date.now() + startDelayMinutes * 60000);
    const hostRow = await DeanSprints.create({
      userId: discordId,
      hostId: discordId,
      groupId,
      role: 'host',
      guildId,
      channelId,
      threadId,
      type: 'team',
      visibility: 'public',
      mode,
      track,
      startedAt,
      durationMinutes: minutes,
      status: 'processing',
      label,
      joinedAt: startedAt,
      startDelayMinutes,
      preStartPingsEnabled,
    });
    await interaction.editReply({ embeds: [hostTeamEmbed(minutes, label, groupId, startDelayMinutes)] });
    if (mode !== 'time') {
      await interaction.followUp({ content: baselineNudgeText(), allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    }
    await scheduleSprintNotifications(hostRow, interaction.client);
    return;
  } else if (sub === 'join') {
    const codeRaw = interaction.options.getString('code');
    const provided = codeRaw ? codeRaw.toUpperCase() : undefined;
    const requestedTrackRaw = interaction.options.getString('track');
    const requestedTrack = requestedTrackRaw ? String(requestedTrackRaw).trim().toLowerCase() : null;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    const host = await DeanSprints.findOne({ where: { guildId, status: 'processing', type: 'team', groupId: provided, role: 'host' } });
    if (!host) {
      return interaction.editReply({ content: noActiveTeamText() });
    }

    const hostMode = normalizeMode(host.mode);
    const effectiveTrack = hostMode === 'words'
      ? (requestedTrack === 'time' ? 'time' : 'words')
      : defaultTrackForMode(hostMode);
    const existingInThisTeam = await DeanSprints.findOne({
      where: { userId: discordId, guildId, status: 'processing', type: 'team', groupId: host.groupId },
    });
    if (existingInThisTeam) {
      return interaction.editReply({ content: "You're already in that sprint, dude. Check it with `/sprint status`.", allowedMentions: { parse: [] } });
    }
    await DeanSprints.create({
      userId: discordId,
      hostId: host.hostId || host.userId,
      groupId: host.groupId,
      role: 'participant',
      guildId,
      channelId: host.channelId,
      threadId: host.threadId ?? null,
      type: 'team',
      visibility: host.visibility,
      mode: hostMode,
      track: effectiveTrack,
      startedAt: host.startedAt,
      durationMinutes: host.durationMinutes,
      status: 'processing',
      label: host.label,
      joinedAt: new Date(),
    });
    // Fire Hunt trigger: team joined awards host and joiner
    try {
      const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
      const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
      const announce = makeDeanAnnouncer(interaction);
      await fireTrigger('dean.team.joined', { userId: discordId, hostId: host.hostId || host.userId, announce });
    } catch (huntErr) {
      console.warn('[hunts] dean.team.joined trigger failed:', huntErr);
    }
    const sprintIdentifier = formatSprintIdentifier({ type: host.type, groupId: host.groupId, label: host.label, startedAt: host.startedAt });
    const joinText = (hostMode === 'time' || (hostMode === 'words' && effectiveTrack === 'time'))
      ? sprintJoinTrackTimeText({ sprintIdentifier, durationMinutes: host.durationMinutes })
      : sprintJoinText({ sprintIdentifier, durationMinutes: host.durationMinutes });
    await interaction.editReply({ content: joinText, allowedMentions: { parse: [] } });
    if (hostMode !== 'time' && effectiveTrack !== 'time') {
      await interaction.followUp({ content: baselineNudgeText(), flags: MessageFlags.Ephemeral });
    }
    return;
  } else if (sub === 'end') {
    const discordId = interaction.user.id;
    const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    if (!actives.length) return interaction.editReply({ content: noActiveSprintText() });

    if (actives.length > 1) {
      const token = makeToken();
      setInteractionState(token, { guildId, userId: discordId, action: 'end' });

      // Spec: team first, then solo; within each group soonest ending first.
      const nowMs = Date.now();
      const candidates = actives.map(row => {
        const startsAtMs = row.startedAt ? new Date(row.startedAt).getTime() : nowMs;
        const endsAtMs = startsAtMs + (row.durationMinutes || 0) * 60000;
        return { row, endsAtMs };
      });
      candidates.sort((a, b) => {
        const aTeam = a.row.type === 'team' ? 0 : 1;
        const bTeam = b.row.type === 'team' ? 0 : 1;
        if (aTeam !== bTeam) return aTeam - bTeam;
        return a.endsAtMs - b.endsAtMs;
      });

      const select = new Discord.StringSelectMenuBuilder()
        .setCustomId(`sprintPick_${token}`)
        .setPlaceholder('Pick a sprint')
        .setMinValues(1)
        .setMaxValues(1);

      for (const c of candidates.slice(0, 25)) {
        const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
        const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
        const startsAtMs = c.row.startedAt ? new Date(c.row.startedAt).getTime() : nowMs;
        const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
        const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
        const desc = nowMs < startsAtMs ? `Starts in ${startsInMin}m` : `Ends in ${minsLeft}m`;
        select.addOptions(
          new Discord.StringSelectMenuOptionBuilder()
            .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
            .setDescription(desc.slice(0, 100))
            .setValue(String(c.row.id))
        );
      }

      const row = new Discord.ActionRowBuilder().addComponents(select);
      return interaction.editReply({
        content: 'Which sprint are we ending? Pick one. I am not guessing.',
        components: [row],
        allowedMentions: { parse: [] },
      });
    }

    const active = actives[0];
    const endedAt = new Date();
    const sprintIdentifier = formatSprintIdentifier({ type: active.type, groupId: active.groupId, label: active.label, startedAt: active.startedAt });

    async function safeName(userId) {
      try {
        if (interaction.guild) {
          const m = await interaction.guild.members.fetch(userId);
          return m?.displayName || m?.user?.username || userId;
        }
      } catch {}
      return userId;
    }

    async function buildLeaderboardLines(participantRows) {
      const scores = [];
      for (const p of participantRows) {
        const rows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
        const total = sumNet(rows);
        scores.push({ userId: p.userId, total });
      }
      scores.sort((a, b) => (b.total || 0) - (a.total || 0));
      const lines = [];
      for (let i = 0; i < scores.length; i++) {
        lines.push(`${i + 1}) <@${scores[i].userId}> - NET ${scores[i].total || 0}`);
      }
      return lines;
    }

    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      const participants = await DeanSprints.findAll({ where: { guildId, groupId: active.groupId, status: 'processing' }, order: [['createdAt', 'ASC']] });
      const participantIds = [...new Set(participants.map(p => p.userId))];
      const pingLine = participantIds.length ? participantIds.map(id => `<@${id}>`).join(' ') : '';
      const leaderboardLines = await buildLeaderboardLines(participants);
      // End the team (host + all participants)
      // Persist endedAt immediately so /wc late logs can target the just-ended sprint without racing
      // the follow-up update that captures end summary message refs.
      await DeanSprints.update(
        { status: 'done', endNotified: true, endedAt },
        { where: { guildId, groupId: active.groupId, status: 'processing' } }
      );
      try {
        const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        const announce = makeDeanAnnouncer(interaction);
        await fireTrigger('dean.sprint.completed', { userId: discordId, announce, interaction });
      } catch (huntErr) {
        console.warn('[hunts] dean.sprint.completed trigger failed:', huntErr);
      }
      await interaction.editReply({
        content: pingLine,
        embeds: [sprintEndedEmbed({ sprintIdentifier, durationMinutes: active.durationMinutes, leaderboardLines })],
        allowedMentions: { users: participantIds, parse: [] },
      });

      // Best-effort: capture end summary message ref so late logging can edit it.
      try {
        const msg = await interaction.fetchReply();
        await DeanSprints.update(
          {
            endedAt,
            endSummaryChannelId: msg?.channelId || interaction.channelId || null,
            endSummaryMessageId: msg?.id || null,
          },
          { where: { guildId, groupId: active.groupId } }
        );
      } catch (e) {
        console.warn('[dean] failed to record end summary ref (team):', e?.message || e);
      }
    } else {
      const participantIds = [active.userId];
      const pingLine = `<@${active.userId}>`;
      const leaderboardLines = await buildLeaderboardLines([active]);
      try {
        await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null, endedAt });
      } catch (e) {
        console.warn('[dean] failed to persist endedAt on solo end:', e?.message || e);
        try {
          await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null, endedAt });
        } catch {
          await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null });
        }
      }
      // Fire Hunt trigger on solo sprint completion
      try {
        const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        const announce = makeDeanAnnouncer(interaction);
        await fireTrigger('dean.sprint.completed', { userId: discordId, announce, interaction });
      } catch (huntErr) {
        console.warn('[hunts] dean.sprint.completed trigger failed (solo):', huntErr);
      }
      await interaction.editReply({
        content: pingLine,
        embeds: [sprintEndedEmbed({ sprintIdentifier, durationMinutes: active.durationMinutes, leaderboardLines })],
        allowedMentions: { users: participantIds, parse: [] },
      });

      // Best-effort: capture end summary message ref so late logging can edit it.
      try {
        const msg = await interaction.fetchReply();
        await active.update({
          endSummaryChannelId: msg?.channelId || interaction.channelId || null,
          endSummaryMessageId: msg?.id || null,
        });
      } catch (e) {
        console.warn('[dean] failed to record end summary ref (solo):', e?.message || e);
      }
    }
    return;
  } else if (sub === 'status') {
    const discordId = interaction.user.id;
    const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    if (!actives.length) return interaction.editReply({ content: noActiveSprintText() });

    if (actives.length > 1) {
      const token = makeToken();
      setInteractionState(token, { guildId, userId: discordId, action: 'status' });

      // Spec: team first, then solo; within each group soonest ending first.
      const nowMs = Date.now();
      const candidates = actives.map(row => {
        const startsAtMs = row.startedAt ? new Date(row.startedAt).getTime() : nowMs;
        const endsAtMs = startsAtMs + (row.durationMinutes || 0) * 60000;
        return { row, endsAtMs };
      });
      candidates.sort((a, b) => {
        const aTeam = a.row.type === 'team' ? 0 : 1;
        const bTeam = b.row.type === 'team' ? 0 : 1;
        if (aTeam !== bTeam) return aTeam - bTeam;
        return a.endsAtMs - b.endsAtMs;
      });

      const select = new Discord.StringSelectMenuBuilder()
        .setCustomId(`sprintPick_${token}`)
        .setPlaceholder('Pick a sprint')
        .setMinValues(1)
        .setMaxValues(1);

      for (const c of candidates.slice(0, 25)) {
        const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
        const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
        const startsAtMs = c.row.startedAt ? new Date(c.row.startedAt).getTime() : nowMs;
        const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
        const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
        const desc = nowMs < startsAtMs ? `Starts in ${startsInMin}m` : `Ends in ${minsLeft}m`;
        select.addOptions(
          new Discord.StringSelectMenuOptionBuilder()
            .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
            .setDescription(desc.slice(0, 100))
            .setValue(String(c.row.id))
        );
      }

      const row = new Discord.ActionRowBuilder().addComponents(select);
      return interaction.editReply({
        content: 'Which sprint are we checking? Pick one. I am not guessing.',
        components: [row],
        allowedMentions: { parse: [] },
      });
    }

    const active = actives[0];
    const sprintIdentifier = formatSprintIdentifier({ type: active.type, groupId: active.groupId, label: active.label, startedAt: active.startedAt });
    const nowMs = Date.now();
    const startsAtMs = new Date(active.startedAt).getTime();
    if (nowMs < startsAtMs) {
      const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
      return interaction.editReply({
        content: `Status: ${sprintIdentifier}\nStarts in: ${startsInMin}m\nTimer: ${active.durationMinutes}m once it kicks off.`,
        allowedMentions: { parse: [] },
      });
    }
    const endsAt = new Date(startsAtMs + active.durationMinutes * 60000);
    const remainingMs = endsAt.getTime() - nowMs;
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
    const elapsedMin = Math.max(0, Math.floor((nowMs - startsAtMs) / 60000));

    const mode = normalizeMode(active.mode);
    const track = String(active.track || '').trim().toLowerCase();

    if (mode === 'time' || track === 'time') {
      await interaction.editReply({
        content: sprintStatusTimeText({
          sprintIdentifier,
          timeLeftMinutes: remainingMin,
          yourMinutesSoFar: elapsedMin,
        }),
        allowedMentions: { parse: [] },
      });
      return;
    }

    const rows = await Wordcount.findAll({ where: { sprintId: active.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
    const sprintTotal = sumNet(rows);

    if (mode === 'mixed') {
      const hasAnyWordcount = Array.isArray(rows) && rows.length > 0;
      await interaction.editReply({
        content: sprintStatusMixedText({
          sprintIdentifier,
          timeLeftMinutes: remainingMin,
          yourMinutesSoFar: elapsedMin,
          yourNetWordsSoFar: hasAnyWordcount ? sprintTotal : null,
        }),
        allowedMentions: { parse: [] },
      });
      return;
    }

    await interaction.editReply({
      content: sprintStatusWordsText({
        sprintIdentifier,
        timeLeftMinutes: remainingMin,
        yourNetWordsSoFar: sprintTotal,
        yourMinutesSoFar: elapsedMin,
      }),
      allowedMentions: { parse: [] },
    });
    return;
  } else if (sub === 'leave') {
    const discordId = interaction.user.id;
    const actives = await DeanSprints.findAll({
      where: { userId: discordId, guildId, status: 'processing', type: 'team' },
      order: [['startedAt', 'DESC']],
    });
    if (!actives.length) return interaction.editReply({ content: notInTeamSprintText() });

    if (actives.length > 1) {
      const token = makeToken();
      setInteractionState(token, { guildId, userId: discordId, action: 'leave' });

      const nowMs = Date.now();
      const candidates = actives.map(row => {
        const startsAtMs = row.startedAt ? new Date(row.startedAt).getTime() : nowMs;
        const endsAtMs = startsAtMs + (row.durationMinutes || 0) * 60000;
        return { row, endsAtMs };
      });
      candidates.sort((a, b) => a.endsAtMs - b.endsAtMs);

      const select = new Discord.StringSelectMenuBuilder()
        .setCustomId(`sprintPick_${token}`)
        .setPlaceholder('Pick a team sprint')
        .setMinValues(1)
        .setMaxValues(1);

      for (const c of candidates.slice(0, 25)) {
        const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
        const startsAtMs = c.row.startedAt ? new Date(c.row.startedAt).getTime() : nowMs;
        const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
        const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
        const desc = nowMs < startsAtMs ? `Starts in ${startsInMin}m` : `Ends in ${minsLeft}m`;
        select.addOptions(
          new Discord.StringSelectMenuOptionBuilder()
            .setLabel(`${sprintIdentifier}`.slice(0, 100))
            .setDescription(desc.slice(0, 100))
            .setValue(String(c.row.id))
        );
      }

      const row = new Discord.ActionRowBuilder().addComponents(select);
      return interaction.editReply({
        content: 'Which team sprint are you leaving? Pick one. I am not guessing.',
        components: [row],
        allowedMentions: { parse: [] },
      });
    }

    const active = actives[0];
    if (active.role === 'host') return interaction.editReply({ content: hostsUseEndText() });

    const sprintIdentifier = formatSprintIdentifier({ type: active.type, groupId: active.groupId, label: active.label, startedAt: active.startedAt });
    try {
      await active.update({ status: 'done', endNotified: true, endedAt: new Date() });
    } catch (e) {
      console.warn('[dean] failed to persist endedAt on leave:', e?.message || e);
      try {
        await active.update({ status: 'done', endNotified: true, endedAt: new Date() });
      } catch {
        await active.update({ status: 'done', endNotified: true });
      }
    }

    await interaction.editReply({ content: sprintLeaveText({ sprintIdentifier }), allowedMentions: { parse: [] } });
    return;
  } else if (sub === 'list') {
    const sprints = await DeanSprints.findAll({ where: { guildId, channelId, status: 'processing' }, order: [['createdAt', 'ASC']] });

    const nowMs = Date.now();

    // De-dupe team sprints: show one line per hunt code (groupId), prefer host row.
    const teamByGroupId = new Map();
    const soloRows = [];

    for (const s of sprints) {
      if (s.type === 'team' && s.groupId) {
        const existing = teamByGroupId.get(s.groupId);
        if (!existing) {
          teamByGroupId.set(s.groupId, { host: s.role === 'host' ? s : null, any: s, count: 1 });
        } else {
          existing.count += 1;
          if (!existing.host && s.role === 'host') existing.host = s;
        }
      } else {
        soloRows.push(s);
      }
    }

    const teamEntries = [...teamByGroupId.entries()].map(([groupId, data]) => {
      const row = data.host || data.any;
      const startsAtMs = row.startedAt ? new Date(row.startedAt).getTime() : nowMs;
      const endsAtMs = startsAtMs + (row.durationMinutes || 0) * 60000;
      return { row, endsAtMs, groupId, count: data.count };
    });

    const soloEntries = soloRows.map(row => {
      const startsAtMs = row.startedAt ? new Date(row.startedAt).getTime() : nowMs;
      const endsAtMs = startsAtMs + (row.durationMinutes || 0) * 60000;
      return { row, endsAtMs };
    });

    // Spec ordering: team first, then solo; within each group, soonest ending first.
    teamEntries.sort((a, b) => a.endsAtMs - b.endsAtMs);
    soloEntries.sort((a, b) => a.endsAtMs - b.endsAtMs);

    const lines = [];

    for (const t of teamEntries) {
      const startsAtMs = t.row.startedAt ? new Date(t.row.startedAt).getTime() : nowMs;
      const remainingMin = Math.max(0, Math.ceil((t.endsAtMs - nowMs) / 60000));
      const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
      const sprintIdentifier = formatSprintIdentifier({ type: t.row.type, groupId: t.row.groupId, label: t.row.label, startedAt: t.row.startedAt });
      const timingPrefix = nowMs < startsAtMs ? `(starts in ${startsInMin}m) ` : '';
      const sprinterWord = t.count === 1 ? 'sprinter' : 'sprinters';
      const label = `${timingPrefix}${sprintIdentifier} • ${t.count} ${sprinterWord}`.trim();
      lines.push(formatListLine('Team', remainingMin, t.row.userId, label));
    }

    for (const s of soloEntries) {
      const startsAtMs = s.row.startedAt ? new Date(s.row.startedAt).getTime() : nowMs;
      const remainingMin = Math.max(0, Math.ceil((s.endsAtMs - nowMs) / 60000));
      const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
      const sprintIdentifier = formatSprintIdentifier({ type: s.row.type, groupId: s.row.groupId, label: s.row.label, startedAt: s.row.startedAt });
      const timingPrefix = nowMs < startsAtMs ? `(starts in ${startsInMin}m) ` : '';
      const label = `${timingPrefix}${sprintIdentifier}`.trim();
      lines.push(formatListLine('Solo', remainingMin, s.row.userId, label));
    }

    const embed = listEmbeds(lines);
    await interaction.editReply({ embeds: [embed] });
    return;
  } else if (subGroup === 'wc') {
    return handleSprintWc(interaction, { guildId });
  } else if (subGroup === 'project') {
    const discordId = interaction.user.id;
    if (!(sub === 'use' || sub === 'clear')) {
      return interaction.editReply({ content: "Yeah, I don't know that one." });
    }

    const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    if (!actives.length) {
      return interaction.editReply({ content: 'No active sprint right now. Kick one off with `/sprint start`.', allowedMentions: { parse: [] } });
    }

    // Disambiguation: never guess wrong.
    let target = null;
    if (actives.length === 1) {
      target = actives[0];
    } else {
      const token = makeToken();
      setInteractionState(token, {
        guildId,
        userId: discordId,
        sprintProjectVerb: sub,
        projectInputRaw: (sub === 'use') ? (interaction.options.getString('project') || interaction.options.getString('project_id') || null) : null,
      });

      // Spec: team first, then solo; within group soonest ending first.
      const nowMs = Date.now();
      const candidates = actives.map(row => {
        const startsAtMs = row.startedAt ? new Date(row.startedAt).getTime() : nowMs;
        const endsAtMs = startsAtMs + (row.durationMinutes || 0) * 60000;
        return { row, endsAtMs };
      });
      candidates.sort((a, b) => {
        const aTeam = a.row.type === 'team' ? 0 : 1;
        const bTeam = b.row.type === 'team' ? 0 : 1;
        if (aTeam !== bTeam) return aTeam - bTeam;
        return a.endsAtMs - b.endsAtMs;
      });

      const select = new Discord.StringSelectMenuBuilder()
        .setCustomId(`sprintProjectSprintPick_${token}`)
        .setPlaceholder('Pick a sprint')
        .setMinValues(1)
        .setMaxValues(1);

      for (const c of candidates.slice(0, 25)) {
        const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
        const kindLabel = c.row.type === 'team' ? 'Team' : 'Solo';
        const startsAtMs = c.row.startedAt ? new Date(c.row.startedAt).getTime() : nowMs;
        const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
        const minsLeft = Math.max(0, Math.ceil((c.endsAtMs - nowMs) / 60000));
        const desc = nowMs < startsAtMs ? `Starts in ${startsInMin}m` : `Ends in ${minsLeft}m`;
        select.addOptions(
          new Discord.StringSelectMenuOptionBuilder()
            .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
            .setDescription(desc.slice(0, 100))
            .setValue(String(c.row.id))
        );
      }

      const row = new Discord.ActionRowBuilder().addComponents(select);
      return interaction.editReply({
        content: 'Which sprint are we linking? Pick one. I am not guessing.',
        components: [row],
        allowedMentions: { parse: [] },
      });
    }

    const sprintIdentifier = formatSprintIdentifier({ type: target.type, groupId: target.groupId, label: target.label, startedAt: target.startedAt });

    if (sub === 'clear') {
      await target.update({ projectId: null });
      return interaction.editReply({ content: `Alright. Unlinked: ${sprintIdentifier}`, allowedMentions: { parse: [] } });
    }

    const projectInputRaw = interaction.options.getString('project') || interaction.options.getString('project_id');
    let project = await resolveProjectFromInput({ discordId, projectInputRaw });

    if (!project) {
      const projects = await getUserProjects(discordId);
      if (!projects.length) {
        return interaction.editReply({ content: "You don't have any projects yet. Make one with `/project create`.", allowedMentions: { parse: [] } });
      }

      const token = makeToken();
      setInteractionState(token, {
        guildId,
        userId: discordId,
        sprintProjectVerb: 'use',
        sprintId: target.id,
      });

      const select = new Discord.StringSelectMenuBuilder()
        .setCustomId(`sprintProjectProjectPick_${token}`)
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
      return interaction.editReply({
        content: `Which project for ${sprintIdentifier}?`,
        components: [row],
        allowedMentions: { parse: [] },
      });
    }

    await target.update({ projectId: project.id });
    return interaction.editReply({
      content: `Alright. Linked: ${sprintIdentifier}\nProject: **${project.name}** (${project.publicId || project.id})`,
      allowedMentions: { parse: [] },
    });
  } else if (sub === 'setchannel') {
    const perms = interaction.memberPermissions;
    const isStaff = perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild) || perms?.has(PermissionFlagsBits.ManageChannels);
    if (!isStaff) {
      return interaction.editReply({ content: onlyStaffSetChannelText(), allowedMentions: { parse: [] } });
    }

    const chan = interaction.options.getChannel('channel');
    if (!chan || typeof chan.isTextBased !== 'function' || !chan.isTextBased()) {
      return interaction.editReply({ content: selectAChannelText(), allowedMentions: { parse: [] } });
    }
    const allowThreads = interaction.options.getBoolean('allow_threads');
    const allowThreadsByDefault = (typeof allowThreads === 'boolean') ? allowThreads : true;

    const existing = await GuildSprintSettings.findOne({ where: { guildId } });
    if (!existing) {
      await GuildSprintSettings.create({
        guildId,
        allowedChannelIds: [chan.id],
        blockedChannelIds: [],
        allowThreadsByDefault,
        defaultSummaryChannelId: chan.id,
      });
    } else {
      await existing.update({
        allowedChannelIds: [chan.id],
        allowThreadsByDefault,
        defaultSummaryChannelId: chan.id,
      });
    }

    return interaction.editReply({ content: sprintChannelSetText(chan.id, allowThreadsByDefault), allowedMentions: { parse: [] } });
  }

  return interaction.editReply({ content: "Yeah, I don't know that one.", allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('[Dean/sprint] Command error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Yeah, that's on me. Try that again in a sec.", allowedMentions: { parse: [] } });
      } else {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec.", allowedMentions: { parse: [] } });
      }
    } catch {}
  }
}
