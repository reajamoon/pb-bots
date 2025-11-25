import Discord from 'discord.js';
const { EmbedBuilder, MessageFlags } = Discord;
import { Recommendation } from '../../../../models/index.js';
import { fn, col, literal } from 'sequelize';

// Shows stats for the PB library.
async function handleStats(interaction) {
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }
    await interaction.deferReply();
    const totalRecs = await Recommendation.count();
    if (totalRecs === 0) {
        return await interaction.editReply({
            content: 'The Profound Bond library is empty! Help me build our collection by adding some Destiel fics with `/rec add`.'
        });
    }

    // Fetch all recs for stats
    const allRecs = await Recommendation.findAll({ attributes: ['tags', 'additionalTags', 'recommendedBy', 'author', 'wordCount', 'title', 'rating', 'publishedDate'] });

    // Unique recommenders
    const uniqueRecommenders = new Set(allRecs.map(r => r.recommendedBy)).size;
    // Unique authors
    const uniqueAuthors = new Set(allRecs.map(r => (r.author || '').trim().toLowerCase()).filter(Boolean)).size;
    // Unique works (by title+author combo)
    const uniqueWorks = new Set(allRecs.map(r => `${(r.title || '').trim().toLowerCase()}|${(r.author || '').trim().toLowerCase()}`)).size;
    // Total wordcount
    const totalWordCount = allRecs.reduce((sum, r) => sum + (typeof r.wordCount === 'number' ? r.wordCount : 0), 0);

    // Distribution by publication year
    const yearCounts = {};
    for (const rec of allRecs) {
        if (rec.publishedDate) {
            const year = new Date(rec.publishedDate).getFullYear();
            if (!isNaN(year)) yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    }
    // Sort years ascending
    const sortedYears = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    const yearLines = sortedYears.length
        ? sortedYears.map(y => `${y}: ${yearCounts[y]}`).join(' | ')
        : 'No publication dates found.';

    // Gather all tags (site tags + additionalTags)
    let allTags = [];
    for (const rec of allRecs) {
        if (Array.isArray(rec.tags)) allTags.push(...rec.tags);
        else if (typeof rec.tags === 'string' && rec.tags.trim().startsWith('[')) {
            try { allTags.push(...JSON.parse(rec.tags)); } catch {}
        }
        if (Array.isArray(rec.additionalTags)) allTags.push(...rec.additionalTags);
        else if (typeof rec.additionalTags === 'string' && rec.additionalTags.trim().startsWith('[')) {
            try { allTags.push(...JSON.parse(rec.additionalTags)); } catch {}
        }
    }
    allTags = allTags.map(t => (t || '').trim().toLowerCase()).filter(Boolean);
    const tagCounts = {};
    for (const tag of allTags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count], i) => `#${i + 1}: ${tag} (${count})`)
        .join('\n') || 'No tags found.';

    // Ratings by percentage (emoji only)
    const ratingEmojis = {
        'general audiences': '<:ratinggeneral:1133762158077935749>',
        'teen and up audiences': '<:ratingteen:1133762194174136390>',
        'mature': '<:ratingmature:1133762226738700390>',
        'explicit': '<:ratingexplicit:1133762272087506965>',
        'not rated': '❔',
        'unrated': '❔'
    };
    const ratingCounts = {};
    for (const rec of allRecs) {
        const rating = (rec.rating || '').trim().toLowerCase();
        if (rating) ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
    }
    const ratingPercentages = Object.entries(ratingCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([rating, count]) => {
            const emoji = ratingEmojis[rating] || '';
            if (!emoji) return null;
            const percent = ((100 * count) / totalRecs).toFixed(1);
            return `${emoji} ${percent}%`;
        })
        .filter(Boolean)
        .join('\n') || 'No ratings found.';

    const embed = new EmbedBuilder()
        .setTitle('📊 Profound Bond Library Statistics')
        .setDescription(`Our library currently holds **${totalRecs}** carefully curated fanfiction recommendations`)
        .setColor(0x234567)
        .setTimestamp()
        .addFields(
            { name: 'Unique Recommenders', value: uniqueRecommenders.toString(), inline: true },
            { name: 'Unique Authors', value: uniqueAuthors.toString(), inline: true },
            { name: 'Total Wordcount', value: totalWordCount.toLocaleString(), inline: true },
            { name: 'Ratings', value: ratingPercentages, inline: true },
            { name: 'Top 10 Tags', value: topTags, inline: false },
            { name: 'Recs by Publication Year', value: yearLines, inline: false }
        );
    await interaction.editReply({ embeds: [embed] });
}

export default handleStats;
