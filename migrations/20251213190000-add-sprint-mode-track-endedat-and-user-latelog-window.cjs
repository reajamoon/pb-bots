'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Defensive migrations: production may have partial deploys.
    const deanCols = await queryInterface.describeTable('DeanSprints').catch(() => null);
    if (deanCols) {
      if (!deanCols.mode) {
        await queryInterface.addColumn('DeanSprints', 'mode', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'words',
        });
      }
      if (!deanCols.track) {
        await queryInterface.addColumn('DeanSprints', 'track', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'words',
        });
      }
      if (!deanCols.joinedAt) {
        await queryInterface.addColumn('DeanSprints', 'joinedAt', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        });
      }
      if (!deanCols.endedAt) {
        await queryInterface.addColumn('DeanSprints', 'endedAt', {
          type: Sequelize.DATE,
          allowNull: true,
        });
      }
      if (!deanCols.endSummaryChannelId) {
        await queryInterface.addColumn('DeanSprints', 'endSummaryChannelId', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }
      if (!deanCols.endSummaryMessageId) {
        await queryInterface.addColumn('DeanSprints', 'endSummaryMessageId', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }

      // Helpful for editing/lookup, optional.
      const existingIdx = await queryInterface.showIndex('DeanSprints').catch(() => []);
      const idxNames = new Set((existingIdx || []).map(ix => ix.name));
      if (!idxNames.has('dean_sprints_ended_at')) {
        await queryInterface.addIndex('DeanSprints', ['endedAt'], { name: 'dean_sprints_ended_at' }).catch(() => {});
      }
      if (!idxNames.has('dean_sprints_group_id_status')) {
        await queryInterface.addIndex('DeanSprints', ['guildId', 'groupId', 'status'], { name: 'dean_sprints_group_id_status' }).catch(() => {});
      }
    }

    const userCols = await queryInterface.describeTable('users').catch(() => null);
    if (userCols && !userCols.sprintRecentlyEndedWindowMinutes) {
      await queryInterface.addColumn('users', 'sprintRecentlyEndedWindowMinutes', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 15,
      });
      await queryInterface.addIndex('users', ['sprintRecentlyEndedWindowMinutes']).catch(() => {});
    }
  },

  async down(queryInterface) {
    const deanCols = await queryInterface.describeTable('DeanSprints').catch(() => null);
    if (deanCols) {
      await queryInterface.removeIndex('DeanSprints', 'dean_sprints_group_id_status').catch(() => {});
      await queryInterface.removeIndex('DeanSprints', 'dean_sprints_ended_at').catch(() => {});

      if (deanCols.endSummaryMessageId) {
        await queryInterface.removeColumn('DeanSprints', 'endSummaryMessageId').catch(() => {});
      }
      if (deanCols.endSummaryChannelId) {
        await queryInterface.removeColumn('DeanSprints', 'endSummaryChannelId').catch(() => {});
      }
      if (deanCols.endedAt) {
        await queryInterface.removeColumn('DeanSprints', 'endedAt').catch(() => {});
      }
      if (deanCols.joinedAt) {
        await queryInterface.removeColumn('DeanSprints', 'joinedAt').catch(() => {});
      }
      if (deanCols.track) {
        await queryInterface.removeColumn('DeanSprints', 'track').catch(() => {});
      }
      if (deanCols.mode) {
        await queryInterface.removeColumn('DeanSprints', 'mode').catch(() => {});
      }
    }

    const userCols = await queryInterface.describeTable('users').catch(() => null);
    if (userCols && userCols.sprintRecentlyEndedWindowMinutes) {
      await queryInterface.removeIndex('users', ['sprintRecentlyEndedWindowMinutes']).catch(() => {});
      await queryInterface.removeColumn('users', 'sprintRecentlyEndedWindowMinutes').catch(() => {});
    }
  },
};
