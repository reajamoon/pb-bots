const { REST, Routes } = require('discord.js');
require('dotenv').config();
const { readdirSync } = require('fs');
const { join } = require('path');

const commands = [];
const commandsPath = join(__dirname, 'src', 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    const command = require(join(commandsPath, file));
    commands.push(command.data.toJSON());
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// Guild IDs for both servers
const guildIds = [
    process.env.TEST_GUILD_ID,        // Crypto's Cabana (test server)
    process.env.PROFOUND_BOND_GUILD_ID // Profound Bond (main server)
];

// Deploy commands to multiple guilds
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands across ${guildIds.length} servers.`);

        for (const guildId of guildIds) {
            console.log(`Deploying to guild: ${guildId}`);
            
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: commands },
            );

            console.log(`✅ Successfully deployed ${data.length} commands to guild ${guildId}`);
        }

        console.log(`🎉 All commands deployed successfully to all servers!`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();