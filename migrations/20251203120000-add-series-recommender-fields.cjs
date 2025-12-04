'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('series', 'recommendedBy', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Discord user ID of the original series recommender'
    });
    await queryInterface.addColumn('series', 'recommendedByUsername', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Discord username of the original series recommender'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('series', 'recommendedBy');
    await queryInterface.removeColumn('series', 'recommendedByUsername');
  }
};
