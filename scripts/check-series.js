import { Series } from '../src/models/index.js';

const series = await Series.findAll({
  attributes: ['id', 'ao3SeriesId', 'name', 'workCount', 'createdAt'],
  order: [['createdAt', 'DESC']]
});

console.log('Current series entries:');
series.forEach(s => {
  console.log(`ID: ${s.id}, AO3 ID: ${s.ao3SeriesId}, Name: ${s.name?.substring(0, 50)}..., Works: ${s.workCount}, Created: ${s.createdAt?.toISOString()?.split('T')[0]}`);
});

process.exit(0);