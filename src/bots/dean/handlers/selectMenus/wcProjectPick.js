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
      await interaction.reply({ content: "Nope. That menu's missing the context. Run the command again.", flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    }
    return;
  }

  const state = getInteractionState(token);
  if (!state || state.userId !== interaction.user.id) {
    await interaction.reply({ content: 'That one timed out. Run it again.', flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    return;
  }

  deleteInteractionState(token);

  const picked = interaction.values?.[0];
  const projectId = String(picked || '').trim();
  if (!projectId) {
    await interaction.reply({ content: "Yeah, that didn't look right. Try again.", flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    return;
  }

  const project = await Project.findByPk(projectId).catch(() => null);
  if (!project) {
    await interaction.reply({ content: "Can't find that project anymore. Run the command again.", flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
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
