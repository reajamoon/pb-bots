import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { DeanSprints, Project, ProjectMember, User } from '../../../../models/index.js';
import { getInteractionState, deleteInteractionState } from '../../utils/interactionState.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

function getToken(customId) {
  if (!customId || typeof customId !== 'string') return null;
  const parts = customId.split('_');
  return parts.length >= 2 ? parts[1] : null;
}

export async function execute(interaction) {
  try {
    const token = getToken(interaction.customId);
    if (!token) {
      return interaction.reply({ content: 'That picker is missing context. Run the command again.', flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    }

    const state = getInteractionState(token);
    if (!state || state.userId !== interaction.user.id) {
      return interaction.reply({ content: 'That picker is stale. Run the command again.', flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    }

    const guildId = state.guildId ?? interaction.guildId;
    const action = state.action;

    const picked = interaction.values?.[0];
    const pickedId = Number(picked);
    if (!Number.isFinite(pickedId)) {
      deleteInteractionState(token);
      return interaction.update({ content: "Yeah, that didn't look right. Try again.", components: [], allowedMentions: { parse: [] } });
    }

    const sprint = await DeanSprints.findByPk(pickedId).catch(() => null);
    if (!sprint || sprint.guildId !== guildId || sprint.userId !== state.userId || sprint.status !== 'processing') {
      deleteInteractionState(token);
      return interaction.update({ content: "Can't find that sprint anymore. Run the command again.", components: [], allowedMentions: { parse: [] } });
    }

    // Consume state
    deleteInteractionState(token);

    if (action === 'use') {
      const projectId = state.projectId;
      const project = projectId ? await Project.findByPk(projectId).catch(() => null) : null;
      if (!project) {
        return interaction.update({ content: 'Nope. That project is gone. Try again.', components: [], allowedMentions: { parse: [] } });
      }

      const member = await ProjectMember.findOne({ where: { projectId: project.id, userId: state.userId } }).catch(() => null);
      if (!member) {
        return interaction.update({ content: 'You’re not on that project, buddy. Get invited first.', components: [], allowedMentions: { parse: [] } });
      }

      await sprint.update({ projectId: project.id });
      return interaction.update({ content: `Locked this sprint to **${project.name}** (${project.publicId || project.id}). Let’s get those pages.`, components: [], allowedMentions: { parse: [] } });
    }

    if (action === 'invite') {
      const memberId = state.memberId;
      if (!memberId) {
        return interaction.update({ content: 'Missing member info. Run `/project invite` again.', components: [], allowedMentions: { parse: [] } });
      }
      if (!sprint.projectId) {
        return interaction.update({ content: 'No project hooked to that sprint. Pass `project:` or link one first.', components: [], allowedMentions: { parse: [] } });
      }

      const project = await Project.findByPk(sprint.projectId).catch(() => null);
      if (!project) {
        return interaction.update({ content: 'That project is gone. Try again.', components: [], allowedMentions: { parse: [] } });
      }

      const requester = await User.findOne({ where: { discordId: state.userId } }).catch(() => null);
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const isPrivileged = level !== 'member';
      const isOwner = project.ownerId === state.userId;
      const membership = await ProjectMember.findOne({ where: { projectId: project.id, userId: state.userId } }).catch(() => null);
      const isMod = membership?.role === 'mod';
      if (!isOwner && !isMod && !isPrivileged) {
        return interaction.update({ content: 'Only the owner or a mod can invite folks. Flag a mod if you need backup.', components: [], allowedMentions: { parse: [] } });
      }

      await ProjectMember.findOrCreate({ where: { projectId: project.id, userId: memberId }, defaults: { role: 'member' } });
      return interaction.update({ content: `Nice pull. <@${memberId}> is on **${project.name}**. Welcome aboard.`, components: [], allowedMentions: { parse: [] } });
    }

    if (action === 'remove') {
      const memberId = state.memberId;
      if (!memberId) {
        return interaction.update({ content: 'Missing member info. Run `/project remove` again.', components: [], allowedMentions: { parse: [] } });
      }
      if (!sprint.projectId) {
        return interaction.update({ content: 'No project hooked to this sprint, champ.', components: [], allowedMentions: { parse: [] } });
      }

      const requester = await User.findOne({ where: { discordId: state.userId } }).catch(() => null);
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const project = await Project.findByPk(sprint.projectId).catch(() => null);
      const isOwner = project && project.ownerId === state.userId;
      const isPrivileged = level !== 'member';
      if (!isOwner && !isPrivileged) {
        return interaction.update({ content: 'Heads up: only the owner or a mod can boot folks.', components: [], allowedMentions: { parse: [] } });
      }

      await ProjectMember.destroy({ where: { projectId: sprint.projectId, userId: memberId } });
      return interaction.update({ content: `Alright. <@${memberId}> is off the roster. Keep it rolling.`, components: [], allowedMentions: { parse: [] } });
    }

    if (action === 'leaveProject') {
      if (!sprint.projectId) {
        return interaction.update({ content: 'No project hooked to this sprint, champ.', components: [], allowedMentions: { parse: [] } });
      }

      const project = await Project.findByPk(sprint.projectId).catch(() => null);
      if (project && project.ownerId === state.userId) {
        return interaction.update({ content: "You’re the owner, buddy. Transfer ownership first or end the project.", components: [], allowedMentions: { parse: [] } });
      }

      await ProjectMember.destroy({ where: { projectId: sprint.projectId, userId: state.userId } });
      await sprint.update({ projectId: null });
      return interaction.update({ content: 'You’re off the crew. Sprint unlinked from that project.', components: [], allowedMentions: { parse: [] } });
    }

    if (action === 'members') {
      if (!sprint.projectId) {
        return interaction.update({ content: 'No active project on this sprint. Use `/project use` to link one, or create with `/project create`.', components: [], allowedMentions: { parse: [] } });
      }

      const members = await ProjectMember.findAll({ where: { projectId: sprint.projectId }, limit: 50 });
      const list = members.map(m => `• <@${m.userId}> (${m.role})`).join('\n') || 'Just you right now. That’s fine, solo hero arc.';
      return interaction.update({ content: `Crew roll call:\n${list}`, components: [], allowedMentions: { parse: [] } });
    }

    return interaction.update({ content: 'Yeah, I do not know what that picker was trying to do.', components: [], allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('[Dean/projectActiveSprintPick] error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec.", flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
      } else {
        await interaction.update({ content: "Yeah, that's on me. Try that again in a sec.", components: [], allowedMentions: { parse: [] } });
      }
    } catch {}
  }
}

export default { execute };
