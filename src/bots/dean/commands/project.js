import { SlashCommandBuilder } from 'discord.js';
import { DeanSprints, GuildSprintSettings, User, Project, ProjectMember, Wordcount } from '../../../models/index.js';

export const data = new SlashCommandBuilder()
  .setName('project')
  .setDescription('Manage writing projects and collaborators')
  .addSubcommand(sub => sub
    .setName('create')
    .setDescription('Create a new project')
    .addStringOption(opt => opt.setName('name').setDescription('Project name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('info')
    .setDescription('Show details about a project')
    .addStringOption(opt => opt.setName('name').setDescription('Project name (optional)').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List your projects'))
  .addSubcommand(sub => sub
    .setName('invite')
    .setDescription('Invite a member to your project')
    .addUserOption(opt => opt.setName('member').setDescription('User to invite').setRequired(true)))
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
    .addStringOption(opt => opt.setName('project_id').setDescription('Project ID').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('members')
    .setDescription('List project members'));

export async function execute(interaction) {
  try {
    const guildId = interaction.guildId;
    const subName = interaction.options.getSubcommand();
    const discordId = interaction.user.id;

    // Ensure user row exists
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Default defer to avoid timeouts; make sensitive prompts ephemeral
    const wantsConfirmEphemeral = ['remove', 'transfer', 'leave'].includes(subName) && !(interaction.options.getBoolean('confirm') ?? false);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: wantsConfirmEphemeral });
    }

    if (subName === 'create') {
      const name = interaction.options.getString('name');
      const project = await Project.create({ ownerId: discordId, name });
      await ProjectMember.create({ projectId: project.id, userId: discordId, role: 'owner' });
      return interaction.editReply({ content: `Project **${name}** created. ID: ${project.id}` });
    }

    if (subName === 'info') {
      const name = interaction.options.getString('name');
      let project = null;
      if (name) {
        project = await Project.findOne({ where: { ownerId: discordId, name } });
        if (!project) {
          const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }] });
          project = memberships.map(m => m.Project).find(p => p?.name === name) || null;
        }
      } else {
        project = await Project.findOne({ where: { ownerId: discordId }, order: [["updatedAt", "DESC"]] });
        if (!project) {
          const membership = await ProjectMember.findOne({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }], order: [["updatedAt", "DESC"]] });
          project = membership?.Project || null;
        }
      }
      if (!project) {
        return interaction.editReply({ content: "I can't find that project. Try `/project list`." });
      }
      const members = await ProjectMember.findAll({ where: { projectId: project.id } });
      const ownerTag = interaction.client.users.cache.get(project.ownerId)?.tag ?? project.ownerId;
      const activeSprint = await DeanSprints.findOne({ where: { projectId: project.id, status: 'processing' } }).catch(() => null);
      const channelMention = activeSprint?.channelId ? `<#${activeSprint.channelId}>` : '—';
      const mods = members.filter(m => m.role === 'mod').length;
      const lines = [
        `Project: ${project.name}`,
        `Owner: ${ownerTag}`,
        `Members: ${members.length} (mods: ${mods})`,
        `Active sprint: ${activeSprint ? `yes in ${channelMention}` : 'no'}`,
        `Created: ${new Date(project.createdAt).toLocaleString()}`,
        `ID: ${project.id}`,
      ];
      return interaction.editReply({ content: lines.join('\n') });
    }

    if (subName === 'list') {
      const memberships = await ProjectMember.findAll({ where: { userId: discordId }, limit: 50 });
      if (!memberships.length) {
        return interaction.editReply({ content: "You're not on any projects yet." });
      }
      const ids = memberships.map(m => m.projectId);
      const projects = await Project.findAll({ where: { id: ids } });
      const lines = projects.map(p => `• **${p.name}** (${p.id})`).join('\n');
      return interaction.editReply({ content: `Your projects:\n${lines}` });
    }

    if (subName === 'invite') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked up to this sprint, champ.' });
      }
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
    }

    if (subName === 'remove') {
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
    }

    if (subName === 'leave') {
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
      await active.update({ projectId: null });
      return interaction.editReply({ content: 'You’re off the crew. Sprint unlinked from that project.' });
    }

    if (subName === 'use') {
      const projectId = interaction.options.getString('project_id');
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active) {
        return interaction.editReply({ content: 'No active sprint right now.' });
      }
      const member = await ProjectMember.findOne({ where: { projectId, userId: discordId } });
      if (!member) {
        return interaction.editReply({ content: 'You’re not on that project, buddy. Get invited first.' });
      }
      await active.update({ projectId });
      return interaction.editReply({ content: `Locked this sprint to project **${projectId}**. Let’s get those pages.` });
    }

    if (subName === 'members') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No active project on this sprint.' });
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
