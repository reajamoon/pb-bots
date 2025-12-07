import Discord from 'discord.js';
const { SlashCommandBuilder, MessageFlags, InteractionFlags } = Discord;
import { DeanSprints, GuildSprintSettings, User, sequelize, Wordcount, Project, ProjectMember } from '../../../models/index.js';
import { Op } from 'sequelize';
import { startSoloEmbed, hostTeamEmbed, joinTeamEmbed, endSoloEmbed, endTeamEmbed, statusSoloEmbed, statusTeamEmbed, leaveTeamEmbed, listEmbeds, formatListLine, notEnabledInChannelText, noActiveTeamText, alreadyActiveSprintText, noActiveSprintText, notInTeamSprintText, hostsUseEndText, selectAChannelText, onlyStaffSetChannelText, sprintChannelSetText } from '../text/sprintText.js';
import { scheduleSprintNotifications } from '../sprintScheduler.js';

export const data = new SlashCommandBuilder()
  .setName('sprint')
  .setDescription('Start or manage a writing sprint')
  .addSubcommand(sub => sub
    .setName('start')
    .setDescription('Start a sprint in this channel')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('host')
    .setDescription('Host a team sprint')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('join')
    .setDescription('Join the active team sprint in this channel')
    .addStringOption(opt => opt.setName('code').setDescription('Host code if multiple sprints exist')))
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
    await interaction.deferReply({ flags: wrongChannel ? InteractionFlags.Ephemeral : undefined });

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
    const label = interaction.options.getString('label') ?? undefined;

    // Upsert the user row if needed (using discordId)
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Persist the sprint row
    const startedAt = new Date();
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
    });

    await interaction.editReply({ embeds: [startSoloEmbed(minutes, label, 'public')] });
    await scheduleSprintNotifications(sprint, interaction.client);
  } else if (sub === 'host') {
    const minutes = interaction.options.getInteger('minutes');
    const label = interaction.options.getString('label') ?? undefined;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Generate a short group code
    const groupId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const startedAt = new Date();
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
    });
    await interaction.editReply({ embeds: [hostTeamEmbed(minutes, label, groupId)] });
    await scheduleSprintNotifications(hostRow, interaction.client);
  } else if (sub === 'join') {
    const codeRaw = interaction.options.getString('code');
    const provided = codeRaw ? codeRaw.toUpperCase() : undefined;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    let host;
    if (provided) {
      host = await DeanSprints.findOne({ where: { guildId, channelId, status: 'processing', type: 'team', groupId: provided, role: 'host' } });
    } else {
      host = await DeanSprints.findOne({ where: { guildId, channelId, status: 'processing', type: 'team', role: 'host' }, order: [['createdAt', 'DESC']] });
    }
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
    await interaction.editReply({ embeds: [joinTeamEmbed()] });
  } else if (sub === 'end') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText(), flags: InteractionFlags.Ephemeral });
    }
    if (active.type === 'team' && active.role === 'host' && active.groupId) {
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
      await interaction.editReply({ embeds: [endTeamEmbed()] });
    } else {
      await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null });
      // Fire Hunt trigger on solo sprint completion
      try {
        const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        const announce = makeDeanAnnouncer(interaction);
        await fireTrigger('dean.sprint.completed', { userId: discordId, announce });
      } catch (huntErr) {
        console.warn('[hunts] dean.sprint.completed trigger failed (solo):', huntErr);
      }
      await interaction.editReply({ embeds: [endSoloEmbed()] });
    }
  } else if (sub === 'status') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText(), flags: InteractionFlags.Ephemeral });
    }
    const endsAt = new Date(active.startedAt.getTime() + active.durationMinutes * 60000);
    const remainingMs = endsAt.getTime() - Date.now();
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      const count = await DeanSprints.count({ where: { guildId, groupId: active.groupId, status: 'processing' } });
      await interaction.editReply({ embeds: [statusTeamEmbed(remainingMin, count, active.label)] });
    } else {
      await interaction.editReply({ embeds: [statusSoloEmbed(remainingMin, active.label)] });
    }
  } else if (sub === 'leave') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing', type: 'team' } });
    if (!active) {
      return interaction.editReply({ content: notInTeamSprintText(), flags: InteractionFlags.Ephemeral });
    }
    if (active.role === 'host') {
      return interaction.editReply({ content: hostsUseEndText() });
    }
    await active.update({ status: 'done', endNotified: true });
    await interaction.editReply({ embeds: [leaveTeamEmbed()] });
  } else if (sub === 'list') {
    const sprints = await DeanSprints.findAll({ where: { guildId, channelId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    const lines = sprints.map(s => {
      const endsAt = new Date(s.startedAt.getTime() + s.durationMinutes * 60000);
      const remainingMin = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 60000));
      const kind = s.type === 'team' ? (s.role === 'host' ? 'Team host' : 'Team') : 'Solo';
      return formatListLine(kind, remainingMin, s.userId, s.label);
    });
    const embed = listEmbeds(lines);
    await interaction.editReply({ embeds: [embed] });
  } else if (interaction.options.getSubcommandGroup() === 'wc') {
    const discordId = interaction.user.id;
    // Resolve target sprint: active, else most recent within grace window
    const GRACE_MINUTES = 15;
    const now = Date.now();
    let target = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!target) {
      const recent = await DeanSprints.findOne({ where: { userId: discordId, guildId }, order: [['updatedAt', 'DESC']] });
      if (recent) {
        const endedAt = recent.startedAt ? (new Date(recent.startedAt.getTime() + (recent.durationMinutes || 0) * 60000)) : recent.updatedAt;
        const withinGrace = endedAt && (now - endedAt.getTime()) <= GRACE_MINUTES * 60000;
        if (withinGrace) {
          target = recent;
        }
      }
    }
    if (!target) {
      return interaction.editReply({ content: noActiveSprintText() });
    }
    const subName = interaction.options.getSubcommand();
    if (subName === 'set') {
      const count = interaction.options.getInteger('count');
      if (count < 0) {
        return interaction.editReply({ content: 'Wordcount must be zero or greater.' });
      }
      // Find last wordcount for this sprint/user
      const last = await Wordcount.findOne({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'DESC']] });
      const prev = last ? (last.countEnd ?? 0) : 0;
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
      let msg = `Locked in at **${count}**.`;
      msg += `\nWords gained since last update: **${delta >= 0 ? '+' : ''}${delta}**`;
      msg += `\nTotal gained this sprint: **${sprintTotal}**`;
      msg += `\nTotal gained today: **${dayTotal}**`;
      msg += `\nUpdates this sprint: **${updates}**`;
      msg += `\nBest single update this sprint: **${maxGain}**`;
      // Hunt: check 5k single-sprint total
      try {
        const fireTrigger = (await import('../../../shared/hunts/triggerEngine.js')).default;
        const makeDeanAnnouncer = (await import('../utils/huntsAnnouncer.js')).default;
        const announce = makeDeanAnnouncer(interaction);
        await fireTrigger('dean.sprint.wordcount.check', { userId: discordId, sprintTotal, announce });
      } catch (huntErr) { console.warn('[hunts] dean.sprint.wordcount.check failed:', huntErr); }
      return interaction.editReply({ content: msg });
    } else if (subName === 'add') {
      const words = interaction.options.getInteger('new-words');
      if (words <= 0) {
        return interaction.editReply({ content: 'Words must be a positive number.' });
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
        await fireTrigger('dean.sprint.wordcount.check', { userId: discordId, sprintTotal, announce });
      } catch (huntErr) { console.warn('[hunts] dean.sprint.wordcount.check failed:', huntErr); }
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

  // wc undo
  if (interaction.options.getSubcommandGroup() === 'wc' && interaction.options.getSubcommand() === 'undo') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText() });
    }
    const last = await Wordcount.findOne({ where: { sprintId: active.id, userId: discordId }, order: [['recordedAt', 'DESC']] });
    if (!last) {
      return interaction.editReply({ content: "No wordcount to undo, partner." });
    }
    await last.destroy();
    const rows = await Wordcount.findAll({ where: { sprintId: active.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
    const totalRaw = rows.reduce((acc, r) => {
      const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
      return acc + (d > 0 ? d : 0);
    }, 0);
    const next = Math.max(0, totalRaw);
    await active.update({ wordcountEnd: next });
    return interaction.editReply({ content: `Undone. Sitting at **${next}**.` });
  }
  } catch (err) {
    console.error('[Dean/sprint] Command error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Yeah, that's on me. Try that again in a sec." });
      } else {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec.", flags: MessageFlags.SuppressNotifications });
      }
    } catch (e) {}
  }
}
