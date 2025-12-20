import { summaryEmbed, formatSprintIdentifier, sprintCheckInWordsText, sprintEndedWordsText } from './text/sprintText.js';
import { DeanSprints, GuildSprintSettings, Wordcount, Project } from '../../models/index.js';
import fireTrigger from '../../shared/hunts/triggerEngine.js';
import { sumNet } from '../../shared/utils/wordcountMath.js';

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
  const startsInMs = startedAtMs - now;
  const midpointDelay = Math.max(0, startedAtMs + durationMs / 2 - now);

  const targetChannel = getChannelFromIds(client, sprint.guildId, sprint.channelId, sprint.threadId);
  if (!targetChannel) return;

  async function safeDisplayName(userId) {
    try {
      if (targetChannel.guild && targetChannel.guild.members) {
        const m = await targetChannel.guild.members.fetch(userId);
        return m?.displayName || m?.user?.username || userId;
      }
    } catch {}
    return userId;
  }

  async function buildLeaderboardLines(participantRows) {
    const scores = [];
    for (const p of participantRows) {
      const wcRows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
      const total = sumNet(wcRows);
      scores.push({ userId: p.userId, total });
    }
    scores.sort((a, b) => (b.total || 0) - (a.total || 0));
    const lines = [];
    for (let i = 0; i < scores.length; i++) {
      const name = await safeDisplayName(scores[i].userId);
      lines.push(`${i + 1}) ${name} - NET ${scores[i].total || 0}`);
    }
    return lines;
  }

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

        const sprintIdentifier = formatSprintIdentifier({ type: fresh.type, groupId: fresh.groupId, label: fresh.label, startedAt: fresh.startedAt });
        const endsAt = new Date(new Date(fresh.startedAt).getTime() + (fresh.durationMinutes || 0) * 60000);
        const remainingMin = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 60000));

        const participants = (fresh.type === 'team' && fresh.groupId)
          ? await DeanSprints.findAll({ where: { guildId: fresh.guildId, groupId: fresh.groupId, status: 'processing' }, order: [['createdAt', 'ASC']] })
          : [fresh];

        const progressLines = [];
        for (const p of participants) {
          const wcRows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
          const total = sumNet(wcRows);
          const name = await safeDisplayName(p.userId);
          progressLines.push(`${name}: NET ${total || 0}`);
        }

        await targetChannel.send({
          content: sprintCheckInWordsText({ sprintIdentifier, timeLeftMinutes: remainingMin, progressLines }),
          allowedMentions: { parse: [] },
        });
        await fresh.update({ midpointNotified: true });
      } catch (e) {
        console.warn('[dean] midpoint notify failed', (e && e.message) || e);
      }
    }, midpointDelay);
  }

  // Optional pre-start reminder pings (team host only)
  // Dedupe uses DB flags so rescheduling after restart won't re-ping.
  const isTeamHostForReminders = sprint.type === 'team' && sprint.role === 'host' && sprint.groupId;
  const preStartEnabled = Boolean(sprint.preStartPingsEnabled);
  if (isTeamHostForReminders && preStartEnabled && startsInMs > 60000) {
    async function sendPreStartPing(minutesRemaining) {
      try {
        const fresh = await DeanSprints.findByPk(sprint.id);
        if (!fresh || fresh.status !== 'processing') return;

        const freshStartedAtMs = new Date(fresh.startedAt).getTime();
        const remainingMs = freshStartedAtMs - Date.now();
        if (remainingMs <= 0) return;

        let flagField = null;
        if (minutesRemaining === 10) flagField = 'preStartPing10Sent';
        if (minutesRemaining === 5) flagField = 'preStartPing5Sent';
        if (minutesRemaining === 1) flagField = 'preStartPing1Sent';
        if (!flagField) return;

        const [updated] = await DeanSprints.update(
          { [flagField]: true },
          { where: { id: fresh.id, [flagField]: false } }
        ).catch(() => [0]);
        if (!updated) return;

        const participants = await DeanSprints.findAll({ where: { guildId: fresh.guildId, groupId: fresh.groupId, status: 'processing' }, order: [['createdAt', 'ASC']] });
        const participantIds = [...new Set(participants.map(p => p.userId))];
        const pingLine = participantIds.length ? participantIds.map(id => `<@${id}>`).join(' ') : '';
        const sprintIdentifier = formatSprintIdentifier({ type: fresh.type, groupId: fresh.groupId, label: fresh.label, startedAt: fresh.startedAt });

        let reminderLine = `T-minus **${minutesRemaining}** minute${minutesRemaining === 1 ? '' : 's'}.`;
        if (minutesRemaining === 10) reminderLine = 'Ten minutes. Finish your tea, find your doc.';
        if (minutesRemaining === 5) reminderLine = 'Five minutes. Wrap it up and get in position.';
        if (minutesRemaining === 1) reminderLine = 'One minute. Lock in.';

        await targetChannel.send({
          content: `${pingLine}\n${reminderLine}\nSprint: ${sprintIdentifier}`,
          allowedMentions: { users: participantIds, parse: [] },
        });
      } catch (e) {
        console.warn('[dean] pre-start ping failed', (e && e.message) || e);
      }
    }

    const delay10 = Math.max(0, startedAtMs - (Date.now() + 10 * 60000));
    const delay5 = Math.max(0, startedAtMs - (Date.now() + 5 * 60000));
    const delay1 = Math.max(0, startedAtMs - (Date.now() + 1 * 60000));

    if (startsInMs >= 10 * 60000) {
      setTimeout(() => sendPreStartPing(10), delay10);
    }
    if (startsInMs >= 5 * 60000) {
      setTimeout(() => sendPreStartPing(5), delay5);
    }
    setTimeout(() => sendPreStartPing(1), delay1);
  }

  // End notifications are handled by the watchdog. (This avoids duplicate end pings
  // when both timeouts and the watchdog are running.)
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
    const total = sumNet(wcRows);
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
        // Midpoint notifications are handled by scheduleSprintNotifications.
        // End notifications are handled here, with an atomic status update guard to avoid duplicates.
        if (!s.endNotified && now >= endsAt) {
          const endedAt = new Date();

          // For team sprints, only host triggers channel notifications.
          // Non-host rows still get marked done.
          const isTeam = s.type === 'team' && s.groupId;
          const isTeamHost = isTeam && s.role === 'host';
          if (isTeam && !isTeamHost) {
            await DeanSprints.update(
              { endNotified: true, status: 'done', endedAt },
              { where: { id: s.id, status: 'processing' } }
            ).catch(() => null);
            continue;
          }

          const shouldNotify = s.type === 'solo' || isTeamHost;

          // Atomic guard: only one worker should move the sprint(s) to done.
          const [updated] = isTeam
            ? await DeanSprints.update(
              { endNotified: true, status: 'done', endedAt },
              { where: { guildId: s.guildId, groupId: s.groupId, status: 'processing' } }
            ).catch(() => [0])
            : await DeanSprints.update(
              { endNotified: true, status: 'done', endedAt },
              { where: { id: s.id, status: 'processing', endNotified: false } }
            ).catch(() => [0]);

          if (!updated) continue;

          let endSummaryChannelId = null;
          let endSummaryMessageId = null;

          if (shouldNotify) {
            try {
              const channel = await client.channels.fetch(s.threadId || s.channelId).catch(() => null);
              if (channel) {
                const sprintIdentifier = formatSprintIdentifier({ type: s.type, groupId: s.groupId, label: s.label, startedAt: s.startedAt });
                const participants = isTeam
                  ? await DeanSprints.findAll({ where: { guildId: s.guildId, groupId: s.groupId }, order: [['createdAt', 'ASC']] })
                  : [s];
                const participantIds = [...new Set(participants.map(p => p.userId))];
                const pingLine = participantIds.length ? participantIds.map(id => `<@${id}>`).join(' ') : '';

                const scores = [];
                for (const p of participants) {
                  const wcRows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
                  const total = sumNet(wcRows);
                  scores.push({ userId: p.userId, total });
                }
                scores.sort((a, b) => (b.total || 0) - (a.total || 0));
                const leaderboardLines = [];
                for (let i = 0; i < scores.length; i++) {
                  let name = scores[i].userId;
                  try {
                    if (channel.guild && channel.guild.members) {
                      const m = await channel.guild.members.fetch(scores[i].userId);
                      name = m?.displayName || m?.user?.username || scores[i].userId;
                    }
                  } catch {}
                  leaderboardLines.push(`${i + 1}) ${name} - NET ${scores[i].total || 0}`);
                }

                const endMessage = await channel.send({
                  content: sprintEndedWordsText({ pingLine, sprintIdentifier, durationMinutes: s.durationMinutes, leaderboardLines }),
                  allowedMentions: { users: participantIds, parse: [] },
                });

                endSummaryChannelId = channel.id;
                endSummaryMessageId = endMessage.id;
              }
            } catch (e) {
              console.warn('[dean] watchdog end notify failed', (e && e.message) || e);
            }

            // Also send to summary channel if configured
            const settings = await GuildSprintSettings.findOne({ where: { guildId: s.guildId } });
            if (settings && settings.defaultSummaryChannelId) {
              await notifySummary(client, s, settings.defaultSummaryChannelId);
            }
          }

          // Best-effort persist end refs for late logging edits
          if (endSummaryChannelId && endSummaryMessageId) {
            if (isTeam) {
              await DeanSprints.update(
                { endSummaryChannelId, endSummaryMessageId },
                { where: { guildId: s.guildId, groupId: s.groupId } }
              ).catch(() => null);
            } else {
              await DeanSprints.update(
                { endSummaryChannelId, endSummaryMessageId },
                { where: { id: s.id } }
              ).catch(() => null);
            }
          }

          // Fire hunt trigger for sprint completion in watchdog path
          try {
            const channel = await client.channels.fetch(s.threadId || s.channelId).catch(() => null);
            await fireTrigger('dean.sprint.completed', { userId: s.userId, channel });
          } catch {}
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
    const summaryIdentifier = formatSprintIdentifier({ type: s.type, groupId: s.groupId, label: sum.label ?? s.label, startedAt: s.startedAt });
    const embed = summaryEmbed(`<#${s.threadId || s.channelId}>`, summaryIdentifier, sum.isTeam);
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
