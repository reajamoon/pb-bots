import { Series } from './src/models/index.js';

const series = await Series.findAll({
  attributes: ['id', 'ao3_id', 'title', 'works_count', 'createdAt'],
  order: [['createdAt', 'DESC']]
});

console.log('Current series entries:');
series.forEach(s => {
  console.log(`ID: ${s.id}, AO3 ID: ${s.ao3_id}, Title: ${s.title?.substring(0, 50)}..., Works: ${s.works_count}, Created: ${s.createdAt?.toISOString()?.split('T')[0]}`);
});

process.exit(0);