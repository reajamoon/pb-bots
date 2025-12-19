import Discord from 'discord.js';
const { MessageFlags } = Discord;

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

function getActionFromCustomId(customId) {
  if (!customId || typeof customId !== 'string') return null;
  // Convention: action_context_primaryId_secondaryId
  return customId.split('_')[0] || null;
}

async function tryLoadButtonHandler(action) {
  if (!action) return null;
  return import(`./buttons/${action}.js`).catch(() => null);
}

export async function handleButton(interaction) {
  const customId = interaction.customId;
  const action = getActionFromCustomId(customId);

  const mod = await tryLoadButtonHandler(action);
  const handler = mod?.default || mod;

  if (handler && typeof handler.execute === 'function') {
    return handler.execute(interaction);
  }

  console.warn(`[dean] Unhandled button interaction: customId=${customId}`);
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: 'That button is not wired up yet.', flags: EPHEMERAL_FLAG });
  }
}
