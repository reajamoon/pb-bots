import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const HuntProgress = sequelize.define('HuntProgress', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    huntKey: { type: DataTypes.STRING, allowNull: false },
    progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    unlockedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'hunt_progress',
    underscored: true,
    indexes: [
      { unique: true, fields: ['user_id', 'hunt_key'] },
    ],
  });

  return HuntProgress;
};
