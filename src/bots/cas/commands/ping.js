import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Simple health check');

async function execute(interaction) {
  const { MessageFlags } = await import('discord.js');
  await interaction.reply({ content: "I'm online and watching.", flags: MessageFlags.Ephemeral });
  try {
    const { fireTrigger } = await import('../../../shared/hunts/triggerEngine.js');
    const { getCasAnnouncer } = await import('../utils/huntsAnnouncer.js');
    const announce = getCasAnnouncer(interaction);
    await fireTrigger('cas.search.used', { userId: interaction.user.id, announce });
  } catch (huntErr) {
    console.warn('[hunts] cas.search.used trigger failed:', huntErr);
  }
}

export { data };
export default { data, execute };
