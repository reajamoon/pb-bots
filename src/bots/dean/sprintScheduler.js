import { midpointEmbed, completeEmbed, summaryEmbed } from './text/sprintText.js';
import { DeanSprints, GuildSprintSettings, Wordcount, Project } from '../../models/index.js';

function getChannelFromIds(client, guildId, channelId, threadId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return null;
  if (threadId && channel.threads) {
    const thread = channel.threads.cache.get(threadId);
    return thread || channel;
  }
  return channel;
}

export async function scheduleSprintNotifications(sprint, client) {
  const durationMs = (sprint.durationMinutes || 0) * 60000;
  if (!durationMs) return;

  const startedAtMs = new Date(sprint.startedAt).getTime();
  const now = Date.now();
  const midpointDelay = Math.max(0, startedAtMs + durationMs / 2 - now);
  const endDelay = Math.max(0, startedAtMs + durationMs - now);

  const targetChannel = getChannelFromIds(client, sprint.guildId, sprint.channelId, sprint.threadId);
  if (!targetChannel) return;

  // Midpoint notification (dedupe: only host for team; Set guard)
  const firedKeySet = scheduleSprintNotifications._midKeys || (scheduleSprintNotifications._midKeys = new Set());
  const isTeamHost = sprint.type === 'team' && sprint.role === 'host' && sprint.groupId;
  const midKey = isTeamHost ? `${sprint.guildId}:${sprint.groupId}` : `${sprint.guildId}:${sprint.id}`;
  if (!sprint.midpointNotified && !firedKeySet.has(midKey)) {
    firedKeySet.add(midKey);
    setTimeout(async () => {
      try {
        const fresh = await DeanSprints.findByPk(sprint.id);
        if (!fresh || fresh.status !== 'processing') return;
        // For team sprints, only host posts midpoint to avoid duplicates
        if (fresh.type === 'team' && fresh.role !== 'host') return;
        const embed = midpointEmbed(fresh.label);
        await targetChannel.send({ embeds: [embed] });
        await fresh.update({ midpointNotified: true });
      } catch (e) {
        console.warn('[dean] midpoint notify failed', (e && e.message) || e);
      }
    }, midpointDelay);
  }

  // End notification
  setTimeout(async () => {
    try {
      const fresh = await DeanSprints.findByPk(sprint.id);
      if (!fresh || fresh.status !== 'processing') return;
      const embed = completeEmbed(fresh.type === 'team', fresh.label);
      // Only host posts completion for team to avoid duplicates
      if (fresh.type === 'team' && fresh.role !== 'host') {
        await fresh.update({ status: 'done', endNotified: true });
        return;
      }
      await targetChannel.send({ embeds: [embed] });
      // Mark all team rows done if host, otherwise just the solo
      if (fresh.type === 'team' && fresh.groupId) {
        await DeanSprints.update({ status: 'done', endNotified: true }, { where: { guildId: fresh.guildId, groupId: fresh.groupId, status: 'processing' } });
      } else {
        await fresh.update({ status: 'done', endNotified: true });
      }

      // Optional summary posting
      const settings = await GuildSprintSettings.findOne({ where: { guildId: fresh.guildId } });
      if (settings && settings.defaultSummaryChannelId) {
        const summaryChannel = getChannelFromIds(client, fresh.guildId, settings.defaultSummaryChannelId);
        if (summaryChannel) {
          const sum = await buildSummaries(fresh);
          const sumEmbed = summaryEmbed(`<#${fresh.threadId || fresh.channelId}>`, sum.label, sum.isTeam);
          await summaryChannel.send({ embeds: [sumEmbed] });
          // Post per-member totals line-wise for readability
          const lines = sum.members.map(m => `• <@${m.userId}>: ${m.total} words${m.projectName ? ` (${m.projectName})` : ''}`);
          if (lines.length) {
            await summaryChannel.send({ content: lines.join('\n') });
          }
        }
      }
    } catch (e) {
      console.warn('[dean] end notify failed', (e && e.message) || e);
    }
  }, endDelay);
}

async function buildSummaries(sprint) {
  const isTeam = sprint.type === 'team' && sprint.groupId;
  let participants;
  if (isTeam) {
    participants = await DeanSprints.findAll({ where: { guildId: sprint.guildId, groupId: sprint.groupId }, order: [['createdAt', 'ASC']] });
  } else {
    participants = [sprint];
  }
  const memberSummaries = [];
  for (const p of participants) {
    // Sum Wordcount rows recorded for this sprint/user
    const wcRows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
    const totalRaw = wcRows.reduce((acc, r) => {
      const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
      return acc + (d > 0 ? d : 0);
    }, 0);
    const total = Math.max(0, totalRaw);
    let projectName = null;
    if (p.projectId) {
      const proj = await Project.findByPk(p.projectId).catch(() => null);
      projectName = proj?.name || null;
    }
    memberSummaries.push({ userId: p.userId, total, projectName });
  }
  return {
    isTeam,
    label: sprint.label,
    durationMinutes: sprint.durationMinutes,
    members: memberSummaries,
  };
}
import { setTimeout as delay } from 'timers/promises';

export async function startSprintWatchdog(client) {
  // Lightweight poller to send end notifications; midpoint can be added similarly
  async function tick() {
    const now = Date.now();
    const active = await DeanSprints.findAll({ where: { status: 'processing' }, limit: 100 });
    for (const s of active) {
      const endsAt = new Date(s.startedAt).getTime() + s.durationMinutes * 60000;
      try {
        // For team sprints, only host triggers channel notifications
        const isTeamHost = s.type === 'team' && s.role === 'host';
        const shouldNotify = s.type === 'solo' || isTeamHost;
        // Midpoint notifications are handled by scheduleSprintNotifications to avoid duplicates
        if (!s.endNotified && now >= endsAt) {
          if (shouldNotify) {
            await notify(client, s, { embeds: [completeEmbed()] });
            // Also send to summary channel if configured
            const settings = await GuildSprintSettings.findOne({ where: { guildId: s.guildId } });
            if (settings && settings.defaultSummaryChannelId) {
              await notifySummary(client, s, settings.defaultSummaryChannelId);
            }
          }
          await s.update({ endNotified: true, status: 'done' });
        }
      } catch (e) {
        // Continue processing other sprints
        console.error('[dean] sprintScheduler notify error', e);
      }
    }
  }

  async function notify(client, s, payload) {
    const channel = await client.channels.fetch(s.threadId || s.channelId).catch(() => null);
    if (!channel) return;
    await channel.send(payload);
  }

  async function notifySummary(client, s, summaryChannelId) {
    const channel = await client.channels.fetch(summaryChannelId).catch(() => null);
    if (!channel) return;
    const sum = await buildSummaries(s);
    const embed = summaryEmbed(`<#${s.threadId || s.channelId}>`, sum.label, sum.isTeam);
    await channel.send({ embeds: [embed] });
    const lines = sum.members.map(m => `• <@${m.userId}>: ${m.total} words${m.projectName ? ` (${m.projectName})` : ''}`);
    if (lines.length) {
      await channel.send({ content: lines.join('\n') });
    }
  }

  (async function loop() {
    // Poll every 30s; AO3 rate limit spacing in Jack is ~20s, so this is fine
    while (true) {
      await tick();
      await delay(30000);
    }
  })();
}
