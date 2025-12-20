'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'GuildSprintSettings';

    let columns;
    try {
      columns = await queryInterface.describeTable(table);
    } catch {
      columns = null;
    }

    if (!columns || !columns.timezone) {
      await queryInterface.addColumn(table, 'timezone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'GuildSprintSettings';

    let columns;
    try {
      columns = await queryInterface.describeTable(table);
    } catch {
      columns = null;
    }

    if (columns && columns.timezone) {
      await queryInterface.removeColumn(table, 'timezone');
    }
  },
};
