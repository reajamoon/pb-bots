import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { getInteractionState, deleteInteractionState } from '../../utils/interactionState.js';
import { handleWc } from '../../utils/handleWc.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

export async function execute(interaction) {
  const customId = interaction.customId || '';
  const parts = customId.split('_');
  const verb = parts[1] || '';
  const token = parts[2] || '';

  if (!token) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'That button is missing context. Try the command again.', flags: EPHEMERAL_FLAG });
    }
    return;
  }

  const state = getInteractionState(token);
  deleteInteractionState(token);

  if (!state || state.userId !== interaction.user.id) {
    await interaction.reply({ content: 'That confirmation is stale. Run the command again.', flags: EPHEMERAL_FLAG });
    return;
  }

  if (verb === 'cancel') {
    await interaction.update({ content: 'Cancelled. No changes made.', components: [] });
    return;
  }

  // Confirm
  await interaction.deferUpdate();
  return handleWc(interaction, {
    guildId: state.guildId,
    forcedScope: state.scope,
    forcedProjectId: state.projectId,
    forcedTargetId: state.targetId,
    forcedSubcommand: state.subcommand,
    forcedOptions: state.options,
    forcedUndoWordcountId: state.undoWordcountId,
    confirmed: true,
  });
}

export default { execute };
