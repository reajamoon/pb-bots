// One-time backfill: award Library Card hunt and grant role to existing reactors
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { Config, HuntProgress } from '../src/models/index.js';
import { fireTrigger } from '../src/shared/hunts/triggerEngine.js';
import { makeAnnouncer } from '../src/shared/hunts/announce.js';

async function main() {
  const token = process.env.SAM_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!token) {
    console.error('Missing bot token (SAM_TOKEN/DISCORD_TOKEN/BOT_TOKEN)');
    process.exit(1);
  }

  const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ] });

  await client.login(token);
  await new Promise(resolve => client.once('ready', resolve));
  console.log(`Logged in as ${client.user.tag}`);

  const messageIdCfg = await Config.findOne({ where: { key: 'rec_guidelines_message_id' } });
  const roleIdCfg = await Config.findOne({ where: { key: 'rec_guidelines_role_id' } });
  const messageId = messageIdCfg?.value;
  const roleId = roleIdCfg?.value;
  if (!messageId || !roleId) {
    console.error('Missing rec_guidelines_message_id or rec_guidelines_role_id in Config');
    process.exit(1);
  }

  // Attempt to locate the message across guilds/channels
  let targetMessage = null;
  for (const [, guild] of client.guilds.cache) {
    const channels = await guild.channels.fetch();
    for (const [, ch] of channels) {
      try {
        if (!ch?.isTextBased?.()) continue;
        const msg = await ch.messages.fetch(messageId).catch(() => null);
        if (msg) { targetMessage = msg; break; }
      } catch {}
    }
    if (targetMessage) break;
  }

  if (!targetMessage) {
    console.error('Could not find guidelines message');
    process.exit(1);
  }

  const guild = targetMessage.guild;
  const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    console.error('Could not find role');
    process.exit(1);
  }

  const announce = makeAnnouncer({
    sendEphemeral: async (_botName, _userId, content, { flags } = {}) => {
      await targetMessage.channel?.send({ content, flags });
    },
    sendPublic: async (_botName, _userId, contentOrOpts) => {
      const payload = typeof contentOrOpts === 'string'
        ? { content: contentOrOpts }
        : { content: contentOrOpts.content, embeds: contentOrOpts.embed ? [contentOrOpts.embed] : contentOrOpts.embeds };
      await targetMessage.channel?.send(payload);
    },
  });

  let processed = 0;
  for (const [, reaction] of targetMessage.reactions.cache) {
    const users = await reaction.users.fetch({ limit: 100 });
    for (const [, user] of users) {
      if (user.bot) continue;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) continue;
      // Skip if already unlocked to avoid duplicate announce/grant
      const already = await HuntProgress.findOne({ where: { userId: user.id, huntKey: 'library_card_guidelines', unlockedAt: { not: null } } }).catch(() => null);
      if (already) continue;

      const grantRole = async (uid) => {
        if (uid !== user.id) return;
        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role.id).catch(() => {});
        }
      };
      await fireTrigger('system.reaction.special', { userId: user.id, announce, grantRole });
      processed += 1;
    }
  }

  console.log(`Processed ${processed} users.`);
  client.destroy();
}

main().catch(err => { console.error(err); process.exit(1); });
