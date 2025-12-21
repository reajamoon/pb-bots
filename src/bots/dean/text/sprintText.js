// Dean voice: upbeat, direct, no em-dashes.
export const colors = {
  info: 0x3B82F6,
  success: 0x10B981,
  warn: 0xF59E0B,
};

// Randomized encouragement lines for status/midpoint/end
const soloBoosters = [
  "Keep it rolling.",
  "Carry on, wayward writer.",
  "Turn it up, keep typing!",
  "Stay on it. You got this.",
  "You're cooking! Keep going.",
  "Lock in.",
  "Hey, eyes on the page."
];

const teamBoosters = [
  "Crew's moving, don't fall behind.",
  "Keep pace.",
  "Run with the pack.",
  "Let's push.",
  "Bring the heat.",
  "I’ll be back... with edits."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Southern-style endearments; light, friendly, non-patronizing
const endearments = [
  'killer',
  'sweetheart',
  'sunshine',
  'cowboy',
];

function maybeEndearment() {
  // ~25% chance to append an endearment
  if (Math.random() < 0.25) {
    return ` ${pick(endearments)}`;
  }
  return '';
}

export function startSoloEmbed(minutes, label, visibility, startDelayMinutes = 0, mode) {
  const modeLine = mode ? `\nMode: ${mode}` : '';
  if (startDelayMinutes > 0) {
    const startAtUnix = Math.floor((Date.now() + startDelayMinutes * 60000) / 1000);
    return {
      title: 'Sprint queued',
      description: `Starts in ${startDelayMinutes} minute${startDelayMinutes === 1 ? '' : 's'} (at <t:${startAtUnix}:t>). Timer: ${minutes} minute${minutes === 1 ? '' : 's'} once it kicks off.${modeLine}${label ? `\nLabel: ${label}` : ''}`,
      color: colors.info,
    };
  }
  return {
    title: 'Sprint started',
    description: `Clock's on for ${minutes} minute${minutes === 1 ? '' : 's'}. ${pick(soloBoosters)}${maybeEndearment()}${modeLine}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
  };
}

export function hostTeamEmbed(minutes, label, groupId, startDelayMinutes = 0, mode) {
  const modeLine = mode ? `\nMode: ${mode}` : '';
  if (startDelayMinutes > 0) {
    const startAtUnix = Math.floor((Date.now() + startDelayMinutes * 60000) / 1000);
    return {
      title: 'Team sprint queued',
      description: `${hostTeamCodeLine(groupId)} Starts in ${startDelayMinutes} minute${startDelayMinutes === 1 ? '' : 's'} (at <t:${startAtUnix}:t>). Timer: ${minutes} minute${minutes === 1 ? '' : 's'} once it kicks off.${modeLine}${label ? `\nLabel: ${label}` : ''}`,
      color: colors.info,
    };
  }
  return {
    title: 'Team sprint started',
    description: `Clock's on for ${minutes} minute${minutes === 1 ? '' : 's'}. ${hostTeamCodeLine(groupId)} ${pick(teamBoosters)}${maybeEndearment()}${modeLine}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
  };
}

export function joinTeamEmbed() {
  return {
    title: 'Joined team sprint',
    description: "You're in. Run with the pack.",
    color: colors.success,
  };
}

export function endSoloEmbed() {
  return {
    title: 'Sprint ended',
    description: `Nice work. Drop your wordcount when you're ready${maybeEndearment()}.`,
    color: colors.success,
  };
}

export function endTeamEmbed() {
  return {
    title: 'Team sprint ended',
    description: `Good run. Post your numbers when you're ready${maybeEndearment()}.`,
    color: colors.success,
  };
}

export function statusSoloEmbed(remainingMin, label) {
  return {
    title: 'Sprint status',
    description: `About ${remainingMin} minute${remainingMin === 1 ? '' : 's'} left. You're cooking. ${maybeEndearment()}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
  };
}

export function statusTeamEmbed(remainingMin, count, label) {
  return {
    title: 'Team sprint status',
    description: `About ${remainingMin} minute${remainingMin === 1 ? '' : 's'} left. ${count} sprinter${count === 1 ? '' : 's'} in. Keep pace. ${maybeEndearment()}${label ? `\nLabel: ${label}` : ''}`,
    color: colors.info,
  };
}

export function leaveTeamEmbed() {
  return {
    title: 'Left team sprint',
    description: "Catch ya next round.",
    color: colors.warn,
  };
}

export function listEmbeds(lines) {
  return {
    title: 'Active sprints',
    description: lines.length ? lines.map(l => `• ${l}`).join('\n') : 'No active sprints in this channel.',
    color: colors.info,
  };
}

export function hostTeamCodeLine(groupId) {
  return `Join with code ${groupId}.`;
}

export function formatListLine(kind, remainingMin, userId, label) {
  const lbl = label ? ` • ${label}` : '';
  return `${kind} (${remainingMin}m left) • <@${userId}>${lbl}`;
}

export function midpointEmbed() {
  return {
    title: 'Midpoint',
    description: `Halfway there. You got this${maybeEndearment()}.`,
    color: colors.info,
  };
}

export function completeEmbed() {
  return {
    title: 'Sprint complete',
    description: "Nice work. Drop your wordcount when you're ready.",
    color: colors.success,
  };
}

export function summaryEmbed(channelMention, label, isTeam, mode) {
  const who = isTeam ? 'Team sprint' : 'Sprint';
  const lbl = label ? ` (${label})` : '';
  const modeLine = mode ? `\nMode: ${mode}` : '';
  return {
    title: 'Sprint summary',
    description: `${who} complete${lbl} in ${channelMention}. Nice pull.${modeLine}`,
    color: colors.info,
  };
}

// Plain-text responses in Dean's voice
export function notEnabledInChannelText(sprintChannelMention = '') {
  const tail = sprintChannelMention ? ` Head over to ${sprintChannelMention} if you wanna do that.` : '';
  return `Hey buddy, you can't sprint here.${tail}`;
}
export function noActiveTeamText() {
  return "There ain't anybody sprinting in here. Start one with `/sprint host`. If you need more bodies, I can call up my buddies.";
}
export function alreadyActiveSprintText() {
  return 'You already have a sprint going, dude. Need to ditch it? Use `/sprint end`. Or just keep rolling.';
}
export function noActiveSprintText() {
  return "Nobody's sprinting right now. Kick one off with `/sprint start`.";
}
export function notInTeamSprintText() {
  return "You're not in a team sprint. Ask the host for the code and use `/sprint join`.";
}
export function hostsUseEndText() {
  return 'If you started it, use `/sprint end`.';
}
export function selectAChannelText() {
  return 'Pick a channel to use. Keep it tidy.';
}
export function onlyStaffSetChannelText() {
  return "Only mods can set the sprint channel. Need a hand? Flag a mod.";
}
export function sprintChannelSetText(channelId, allowThreads) {
  return `Sprint channel set to <#${channelId}>. Threads are ${allowThreads ? 'allowed' : 'not allowed'}.`;
}

// ---------------------------------------------------------------------------
// Spec-aligned message templates (plain text)
// Note: These are additive helpers. Existing embed flows remain unchanged.

export function formatSprintIdentifier({ type, groupId, label, startedAt } = {}) {
  if (type === 'team' && groupId) {
    return label ? `${groupId} - ${label}` : `${groupId}`;
  }

  let ts = null;
  if (startedAt) {
    try {
      const d = new Date(startedAt);
      const ms = d.getTime();
      if (Number.isFinite(ms)) ts = Math.floor(ms / 1000);
    } catch {
      // ignore
    }
  }

  if (label) {
    // Solo sprint labels are not unique; add a short timestamp so concurrent
    // sprints with the same label are still distinguishable.
    return ts ? `${label} • <t:${ts}:t>` : label;
  }

  if (ts) return `Solo sprint • <t:${ts}:t>`;
  return 'Solo sprint';
}

function linesToBlock(lines) {
  if (!lines || !lines.length) return '';
  return lines.join('\n');
}

function chunkLinesForEmbed(lines, maxLen = 1024) {
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean).map(l => String(l)) : [];
  if (!safeLines.length) return [];

  const chunks = [];
  let current = '';
  for (const line of safeLines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLen) {
      if (current) chunks.push(current);
      current = line.length > maxLen ? line.slice(0, maxLen - 3) + '...' : line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function lateLogLine() {
  return "Log your words: You can still drop your numbers during your late logging window with `/wc` (default 15 minutes; your setting might be different.).";
}

export function sprintEndedWordsText({
  pingLine = '',
  sprintIdentifier,
  durationMinutes,
  leaderboardLines = [],
  alsoParticipatedLines = [],
} = {}) {
  const header = pingLine ? `${pingLine}\n\n` : '';
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';

  const leaderboardBlock = leaderboardLines.length
    ? linesToBlock(leaderboardLines)
    : 'No word logs yet.';

  const alsoBlock = alsoParticipatedLines.length
    ? `\n\nAlso participated (time)\n${linesToBlock(alsoParticipatedLines)}`
    : '';

  return (
    `${header}` +
    `Sprint's over: ${id}\n` +
    `Duration: ${dur}\n\n` +
    `Leaderboard (words)\n` +
    `${leaderboardBlock}` +
    `${alsoBlock}\n\n` +
    `${lateLogLine()}\n` +
    `Note: This summary might update if late logs roll in.`
  ).trim();
}

export function sprintEndedEmbed({
  sprintIdentifier,
  durationMinutes,
  mode,
  leaderboardLines = [],
  alsoParticipatedLines = [],
} = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';
  const modeLine = mode ? `\nMode: ${mode}` : '';

  const leaderboard = leaderboardLines.length ? leaderboardLines : ['No word logs yet.'];
  const leaderboardChunks = chunkLinesForEmbed(leaderboard, 1024);

  const alsoChunks = alsoParticipatedLines.length ? chunkLinesForEmbed(alsoParticipatedLines, 1024) : [];

  const fields = [];
  for (let i = 0; i < leaderboardChunks.length; i++) {
    fields.push({
      name: i === 0 ? 'Leaderboard (NET)' : 'Leaderboard (NET, cont.)',
      value: leaderboardChunks[i],
      inline: false,
    });
  }
  for (let i = 0; i < alsoChunks.length; i++) {
    fields.push({
      name: i === 0 ? 'Also participated (time)' : 'Also participated (time, cont.)',
      value: alsoChunks[i],
      inline: false,
    });
  }

  fields.push({
    name: 'Late logging',
    value: `${lateLogLine()}\nNote: This summary might update if late logs roll in.`,
    inline: false,
  });

  return {
    title: `Sprint's over: ${id}`,
    description: `Duration: ${dur}${modeLine}`,
    color: colors.success,
    fields,
  };
}

export function sprintEndedMixedEmbed({
  sprintIdentifier,
  durationMinutes,
  mode,
  participantLines = [],
} = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';
  const modeLine = mode ? `\nMode: ${mode}` : '\nMode: mixed';

  const participants = participantLines.length ? participantLines : ['No participants found.'];
  const participantChunks = chunkLinesForEmbed(participants, 1024);

  const fields = [];
  for (let i = 0; i < participantChunks.length; i++) {
    fields.push({
      name: i === 0 ? 'Participants (host first, then join order)' : 'Participants (cont.)',
      value: participantChunks[i],
      inline: false,
    });
  }

  fields.push({
    name: 'Late logging',
    value: `${lateLogLine()}\nNote: This summary might update if late logs roll in.`,
    inline: false,
  });

  return {
    title: `Sprint's over: ${id}`,
    description: `Duration: ${dur}${modeLine}`,
    color: colors.success,
    fields,
  };
}

export function sprintEndedTimeEmbed({
  sprintIdentifier,
  durationMinutes,
  mode,
  participantLines = [],
} = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';
  const modeLine = mode ? `\nMode: ${mode}` : '\nMode: time';

  const participants = participantLines.length ? participantLines : ['No participants found.'];
  const participantChunks = chunkLinesForEmbed(participants, 1024);

  const fields = [];
  for (let i = 0; i < participantChunks.length; i++) {
    fields.push({
      name: i === 0 ? 'Participants (host first, then join order)' : 'Participants (cont.)',
      value: participantChunks[i],
      inline: false,
    });
  }

  return {
    title: `Sprint's over: ${id}`,
    description: `Duration: ${dur}${modeLine}`,
    color: colors.success,
    fields,
  };
}

export function sprintEndedMixedText({
  pingLine = '',
  sprintIdentifier,
  durationMinutes,
  participantLines = [],
} = {}) {
  const header = pingLine ? `${pingLine}\n\n` : '';
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';

  const participantBlock = participantLines.length
    ? linesToBlock(participantLines)
    : 'No participants found.';

  return (
    `${header}` +
    `Sprint's over: ${id}\n` +
    `Duration: ${dur}\n\n` +
    `Participants (host first, then join order)\n` +
    `${participantBlock}\n\n` +
    `${lateLogLine()}\n` +
    `Note: This summary might update if late logs roll in.`
  ).trim();
}

export function sprintEndedTimeText({
  pingLine = '',
  sprintIdentifier,
  durationMinutes,
  participantLines = [],
} = {}) {
  const header = pingLine ? `${pingLine}\n\n` : '';
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';

  const participantBlock = participantLines.length
    ? linesToBlock(participantLines)
    : 'No participants found.';

  return (
    `${header}` +
    `Sprint's over: ${id}\n` +
    `Duration: ${dur}\n\n` +
    `Participants (host first, then join order)\n` +
    `${participantBlock}`
  ).trim();
}

export function sprintCheckInWordsText({ sprintIdentifier, timeLeftMinutes, progressLines = [] } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const left = Number.isFinite(timeLeftMinutes) ? `${timeLeftMinutes}m` : 'Unknown';
  const progressBlock = progressLines.length ? linesToBlock(progressLines) : 'No logs yet.';

  return (
    `Check-in: ${id}\n` +
    `Time left: ${left}\n\n` +
    `Logged so far\n` +
    `${progressBlock}\n\n` +
    `If you haven't logged yet, chill. Drop it with \/wc when you're ready.`
  ).trim();
}

export function sprintCheckInMixedText({ sprintIdentifier, timeLeftMinutes, participantLines = [] } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const left = Number.isFinite(timeLeftMinutes) ? `${timeLeftMinutes}m` : 'Unknown';
  const participantBlock = participantLines.length ? linesToBlock(participantLines) : 'No participants found.';

  return (
    `Check-in: ${id}\n` +
    `Time left: ${left}\n\n` +
    `So far (host first, then join order)\n` +
    `${participantBlock}\n\n` +
    `No pressure. Log words with \/wc if you feel like it.`
  ).trim();
}

export function sprintCheckInTimeText({ sprintIdentifier, timeLeftMinutes, participantLines = [] } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const left = Number.isFinite(timeLeftMinutes) ? `${timeLeftMinutes}m` : 'Unknown';
  const participantBlock = participantLines.length ? linesToBlock(participantLines) : 'No participants found.';

  return (
    `Check-in: ${id}\n` +
    `Time left: ${left}\n\n` +
    `So far (host first, then join order)\n` +
    `${participantBlock}\n\n` +
    `Keep it rolling.`
  ).trim();
}

export function sprintStatusWordsText({ sprintIdentifier, timeLeftMinutes, yourNetWordsSoFar, yourMinutesSoFar } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const left = Number.isFinite(timeLeftMinutes) ? `${timeLeftMinutes}m` : 'Unknown';
  const words = Number.isFinite(yourNetWordsSoFar) ? yourNetWordsSoFar : 0;
  const mins = Number.isFinite(yourMinutesSoFar) ? yourMinutesSoFar : 0;
  return (
    `Status: ${id}\n` +
    `Time left: ${left}\n\n` +
    `You: NET ${words} (minutes ${mins})\n\n` +
    `Log with \/wc whenever. You've got this.`
  ).trim();
}

export function sprintStatusMixedText({ sprintIdentifier, timeLeftMinutes, yourMinutesSoFar, yourNetWordsSoFar } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const left = Number.isFinite(timeLeftMinutes) ? `${timeLeftMinutes}m` : 'Unknown';
  const mins = Number.isFinite(yourMinutesSoFar) ? yourMinutesSoFar : 0;
  const wordsPart = Number.isFinite(yourNetWordsSoFar) ? ` - words NET ${yourNetWordsSoFar}` : '';
  return (
    `Status: ${id}\n` +
    `Time left: ${left}\n\n` +
    `You: minutes ${mins}${wordsPart}`
  ).trim();
}

export function sprintStatusTimeText({ sprintIdentifier, timeLeftMinutes, yourMinutesSoFar } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const left = Number.isFinite(timeLeftMinutes) ? `${timeLeftMinutes}m` : 'Unknown';
  const mins = Number.isFinite(yourMinutesSoFar) ? yourMinutesSoFar : 0;
  return (
    `Status: ${id}\n` +
    `Time left: ${left}\n\n` +
    `You: minutes ${mins}`
  ).trim();
}

export function sprintJoinText({ sprintIdentifier, durationMinutes } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';
  return (
    `You're in: ${id}\n` +
    `Timer: ${dur}\n\n` +
    "Optional: set a baseline now so `/wc set` can do the math for you. Or don't. I'm not your dad."
  ).trim();
}

export function sprintJoinTrackTimeText({ sprintIdentifier, durationMinutes } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const dur = Number.isFinite(durationMinutes) ? `${durationMinutes}m` : 'Unknown';
  return (
    `You're in (time track): ${id}\n` +
    `Timer: ${dur}\n\n` +
    "You're here for vibes and minutes. Wordcounts are off for you in this sprint."
  ).trim();
}

export function sprintLeaveText({ sprintIdentifier } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  return (`Got it. You're out: ${id}\nCatch you next round.`).trim();
}

export function sprintExtendText({ sprintIdentifier, newEndTimeRelative } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  const end = newEndTimeRelative || 'soon';
  return (`Extended: ${id}\nNew end time: ${end}\n\nAlright, we ride longer.`).trim();
}

export function sprintEndEarlyText({ sprintIdentifier } = {}) {
  const id = sprintIdentifier || 'Unknown sprint';
  return (`Ended early: ${id}\n\nNice work. If you logged words, the end summary will show up when I wrap it.`).trim();
}
