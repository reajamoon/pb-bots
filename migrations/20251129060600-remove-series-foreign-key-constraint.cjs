'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the foreign key constraint on seriesId
    // This allows seriesId to store AO3 series IDs without database enforcement
    await queryInterface.removeConstraint('recommendations', 'recommendations_seriesId_fkey');
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add the foreign key constraint if we need to rollback
    await queryInterface.addConstraint('recommendations', {
      fields: ['seriesId'],
      type: 'foreign key',
      name: 'recommendations_seriesId_fkey',
      references: {
        table: 'series',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  }
};