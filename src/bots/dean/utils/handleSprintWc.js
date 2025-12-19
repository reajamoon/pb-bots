import Discord from 'discord.js';
const {
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} = Discord;
import { Op } from 'sequelize';
import { DeanSprints, User, Wordcount, Project } from '../../../models/index.js';
import { formatSprintIdentifier, noActiveSprintText, sprintEndedWordsText } from '../text/sprintText.js';
import { wcSprintPickerPromptText, wcConfirmSetPromptText, wcConfirmUndoPromptText, wcConfirmBaselinePromptText } from '../text/wcText.js';
import { setInteractionState } from './interactionState.js';

function makeToken(length = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function buildCandidateTargets({ guildId, discordId, windowMinutes }) {
  const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId, status: 'processing' }, order: [['startedAt', 'DESC']] });

  const candidates = actives.map(row => ({ row, kind: 'active' }));

  if (windowMinutes > 0) {
    const ended = await DeanSprints.findAll({
      where: { userId: discordId, guildId, status: 'done', endedAt: { [Op.ne]: null } },
      order: [['endedAt', 'DESC']],
      limit: 5,
    });
    for (const row of ended) {
      const endedAt = row.endedAt ? new Date(row.endedAt) : null;
      if (!endedAt) continue;
      const withinWindow = (Date.now() - endedAt.getTime()) <= windowMinutes * 60000;
      if (withinWindow) candidates.push({ row, kind: 'ended' });
    }
  }

  return candidates;
}

export async function handleSprintWc(interaction, { guildId, forcedTargetId, forcedSubcommand, forcedOptions, forcedUndoWordcountId, confirmed } = {}) {
  const discordId = interaction.user.id;
  const effectiveGuildId = guildId ?? interaction.guildId;

  function getIntOption(name) {
    if (forcedOptions) {
      if (name === 'count') return forcedOptions.count;
      if (name === 'new-words') return forcedOptions.newWords;
      return null;
    }
    return interaction.options?.getInteger?.(name) ?? null;
  }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
  }

  async function getLateLogWindowMinutes() {
    try {
      const u = await User.findOne({ where: { discordId } });
      return clampInt(u?.sprintRecentlyEndedWindowMinutes, 0, 360, 15);
    } catch {
      return 15;
    }
  }

  function getSprintEndedAtCandidate(sprintRow) {
    if (!sprintRow) return null;
    if (sprintRow.endedAt) return new Date(sprintRow.endedAt);
    if (sprintRow.startedAt && sprintRow.durationMinutes) {
      return new Date(new Date(sprintRow.startedAt).getTime() + sprintRow.durationMinutes * 60000);
    }
    if (sprintRow.updatedAt) return new Date(sprintRow.updatedAt);
    return null;
  }

  async function resolveWcTarget() {
    const actives = await DeanSprints.findAll({ where: { userId: discordId, guildId: effectiveGuildId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    if (actives.length > 1) {
      return { ambiguous: 'multiple-active' };
    }
    if (actives.length === 1) return { target: actives[0] };

    const windowMinutes = await getLateLogWindowMinutes();
    if (windowMinutes <= 0) {
      return { error: noActiveSprintText() };
    }

    const endedCandidates = await DeanSprints.findAll({
      where: { userId: discordId, guildId: effectiveGuildId, status: 'done' },
      order: [['endedAt', 'DESC'], ['updatedAt', 'DESC']],
      limit: 8,
    });
    if (!endedCandidates.length) return { error: noActiveSprintText() };

    const within = endedCandidates.filter(row => {
      const endedAt = getSprintEndedAtCandidate(row);
      if (!endedAt) return false;
      return (Date.now() - endedAt.getTime()) <= windowMinutes * 60000;
    });
    if (!within.length) return { error: noActiveSprintText() };
    if (within.length === 1) return { target: within[0], isLateLog: true, lateLogWindowMinutes: windowMinutes };

    return { ambiguous: 'multiple-recent', lateLogWindowMinutes: windowMinutes };
  }

  async function safeName(userId, guild) {
    try {
      const member = await guild.members.fetch(userId);
      return member?.displayName || member?.user?.username || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  async function buildLeaderboardLines(participantRows, guild) {
    const scores = [];
    for (const p of participantRows) {
      const rows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
      const total = rows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      scores.push({ userId: p.userId, total });
    }
    scores.sort((a, b) => (b.total || 0) - (a.total || 0));
    const lines = [];
    for (let i = 0; i < scores.length; i++) {
      const name = await safeName(scores[i].userId, guild);
      lines.push(`${i + 1}) ${name} - NET ${scores[i].total || 0}`);
    }
    return lines;
  }

  async function getEndSummaryRef(sprintRow) {
    if (sprintRow?.endSummaryChannelId && sprintRow?.endSummaryMessageId) {
      return { channelId: sprintRow.endSummaryChannelId, messageId: sprintRow.endSummaryMessageId };
    }
    if (sprintRow?.type === 'team' && sprintRow?.groupId) {
      const any = await DeanSprints.findOne({ where: { guildId: effectiveGuildId, groupId: sprintRow.groupId, endSummaryMessageId: { [Op.ne]: null } }, order: [['updatedAt', 'DESC']] }).catch(() => null);
      if (any?.endSummaryChannelId && any?.endSummaryMessageId) {
        return { channelId: any.endSummaryChannelId, messageId: any.endSummaryMessageId };
      }
    }
    return null;
  }

  async function maybeEditEndSummary(sprintRow) {
    if (!sprintRow || sprintRow.status !== 'done') return;

    const windowMinutes = await getLateLogWindowMinutes();
    const endedAt = getSprintEndedAtCandidate(sprintRow);
    if (!endedAt) return;
    if ((Date.now() - endedAt.getTime()) > windowMinutes * 60000) return;

    const ref = await getEndSummaryRef(sprintRow);
    if (!ref) return;

    try {
      const channel = await interaction.client.channels.fetch(ref.channelId).catch(() => null);
      if (!channel || typeof channel.messages?.fetch !== 'function') return;
      const msg = await channel.messages.fetch(ref.messageId).catch(() => null);
      if (!msg) return;

      const participants = (sprintRow.type === 'team' && sprintRow.groupId)
        ? await DeanSprints.findAll({ where: { guildId: effectiveGuildId, groupId: sprintRow.groupId }, order: [['createdAt', 'ASC']] })
        : [sprintRow];
      const participantIds = participants.map(p => p.userId);
      const pingLine = participantIds.length ? participantIds.map(id => `<@${id}>`).join(' ') : '';
      const sprintIdentifier = formatSprintIdentifier({ type: sprintRow.type, groupId: sprintRow.groupId, label: sprintRow.label, startedAt: sprintRow.startedAt });
      const leaderboardLines = await buildLeaderboardLines(participants, interaction.guild);
      const content = sprintEndedWordsText({ pingLine, sprintIdentifier, durationMinutes: sprintRow.durationMinutes, leaderboardLines });

      await msg.edit({ content, allowedMentions: { parse: [] } });
    } catch (e) {
      console.warn('[dean] late-log end summary edit failed:', e?.message || e);
    }
  }

  let target = null;

  if (forcedTargetId) {
    target = await DeanSprints.findByPk(forcedTargetId).catch(() => null);
    if (!target || target.guildId !== effectiveGuildId || target.userId !== discordId) {
      return interaction.editReply({ content: noActiveSprintText() });
    }
  } else {
    const resolved = await resolveWcTarget();
    if (resolved.error) {
      return interaction.editReply({ content: resolved.error });
    }
    if (resolved.ambiguous) {
      const windowMinutes = await getLateLogWindowMinutes();
      const candidates = await buildCandidateTargets({ guildId: effectiveGuildId, discordId, windowMinutes });
      if (candidates.length <= 1) {
        return interaction.editReply({ content: noActiveSprintText() });
      }

      const token = makeToken();
      const subcommand = forcedSubcommand ?? interaction.options?.getSubcommand?.();

      const options = forcedOptions ?? {
        count: interaction.options?.getInteger?.('count') ?? null,
        newWords: interaction.options?.getInteger?.('new-words') ?? null,
      };

      setInteractionState(token, { guildId: effectiveGuildId, userId: discordId, subcommand, options });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`wcPick_${token}`)
        .setPlaceholder('Pick a sprint')
        .setMinValues(1)
        .setMaxValues(1);

      for (const c of candidates.slice(0, 25)) {
        const sprintIdentifier = formatSprintIdentifier({ type: c.row.type, groupId: c.row.groupId, label: c.row.label, startedAt: c.row.startedAt });
        const kindLabel = c.kind === 'active' ? 'Active' : 'Ended';

        let timingLabel = '';
        if (c.kind === 'ended') {
          const endedAt = getSprintEndedAtCandidate(c.row);
          if (endedAt) {
            const minsAgo = Math.max(0, Math.ceil((Date.now() - endedAt.getTime()) / 60000));
            timingLabel = ` (ended ${minsAgo}m ago)`;
          }
        } else {
          const startsAtMs = c.row.startedAt ? new Date(c.row.startedAt).getTime() : null;
          const durationMs = (typeof c.row.durationMinutes === 'number') ? c.row.durationMinutes * 60000 : null;
          if (startsAtMs && durationMs) {
            const endsAtMs = startsAtMs + durationMs;
            const minsLeft = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 60000));
            timingLabel = ` (ends in ${minsLeft}m)`;
          }
        }

        select.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${kindLabel}: ${sprintIdentifier}`.slice(0, 100))
            .setDescription(`${c.row.type === 'team' ? 'Team' : 'Solo'}${timingLabel}`.slice(0, 100))
            .setValue(String(c.row.id))
        );
      }

      const row = new ActionRowBuilder().addComponents(select);
      return interaction.editReply({ content: wcSprintPickerPromptText(), components: [row] });
    }

    target = resolved.target;
  }

  const subName = forcedSubcommand ?? interaction.options?.getSubcommand?.();

  if (subName === 'baseline') {
    const count = getIntOption('count');
    if (typeof count !== 'number') {
      return interaction.editReply({ content: 'I need a number for that. Try `/wc baseline count:123`.' });
    }
    if (count < 0) {
      await interaction.followUp({ content: "Baseline's gotta be at least zero, buddy.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!confirmed) {
      const token = makeToken();
      const sprintIdentifier = formatSprintIdentifier({ type: target.type, groupId: target.groupId, label: target.label, startedAt: target.startedAt });
      const activeOrEnded = target.status === 'done' ? 'ended' : 'active';
      const prompt = wcConfirmBaselinePromptText({ sprintIdentifier, activeOrEnded, baselineB: count });

      setInteractionState(token, {
        guildId: effectiveGuildId,
        userId: discordId,
        targetId: target.id,
        subcommand: 'baseline',
        options: { count, newWords: null },
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wcConfirm_confirm_${token}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`wcConfirm_cancel_${token}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: prompt, components: [row], allowedMentions: { parse: [] } });
    }

    await target.update({
      wordcountStart: count,
      // If they haven't logged anything yet, treat baseline as current absolute too.
      wordcountEnd: (typeof target.wordcountEnd === 'number') ? target.wordcountEnd : count,
    });

    await maybeEditEndSummary(target);
    return interaction.editReply({ content: `Baseline set: **${count}**. Now when you do /wc set (or /sprint wc set), I won't pretend you wrote your entire draft in one sprint.` });
  }
  if (subName === 'set') {
    const count = getIntOption('count');
    if (typeof count !== 'number') {
      return interaction.editReply({ content: 'I need a number for that. Try `/wc set count:123`.' });
    }
    if (count < 0) {
      await interaction.followUp({ content: "Wordcount's gotta be at least zero, buddy. If you want to bump numbers, use `/wc add` (or `/sprint wc add`). If you need to undo a bad update, try `/wc undo`.", flags: MessageFlags.Ephemeral });
      return;
    }

    // Find last wordcount for this sprint/user
    const last = await Wordcount.findOne({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'DESC']] });
    const prev = last && typeof last.countEnd === 'number'
      ? last.countEnd
      : (typeof target.wordcountEnd === 'number'
        ? target.wordcountEnd
        : (typeof target.wordcountStart === 'number' ? target.wordcountStart : 0));
    const delta = count - prev;

    if (!confirmed) {
      const token = makeToken();
      const sprintIdentifier = formatSprintIdentifier({ type: target.type, groupId: target.groupId, label: target.label, startedAt: target.startedAt });
      const targetLabel = sprintIdentifier;
      const prompt = wcConfirmSetPromptText({
        targetLabel,
        newX: count,
        currentNet: prev,
        deltaSigned: `${delta >= 0 ? '+' : ''}${delta}`,
      });

      setInteractionState(token, {
        guildId: effectiveGuildId,
        userId: discordId,
        targetId: target.id,
        subcommand: 'set',
        options: { count, newWords: null },
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wcConfirm_confirm_${token}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`wcConfirm_cancel_${token}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: prompt, components: [row], allowedMentions: { parse: [] } });
    }

    // Find last wordcount for this sprint/user
    // (Recomputed above)
    await target.update({ wordcountEnd: count });
    await Wordcount.create({
      userId: discordId,
      projectId: target.projectId || null,
      sprintId: target.id,
      countStart: prev,
      countEnd: count,
      delta,
      recordedAt: new Date(),
    });
    // Sprint stats
    const allRows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
    const sprintTotal = allRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
    const updates = allRows.length;
    const maxGain = allRows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
    // Daily stats
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dayRows = await Wordcount.findAll({ where: { userId: discordId, recordedAt: { [Op.gte]: startOfDay } }, order: [['recordedAt', 'ASC']] });
    const dayTotal = dayRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
    // Feedback
    const sinceLabel = last ? 'since last update' : 'since sprint start';
    let msg = `Locked in at **${count}**.`;
    msg += `\nWords gained ${sinceLabel}: **${delta >= 0 ? '+' : ''}${delta}**`;
    msg += `\nTotal gained this sprint: **${sprintTotal}**`;
    msg += `\nTotal gained today: **${dayTotal}**`;
    msg += `\nUpdates this sprint: **${updates}**`;
    msg += `\nBest single update this sprint: **${maxGain}**`;
    // Hunt: check 5k single-sprint total
    try {
      const fireTrigger = (await import('../../shared/hunts/triggerEngine.js')).default;
      const makeDeanAnnouncer = (await import('./huntsAnnouncer.js')).default;
      const announce = makeDeanAnnouncer(interaction);
      await fireTrigger('dean.sprint.wordcount.check', { userId: discordId, sprintTotal, announce, interaction });
    } catch (huntErr) { console.warn('[hunts] dean.sprint.wordcount.check failed:', huntErr); }

    await maybeEditEndSummary(target);
    return interaction.editReply({ content: msg });
  } else if (subName === 'add') {
    const words = getIntOption('new-words');
    if (words <= 0) {
      await interaction.followUp({ content: 'New words gotta be a positive number, buddy. If you need to change your total words use `/wc set` instead, or you can use `/wc undo` if you wanna undo the last wordcount change you made.', flags: MessageFlags.Ephemeral });
      return;
    }
    const prev = (typeof target.wordcountEnd === 'number')
      ? target.wordcountEnd
      : (typeof target.wordcountStart === 'number' ? target.wordcountStart : 0);
    const next = prev + words;
    await target.update({ wordcountEnd: next });
    await Wordcount.create({
      userId: discordId,
      projectId: target.projectId || null,
      sprintId: target.id,
      countStart: prev,
      countEnd: next,
      delta: words,
      recordedAt: new Date(),
    });
    // Sprint stats
    const allRows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
    const sprintTotal = allRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
    const updates = allRows.length;
    const maxGain = allRows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
    // Daily stats
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dayRows = await Wordcount.findAll({ where: { userId: discordId, recordedAt: { [Op.gte]: startOfDay } }, order: [['recordedAt', 'ASC']] });
    const dayTotal = dayRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
    // Feedback
    let msg = `Nice. **+${words}**. Sitting at **${next}**.`;
    msg += `\nTotal gained this sprint: **${sprintTotal}**`;
    msg += `\nTotal gained today: **${dayTotal}**`;
    msg += `\nUpdates this sprint: **${updates}**`;
    msg += `\nBest single update this sprint: **${maxGain}**`;
    // Hunt: check 5k single-sprint total
    try {
      const fireTrigger = (await import('../../shared/hunts/triggerEngine.js')).default;
      const makeDeanAnnouncer = (await import('./huntsAnnouncer.js')).default;
      const announce = makeDeanAnnouncer(interaction);
      await fireTrigger('dean.sprint.wordcount.check', { userId: discordId, sprintTotal, announce, interaction });
    } catch (huntErr) { console.warn('[hunts] dean.sprint.wordcount.check failed:', huntErr); }

    await maybeEditEndSummary(target);
    return interaction.editReply({ content: msg });
  } else if (subName === 'show') {
    const wc = target.wordcountEnd ?? 0;
    // Sprint stats
    const allRows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
    const sprintTotal = allRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
    const updates = allRows.length;
    const maxGain = allRows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
    const first = (typeof target.wordcountStart === 'number')
      ? target.wordcountStart
      : (allRows.length ? (allRows[0].countEnd ?? allRows[0].countStart ?? 0) : 0);
    // Daily stats
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dayRows = await Wordcount.findAll({ where: { userId: discordId, recordedAt: { [Op.gte]: startOfDay } }, order: [['recordedAt', 'ASC']] });
    const dayTotal = dayRows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
    let msg = `Current wordcount: **${wc}**`;
    msg += `\nStarted at: **${first}**`;
    msg += `\nTotal gained this sprint: **${sprintTotal}**`;
    msg += `\nTotal gained today: **${dayTotal}**`;
    msg += `\nUpdates this sprint: **${updates}**`;
    msg += `\nBest single update this sprint: **${maxGain}**`;
    return interaction.editReply({ content: msg });
  } else if (subName === 'summary') {
    const participants = target.type === 'team' && target.groupId
      ? await DeanSprints.findAll({ where: { guildId: effectiveGuildId, groupId: target.groupId }, order: [['createdAt', 'ASC']] })
      : [target];
    const linesSum = [];
    for (const p of participants) {
      const rows = await Wordcount.findAll({ where: { sprintId: p.id, userId: p.userId }, order: [['recordedAt', 'ASC']] });
      const total = rows.reduce((acc, r) => acc + (r.delta > 0 ? r.delta : 0), 0);
      const updates = rows.length;
      const maxGain = rows.reduce((max, r) => r.delta > max ? r.delta : max, 0);
      const first = (typeof p.wordcountStart === 'number')
        ? p.wordcountStart
        : (rows.length ? (rows[0].countEnd ?? rows[0].countStart ?? 0) : 0);
      const last = rows.length ? rows[rows.length - 1].countEnd ?? rows[rows.length - 1].countStart ?? 0 : 0;
      let extra = '';
      if (p.projectId) {
        let proj = null;
        try {
          proj = await Project.findByPk(p.projectId);
        } catch (e) {
          proj = null;
        }
        if (proj && proj.name) extra = ` (${proj.name})`;
      }
      linesSum.push(`• <@${p.userId}>: **${total}** words${extra} (updates: ${updates}, best: ${maxGain}, start: ${first}, end: ${last})`);
    }
    const content = linesSum.join('\n') || 'Nobody dropped numbers yet. Wanna be first?';
    return interaction.editReply({ content: `Here’s the tally so far:\n${content}` });
  } else if (subName === 'undo') {
    const last = forcedUndoWordcountId
      ? await Wordcount.findOne({ where: { id: forcedUndoWordcountId, sprintId: target.id, userId: discordId } })
      : await Wordcount.findOne({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'DESC']] });
    if (!last) {
      await interaction.followUp({ content: 'No wordcount to undo, partner.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!confirmed) {
      const token = makeToken();
      const sprintIdentifier = formatSprintIdentifier({ type: target.type, groupId: target.groupId, label: target.label, startedAt: target.startedAt });
      const targetLabel = sprintIdentifier;

      const entryAmountSigned = `${last.delta >= 0 ? '+' : ''}${last.delta}`;
      const entryTimestamp = (last.recordedAt ? new Date(last.recordedAt) : new Date()).toLocaleString();
      const prompt = wcConfirmUndoPromptText({
        targetLabel,
        entryType: 'WC',
        entryAmountSigned,
        entryTimestamp,
      });

      setInteractionState(token, {
        guildId: effectiveGuildId,
        userId: discordId,
        targetId: target.id,
        subcommand: 'undo',
        options: { count: null, newWords: null },
        undoWordcountId: last.id,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wcConfirm_confirm_${token}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`wcConfirm_cancel_${token}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: prompt, components: [row], allowedMentions: { parse: [] } });
    }

    await last.destroy();
    const rows = await Wordcount.findAll({ where: { sprintId: target.id, userId: discordId }, order: [['recordedAt', 'ASC']] });
    const totalRaw = rows.reduce((acc, r) => {
      const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
      return acc + (d > 0 ? d : 0);
    }, 0);
    const next = Math.max(0, totalRaw);
    await target.update({ wordcountEnd: next });

    await maybeEditEndSummary(target);
    return interaction.editReply({ content: `Undone. Sitting at **${next}**.` });
  }
}
