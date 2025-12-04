'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'messageCountSetBy', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Discord ID of admin who set this message count'
    });

    await queryInterface.addColumn('users', 'messageCountSetAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the message count was admin-set'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'messageCountSetBy');
    await queryInterface.removeColumn('users', 'messageCountSetAt');
  }
};