import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('intro')
  .setDescription('Dean: guided prompts for your introduction');

export async function execute(interaction) {
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: [
      "Alright, if introductions make your brain go blank, I got you.",
      '',
      'Pick any of these and answer whatever feels good:',
      '1) What should we call you, and what are your pronouns?',
      '2) How did you find Destiel, and what do you love about it?',
      '3) What are you into right now? Fic tropes, music, games, hobbies, anything.',
      '4) What kind of chats do you like? Quiet lurking, memes, meta, screaming, recs?',
      '5) Anything you want folks to know up front? (Boundaries, squicks, no spoilers, etc.)',
      '',
      'If you want a simple template, copy and fill this in:',
      '```',
      'Name or nickname:',
      'Pronouns:',
      'Destiel era or vibe:',
      'Fic tastes:',
      'Other fandoms or hobbies:',
      'Anything else:',
      '```',
    ].join('\n'),
  });
}

export default { data, execute };
