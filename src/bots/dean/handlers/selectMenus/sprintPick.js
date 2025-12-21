import Discord from 'discord.js';
const { MessageFlags } = Discord;

import { Op } from 'sequelize';
import { DeanSprints, Wordcount } from '../../../../models/index.js';
import { getInteractionState, deleteInteractionState } from '../../utils/interactionState.js';
import { formatSprintIdentifier, noActiveSprintText, hostsUseEndText, sprintEndedWordsText, sprintLeaveText, sprintStatusWordsText, sprintEndedEmbed } from '../../text/sprintText.js';
import { sumNet } from '../../../../shared/utils/wordcountMath.js';

const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;

function getToken(customId) {
  if (!customId || typeof customId !== 'string') return null;
  const parts = customId.split('_');
  return parts.length >= 2 ? parts[1] : null;
}

function normalizeMode(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'time' || v === 'mixed' || v === 'words') return v;
  return 'words';
}

async function safeName(guild, userId) {
  try {
    if (!guild) return userId;
    const m = await guild.members.fetch(userId);
    return m?.displayName || m?.user?.username || userId;
  } catch {
    return userId;
  }
}

async function buildLeaderboardLines(participantRows, guild) {
  const scores = [];
  for (const p of participantRows) {
    const rows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
    const total = sumNet(rows);
    scores.push({ userId: p.userId, total });
  }
  scores.sort((a, b) => (b.total || 0) - (a.total || 0));
  const lines = [];
  for (let i = 0; i < scores.length; i++) {
    lines.push(`${i + 1}) <@${scores[i].userId}> - NET ${scores[i].total || 0}`);
  }
  return lines;
}

export async function execute(interaction) {
  try {
    const token = getToken(interaction.customId);
    if (!token) {
      return interaction.reply({ content: 'Nope. That menu is missing context. Run `/sprint` again.', flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    }

    const state = getInteractionState(token);
    if (!state || state.userId !== interaction.user.id) {
      return interaction.reply({ content: 'Nope. That menu expired. Run `/sprint` again.', flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    }

    const guildId = state.guildId ?? interaction.guildId;
    const action = state.action;
    const pickedId = interaction.values?.[0];

    if (!pickedId) {
      return interaction.reply({ content: 'Pick one, buddy.', flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
    }

    const target = await DeanSprints.findByPk(pickedId).catch(() => null);
    if (!target || target.guildId !== guildId || target.userId !== interaction.user.id || target.status !== 'processing') {
      deleteInteractionState(token);
      return interaction.update({ content: noActiveSprintText(), components: [], allowedMentions: { parse: [] } });
    }

    // Consume the state so repeated submits do nothing.
    deleteInteractionState(token);

    if (action === 'status') {
      const sprintIdentifier = formatSprintIdentifier({ type: target.type, groupId: target.groupId, label: target.label, startedAt: target.startedAt });
      const nowMs = Date.now();
      const startsAtMs = new Date(target.startedAt).getTime();
      if (nowMs < startsAtMs) {
        const startsInMin = Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000));
        return interaction.update({
          content: `Status: ${sprintIdentifier}\nStarts in: ${startsInMin}m\nTimer: ${target.durationMinutes}m once it kicks off.`,
          components: [],
          allowedMentions: { parse: [] },
        });
      }

      const endsAt = new Date(startsAtMs + target.durationMinutes * 60000);
      const remainingMs = endsAt.getTime() - nowMs;
      const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
      const elapsedMin = Math.max(0, Math.floor((nowMs - startsAtMs) / 60000));
      const rows = await Wordcount.findAll({ where: { sprintId: target.id, userId: interaction.user.id }, order: [['recordedAt', 'ASC']] });
      const sprintTotal = sumNet(rows);

      return interaction.update({
        content: sprintStatusWordsText({
          sprintIdentifier,
          timeLeftMinutes: remainingMin,
          yourNetWordsSoFar: sprintTotal,
          yourMinutesSoFar: elapsedMin,
        }),
        components: [],
        allowedMentions: { parse: [] },
      });
    }

    if (action === 'end') {
      // Team sprint: only host can end for everyone.
      if (target.type === 'team' && target.role !== 'host') {
        return interaction.update({ content: hostsUseEndText(), components: [], allowedMentions: { parse: [] } });
      }

      const endedAt = new Date();
      const sprintIdentifier = formatSprintIdentifier({ type: target.type, groupId: target.groupId, label: target.label, startedAt: target.startedAt });

      if (target.type === 'team' && target.groupId) {
        const participants = await DeanSprints.findAll({
          where: { guildId, groupId: target.groupId, status: 'processing' },
          order: [['createdAt', 'ASC']],
        });
        const participantIds = [...new Set(participants.map(p => p.userId))];
        const pingLine = participantIds.length ? participantIds.map(id => `<@${id}>`).join(' ') : '';
        const leaderboardLines = await buildLeaderboardLines(participants, interaction.guild);

        // Idempotent-ish: atomically update all processing rows in this group.
        await DeanSprints.update(
          { status: 'done', endNotified: true, endedAt },
          { where: { guildId, groupId: target.groupId, status: 'processing' } }
        );

        await DeanSprints.update(
          {
            endedAt,
            endSummaryChannelId: interaction.channelId || interaction.message?.channelId || null,
            endSummaryMessageId: interaction.message?.id || null,
          },
          { where: { guildId, groupId: target.groupId } }
        ).catch(() => null);

        return interaction.update({
          content: pingLine,
          embeds: [sprintEndedEmbed({ sprintIdentifier, durationMinutes: target.durationMinutes, leaderboardLines, mode: normalizeMode(target.mode) })],
          components: [],
          allowedMentions: { users: participantIds, parse: [] },
        });
      }

      // Solo sprint end.
      await DeanSprints.update(
        { status: 'done', endNotified: true, endedAt },
        { where: { id: target.id, status: 'processing' } }
      ).catch(() => null);

      await target.update({
        endSummaryChannelId: interaction.channelId || interaction.message?.channelId || null,
        endSummaryMessageId: interaction.message?.id || null,
      }).catch(() => null);

      const participantIds = [target.userId];
      const pingLine = `<@${target.userId}>`;
      const leaderboardLines = await buildLeaderboardLines([target], interaction.guild);

      return interaction.update({
        content: pingLine,
        embeds: [sprintEndedEmbed({ sprintIdentifier, durationMinutes: target.durationMinutes, leaderboardLines, mode: normalizeMode(target.mode) })],
        components: [],
        allowedMentions: { users: participantIds, parse: [] },
      });
    }

    if (action === 'leave') {
      if (target.type !== 'team') {
        return interaction.update({ content: "That's not a team sprint.", components: [], allowedMentions: { parse: [] } });
      }
      if (target.role === 'host') {
        return interaction.update({ content: hostsUseEndText(), components: [], allowedMentions: { parse: [] } });
      }

      const endedAt = new Date();
      await DeanSprints.update(
        { status: 'done', endNotified: true, endedAt },
        { where: { id: target.id, status: 'processing' } }
      ).catch(() => null);

      const sprintIdentifier = formatSprintIdentifier({ type: target.type, groupId: target.groupId, label: target.label, startedAt: target.startedAt });
      return interaction.update({
        content: sprintLeaveText({ sprintIdentifier }),
        components: [],
        allowedMentions: { parse: [] },
      });
    }

    return interaction.update({ content: 'Yeah, I do not know what that picker was trying to do.', components: [], allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('[Dean/sprintPick] error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec.", flags: EPHEMERAL_FLAG, allowedMentions: { parse: [] } });
      } else {
        await interaction.update({ content: "Yeah, that's on me. Try that again in a sec.", components: [], allowedMentions: { parse: [] } });
      }
    } catch {}
  }
}

export default { execute };
