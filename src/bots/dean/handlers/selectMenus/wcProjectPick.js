import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { Project } from '../../../../models/index.js';
import { getInteractionState, deleteInteractionState } from '../../utils/interactionState.js';
import { handleWc } from '../../utils/handleWc.js';

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

  const picked = interaction.values?.[0];
  const projectId = String(picked || '').trim();
  if (!projectId) {
    await interaction.reply({ content: 'That selection did not look right. Try again.', flags: EPHEMERAL_FLAG });
    return;
  }

  const project = await Project.findByPk(projectId).catch(() => null);
  if (!project) {
    await interaction.reply({ content: 'I cannot find that project anymore. Try the command again.', flags: EPHEMERAL_FLAG });
    return;
  }

  await interaction.update({ content: 'Got it.', components: [] });

  return handleWc(interaction, {
    guildId: state.guildId,
    forcedScope: 'project',
    forcedProjectId: project.id,
    forcedSubcommand: state.subcommand,
    forcedOptions: state.options,
  });
}

export default { execute };
