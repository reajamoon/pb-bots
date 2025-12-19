import Discord from 'discord.js';
const { MessageFlags } = Discord;

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

function getActionFromCustomId(customId) {
  if (!customId || typeof customId !== 'string') return null;
  return customId.split('_')[0] || null;
}

async function tryLoadSelectMenuHandler(action) {
  if (!action) return null;
  return import(`./selectMenus/${action}.js`).catch(() => null);
}

export async function handleSelectMenu(interaction) {
  const customId = interaction.customId;
  const action = getActionFromCustomId(customId);

  const mod = await tryLoadSelectMenuHandler(action);
  const handler = mod?.default || mod;

  if (handler && typeof handler.execute === 'function') {
    return handler.execute(interaction);
  }

  console.warn(`[dean] Unhandled select menu interaction: customId=${customId}`);
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: 'That menu is not wired up yet.', flags: EPHEMERAL_FLAG });
  }
}
