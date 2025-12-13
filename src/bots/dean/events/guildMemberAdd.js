import deanIntroMessage from '../text/introText.js';
import { Config } from '../../../models/index.js';

async function getConfigValue(key) {
  const row = await Config.findOne({ where: { key } }).catch(() => null);
  return (row?.value || '').trim();
}

export default function onGuildMemberAdd(client) {
  client.on('guildMemberAdd', async (member) => {
    try {
      if (!member || member.user?.bot) return;

      const introChannelId = await getConfigValue('intro_channel_id');
      if (!introChannelId) {
        console.warn('[dean] Missing Config key intro_channel_id; skipping intro message.');
        return;
      }

      const modQuestionsChannelId = await getConfigValue('mod_questions_channel_id');
      const casUserId = await getConfigValue('cas_bot_user_id');

      const modQuestionsMention = modQuestionsChannelId ? `<#${modQuestionsChannelId}>` : '';
      const casMention = casUserId ? `<@${casUserId}>` : '';

      const channel = await member.guild.channels.fetch(introChannelId).catch(() => null);
      if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased()) {
        console.warn('[dean] Intro channel not found or not text-based:', introChannelId);
        return;
      }

      await channel.send({ content: deanIntroMessage(`<@${member.id}>`, modQuestionsMention, casMention) });
    } catch (err) {
      console.warn('[dean] guildMemberAdd handler failed:', (err && err.message) || err);
    }
  });
}
