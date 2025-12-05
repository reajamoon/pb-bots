import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { DeanSprints, GuildSprintSettings, User, sequelize, Wordcount, Project, ProjectMember } from '../../../models/index.js';
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
    await interaction.deferReply({ ephemeral: wrongChannel });

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
    await interaction.editReply({ embeds: [joinTeamEmbed()] });
  } else if (sub === 'end') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText(), ephemeral: true });
    }
    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      // End the team (host + all participants)
      await DeanSprints.update({ status: 'done', endNotified: true }, { where: { guildId, groupId: active.groupId, status: 'processing' } });
      await interaction.editReply({ embeds: [endTeamEmbed()] });
    } else {
      await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null });
      await interaction.editReply({ embeds: [endSoloEmbed()] });
    }
  } else if (sub === 'status') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText(), ephemeral: true });
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
      return interaction.editReply({ content: notInTeamSprintText(), ephemeral: true });
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
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: noActiveSprintText() });
    }
    const subName = interaction.options.getSubcommand();
    if (subName === 'set') {
      const count = interaction.options.getInteger('count');
      if (count < 0) {
        return interaction.editReply({ content: 'Wordcount must be zero or greater.' });
      }
      await active.update({ wordcountEnd: count });
      await Wordcount.create({
        userId: discordId,
        projectId: active.projectId || null,
        sprintId: active.id,
        countStart: null,
        countEnd: count,
        delta: null,
        recordedAt: new Date(),
      });
      return interaction.editReply({ content: `Alright, locked in at **${count}**. Keep it rolling.` });
    } else if (subName === 'add') {
      const words = interaction.options.getInteger('new-words');
      if (words <= 0) {
        return interaction.editReply({ content: 'Words must be a positive number.' });
      }
      const next = (active.wordcountEnd || 0) + words;
      await active.update({ wordcountEnd: next });
      await Wordcount.create({
        userId: discordId,
        projectId: active.projectId || null,
        sprintId: active.id,
        countStart: active.wordcountEnd || 0,
        countEnd: next,
        delta: words,
        recordedAt: new Date(),
      });
      return interaction.editReply({ content: `Nice. **+${words}**. Sitting at **${next}**.` });
    } else if (subName === 'show') {
      const wc = active.wordcountEnd ?? 0;
      return interaction.editReply({ content: `You’re at **${wc}**. Take a breath, then hit it again.` });
    } else if (subName === 'summary') {
      const participants = active.type === 'team' && active.groupId
        ? await DeanSprints.findAll({ where: { guildId, groupId: active.groupId }, order: [['createdAt', 'ASC']] })
        : [active];
      const linesSum = [];
      for (const p of participants) {
        const rows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
        const totalRaw = rows.reduce((acc, r) => {
          const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
          return acc + (d > 0 ? d : 0);
        }, 0);
        const total = Math.max(0, totalRaw);
        let extra = '';
        if (p.projectId) {
          const proj = await Project.findByPk(p.projectId).catch(() => null);
          if (proj?.name) extra = ` (${proj.name})`;
        }
        linesSum.push(`• <@${p.userId}>: ${total} words${extra}`);
      }
      const content = linesSum.join('\n') || 'Nobody dropped numbers yet. Wanna be first?';
      return interaction.editReply({ content: `Here’s the tally so far:\n${content}` });
  } else if (interaction.options.getSubcommandGroup() === 'project') {
    const discordId = interaction.user.id;
    const subName = interaction.options.getSubcommand();
    if (subName === 'use') {
          const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }] });
          project = memberships.map(m => m.Project).find(p => p?.name === name) || null;
        }
      } else {
        // Fallback to most recently updated owned project, else latest membership
        project = await Project.findOne({ where: { ownerId: discordId }, order: [["updatedAt", "DESC"]] });
        if (!project) {
          const membership = await ProjectMember.findOne({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }], order: [["updatedAt", "DESC"]] });
          project = membership?.Project || null;
        }
      }
      if (!project) {
        `Created: ${new Date(project.createdAt).toLocaleString()}`,
        `ID: ${project.id}`,
      ];
      return interaction.editReply({ content: lines.join('\n') });
    } else if (subName === 'list') {
      const memberships = await ProjectMember.findAll({ where: { userId: discordId }, limit: 50 });
      if (!memberships.length) {
        return interaction.editReply({ content: "You're not on any projects yet." });
      }
      const ids = memberships.map(m => m.projectId);
      const projects = await Project.findAll({ where: { id: ids } });
      const lines = projects.map(p => `• **${p.name}** (${p.id})`).join('\n');
      return interaction.editReply({ content: `Your projects:\n${lines}` });
    } else if (subName === 'invite') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked up to this sprint, champ.' });
      }
      // Owner or mod required
      const requester = await User.findOne({ where: { discordId } });
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const project = await Project.findByPk(active.projectId);
      const isOwner = project && project.ownerId === discordId;
      const isPrivileged = level !== 'member';
      if (!isOwner && !isPrivileged) {
        return interaction.editReply({ content: 'Only the owner or a mod can invite folks.', ephemeral: true });
      }
      const member = interaction.options.getUser('member');
      await ProjectMember.findOrCreate({ where: { projectId: active.projectId, userId: member.id }, defaults: { role: 'member' } });
      return interaction.editReply({ content: `Pulled <@${member.id}> onto the crew.` });
    } else if (subName === 'remove') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked up to this sprint, champ.' });
      }
      const member = interaction.options.getUser('member');
        const confirm = interaction.options.getBoolean('confirm') ?? false;
        if (!confirm) {
          return interaction.editReply({ content: `You sure you wanna boot <@${member.id}>? Re-run with **confirm:true**.` });
        }
      const requester = await User.findOne({ where: { discordId } });
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const project = await Project.findByPk(active.projectId);
      const isOwner = project && project.ownerId === discordId;
      const isPrivileged = level !== 'member';
      if (!isOwner && !isPrivileged) {
        return interaction.editReply({ content: 'Heads up: only the owner or a mod can boot folks.', ephemeral: true });
      }
      await ProjectMember.destroy({ where: { projectId: active.projectId, userId: member.id } });
      return interaction.editReply({ content: `Alright, <@${member.id}> is off the roster.` });
    } else if (subName === 'leave') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked up to this sprint, champ.' });
      }
        const confirm = interaction.options.getBoolean('confirm') ?? false;
        if (!confirm) {
          return interaction.editReply({ content: 'You sure you wanna bail on this project? Re-run with **confirm:true**.' });
        }
      const projectId = active.projectId;
      const project = await Project.findByPk(projectId);
      if (project && project.ownerId === discordId) {
        return interaction.editReply({ content: "You're the owner, buddy. Transfer ownership first or end the project." });
      }
      await ProjectMember.destroy({ where: { projectId, userId: discordId } });
      // If sprint is linked to that project, clear it
      await active.update({ projectId: null });
      return interaction.editReply({ content: 'You’re off the crew. Sprint unlinked from that project.' });
    } else if (subName === 'use') {
      const projectId = interaction.options.getString('project_id');
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active) {
        return interaction.editReply({ content: noActiveSprintText() });
      }
      // Validate membership
      const member = await ProjectMember.findOne({ where: { projectId, userId: discordId } });
      if (!member) {
        return interaction.editReply({ content: 'You’re not on that project, buddy. Get invited first.' });
      }
      await active.update({ projectId });
      return interaction.editReply({ content: `Locked this sprint to project **${projectId}**. Let’s get those pages.` });
    } else if (subName === 'members') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No active project on this sprint.' });
      }
        const confirm = interaction.options.getBoolean('confirm') ?? false;
        const target = interaction.options.getUser('member');
        if (!confirm) {
          return interaction.editReply({ content: `Transfer ownership to <@${target.id}>? Re-run with **confirm:true**.` });
        }
      const members = await ProjectMember.findAll({ where: { projectId: active.projectId }, limit: 50 });
      const list = members.map(m => `• <@${m.userId}> (${m.role})`).join('\n') || 'Just you right now. That’s fine, solo hero arc.';
      return interaction.editReply({ content: `Crew roll call:\n${list}` });
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
    } catch {}
  }
}
