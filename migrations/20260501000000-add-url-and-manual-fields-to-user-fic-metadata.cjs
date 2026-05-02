'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if columns already exist before adding
    const tableDescription = await queryInterface.describeTable('user_fic_metadata');
    
    // Add the url column if it doesn't exist
    if (!tableDescription.url) {
      await queryInterface.addColumn('user_fic_metadata', 'url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Add the manual_fields column if it doesn't exist
    if (!tableDescription.manual_fields) {
      await queryInterface.addColumn('user_fic_metadata', 'manual_fields', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      });
    }

    // Check if the old constraint exists before trying to drop it
    const constraints = await queryInterface.showConstraint('user_fic_metadata');
    const oldConstraintExists = constraints.some(c => c.constraintName === 'unique_user_fic_metadata_entry');
    
    if (oldConstraintExists) {
      // Drop the old unique constraint
      await queryInterface.removeConstraint('user_fic_metadata', 'unique_user_fic_metadata_entry');
    }

    // Check if the new constraint exists before creating
    const newConstraintExists = constraints.some(c => c.constraintName === 'unique_user_fic_metadata_user_url');
    
    if (!newConstraintExists) {
      // Add new unique constraint on userID + url
      await queryInterface.addConstraint('user_fic_metadata', {
        fields: ['userID', 'url'],
        type: 'unique',
        name: 'unique_user_fic_metadata_user_url'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check current state before reverting
    const tableDescription = await queryInterface.describeTable('user_fic_metadata');
    const constraints = await queryInterface.showConstraint('user_fic_metadata');

    // Remove the new constraint if it exists
    const newConstraintExists = constraints.some(c => c.constraintName === 'unique_user_fic_metadata_user_url');
    if (newConstraintExists) {
      await queryInterface.removeConstraint('user_fic_metadata', 'unique_user_fic_metadata_user_url');
    }

    // Remove the new columns if they exist
    if (tableDescription.manual_fields) {
      await queryInterface.removeColumn('user_fic_metadata', 'manual_fields');
    }
    if (tableDescription.url) {
      await queryInterface.removeColumn('user_fic_metadata', 'url');
    }

    // Restore the old unique constraint if it doesn't exist
    const oldConstraintExists = constraints.some(c => c.constraintName === 'unique_user_fic_metadata_entry');
    if (!oldConstraintExists) {
      await queryInterface.addConstraint('user_fic_metadata', {
        fields: ['userID', 'ao3ID', 'seriesId'],
        type: 'unique',
        name: 'unique_user_fic_metadata_entry'
      });
    }
  }
};