import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { Project, ProjectMember, DeanSprints } from '../../../../models/index.js';
import { getInteractionState, deleteInteractionState } from '../../utils/interactionState.js';
import { formatSprintIdentifier } from '../../text/sprintText.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

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

  const sprintId = Number(state.sprintId);
  if (!Number.isFinite(sprintId)) {
    await interaction.reply({ content: 'Missing sprint context. Try again.', flags: EPHEMERAL_FLAG });
    return;
  }

  const picked = interaction.values?.[0];
  const projectId = String(picked || '').trim();
  if (!projectId) {
    await interaction.reply({ content: 'That selection did not look right. Try again.', flags: EPHEMERAL_FLAG });
    return;
  }

  const sprint = await DeanSprints.findByPk(sprintId).catch(() => null);
  if (!sprint || sprint.guildId !== state.guildId || sprint.userId !== state.userId || sprint.status !== 'processing') {
    await interaction.reply({ content: 'I cannot find that sprint entry anymore. Try the command again.', flags: EPHEMERAL_FLAG });
    return;
  }

  const project = await Project.findByPk(projectId).catch(() => null);
  if (!project) {
    await interaction.reply({ content: 'I cannot find that project anymore. Try the command again.', flags: EPHEMERAL_FLAG });
    return;
  }

  // Ensure membership (or owner)
  const member = await ProjectMember.findOne({ where: { projectId: project.id, userId: state.userId } }).catch(() => null);
  if (!member && project.ownerId !== state.userId) {
    await interaction.reply({ content: "You're not on that project, buddy. Get invited first.", flags: EPHEMERAL_FLAG });
    return;
  }

  await sprint.update({ projectId: project.id });

  const sprintIdentifier = formatSprintIdentifier({ type: sprint.type, groupId: sprint.groupId, label: sprint.label, startedAt: sprint.startedAt });
  await interaction.update({
    content: `Alright. Linked: ${sprintIdentifier}\nProject: **${project.name}** (${project.publicId || project.id})`,
    components: [],
    allowedMentions: { parse: [] },
  });
}

export default { execute };
