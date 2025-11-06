'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'messagesSinceAdminSet', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of messages sent since admin last set the message count'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'messagesSinceAdminSet');
  }
};