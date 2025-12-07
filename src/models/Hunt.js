import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Hunt = sequelize.define('Hunt', {
    key: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'hunts',
    underscored: true,
  });

  return Hunt;
};
