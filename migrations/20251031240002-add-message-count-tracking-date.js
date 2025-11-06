'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'messageCountStartDate', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When message counting started for this user (first time messageCount was incremented)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'messageCountStartDate');
  }
};