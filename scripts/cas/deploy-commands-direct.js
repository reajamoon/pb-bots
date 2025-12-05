import 'dotenv/config';
import https from 'https';

const token = process.env.CAS_BOT_TOKEN;
const clientId = process.env.CAS_CLIENT_ID;
const guildId = process.env.CAS_GUILD_ID;

if (!token || !clientId) {
  console.error('[cas] Missing token or clientId. Set CAS_BOT_TOKEN and CAS_CLIENT_ID.');
  process.exit(1);
}

let commands = [];
try {
  const { default: casCommands } = await import('../../src/bots/cas/registerCommands.js');
  if (Array.isArray(casCommands)) commands = casCommands;
} catch (e) {
  console.warn('[cas] Could not import registerCommands.js as array; using []');
}

const body = JSON.stringify(commands);
const path = guildId
  ? `/api/v10/applications/${clientId}/guilds/${guildId}/commands`
  : `/api/v10/applications/${clientId}/commands`;

const req = https.request(
  {
    hostname: 'discord.com',
    method: 'PUT',
    path,
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  },
  res => {
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[cas] Registered ${commands.length} commands${guildId ? ' (guild)' : ''}.`);
      } else {
        console.error(`[cas] Failed to register commands: ${res.statusCode}`);
        console.error(data);
        process.exitCode = 1;
      }
    });
  }
);

req.on('error', err => {
  console.error('[cas] HTTPS error registering commands:', err);
  process.exit(1);
});

req.write(body);
req.end();
