"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("birthday_messages", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      birthdayDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
    await queryInterface.addIndex("birthday_messages", ["userId", "birthdayDate"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("birthday_messages");
  }
};
