'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the PB-versary columns since we're not implementing notifications yet
    await queryInterface.removeColumn('guilds', 'pbversaryWishesRoleId');
    await queryInterface.removeColumn('guilds', 'pbversaryChannelId');
    await queryInterface.removeColumn('guilds', 'pbversaryAnnouncementTime');
  },

  async down(queryInterface, Sequelize) {
    // Re-add them if we need to rollback this migration
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
  }
};