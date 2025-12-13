import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const UserSettingPoke = sequelize.define('UserSettingPoke', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false, field: 'user_id' },
    settingKey: { type: DataTypes.STRING, allowNull: false, field: 'setting_key' },
  }, {
    tableName: 'user_setting_pokes',
    underscored: true,
    indexes: [
      { unique: true, fields: ['user_id', 'setting_key'], name: 'user_setting_pokes_user_setting_unique' },
    ],
  });

  return UserSettingPoke;
};
