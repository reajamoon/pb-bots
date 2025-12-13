"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    // Postgres: make this migration idempotent so it can be re-run safely
    // (e.g., if an index was created manually or a previous deploy partially applied it).
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_work_partial ON public.user_fic_metadata USING BTREE ("userID", "ao3ID") WHERE "seriesId" IS NULL;'
      );
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_series_partial ON public.user_fic_metadata USING BTREE ("userID", "seriesId") WHERE "ao3ID" IS NULL;'
      );
      return;
    }

    // Fallback for other dialects
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
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS public.uniq_user_work_partial;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS public.uniq_user_series_partial;');
      return;
    }
    await queryInterface.removeIndex('user_fic_metadata', 'uniq_user_work_partial');
    await queryInterface.removeIndex('user_fic_metadata', 'uniq_user_series_partial');
  }
};
