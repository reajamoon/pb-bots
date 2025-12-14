import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const DeanSprintsModelDef = sequelize.define('DeanSprints', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    guildId: { type: DataTypes.STRING, allowNull: false },
    channelId: { type: DataTypes.STRING, allowNull: true },
    threadId: { type: DataTypes.STRING, allowNull: true },
    projectId: { type: DataTypes.UUID, allowNull: true },
    groupId: { type: DataTypes.STRING, allowNull: true },
    hostId: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'participant' },
    type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'solo' },
    // Spec fields
    mode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'words' },
    track: { type: DataTypes.STRING, allowNull: false, defaultValue: 'words' },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    endSummaryChannelId: { type: DataTypes.STRING, allowNull: true },
    endSummaryMessageId: { type: DataTypes.STRING, allowNull: true },
    startDelayMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    preStartPingsEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    preStartPing10Sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    preStartPing5Sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    preStartPing1Sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
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
      { fields: ['groupId'] },
      { fields: ['hostId'] },
      { fields: ['endedAt'] },
    ],
  });

  return DeanSprintsModelDef;
};
