import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ModmailRelay = sequelize.define('ModmailRelay', {
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    bot_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ticket_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ticket_seq: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fic_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    thread_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    base_message_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    open: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_user_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_relayed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'open',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    timestamps: false,
    tableName: 'ModmailRelay',
    indexes: [
      { unique: false, fields: ['user_id'] },
      { unique: false, fields: ['bot_name'] },
      { unique: false, fields: ['user_id', 'bot_name', 'open'] },
      { unique: false, fields: ['thread_id'] },
      { unique: false, fields: ['ticket_number'] },
      { unique: true, fields: ['bot_name', 'ticket_seq'] }
    ]
  });
  return ModmailRelay;
};
