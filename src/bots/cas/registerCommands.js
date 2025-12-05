import { REST, Routes } from 'discord.js';
import ping from './commands/ping.js';
import modmail from './commands/modmail.js';
import modmailClose from './commands/modmailClose.js';
import hug from './commands/hug.js';

export default async function registerCasCommands(client) {
  const guildId = process.env.CAS_GUILD_ID || process.env.GUILD_ID;
  const appId = process.env.CAS_CLIENT_ID || process.env.CLIENT_ID;
  const token = (process.env.CAS_BOT_TOKEN || '').trim();
  if (!guildId || !appId || !token) {
    console.warn('[cas] Missing env: CAS_GUILD_ID, CAS_APP_ID, or CAS_BOT_TOKEN');
  }

  client.commands.set(ping.data.name, ping);
  client.commands.set(modmail.data.name, modmail);
  client.commands.set(modmailClose.data.name, modmailClose);
  client.commands.set(hug.data.name, hug);

  const commands = [ping.data.toJSON(), modmail.data.toJSON(), modmailClose.data.toJSON(), hug.data.toJSON()];
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log('[cas] Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('[cas] Registered global commands');
    }
  } catch (err) {
    console.error('[cas] Failed to register commands:', err);
  }
}
