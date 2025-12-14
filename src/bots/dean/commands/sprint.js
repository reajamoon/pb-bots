import Discord from 'discord.js';
const { SlashCommandBuilder, MessageFlags } = Discord;
import { DeanSprints, GuildSprintSettings, User, sequelize, Wordcount, Project, ProjectMember } from '../../../models/index.js';
import { Op } from 'sequelize';
import { startSoloEmbed, hostTeamEmbed, listEmbeds, formatListLine, notEnabledInChannelText, noActiveTeamText, alreadyActiveSprintText, noActiveSprintText, notInTeamSprintText, hostsUseEndText, selectAChannelText, onlyStaffSetChannelText, sprintChannelSetText, formatSprintIdentifier, sprintJoinText, sprintLeaveText, sprintStatusWordsText, sprintEndedWordsText } from '../text/sprintText.js';
import { scheduleSprintNotifications } from '../sprintScheduler.js';

export const data = new SlashCommandBuilder()
  .setName('sprint')
  .setDescription('Start or manage a writing sprint')
  .addSubcommand(sub => sub
    .setName('start')
    .setDescription('Start a sprint in this channel')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addIntegerOption(opt => opt.setName('start_in').setDescription('Delay start by N minutes (default 1)').setRequired(false))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('host')
    .setDescription('Host a team sprint')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addIntegerOption(opt => opt.setName('start_in').setDescription('Delay start by N minutes (default 1)').setRequired(false))
    .addBooleanOption(opt => opt.setName('pings').setDescription('Enable pre-start reminder pings during the delay (team only)').setRequired(false))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('join')
    .setDescription('Join the active team sprint in this channel')
    .addStringOption(opt => opt.setName('code').setDescription('Host code').setRequired(true)))
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
    .addStringOption(opt => opt.setName('project_id').setDescription('Project ID').setRequired(true)))
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
  if (sub === 'start') {
    const minutes = interaction.options.getInteger('minutes');
    const startInRaw = interaction.options.getInteger('start_in');
    const startDelayMinutes = Math.max(0, Math.min(180, (typeof startInRaw === 'number' ? startInRaw : 1)));
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
      startedAt,
      durationMinutes: minutes,
      status: 'processing',
      label,
      joinedAt: startedAt,
      startDelayMinutes,
      preStartPingsEnabled: false,
    });

    await interaction.editReply({ embeds: [startSoloEmbed(minutes, label, 'public')] });
    if (startDelayMinutes > 0) {
      await interaction.followUp({
        content: `Alright. Sprint's queued. Starts in **${startDelayMinutes}** minute${startDelayMinutes === 1 ? '' : 's'}. Use the buffer to set your baseline and get comfy.`,
        allowedMentions: { parse: [] },
      });
    }
    await scheduleSprintNotifications(sprint, interaction.client);
  } else if (sub === 'host') {
    const minutes = interaction.options.getInteger('minutes');
    const startInRaw = interaction.options.getInteger('start_in');
    const startDelayMinutes = Math.max(0, Math.min(180, (typeof startInRaw === 'number' ? startInRaw : 1)));
    const preStartPingsEnabled = interaction.options.getBoolean('pings') ?? false;
    const label = interaction.options.getString('label') ?? undefined;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Generate a short group code
    const groupId = Math.random().toString(36).slice(2, 8).toUpperCase();
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
      startedAt,
      durationMinutes: minutes,
      status: 'processing',
      label,
      joinedAt: startedAt,
      startDelayMinutes,
      preStartPingsEnabled,
    });
    await interaction.editReply({ embeds: [hostTeamEmbed(minutes, label, groupId)] });
    if (startDelayMinutes > 0) {
      await interaction.followUp({
        content: `Alright, gang. Starts in **${startDelayMinutes}** minute${startDelayMinutes === 1 ? '' : 's'}. Join up, grab a drink, set your baseline.`,
        allowedMentions: { parse: [] },
      });
    }
    await scheduleSprintNotifications(hostRow, interaction.client);
  } else if (sub === 'join') {
    const codeRaw = interaction.options.getString('code');
    const provided = codeRaw ? codeRaw.toUpperCase() : undefined;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    const host = await DeanSprints.findOne({ where: { guildId, channelId, status: 'processing', type: 'team', groupId: provided, role: 'host' } });
    if (!host) {
      return interaction.editReply({ content: noActiveTeamText() });
    }
    const existing = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (existing) {
      return interaction.editReply({ content: alreadyActiveSprintText() });
    }
    await DeanSprints.create({
      userId: discordId,
      hostId: host.hostId || host.userId,
      groupId: host.groupId,
      role: 'participant',
      guildId,
      channelId,
      threadId,
      type: 'team',
      visibility: host.visibility,
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
    await interaction.editReply({ content: sprintJoinText({ sprintIdentifier, durationMinutes: host.durationMinutes }), allowedMentions: { parse: [] } });
  } else if (sub === 'end') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText() });
    }
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
        const total = rows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
        scores.push({ userId: p.userId, total });
      }
      scores.sort((a, b) => (b.total || 0) - (a.total || 0));
      const lines = [];
      for (let i = 0; i < scores.length; i++) {
        const name = await safeName(scores[i].userId);
        lines.push(`${i + 1}) ${name} - NET ${scores[i].total || 0}`);
      }
      return lines;
    }

    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      const participants = await DeanSprints.findAll({ where: { guildId, groupId: active.groupId, status: 'processing' }, order: [['createdAt', 'ASC']] });
      const participantIds = participants.map(p => p.userId);
      const pingLine = participantIds.length ? participantIds.map(id => `<@${id}>`).join(' ') : '';
      const leaderboardLines = await buildLeaderboardLines(participants);
      // End the team (host + all participants)
      await DeanSprints.update({ status: 'done', endNotified: true }, { where: { guildId, groupId: active.groupId, status: 'processing' } });
      try {
        const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        const announce = makeDeanAnnouncer(interaction);
        await fireTrigger('dean.sprint.completed', { userId: discordId, announce, interaction });
      } catch (huntErr) {
        console.warn('[hunts] dean.sprint.completed trigger failed:', huntErr);
      }
      await interaction.editReply({
        content: sprintEndedWordsText({ pingLine, sprintIdentifier, durationMinutes: active.durationMinutes, leaderboardLines }),
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
        await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null });
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
        content: sprintEndedWordsText({ pingLine, sprintIdentifier, durationMinutes: active.durationMinutes, leaderboardLines }),
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
  } else if (sub === 'status') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText() });
    }
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
    const rows = await Wordcount.findAll({ where: { sprintId: active.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
    const sprintTotal = rows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
    await interaction.editReply({
      content: sprintStatusWordsText({
        sprintIdentifier,
        timeLeftMinutes: remainingMin,
        yourNetWordsSoFar: sprintTotal,
        yourMinutesSoFar: elapsedMin,
      }),
      allowedMentions: { parse: [] },
    });
  } else if (sub === 'leave') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing', type: 'team' } });
    if (!active) {
      return interaction.editReply({ content: notInTeamSprintText() });
    }
    if (active.role === 'host') {
      return interaction.editReply({ content: hostsUseEndText() });
    }
    const sprintIdentifier = formatSprintIdentifier({ type: active.type, groupId: active.groupId, label: active.label, startedAt: active.startedAt });
    try {
      await active.update({ status: 'done', endNotified: true, endedAt: new Date() });
    } catch (e) {
      console.warn('[dean] failed to persist endedAt on leave:', e?.message || e);
      await active.update({ status: 'done', endNotified: true });
    }
    await interaction.editReply({ content: sprintLeaveText({ sprintIdentifier }), allowedMentions: { parse: [] } });
  } else if (sub === 'list') {
    const sprints = await DeanSprints.findAll({ where: { guildId, channelId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    const lines = sprints.map(s => {
      const nowMs = Date.now();
      const startsAtMs = new Date(s.startedAt).getTime();
      const endsAtMs = startsAtMs + s.durationMinutes * 60000;
      const remainingMin = Math.max(0, Math.ceil((endsAtMs - nowMs) / 60000));
      const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
      const kind = s.type === 'team' ? (s.role === 'host' ? 'Team host' : 'Team') : 'Solo';
      const label = nowMs < startsAtMs ? `(starts in ${startsInMin}m) ${s.label || ''}`.trim() : s.label;
      return formatListLine(kind, remainingMin, s.userId, label);
    });
    const embed = listEmbeds(lines);
    await interaction.editReply({ embeds: [embed] });
  } else if (interaction.options.getSubcommandGroup() === 'wc') {
    const discordId = interaction.user.id;

    function clampInt(value, min, max, fallback) {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, Math.trunc(n)));
    }

    async function getLateLogWindowMinutes() {
      try {
        const u = await User.findOne({ where: { discordId } });
        return clampInt(u?.sprintRecentlyEndedWindowMinutes, 0, 360, 15);
      } catch {
        return 15;
      }
    }

    function getSprintEndedAtCandidate(sprintRow) {
      if (!sprintRow) return null;
      if (sprintRow.endedAt) return new Date(sprintRow.endedAt);
      if (sprintRow.startedAt && sprintRow.durationMinutes) {
        return new Date(new Date(sprintRow.startedAt).getTime() + sprintRow.durationMinutes * 60000);
      }
      if (sprintRow.updatedAt) return new Date(sprintRow.updatedAt);
      return null;
    }

    async function resolveWcTarget() {
      const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] });
      if (actives.length > 1) {
        return { error: "You've got more than one active sprint, buddy. I can't guess which one you mean. End the one you're done with, or use `/sprint list` to see what's running." };
      }
      if (actives.length === 1) return { target: actives[0] };

      const windowMinutes = await getLateLogWindowMinutes();
      if (windowMinutes <= 0) {
        return { error: noActiveSprintText() };
      }

      const recent = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'done' }, order: [['endedAt', 'DESC'], ['updatedAt', 'DESC']] });
      if (!recent) return { error: noActiveSprintText() };

      const endedAt = getSprintEndedAtCandidate(recent);
      if (!endedAt) return { error: noActiveSprintText() };
      const withinWindow = (Date.now() - endedAt.getTime()) <= windowMinutes * 60000;
      if (!withinWindow) return { error: noActiveSprintText() };

      return { target: recent, isLateLog: true, lateLogWindowMinutes: windowMinutes };
    }

    async function safeName(userId, guild) {
      try {
        if (guild && guild.members) {
          const m = await guild.members.fetch(userId);
          return m?.displayName || m?.user?.username || userId;
        }
      } catch {}
      return userId;
    }

    async function buildLeaderboardLines(participantRows, guild) {
      const scores = [];
      for (const p of participantRows) {
        const rows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
        const total = rows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
        scores.push({ userId: p.userId, total });
      }
      scores.sort((a, b) => (b.total || 0) - (a.total || 0));
      const lines = [];
      for (let i = 0; i < scores.length; i++) {
        const name = await safeName(scores[i].userId, guild);
        lines.push(`${i + 1}) ${name} - NET ${scores[i].total || 0}`);
      }
      return lines;
    }

    async function getEndSummaryRef(sprintRow) {
      if (sprintRow?.endSummaryChannelId && sprintRow?.endSummaryMessageId) {
        return { channelId: sprintRow.endSummaryChannelId, messageId: sprintRow.endSummaryMessageId };
      }
      if (sprintRow?.type === 'team' && sprintRow?.groupId) {
        const any = await DeanSprints.findOne({ where: { guildId, groupId: sprintRow.groupId, endSummaryMessageId: { [Op.ne]: null } }, order: [['updatedAt', 'DESC']] }).catch(() => null);
        if (any?.endSummaryChannelId && any?.endSummaryMessageId) {
          return { channelId: any.endSummaryChannelId, messageId: any.endSummaryMessageId };
        }
      }
      return null;
    }

    async function maybeEditEndSummary(sprintRow) {
      if (!sprintRow || sprintRow.status !== 'done') return;

      const windowMinutes = await getLateLogWindowMinutes();
      const endedAt = getSprintEndedAtCandidate(sprintRow);
      if (!endedAt) return;
      if ((Date.now() - endedAt.getTime()) > windowMinutes * 60000) return;

      const ref = await getEndSummaryRef(sprintRow);
      if (!ref) return;

      try {
        const channel = await interaction.client.channels.fetch(ref.channelId).catch(() => null);
        if (!channel || typeof channel.messages?.fetch !== 'function') return;
        const msg = await channel.messages.fetch(ref.messageId).catch(() => null);
        if (!msg) return;

        const participants = (sprintRow.type === 'team' && sprintRow.groupId)
          ? await DeanSprints.findAll({ where: { guildId, groupId: sprintRow.groupId }, order: [['createdAt', 'ASC']] })
          : [sprintRow];
        const participantIds = participants.map(p => p.userId);
        const pingLine = participantIds.length ? participantIds.map(id => `<@${id}>`).join(' ') : '';
        const sprintIdentifier = formatSprintIdentifier({ type: sprintRow.type, groupId: sprintRow.groupId, label: sprintRow.label, startedAt: sprintRow.startedAt });
        const leaderboardLines = await buildLeaderboardLines(participants, interaction.guild);
        const content = sprintEndedWordsText({ pingLine, sprintIdentifier, durationMinutes: sprintRow.durationMinutes, leaderboardLines });

        await msg.edit({ content, allowedMentions: { parse: [] } });
      } catch (e) {
        console.warn('[dean] late-log end summary edit failed:', e?.message || e);
      }
    }

    const resolved = await resolveWcTarget();
    if (resolved.error) {
      return interaction.editReply({ content: resolved.error });
    }
    const target = resolved.target;

    const subName = interaction.options.getSubcommand();
    if (subName === 'set') {
      const count = interaction.options.getInteger('count');
      if (count < 0) {
        await interaction.followUp({ content: "Wordcount's gotta be at least zero, buddy. If you want to bump numbers, use `/sprint wc add`. If you need to undo a bad update, try `/sprint wc undo`.", flags: MessageFlags.Ephemeral });
        return;
      }
      // Find last wordcount for this sprint/user
      const last = await Wordcount.findOne({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'DESC']] });
      // Fallback to sprint's tracked end if no row found to avoid zero-based spikes
      const prev = last && typeof last.countEnd === 'number' ? last.countEnd : (typeof target.wordcountEnd === 'number' ? target.wordcountEnd : 0);
      const delta = count - prev;
      await target.update({ wordcountEnd: count });
      await Wordcount.create({
        userId: discordId,
        projectId: target.projectId || null,
        sprintId: target.id,
        countStart: prev,
        countEnd: count,
        delta,
        recordedAt: new Date(),
      });
      // Sprint stats
      const allRows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
      const sprintTotal = allRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      const updates = allRows.length;
      const maxGain = allRows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
      // Daily stats
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const dayRows = await Wordcount.findAll({ where: { userId: discordId, recordedAt: { [Op.gte]: startOfDay } }, order: [['recordedAt', 'ASC']] });
      const dayTotal = dayRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      // Feedback
      const sinceLabel = last ? 'since last update' : 'since sprint start';
      let msg = `Locked in at **${count}**.`;
      msg += `\nWords gained ${sinceLabel}: **${delta >= 0 ? '+' : ''}${delta}**`;
      msg += `\nTotal gained this sprint: **${sprintTotal}**`;
      msg += `\nTotal gained today: **${dayTotal}**`;
      msg += `\nUpdates this sprint: **${updates}**`;
      msg += `\nBest single update this sprint: **${maxGain}**`;
      // Hunt: check 5k single-sprint total
      try {
        const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        const announce = makeDeanAnnouncer(interaction);
        await fireTrigger('dean.sprint.wordcount.check', { userId: discordId, sprintTotal, announce, interaction });
      } catch (huntErr) { console.warn('[hunts] dean.sprint.wordcount.check failed:', huntErr); }

      await maybeEditEndSummary(target);
      return interaction.editReply({ content: msg });
    } else if (subName === 'add') {
      const words = interaction.options.getInteger('new-words');
      if (words <= 0) {
        await interaction.followUp({ content: 'New words gotta be a positive number, buddy. If you need to change your total words use `/sprint wc set` instead, or you can use `/sprint wc undo` if you wanna undo the last wordcount change you made.', flags: MessageFlags.Ephemeral });
        return;
      }
      const prev = target.wordcountEnd || 0;
      const next = prev + words;
      await target.update({ wordcountEnd: next });
      await Wordcount.create({
        userId: discordId,
        projectId: target.projectId || null,
        sprintId: target.id,
        countStart: prev,
        countEnd: next,
        delta: words,
        recordedAt: new Date(),
      });
      // Sprint stats
      const allRows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
      const sprintTotal = allRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      const updates = allRows.length;
      const maxGain = allRows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
      // Daily stats
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const dayRows = await Wordcount.findAll({ where: { userId: discordId, recordedAt: { [Op.gte]: startOfDay } }, order: [['recordedAt', 'ASC']] });
      const dayTotal = dayRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      // Feedback
      let msg = `Nice. **+${words}**. Sitting at **${next}**.`;
      msg += `\nTotal gained this sprint: **${sprintTotal}**`;
      msg += `\nTotal gained today: **${dayTotal}**`;
      msg += `\nUpdates this sprint: **${updates}**`;
      msg += `\nBest single update this sprint: **${maxGain}**`;
      // Hunt: check 5k single-sprint total
      try {
        const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        const announce = makeDeanAnnouncer(interaction);
        await fireTrigger('dean.sprint.wordcount.check', { userId: discordId, sprintTotal, announce, interaction });
      } catch (huntErr) { console.warn('[hunts] dean.sprint.wordcount.check failed:', huntErr); }

      await maybeEditEndSummary(target);
      return interaction.editReply({ content: msg });
    } else if (subName === 'show') {
      const wc = target.wordcountEnd ?? 0;
      // Sprint stats
      const allRows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
      const sprintTotal = allRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      const updates = allRows.length;
      const maxGain = allRows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
      const first = allRows.length ? allRows[0].countEnd ?? allRows[0].countStart ?? 0 : 0;
      // Daily stats
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const dayRows = await Wordcount.findAll({ where: { userId: discordId, recordedAt: { [Op.gte]: startOfDay } }, order: [['recordedAt', 'ASC']] });
      const dayTotal = dayRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      let msg = `Current wordcount: **${wc}**`;
      msg += `\nStarted at: **${first}**`;
      msg += `\nTotal gained this sprint: **${sprintTotal}**`;
      msg += `\nTotal gained today: **${dayTotal}**`;
      msg += `\nUpdates this sprint: **${updates}**`;
      msg += `\nBest single update this sprint: **${maxGain}**`;
      return interaction.editReply({ content: msg });
    } else if (subName === 'summary') {
      const participants = target.type === 'team' && target.groupId
        ? await DeanSprints.findAll({ where: { guildId, groupId: target.groupId }, order: [['createdAt', 'ASC']] })
        : [target];
      const linesSum = [];
      for (const p of participants) {
        const rows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
        const total = rows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
        const updates = rows.length;
        const maxGain = rows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
        const first = rows.length ? rows[0].countEnd ?? rows[0].countStart ?? 0 : 0;
        const last = rows.length ? rows[rows.length - 1].countEnd ?? rows[rows.length - 1].countStart ?? 0 : 0;
        let extra = '';
        if (p.projectId) {
          let proj = null;
          try {
            proj = await Project.findByPk(p.projectId);
          } catch (e) {
            proj = null;
          }
          if (proj && proj.name) extra = ` (${proj.name})`;
        }
        linesSum.push(`• <@${p.userId}>: **${total}** words${extra} (updates: ${updates}, best: ${maxGain}, start: ${first}, end: ${last})`);
      }
      const content = linesSum.join('\n') || 'Nobody dropped numbers yet. Wanna be first?';
      return interaction.editReply({ content: `Here’s the tally so far:\n${content}` });
    } else if (subName === 'undo') {
      const last = await Wordcount.findOne({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'DESC']] });
      if (!last) {
        await interaction.followUp({ content: "No wordcount to undo, partner.", flags: MessageFlags.Ephemeral });
        return;
      }
      await last.destroy();
      const rows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
      const totalRaw = rows.reduce((acc, r) => {
        const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
        return acc + (d > 0 ? d : 0);
      }, 0);
      const next = Math.max(0, totalRaw);
      await target.update({ wordcountEnd: next });

      await maybeEditEndSummary(target);
      return interaction.editReply({ content: `Undone. Sitting at **${next}**.` });
    }
  } else if (interaction.options.getSubcommandGroup() === 'project') {
    const discordId = interaction.user.id;
    const subName = interaction.options.getSubcommand();
    if (subName === 'use') {
      const projectId = interaction.options.getString('project_id');
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active) {
        return interaction.editReply({ content: noActiveSprintText() });
      }
      const member = await ProjectMember.findOne({ where: { projectId, userId: discordId } });
      if (!member) {
        return interaction.editReply({ content: 'You’re not on that project, buddy. Get invited first.' });
      }
      await active.update({ projectId });
      return interaction.editReply({ content: `Locked this sprint to project **${projectId}**. Let’s get those pages.` });
    }
  }
  } catch (err) {
    console.error('[Dean/sprint] Command error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Yeah, that's on me. Try that again in a sec." });
      } else {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec.", flags: MessageFlags.Ephemeral });
      }
    } catch (e) {}
  }
}
