import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import quickLinkCheck from './quickLinkCheck.js';
import isValidFanficUrl from './isValidFanficUrl.js';
import {
	isSeriesRec,
	buildBaseEmbed,
	buildStoryLinkText,
	getRatingAndColor,
	addWorkWarningsField,
	addSeriesWarningsField,
	addTagsField,
	addNotesField,
	addEngagementFields,
	addStatsFields,
	addStatusField
} from './createRecommendationEmbed.js';

// Async embed builder for a rec (single or series)
export async function createRecommendationEmbed(rec) {
	// If this work is part of a series, show series info
	if (rec.series && typeof rec.series === 'object' && rec.series.name && rec.series.url && rec.series.part) {
		const embed = buildBaseEmbed(rec, getRatingAndColor(rec.rating).color);
		embed.addFields({
			name: 'Series',
			value: `[Part ${rec.series.part} of ${rec.series.name}](${rec.series.url})`
		});
	}
	if (isSeriesRec(rec)) {
		return await createSeriesRecommendationEmbed(rec);
	}
	// Use shared helper for rating and color
	const { ratingValue, color } = getRatingAndColor(rec.rating);
	const embed = buildBaseEmbed(rec, color);
	if (rec.summary) {
		const summaryText = rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary;
		embed.addFields({
			name: 'Summary',
			value: `>>> ${summaryText}`
		});
	}
	const isLinkWorking = rec.deleted ? false : await quickLinkCheck(rec.url);
	const siteInfo = isValidFanficUrl(rec.url);
	const linkText = buildStoryLinkText(rec, isLinkWorking, siteInfo);
	const linkAndMetaFields = [
		{ name: '🔗 Story Link', value: linkText, inline: true }
	];
	if (rec.rating) linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
	addStatusField(linkAndMetaFields, rec);
	embed.addFields(linkAndMetaFields);
	addStatsFields(embed, rec);
	addWorkWarningsField(embed, rec);
	addTagsField(embed, rec);
	addNotesField(embed, rec);
	addEngagementFields(embed, rec);
	return embed;
}

// Async embed builder for a series rec
export async function createSeriesRecommendationEmbed(rec) {
	// Determine effective rating for the series (highest among works, or series rating)
	let effectiveRating = rec.rating;
	if ((!effectiveRating || effectiveRating.toLowerCase() === 'unrated' || effectiveRating.toLowerCase() === 'not rated') && Array.isArray(rec.series_works)) {
		const ratingOrder = ['not rated', 'unrated', 'general audiences', 'teen and up audiences', 'mature', 'explicit'];
		let maxIdx = 0;
		for (const work of rec.series_works) {
			if (work.rating && typeof work.rating === 'string') {
				const idx = ratingOrder.indexOf(work.rating.trim().toLowerCase());
				if (idx > maxIdx) maxIdx = idx;
			}
		}
		effectiveRating = ratingOrder[maxIdx] || 'Unrated';
	}
	const { ratingValue, color } = getRatingAndColor(effectiveRating);
	const embed = new EmbedBuilder()
		.setTitle(`📚 ${rec.title}`)
		.setDescription(`**Series by:** ${(rec.authors && Array.isArray(rec.authors)) ? rec.authors.join(', ') : (rec.author || 'Unknown Author')}`)
		.setURL(rec.url)
		.setColor(color)
		.setTimestamp()
		.setFooter({
			text: `From the Profound Bond Library • Recommended by ${rec.recommendedByUsername} • ID: ${rec.id}`
		});
	if (rec.summary) {
		const summaryText = rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary;
		embed.addFields({
			name: 'Series Summary',
			value: `>>> ${summaryText}`
		});
	}
	const isLinkWorking = rec.deleted ? false : await quickLinkCheck(rec.url);
	const siteInfo = isValidFanficUrl(rec.url);
	const linkText = buildStoryLinkText(rec, isLinkWorking, siteInfo);
	const linkAndMetaFields = [
		{ name: '🔗 Series Link', value: linkText, inline: true }
	];
	if (effectiveRating) linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
	addStatusField(linkAndMetaFields, rec);
	embed.addFields(linkAndMetaFields);
	addStatsFields(embed, rec);
	addSeriesWarningsField(embed, rec);
	addTagsField(embed, rec);
	addNotesField(embed, rec);
	addEngagementFields(embed, rec);
	if (Array.isArray(rec.series_works) && rec.series_works.length > 0) {
		const maxToShow = 5;
		let worksList = '';
		for (let i = 0; i < Math.min(rec.series_works.length, maxToShow); i++) {
			const work = rec.series_works[i];
			const title = work.title || `Work #${i + 1}`;
			const url = work.url || rec.url;
			worksList += `${i + 1}. [${title}](${url})\n`;
		}
		if (rec.series_works.length > maxToShow) {
			worksList += `${maxToShow}. [and more...](${rec.url})`;
		}
		embed.addFields({
			name: `Works in Series (${rec.series_works.length})`,
			value: worksList.trim()
		});
	}
	return embed;
}