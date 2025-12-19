import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { handleCommand } from '../handlers/commandHandler.js';
import { handleButton } from '../handlers/buttonHandler.js';
import { handleSelectMenu } from '../handlers/selectMenuHandler.js';
import { handleModal } from '../handlers/modalHandler.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

const processedInteractionIds = new Set();

export default function onInteractionCreate(client) {
  client.on('interactionCreate', async interaction => {
    try {
      if (processedInteractionIds.has(interaction.id)) {
        console.warn(`[dean] Duplicate interaction detected: id=${interaction.id} type=${interaction.type} customId=${interaction.customId || 'none'} commandName=${interaction.commandName || 'none'}`);
      } else {
        processedInteractionIds.add(interaction.id);
      }

      if (interaction.isChatInputCommand()) {
        return await handleCommand(interaction);
      }
      if (interaction.isButton()) {
        return await handleButton(interaction);
      }
      if (interaction.isStringSelectMenu()) {
        return await handleSelectMenu(interaction);
      }
      if (interaction.isModalSubmit()) {
        return await handleModal(interaction);
      }
    } catch (err) {
      console.error('[dean] Interaction error:', err);

      try {
        if (typeof interaction.isExpired === 'function' && interaction.isExpired()) return;

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Something went wrong processing that interaction.', flags: EPHEMERAL_FLAG });
        } else if (interaction.deferred) {
          await interaction.editReply({ content: 'Something went wrong processing that interaction.', components: [] });
        }
      } catch (e) {
        console.error('[dean] Failed to respond to interaction error:', e);
      }
    }
  });
}
