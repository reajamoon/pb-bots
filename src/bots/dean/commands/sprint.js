import Discord from 'discord.js';
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = Discord;
import { DeanSprints, GuildSprintSettings, User, sequelize, Wordcount, Project, ProjectMember } from '../../../models/index.js';
import { Op } from 'sequelize';
import { startSoloEmbed, hostTeamEmbed, listEmbeds, formatListLine, notEnabledInChannelText, noActiveTeamText, alreadyActiveSprintText, noActiveSprintText, notInTeamSprintText, hostsUseEndText, selectAChannelText, onlyStaffSetChannelText, sprintChannelSetText, formatSprintIdentifier, sprintJoinText, sprintLeaveText, sprintStatusWordsText, sprintEndedWordsText } from '../text/sprintText.js';
import { scheduleSprintNotifications } from '../sprintScheduler.js';
import { handleSprintWc } from '../utils/handleSprintWc.js';

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
  const subGroup = interaction.options.getSubcommandGroup(false);

  function baselineNudgeText() {
    return "Quick heads up: if you're using absolute totals, set a baseline with `/sprint wc baseline count:YOUR_START` so `/sprint wc set` doesn't count your whole draft as sprint words.";
  }

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
    await interaction.followUp({ content: baselineNudgeText(), allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    await scheduleSprintNotifications(sprint, interaction.client);
    return;
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
    await interaction.followUp({ content: baselineNudgeText(), allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    await scheduleSprintNotifications(hostRow, interaction.client);
    return;
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
    await interaction.followUp({ content: baselineNudgeText(), flags: MessageFlags.Ephemeral });
    return;
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
    return;
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
    return;
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
    return;
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
    return;
  } else if (subGroup === 'wc') {
    return handleSprintWc(interaction, { guildId });
  } else if (subGroup === 'project') {
    const discordId = interaction.user.id;
    if (sub !== 'use') {
      return interaction.editReply({ content: "Yeah, I don't know that one." });
    }
    const projectIdRaw = interaction.options.getString('project_id');
    if (!projectIdRaw) {
      return interaction.editReply({ content: "I need a project ID, champ. Grab it from `/project list` and try again.", allowedMentions: { parse: [] } });
    }
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: 'No active sprint right now. Kick one off with `/sprint start`.', allowedMentions: { parse: [] } });
    }
    const project = await Project.findByPk(projectIdRaw).catch(() => null);
    if (!project) {
      return interaction.editReply({ content: "Nope. Can't find that project. Try `/project list`." , allowedMentions: { parse: [] } });
    }
    const membership = await ProjectMember.findOne({ where: { projectId: project.id, userId: discordId } }).catch(() => null);
    if (!membership && project.ownerId !== discordId) {
      return interaction.editReply({ content: "You're not on that project, buddy. Get invited first.", allowedMentions: { parse: [] } });
    }
    await active.update({ projectId: project.id });
    return interaction.editReply({ content: `Alright. This sprint is linked to **${project.name}**.`, allowedMentions: { parse: [] } });
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
