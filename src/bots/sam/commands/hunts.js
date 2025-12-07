import Discord from 'discord.js';
const { SlashCommandBuilder, EmbedBuilder } = Discord;
import { listUserHunts, isHuntUnlocked, HUNTS } from '../../../shared/hunts/registry.js';
import { renderHunterCardPNG } from '../../../shared/hunts/cardRenderer.js';
import { AttachmentBuilder } from 'discord.js';

function computeTotals(progressRows) {
  let points = 0;
  const completed = [];
  for (const row of progressRows) {
    if (row.unlockedAt && row.hunt) {
      points += row.hunt.points || 0;
      completed.push(row.hunt.name);
    }
  }
  return { points, completed };
}

async function getNarrativeProgress(userId) {
  const narratives = HUNTS.filter(h => h.type === 'narrative');
  const items = [];
  for (const n of narratives) {
    const unlocked = await isHuntUnlocked(userId, n.key);
    if (unlocked) {
      items.push({ name: n.name, status: 'completed' });
      continue;
    }
    const reqs = Array.isArray(n.requires) ? n.requires : [];
    let done = 0;
    for (const r of reqs) {
      const ok = await isHuntUnlocked(userId, r);
      if (ok) done += 1;
    }
    items.push({ name: n.name, status: 'ongoing', done, total: reqs.length });
  }
  return items;
}

export default {
  data: new SlashCommandBuilder()
    .setName('hunts')
    .setDescription('Show your Hunter Card: points, completed hunts, and ongoing narratives')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('View hunts for another user')
        .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    await interaction.deferReply();
    const progressRows = await listUserHunts(targetUser.id);
    const { points, completed } = computeTotals(progressRows);
    const narratives = await getNarrativeProgress(targetUser.id);

    const badgeColor = 0x1f2937; // dark slate, FBI badge vibe
    const accent = '#d4af37'; // gold accent

    const embed = new EmbedBuilder()
      .setColor(badgeColor)
      .setAuthor({ name: 'PB Hunters Bureau', iconURL: interaction.client.user.displayAvatarURL() })
      .setTitle('Hunter Identification Card')
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setDescription('Counterfeit FBI badge issued by PB Hunters. Handle with care.')
      .addFields(
        { name: 'Agent', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Clearance', value: 'Level 3', inline: true },
        { name: 'Badge No.', value: `${targetUser.id.slice(-6)}`, inline: true },
      )
      .addFields(
        { name: 'Hunt Points', value: `${points}`, inline: true },
        { name: 'Completed Hunts', value: completed.length ? completed.slice(0, 10).join(', ') + (completed.length > 10 ? `, +${completed.length - 10} more` : '') : 'None yet', inline: false },
      )
      .setFooter({ text: 'Issued by Sam • Tampering voids warranty', iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    if (narratives.length) {
      const lines = narratives.map(n => {
        if (n.status === 'completed') return `✔️ ${n.name}`;
        const total = n.total ?? 0;
        const done = n.done ?? 0;
        const barLen = 10;
        const filled = Math.min(barLen, Math.round((done / Math.max(1, total)) * barLen));
        const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        return `🜁 ${n.name} — ${done}/${total}\n${bar}`;
      });
      embed.addFields({ name: 'Ongoing Hunts', value: lines.join('\n'), inline: false });
    }

    // Try to render PNG badge; fallback to embed if renderer fails
    try {
      const buffer = await renderHunterCardPNG({
        user: targetUser,
        points,
        completed,
        narratives,
      });
      const attachment = new AttachmentBuilder(buffer, { name: 'hunter-card.png' });
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (e) {
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
