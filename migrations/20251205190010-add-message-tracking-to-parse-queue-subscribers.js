export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('ParseQueueSubscribers', 'channel_id', {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Channel ID of the original command reply to edit when job completes',
  });
  await queryInterface.addColumn('ParseQueueSubscribers', 'message_id', {
    type: Sequelize.STRING,
    allowNull: true,
    comment: 'Message ID of the original command reply to edit when job completes',
  });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.removeColumn('ParseQueueSubscribers', 'message_id');
  await queryInterface.removeColumn('ParseQueueSubscribers', 'channel_id');
}
