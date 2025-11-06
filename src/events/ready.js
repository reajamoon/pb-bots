const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Hey, it's Sam. I'm online and ready to help out.`);
        logger.info(`Currently keeping an eye on ${client.guilds.cache.size} ${client.guilds.cache.size === 1 ? 'server' : 'servers'}`);

        // Set bot status
        client.user.setActivity('the family business', { type: 'PLAYING' });
    },
};