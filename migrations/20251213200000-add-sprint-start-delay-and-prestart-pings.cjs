'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const deanCols = await queryInterface.describeTable('DeanSprints').catch(() => null);
    if (!deanCols) return;

    if (!deanCols.startDelayMinutes) {
      await queryInterface.addColumn('DeanSprints', 'startDelayMinutes', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!deanCols.preStartPingsEnabled) {
      await queryInterface.addColumn('DeanSprints', 'preStartPingsEnabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!deanCols.preStartPing10Sent) {
      await queryInterface.addColumn('DeanSprints', 'preStartPing10Sent', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!deanCols.preStartPing5Sent) {
      await queryInterface.addColumn('DeanSprints', 'preStartPing5Sent', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!deanCols.preStartPing1Sent) {
      await queryInterface.addColumn('DeanSprints', 'preStartPing1Sent', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    const existingIdx = await queryInterface.showIndex('DeanSprints').catch(() => []);
    const idxNames = new Set((existingIdx || []).map(ix => ix.name));
    if (!idxNames.has('dean_sprints_started_at')) {
      await queryInterface.addIndex('DeanSprints', ['startedAt'], { name: 'dean_sprints_started_at' }).catch(() => {});
    }
  },

  async down(queryInterface) {
    const deanCols = await queryInterface.describeTable('DeanSprints').catch(() => null);
    if (!deanCols) return;

    await queryInterface.removeIndex('DeanSprints', 'dean_sprints_started_at').catch(() => {});

    if (deanCols.preStartPing1Sent) {
      await queryInterface.removeColumn('DeanSprints', 'preStartPing1Sent').catch(() => {});
    }
    if (deanCols.preStartPing5Sent) {
      await queryInterface.removeColumn('DeanSprints', 'preStartPing5Sent').catch(() => {});
    }
    if (deanCols.preStartPing10Sent) {
      await queryInterface.removeColumn('DeanSprints', 'preStartPing10Sent').catch(() => {});
    }
    if (deanCols.preStartPingsEnabled) {
      await queryInterface.removeColumn('DeanSprints', 'preStartPingsEnabled').catch(() => {});
    }
    if (deanCols.startDelayMinutes) {
      await queryInterface.removeColumn('DeanSprints', 'startDelayMinutes').catch(() => {});
    }
  },
};
