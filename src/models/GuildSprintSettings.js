import { DataTypes } from 'sequelize';

export default (sequelize) => {
const GuildSprintSettings = sequelize.define('GuildSprintSettings', {
  guildId: { type: DataTypes.STRING, allowNull: false, unique: true },
  allowedChannelIds: { type: DataTypes.JSON, allowNull: true },
  blockedChannelIds: { type: DataTypes.JSON, allowNull: true },
  allowThreadsByDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  defaultSummaryChannelId: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'GuildSprintSettings',
  indexes: [{ fields: ['guildId'] }],
});

return GuildSprintSettings;
};
