/**
 * Create DeanSprints table for per-user sprint sessions (CommonJS format).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('DeanSprints', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      guildId: { type: DataTypes.STRING, allowNull: false },
      channelId: { type: DataTypes.STRING, allowNull: true },
      threadId: { type: DataTypes.STRING, allowNull: true },
      type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'solo' },
      visibility: { type: DataTypes.STRING, allowNull: false, defaultValue: 'public' },
      startedAt: { type: DataTypes.DATE, allowNull: false },
      durationMinutes: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'processing' },
      wordcountStart: { type: DataTypes.INTEGER, allowNull: true },
      wordcountEnd: { type: DataTypes.INTEGER, allowNull: true },
      label: { type: DataTypes.STRING, allowNull: true },
      tags: { type: DataTypes.JSON, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      midpointNotified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      endNotified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('DeanSprints', ['userId', 'status']);
    await queryInterface.addIndex('DeanSprints', ['guildId', 'channelId']);
    await queryInterface.addIndex('DeanSprints', ['startedAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DeanSprints');
  },
};
