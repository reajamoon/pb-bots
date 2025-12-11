'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('recommendations', 'relationship_tags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of relationship/ship tags'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('recommendations', 'relationship_tags');
  }
};
/**
 * Migration: add relationship_tags column to recommendations
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add JSONB column relationship_tags with default []
    await queryInterface.addColumn('recommendations', 'relationship_tags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of relationship/ship tags'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('recommendations', 'relationship_tags');
  }
};
