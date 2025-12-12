"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('user_fic_metadata', {
      name: 'uniq_user_work_partial',
      unique: true,
      fields: ['userID', 'ao3ID'],
      where: { seriesId: { [Sequelize.Op.is]: null } },
      using: 'BTREE'
    });

    await queryInterface.addIndex('user_fic_metadata', {
      name: 'uniq_user_series_partial',
      unique: true,
      fields: ['userID', 'seriesId'],
      where: { ao3ID: { [Sequelize.Op.is]: null } },
      using: 'BTREE'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('user_fic_metadata', 'uniq_user_work_partial');
    await queryInterface.removeIndex('user_fic_metadata', 'uniq_user_series_partial');
  }
};
