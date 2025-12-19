import Discord from 'discord.js';
const { MessageFlags } = Discord;

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

export async function handleCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[dean] No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    const isUnknownInteraction = error?.code === 10062 || error?.rawError?.code === 10062;
    if (isUnknownInteraction) return;

    console.error(`[dean] Error executing command ${interaction.commandName}:`, error);
    const payload = { content: 'There was an error executing that command.', flags: EPHEMERAL_FLAG };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (followUpError) {
      console.error('[dean] Failed to send command error message:', followUpError);
    }
  }
}
