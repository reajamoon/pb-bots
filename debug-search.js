import { Recommendation } from './src/models/index.js';
import { fetchRecWithSeries } from './src/models/fetchRecWithSeries.js';
import { createRecEmbed } from './src/shared/recUtils/createRecEmbed.js';

// Test a specific recommendation ID that should have series and tags
const recId = process.argv[2] || 1; // Use first argument or default to 1

console.log(`Debugging recommendation ID: ${recId}`);

const rec = await Recommendation.findByPk(recId);
if (!rec) {
    console.log('Recommendation not found');
    process.exit(1);
}

console.log('\n=== Basic recommendation data ===');
console.log('ID:', rec.id);
console.log('Title:', rec.title);
console.log('URL:', rec.url);
console.log('Series ID:', rec.seriesId);
console.log('Tags (basic):', rec.tags);

console.log('\n=== Fetching with series and user metadata ===');
const recWithSeries = await fetchRecWithSeries(recId, true);

console.log('Has series?', !!recWithSeries.series);
if (recWithSeries.series) {
    console.log('Series name:', recWithSeries.series.name);
    console.log('Series URL:', recWithSeries.series.url);
    console.log('Series object keys:', Object.keys(recWithSeries.series.dataValues || recWithSeries.series));
}

console.log('Has userMetadata?', !!recWithSeries.userMetadata);
console.log('UserMetadata length:', recWithSeries.userMetadata?.length || 0);
if (recWithSeries.userMetadata && recWithSeries.userMetadata.length > 0) {
    for (const meta of recWithSeries.userMetadata) {
        console.log('User metadata - additional_tags:', meta.additional_tags);
        console.log('User metadata - rec_note:', meta.rec_note);
    }
}

console.log('\n=== Testing embed creation ===');
try {
    const embed = createRecEmbed(recWithSeries);
    const embedData = embed.toJSON();
    console.log('Embed fields:');
    embedData.fields?.forEach(field => {
        console.log(`- ${field.name}: ${field.value}`);
    });
    
    const hasSeriesField = embedData.fields?.some(field => field.name.includes('Series'));
    const hasTagsField = embedData.fields?.some(field => field.name.includes('Tags'));
    console.log('Has Series field?', hasSeriesField);
    console.log('Has Tags field?', hasTagsField);
} catch (err) {
    console.error('Error creating embed:', err);
}

process.exit(0);