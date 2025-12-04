// Migration: Add Series table and link works to series

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create Series table
    await queryInterface.createTable('series', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 2. Add seriesId and part to Recommendation (works) table
    await queryInterface.addColumn('recommendations', 'seriesId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'series',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('recommendations', 'part', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('recommendations', 'seriesId');
    await queryInterface.removeColumn('recommendations', 'part');
    await queryInterface.dropTable('series');
  }
};
