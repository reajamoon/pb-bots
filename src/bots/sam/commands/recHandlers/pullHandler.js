import { Config, Recommendation, Series } from '../../../../models/index.js';
import { fetchRecWithSeries } from '../../../../models/index.js';
import { fetchSeriesWithUserMetadata } from '../../../../models/fetchSeriesWithUserMetadata.js';
import { createRecEmbed } from '../../../../shared/recUtils/createRecEmbed.js';
import { createSeriesEmbed } from '../../../../shared/recUtils/createSeriesEmbed.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;

/**
 * Posts a ready recommendation or series to fic-recs cleanly.
 * Usage: /rec pull id:<Recommendation.id|Series.id>
 */
export default async function handlePull(interaction) {
  try {
    await interaction.deferReply();
    const rawId = interaction.options.getString('id');
    if (!rawId || !rawId.trim()) {
      return await interaction.editReply({ content: 'Please provide an ID like 123 (rec) or S456 (series).' });
    }

    // Determine entity type: S### for series, numeric for recommendation
    const isSeriesId = /^S\d+$/i.test(rawId.trim());
    let embed = null;
    let entityType = null;
    if (isSeriesId) {
      const seriesPk = parseInt(rawId.replace(/^[Ss]/, ''), 10);
      const series = await Series.findByPk(seriesPk);
      if (!series) {
        return await interaction.editReply({ content: `No series found with ID ${rawId}.` });
      }
      const seriesWithMeta = await fetchSeriesWithUserMetadata(series.id, true);
      embed = createSeriesEmbed(seriesWithMeta, { preferredUserId: interaction.user.id });
      entityType = 'series';
    } else {
      const recPk = parseInt(rawId, 10);
      if (!Number.isFinite(recPk) || recPk <= 0) {
        return await interaction.editReply({ content: 'Invalid ID format. Use 123 for recs or S456 for series.' });
      }
      const rec = await Recommendation.findByPk(recPk);
      if (!rec) {
        return await interaction.editReply({ content: `No recommendation found with ID ${rawId}.` });
      }
      const recWithSeries = await fetchRecWithSeries(rec.id, true);
      embed = createRecEmbed(recWithSeries, { preferredUserId: interaction.user.id });
      entityType = 'rec';
    }

    // Always post in the channel where the command is used
    const targetChannel = interaction.channel;

    let posted = false;
    try {
      await targetChannel.send({ embeds: [embed] });
      posted = true;
    } catch (postErr) {
      if (postErr && (postErr.code === 50013 || postErr.status === 403)) {
        // Fallback: deliver embed via the deferred reply
        await interaction.editReply({ embeds: [embed] });
        posted = true;
      } else {
        console.warn('[rec pull] Failed to post embed:', postErr);
        await interaction.editReply({ content: 'Failed to post the embed. Please check channel permissions and try again.' });
        return;
      }
    }

    if (posted) {
      try { await interaction.deleteReply(); } catch {}
      await interaction.followUp({ content: entityType === 'series' ? 'Filed the series in fic-recs.' : 'Filed the fic in fic-recs.', flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error('[rec pull] Error:', error);
    try {
      await interaction.editReply({ content: error.message || 'There was an error posting the embed.' });
    } catch {}
  }
}
