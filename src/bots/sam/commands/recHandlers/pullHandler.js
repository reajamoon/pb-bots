import { Config, Recommendation, Series } from '../../../../models/index.js';
import { fetchRecWithSeries } from '../../../../models/index.js';
import { fetchSeriesWithUserMetadata } from '../../../../models/index.js';
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
    // Optional: puppet user override for note/footer attribution (superadmin-only)
    let puppetUserId = null;
    try {
      const { User } = await import('../../../../models/index.js');
      const requester = await User.findOne({ where: { discordId: interaction.user.id } });
      const level = requester && requester.permissionLevel ? String(requester.permissionLevel).toLowerCase() : 'member';
      const isSuperadmin = level === 'superadmin';
      if (isSuperadmin) {
        // Accept as user option or string ID
        const puppetUser = interaction.options.getUser?.('puppetuser') || interaction.options.getUser?.('puppetUser');
        if (puppetUser && puppetUser.id) puppetUserId = puppetUser.id;
        if (!puppetUserId) {
          const puppetIdStr = interaction.options.getString?.('puppetuserid') || interaction.options.getString?.('puppetUserId');
          if (puppetIdStr && String(puppetIdStr).trim()) puppetUserId = String(puppetIdStr).trim();
        }
      }
    } catch {}
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
      embed = createSeriesEmbed(seriesWithMeta, { preferredUserId: puppetUserId || interaction.user.id });
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
      if (process.env.REC_EMBED_DEBUG) {
        try {
          console.debug('[sam:pullHandler] Pre-embed rec audit', {
            id: recWithSeries.id,
            hasSeries: !!recWithSeries.series,
            tagsType: Array.isArray(recWithSeries.tags) ? 'array' : typeof recWithSeries.tags,
            tagsLen: Array.isArray(recWithSeries.tags) ? recWithSeries.tags.length : (typeof recWithSeries.tags === 'string' ? recWithSeries.tags.length : 0),
            userMetaCount: Array.isArray(recWithSeries.userMetadata) ? recWithSeries.userMetadata.length : 0
          });
        } catch {}
      }
      embed = createRecEmbed(recWithSeries, { preferredUserId: puppetUserId || interaction.user.id });
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
