import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import registerDeanCommands from './registerCommands.js';
import onReady from './events/ready.js';
import onInteractionCreate from './events/interactionCreate.js';
import { initEmojiStore } from '../../shared/emojiStore.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { readdirSync } from 'fs';

const token = (process.env.DEAN_BOT_TOKEN || '').trim();
if (!token) {
  console.error('DEAN_BOT_TOKEN is not set.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();

// Dynamically load command handlers from ./commands
try {
  const here = fileURLToPath(import.meta.url);
  const dir = dirname(here);
  const commandsDir = join(dir, 'commands');
  const files = readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = await import(pathToFileURL(join(commandsDir, file)).href);
    const cmd = mod.default || mod;
    if (cmd?.data?.name && typeof cmd.execute === 'function') {
      client.commands.set(cmd.data.name, cmd);
    }
  }
  console.log('[dean] Loaded commands:', Array.from(client.commands.keys()).join(', '));
} catch (e) {
  console.warn('[dean] Failed loading commands:', e && e.message ? e.message : e);
}

// Startup diagnostics to confirm runtime and module resolution
try {
  console.log('[dean] Node', process.version, 'platform', process.platform);
  const here = fileURLToPath(import.meta.url);
  const dir = dirname(here);
  const schedPath = join(dir, 'sprintScheduler.js');
  console.log('[dean] scheduler path', schedPath, 'url', pathToFileURL(schedPath).href);
} catch (e) {
  console.log('[dean] startup diagnostics failed:', e && e.message ? e.message : e);
}

// Delegate ready handling to modular event file
onReady(client);
onInteractionCreate(client);

process.on('uncaughtException', (err) => {
  console.error('[dean] uncaughtException:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[dean] unhandledRejection:', reason && reason.stack ? reason.stack : reason);
});

const REGISTER_ON_BOOT = String(process.env.DEAN_REGISTER_ON_BOOT || 'false').toLowerCase() === 'true';
await client.login(token);
if (REGISTER_ON_BOOT) {
  await registerDeanCommands(client);
} else {
  console.log('[dean] Skipping command registration on boot (DEAN_REGISTER_ON_BOOT=false).');
}
