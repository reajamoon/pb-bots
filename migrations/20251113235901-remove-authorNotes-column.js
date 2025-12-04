// Migration to remove authorNotes column from recommendations table
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the column only if it exists
    const table = await queryInterface.describeTable('recommendations');
    if (table.authorNotes) {
      await queryInterface.removeColumn('recommendations', 'authorNotes');
    } else {
      console.log('Column authorNotes does not exist, skipping removal.');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add the column if needed (for rollback)
    await queryInterface.addColumn('recommendations', 'authorNotes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  }
};
