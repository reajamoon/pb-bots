"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
               "userID",
               "ao3ID",
               "seriesId",
               "updatedAt",
               ROW_NUMBER() OVER (PARTITION BY "userID", "ao3ID" ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC) AS rn
        FROM public.user_fic_metadata
        WHERE "seriesId" IS NULL AND "ao3ID" IS NOT NULL
      )
      DELETE FROM public.user_fic_metadata ufm
      USING ranked r
      WHERE ufm.id = r.id AND r.rn > 1;
    `);

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
               "userID",
               "ao3ID",
               "seriesId",
               "updatedAt",
               ROW_NUMBER() OVER (PARTITION BY "userID", "seriesId" ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC) AS rn
        FROM public.user_fic_metadata
        WHERE "ao3ID" IS NULL AND "seriesId" IS NOT NULL
      )
      DELETE FROM public.user_fic_metadata ufm
      USING ranked r
      WHERE ufm.id = r.id AND r.rn > 1;
    `);
  },

  down: async () => {
    // No-op: cannot reliably reconstruct deleted duplicates
  }
};
