import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { getInteractionState, deleteInteractionState } from '../../utils/interactionState.js';
import { handleWc } from '../../utils/handleWc.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

function getDisabledComponents(message) {
  const rows = message?.components;
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map(row => {
    const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const comps = Array.isArray(json.components) ? json.components : [];
    return {
      ...json,
      components: comps.map(c => ({ ...c, disabled: true })),
    };
  });
}

export async function execute(interaction) {
  const customId = interaction.customId || '';
  const parts = customId.split('_');
  const verb = parts[1] || '';
  const token = parts.length > 2 ? parts.slice(2).join('_') : '';

  if (!token) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'That button is missing context. Try the command again.', flags: EPHEMERAL_FLAG });
    }
    return;
  }

  const state = getInteractionState(token);
  if (!state) {
    // Stateless fallback (used for /sprint wc baseline): baseline-<userId>-<sprintId>-<count>
    if (token.startsWith('baseline-')) {
      const baselineParts = token.split('-');
      const tokenUserId = baselineParts[1] || '';
      const sprintIdRaw = baselineParts[2] || '';
      const countRaw = baselineParts[3] || '';
      const sprintId = Number(sprintIdRaw);
      const count = Number(countRaw);

      if (tokenUserId && tokenUserId === interaction.user.id && Number.isFinite(sprintId) && Number.isFinite(count)) {
        if (verb === 'cancel') {
          await interaction.update({ content: 'Cancelled. No changes made.', components: [] });
          return;
        }

        try {
          await interaction.update({ components: getDisabledComponents(interaction.message) });
        } catch {
          // If we can't update (message deleted/changed), continue anyway.
          await interaction.deferUpdate();
        }
        return handleWc(interaction, {
          guildId: interaction.guildId,
          forcedTargetId: sprintId,
          forcedSubcommand: 'baseline',
          forcedOptions: { count, newWords: null },
          confirmed: true,
        });
      }
    }

    await interaction.reply({ content: 'That confirmation is stale. Run the command again.', flags: EPHEMERAL_FLAG });
    return;
  }

  if (state.userId !== interaction.user.id) {
    await interaction.reply({ content: 'That confirmation is stale. Run the command again.', flags: EPHEMERAL_FLAG });
    return;
  }

  deleteInteractionState(token);

  if (verb === 'cancel') {
    await interaction.update({ content: 'Cancelled. No changes made.', components: [] });
    return;
  }

  // Confirm
  try {
    await interaction.update({ components: getDisabledComponents(interaction.message) });
  } catch {
    // If we can't update (message deleted/changed), fall back.
    await interaction.deferUpdate();
  }
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
