import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ParseQueueSubscriber = sequelize.define('ParseQueueSubscriber', {
    queue_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ParseQueue',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Channel ID of the original command reply to edit when job completes'
    },
    message_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Message ID of the original command reply to edit when job completes'
    },
  }, {
    timestamps: true,
    tableName: 'ParseQueueSubscribers',
    underscored: true,
  });

  return ParseQueueSubscriber;
};
