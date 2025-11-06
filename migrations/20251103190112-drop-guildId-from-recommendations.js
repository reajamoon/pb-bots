'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      try {
        await queryInterface.removeColumn("recommendations", "guildId");
        console.log("[Migration] Successfully removed guildId column in up()");
      } catch (err) {
        console.error("[Migration] Error removing guildId column in up():", err);
        throw err;
      }
  },

  async down (queryInterface, Sequelize) {
      try {
        await queryInterface.addColumn("recommendations", "guildId", {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: ""
        });
        console.log("[Migration] Successfully added guildId column in down()");
      } catch (err) {
        console.error("[Migration] Error adding guildId column in down():", err);
        throw err;
      }
  }
};
