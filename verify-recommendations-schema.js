// verify-recommendations-schema.js
// If you want to see what the rec table is up to, run this with "node verify-recommendations-schema.js". It's not pretty, but it works.

const { sequelize } = require('./src/models');


(async () => {
  try {
  // Pull all the columns from the recommendations table. If it blows up, it's probably a typo or Sequelize being dramatic.
    const columns = await sequelize.getQueryInterface().describeTable('recommendations');
    console.log('Recommendations table columns:');
    console.table(columns);
    process.exit(0);
  } catch (err) {
  // Something went sideways. Print the error and bail out.
    console.error('Error describing table:', err);
    process.exit(1);
  }
})();
