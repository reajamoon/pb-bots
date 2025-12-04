import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const DeanSprints = sequelize.define('DeanSprints', {
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
  }, {
    tableName: 'DeanSprints',
    indexes: [
      { fields: ['userId', 'status'] },
      { fields: ['guildId', 'channelId'] },
      { fields: ['startedAt'] },
    ],
  });

  return DeanSprints;
};
