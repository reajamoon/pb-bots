'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('guilds', 'pbversaryWishesRoleId', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'birthdayWishesRoleId'
    });

    await queryInterface.addColumn('guilds', 'pbversaryChannelId', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'pbversaryWishesRoleId'
    });

    await queryInterface.addColumn('guilds', 'pbversaryAnnouncementTime', {
      type: Sequelize.STRING,
      defaultValue: '09:00',
      allowNull: false,
      after: 'pbversaryChannelId'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('guilds', 'pbversaryWishesRoleId');
    await queryInterface.removeColumn('guilds', 'pbversaryChannelId');
    await queryInterface.removeColumn('guilds', 'pbversaryAnnouncementTime');
  }
};