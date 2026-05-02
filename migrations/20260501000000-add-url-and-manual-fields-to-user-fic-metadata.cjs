'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the url column
    await queryInterface.addColumn('user_fic_metadata', 'url', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add the manual_fields column
    await queryInterface.addColumn('user_fic_metadata', 'manual_fields', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    // Drop the old unique index
    await queryInterface.removeIndex('user_fic_metadata', 'unique_user_fic_metadata_entry');

    // Add new unique index on userID + url
    await queryInterface.addIndex('user_fic_metadata', ['userID', 'url'], {
      unique: true,
      name: 'unique_user_fic_metadata_user_url'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the new index
    await queryInterface.removeIndex('user_fic_metadata', 'unique_user_fic_metadata_user_url');

    // Remove the new columns
    await queryInterface.removeColumn('user_fic_metadata', 'manual_fields');
    await queryInterface.removeColumn('user_fic_metadata', 'url');

    // Restore the old unique index
    await queryInterface.addIndex('user_fic_metadata', ['userID', 'ao3ID', 'seriesId'], {
      unique: true,
      name: 'unique_user_fic_metadata_entry'
    });
  }
};