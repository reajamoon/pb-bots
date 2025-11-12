// scripts/batch-queue-recs-for-update.js
// Adds all recommendations to the parsing queue for batch metadata update
// Run this script to backfill archive_warnings and other fields using the current pipeline

const path = require('path');
const { Sequelize } = require('sequelize');
const dbConfig = require('../config/config.json');
const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

// Initialize Sequelize
const sequelize = new Sequelize(config);
const Recommendation = require('../src/models/Recommendation')(sequelize);

// Import your queue model or utility
const QueueEntry = require('../src/models/QueueEntry') ? require('../src/models/QueueEntry')(sequelize) : null;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    const recs = await Recommendation.findAll();
    let added = 0;
    for (const rec of recs) {
      // Check if already in queue (optional, depending on your queue schema)
      let alreadyQueued = false;
      if (QueueEntry) {
        alreadyQueued = await QueueEntry.findOne({ where: { url: rec.url } });
      }
      if (!alreadyQueued) {
        // Insert into queue (adjust fields as needed for your queue schema)
        await sequelize.query(
          'INSERT INTO queue (url, status, createdAt, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          { replacements: [rec.url, 'pending'] }
        );
        added++;
        console.log(`Queued rec ID ${rec.id} (${rec.url}) for update.`);
      }
    }
    console.log(`Batch queue complete. Added ${added} recommendations to the parsing queue.`);
    await sequelize.close();
  } catch (err) {
    console.error('Error during batch queue:', err);
    process.exit(1);
  }
})();
