module.exports = {
  async up(queryInterface) {
    // Enable uuid-ossp extension for uuid_generate_v4()
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  },
  async down(queryInterface) {
    // Do not drop extension automatically; leaving as no-op to avoid breaking other tables
    // If needed, uncomment the next line to drop the extension.
    // await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS "uuid-ossp";');
  },
};
