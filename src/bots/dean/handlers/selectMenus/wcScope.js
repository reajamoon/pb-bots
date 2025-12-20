import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { getInteractionState, deleteInteractionState } from '../../utils/interactionState.js';
import { handleWc } from '../../utils/handleWc.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

export async function execute(interaction) {
  const customId = interaction.customId || '';
  const parts = customId.split('_');
  const token = parts.length > 1 ? parts.slice(1).join('_') : '';

  if (!token) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Nope. That menu's missing the context. Run `/wc` again.", flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    }
    return;
  }

  const state = getInteractionState(token);
  if (!state || state.userId !== interaction.user.id) {
    await interaction.reply({ content: 'That one timed out. Run it again.', flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    return;
  }

  const picked = interaction.values?.[0];
  const scope = (picked === 'project' || picked === 'sprint') ? picked : null;
  if (!scope) {
    await interaction.reply({ content: "Yeah, that didn't look right. Try again.", flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    return;
  }

  deleteInteractionState(token);

  // Acknowledge the selection and clear the menu.
  await interaction.update({ components: [] });

  return handleWc(interaction, {
    guildId: state.guildId,
    forcedScope: scope,
    forcedSubcommand: state.subcommand,
    forcedOptions: {
      ...(state.options || {}),
      scope,
    },
  });
}

export default { execute };
