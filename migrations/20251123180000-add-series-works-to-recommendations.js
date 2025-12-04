// Migration to add series_works field to recommendations
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('recommendations', 'series_works', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Ordered list of works for AO3 series (array of {title, url, authors})'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('recommendations', 'series_works');
  }
};
