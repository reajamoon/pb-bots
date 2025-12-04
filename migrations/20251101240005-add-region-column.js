'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'region', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'User-specified region/country (validated against country-region-data)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'region');
  }
};