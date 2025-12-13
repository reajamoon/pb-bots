"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    // Postgres: be extra safe/idempotent (production has had partial deploys + pre-existing relations).
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS public.user_setting_pokes (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR NOT NULL,
          setting_key VARCHAR NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS user_setting_pokes_user_setting_unique ON public.user_setting_pokes (user_id, setting_key);'
      );
      return;
    }

    await queryInterface.createTable('user_setting_pokes', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.STRING, allowNull: false },
      setting_key: { type: Sequelize.STRING, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('user_setting_pokes', ['user_id', 'setting_key'], {
      unique: true,
      name: 'user_setting_pokes_user_setting_unique',
    });
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS public.user_setting_pokes_user_setting_unique;');
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS public.user_setting_pokes;');
      return;
    }

    await queryInterface.removeIndex('user_setting_pokes', 'user_setting_pokes_user_setting_unique');
    await queryInterface.dropTable('user_setting_pokes');
  },
};
