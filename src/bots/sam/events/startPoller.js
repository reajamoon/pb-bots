import { Op } from 'sequelize';
import { ParseQueue, ParseQueueSubscriber, User, Config, Recommendation } from '../../../models/index.js';
import { findModmailThreadByUrl } from '../../../shared/utils/findModmailThreadByUrl.js';
// Tiny cache for modmail threads by normalized URL (simple Map)
const modmailThreadCache = new Map();
import { createRecEmbed } from '../../../shared/recUtils/createRecEmbed.js';
import { createSeriesEmbed } from '../../../shared/recUtils/createSeriesEmbed.js';

const POLL_INTERVAL_MS = 10000;
// Single-flight guard for nOTP jobs per heartbeat
const nOTPInFlight = new Set();

async function notifyQueueSubscribers(client) {
    // Heartbeat counters for this cycle
    let heartbeat_n = 0;
    let heartbeat_done = 0;
    let heartbeat_series_done = 0;
    let heartbeat_error = 0;
    try {
        // Notify for jobs that failed Dean/Cas validation (nOTP)
        const nOTPJobs = await ParseQueue.findAll({
            where: { status: 'nOTP' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_n = nOTPJobs.length;
        for (const job of nOTPJobs) {
            // Simple backoff: if we attempted notify in the last 10s, skip this heartbeat
            try {
                const lastTs = job.result && job.result.lastNotifyAttempt;
                if (lastTs && Date.now() - lastTs < POLL_INTERVAL_MS) {
                    continue;
                }
            } catch {}
            // Skip if job already in-flight this heartbeat
            if (nOTPInFlight.has(job.id)) continue;
            nOTPInFlight.add(job.id);
            // Skip if we've already sent a modmail for this nOTP job
            if (job.result && job.result.notified) {
                nOTPInFlight.delete(job.id);
                continue;
            }
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            const userIds = subscribers.map(s => s.user_id);
            const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
            // Fetch modmail channel from config
            const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
            const modmailChannelId = modmailConfig ? modmailConfig.value : null;
            if (!modmailChannelId) {
                console.warn(`[Poller] No modmail_channel_id configured; skipping modmail notification for nOTP job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            const modmailChannel = client.channels.cache.get(modmailChannelId);
            if (!modmailChannel) {
                console.warn(`[Poller] Modmail channel ${modmailChannelId} not found; skipping notification for nOTP job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            let contentMsg = `Hey mods, I caught a fic that doesn't look like it fits rec guidelines. Can you take a look?`;
            contentMsg += `\n\n🔗 <${job.fic_url}>`;
            if (job.validation_reason) contentMsg += `\n**Validation reason:** ${job.validation_reason}`;
            // Always mention the original submitter (requested_by)
            let submitterMention = '';
            if (job.requested_by) {
                // requested_by may be a comma-separated list, but we only expect one for single recs
                const submitterId = job.requested_by.split(',')[0].trim();
                if (submitterId) submitterMention = `<@${submitterId}>`;
            }
            // Also mention any subscribers (if present and not duplicate)
            let mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).filter(m => m !== submitterMention);
            let allMentions = submitterMention;
            if (mentionList.length) allMentions += (allMentions ? ' ' : '') + mentionList.join(' ');
            if (allMentions) {
                contentMsg += `\n**Submitted by:** ${allMentions}`;
            } else {
                // Fallback when no submitter or subscribers are present
                contentMsg += `\n**Submitted by:** Unknown`;
            }
            contentMsg += `\n\nIf this got flagged by mistake, go ahead and approve it. Otherwise, use @relay in this thread and I’ll pass a note to them about why it got bounced.`;
            try {
                // Try to get fic title from Recommendation if it exists
                let threadTitle = null;
                const rec = await Recommendation.findOne({ where: { url: job.fic_url } });
                if (rec && rec.title) {
                    threadTitle = `Rec Validation: ${rec.title.substring(0, 80)}`;
                } else {
                    // Fallback: use fic URL (truncated)
                    threadTitle = `Rec Validation: ${job.fic_url.substring(0, 60)}`;
                }
                // If a threadId is stored on the job, prefer reusing it
                let thread = null;
                try {
                    const storedId = job.result && job.result.threadId;
                    if (storedId) {
                        thread = modmailChannel.threads.cache.get(storedId) || await modmailChannel.threads.fetch(storedId).catch(() => null);
                    }
                } catch {}
                // Otherwise, try to find an existing thread for this fic URL
                if (!thread) {
                    thread = await findModmailThreadByUrl(modmailChannel, job.fic_url, modmailThreadCache);
                }
                if (!thread) {
                    const sentMsg = await modmailChannel.send({ content: contentMsg });
                    // Create a thread for this modmail
                    thread = await sentMsg.startThread({
                        name: threadTitle,
                        autoArchiveDuration: 1440, // 24 hours
                        reason: 'AO3 rec validation failed (nOTP)'
                    });
                    try { modmailThreadCache.set(job.fic_url, thread.id); } catch {}
                    // Persist threadId immediately to avoid duplicates on next heartbeat
                    try {
                        const existingResult = job.result && typeof job.result === 'object' ? job.result : {};
                        await job.update({ result: { ...existingResult, threadId: thread.id, notified: true, lastNotifyAttempt: Date.now() } });
                    } catch (persistErr) {
                        console.error('[Poller] Failed to persist threadId on nOTP job:', persistErr);
                    }
                }
                // Send action buttons inside the thread for intuitive mod actions
                try {
                    // Compose a detailed thread summary to preserve mod relay expectations
                    let threadSummary = `🔗 <${job.fic_url}>`;
                    if (job.validation_reason) threadSummary += `\n**Validation reason:** ${job.validation_reason}`;
                    // Build submitter + subscribers mention list similar to channel message
                    let submitterMention = '';
                    if (job.requested_by) {
                        const submitterId = job.requested_by.split(',')[0].trim();
                        if (submitterId) submitterMention = `<@${submitterId}>`;
                    }
                    const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
                    const userIds = subscribers.map(s => s.user_id);
                    const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
                    let mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).filter(m => m !== submitterMention);
                    let allMentions = submitterMention;
                    if (mentionList.length) allMentions += (allMentions ? ' ' : '') + mentionList.join(' ');
                    if (allMentions) {
                        threadSummary += `\n**Submitted by:** ${allMentions}`;
                    } else {
                        threadSummary += `\n**Submitted by:** Unknown`;
                    }
                    await thread.send({ content: threadSummary });
                    // If this is a series job with multiple failures, list them for action
                    if (job.result && job.result.failures && Array.isArray(job.result.failures) && job.result.failures.length) {
                        const lines = job.result.failures.slice(0, 10).map((f, idx) => `${idx + 1}. <${f.url}> — ${f.reason || 'validation_failed'}`);
                        await thread.send({ content: `Failed works in series:\n${lines.join('\n')}` });
                        if (job.result.failures.length > 10) {
                            await thread.send({ content: `...and ${job.result.failures.length - 10} more.` });
                        }
                    }
                    // Try to include a compact summary embed for context
                    try {
                        const rec = await Recommendation.findOne({ where: { url: job.fic_url } });
                        if (rec) {
                            // Guard: ensure AO3 parsed or member tags present before posting
                            const hasFandomTags = Array.isArray(rec.fandom_tags) && rec.fandom_tags.length > 0;
                            let hasMemberTags = false;
                            if (Array.isArray(rec.userMetadata)) {
                                for (const m of rec.userMetadata) {
                                    if (m && Array.isArray(m.additional_tags) && m.additional_tags.length) { hasMemberTags = true; break; }
                                }
                            }
                            if (!hasFandomTags && !hasMemberTags) {
                                console.warn('[Poller] Recommendation missing parse indicators (no fandom_tags and no member tags). Skipping post and marking for refresh:', rec.id);
                                try {
                                    const { queueRecommendationRefresh } = await import('../../../shared/recUtils/queueUtils.js');
                                    await queueRecommendationRefresh(rec.url);
                                } catch {}
                                continue;
                            }
                            const embed = createRecEmbed(rec);
                            await thread.send({ embeds: [embed] });
                        } else {
                            await thread.send({ content: `Context: <${job.fic_url}>` });
                        }
                    } catch (ctxErr) {
                        console.error('[Poller] Failed to send context embed in thread:', ctxErr);
                    }
                    await thread.send({
                        content: 'Mod tools:',
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        style: 3,
                                        label: 'Approve & requeue',
                                        custom_id: `notp_approve:${job.id}`
                                    },
                                    {
                                        type: 2,
                                        style: 2,
                                        label: 'Dismiss (keep nOTP)',
                                        custom_id: `notp_dismiss:${job.id}`
                                    }
                                ]
                            }
                        ]
                    });
                } catch (btnErr) {
                    console.error('[Poller] Failed to send mod buttons in thread:', btnErr);
                }
            } catch (err) {
                console.error('[Poller] Failed to send modmail notification or create thread for nOTP job:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            // After notifying, clear subscribers to avoid duplicate mentions, but keep the job
            if (subscribers.length) {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            }
            // Mark as notified so we don't spam modmail; keep status 'nOTP' for override command
            try {
                const existingResult = job.result && typeof job.result === 'object' ? job.result : {};
                await job.update({ result: { ...existingResult, notified: true, lastNotifyAttempt: Date.now() } });
            } catch (err) {
                console.error('[Poller] Failed to mark nOTP job as notified:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            // Clear single-flight guard
            nOTPInFlight.delete(job.id);
        }

        // Notify for completed jobs
        const doneJobs = await ParseQueue.findAll({
            where: { status: 'done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_done = doneJobs.length;
        
        // Notify for completed series jobs
        const seriesDoneJobs = await ParseQueue.findAll({
            where: { status: 'series-done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_series_done = seriesDoneJobs.length;

        // Announce AO3 cooldown start/end
        const cooldownJobs = await ParseQueue.findAll({
            where: { status: 'cooldown' }
        });
        for (const job of cooldownJobs) {
            try {
                const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
                const channelId = queueCfg && queueCfg.value ? queueCfg.value : null;
                if (!channelId) {
                    console.warn(`[Poller] No fic_queue_channel configured; skipping cooldown announcement.`);
                    await ParseQueue.destroy({ where: { id: job.id } });
                    continue;
                }
                const channel = client.channels.cache.get(channelId);
                if (!channel) {
                    console.warn(`[Poller] Fic queue channel ${channelId} not found; skipping cooldown announcement.`);
                    await ParseQueue.destroy({ where: { id: job.id } });
                    continue;
                }
                const action = (job.result && job.result.action) || 'start';
                if (action === 'start') {
                    await channel.send({ content: `Heads up — I’m pausing AO3 parsing for a bit due to site issues. I’ll resume automatically once things look stable.` });
                } else if (action === 'end') {
                    await channel.send({ content: `All clear — AO3 parsing is back. If anything looks off, ping a mod and I’ll take another look.` });
                }
            } catch (err) {
                console.error('[Poller] Failed to announce cooldown:', err);
            }
            try {
                await ParseQueue.destroy({ where: { id: job.id } });
            } catch {}
        }

        // Optional: notify mods of error jobs to improve visibility
        const errorJobs = await ParseQueue.findAll({
            where: { status: 'error' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_error = errorJobs.length;
        for (const job of errorJobs) {
            // Notify subscribers via DM and then clean up the job
            try {
                const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
                const errMsg = job.error_message || 'Unknown error';
                for (const sub of subscribers) {
                    const user = await User.findOne({ where: { discordId: sub.user_id } });
                    if (user && user.queueNotifyTag !== false) {
                        const dmUser = await client.users.fetch(sub.user_id).catch(() => null);
                        if (dmUser) {
                            await dmUser.send({
                                content: `Hey, quick heads up. Your fic job for <${job.fic_url}> hit an error and I had to drop it. (${errMsg})\n\nYou can try again, or tweak the URL if needed. To turn off these DMs, use \`/rec notifytag\`.`
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('[Poller] Failed to DM subscribers for error job:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            // Clean up subscribers and delete job
            try {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            } catch {}
            await ParseQueue.destroy({ where: { id: job.id } });
        }
        
        // Process regular done jobs
        for (const job of doneJobs) {
            // Skip silent refresh notifications triggered by duplicate-adds
            try {
                if (job.queue_notify_tag === 'silent-refresh') {
                    await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
                    await ParseQueue.destroy({ where: { id: job.id } });
                    continue;
                }
            } catch {}
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            const userIds = subscribers.map(s => s.user_id);
            const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
            // Always fetch Recommendation from the database for DONE jobs
            let embed = null;
            let recWithSeries = null;
            // Handle different job types
            if (job.result && job.result.type === 'series' && job.result.seriesId) {
                // For series notifications, get the Series record with works and metadata
                const { fetchSeriesWithUserMetadata } = await import('../../../models/index.js');
                const series = await fetchSeriesWithUserMetadata(job.result.seriesId);
                if (series) {
                    const firstSub = subscribers && subscribers.length ? subscribers[0] : null;
                    const overrideNotes = (job.notes || '').trim() ? job.notes : undefined;
                    const includeAdditionalTags = (job.additional_tags || '')
                        ? (job.additional_tags.split(',').map(t => t.trim()).filter(Boolean))
                        : undefined;
                    embed = createSeriesEmbed(series, {
                        preferredUserId: firstSub ? firstSub.user_id : undefined,
                        overrideNotes,
                        includeAdditionalTags
                    });
                } else {
                    console.warn(`[Poller] No Series found for series ID: ${job.result.seriesId}`);
                    continue;
                }
            } else if (job.result && job.result.id) {
                // For individual recommendation notifications
                const { fetchRecWithSeries } = await import('../../../models/fetchRecWithSeries.js');
                recWithSeries = await fetchRecWithSeries(job.result.id, true);
                if (recWithSeries) {
                    // Parse guards for individual recs: require AO3 parse indicators or member tags
                    const hasFandomTags = Array.isArray(recWithSeries.fandom_tags) && recWithSeries.fandom_tags.length > 0;
                    let hasMemberTags = false;
                    if (Array.isArray(recWithSeries.userMetadata)) {
                        for (const m of recWithSeries.userMetadata) {
                            if (m && Array.isArray(m.additional_tags) && m.additional_tags.length) { hasMemberTags = true; break; }
                        }
                    }
                    if (!hasFandomTags && !hasMemberTags) {
                        console.warn('[Poller] Recommendation missing parse indicators (no fandom_tags and no member tags). Skipping post and marking for refresh:', recWithSeries.id);
                        try {
                            const { queueRecommendationRefresh } = await import('../../../shared/recUtils/queueUtils.js');
                            if (recWithSeries.url) await queueRecommendationRefresh(recWithSeries.url);
                        } catch {}
                        continue;
                    }

                    // Series guard: require core fields or member tags; else refresh
                    const seriesOk = !!(recWithSeries && recWithSeries.series && recWithSeries.series.ao3SeriesId && recWithSeries.series.name);
                    let seriesHasMemberTags = false;
                    if (recWithSeries && Array.isArray(recWithSeries.userMetadata)) {
                        for (const m of recWithSeries.userMetadata) {
                            if (m && Array.isArray(m.additional_tags) && m.additional_tags.length) { seriesHasMemberTags = true; break; }
                        }
                    }
                    if (!seriesOk && !seriesHasMemberTags) {
                        console.warn('[Poller] Series missing parse indicators and member tags. Skipping post and marking for refresh:', recWithSeries && recWithSeries.id);
                        try {
                            const { queueSeriesRefresh } = await import('../../../shared/recUtils/queueUtils.js');
                            if (recWithSeries && recWithSeries.series && recWithSeries.series.url) {
                                await queueSeriesRefresh(recWithSeries.series.url);
                            }
                        } catch {}
                        continue;
                    }
                    embed = createRecEmbed(recWithSeries);
                } else {
                    console.warn(`[Poller] No Recommendation found for rec ID: ${job.result.id} (job id: ${job.id}, url: ${job.fic_url})`);
                    continue;
                }
            }
            // Prefer editing tracked messages; only post publicly if no tracked message exists
            const recCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
            const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
            const noteCfg = await Config.findOne({ where: { key: 'queue_notification_channel' } });
            const recId = recCfg && recCfg.value ? recCfg.value : null;
            const queueId = queueCfg && queueCfg.value ? queueCfg.value : null;
            const noteId = noteCfg && noteCfg.value ? noteCfg.value : null;
            const allowedIds = new Set([queueId, noteId, recId].filter(Boolean));
            // Prefer the channel where the job was initiated/pulled if allowed
            let preferredFromSub = null;
            for (const sub of subscribers) {
                if (sub.channel_id && allowedIds.has(sub.channel_id)) { preferredFromSub = sub.channel_id; break; }
            }
            const channelId = preferredFromSub || queueId || noteId || recId || null;
            if (!channelId) {
                console.warn(`[Poller] No allowed notification channel configured; skipping notifications for job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            let channel = client.channels.cache.get(channelId);
            if (!channel && client.channels && client.channels.fetch) {
                channel = await client.channels.fetch(channelId).catch(() => null);
            }
            if (!channel) {
                console.warn(`[Poller] Notification channel ${channelId} not found (after fetch); skipping notification for job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            // For instant_candidate jobs, do not @mention users, but still send embed
            let contentMsg = `Your fic parsing job is done!` + (job.fic_url ? `\n<${job.fic_url}>` : '');
            // Always log when a done job is being processed for notification
            console.log(`[Poller] Processing done job: job id ${job.id}, url: ${job.fic_url}, subscribers: [${subscribers.map(s => s.user_id).join(', ')}]`);
            try {
                console.log('[Poller DEBUG] About to send notification:', {
                    channelId,
                    channelFound: !!channel,
                    clientUser: client.user ? client.user.tag : null,
                    jobId: job.id,
                    jobUrl: job.fic_url,
                    subscribers: subscribers.map(s => s.user_id),
                    users: users.map(u => u.discordId),
                    contentMsg,
                    embedExists: !!embed
                });

                // First, update any tracked original command replies for subscribers
                for (const sub of subscribers) {
                    if (sub.channel_id && sub.message_id && embed) {
                        try {
                            const targetChannel = await client.channels.fetch(sub.channel_id).catch(() => null);
                            if (targetChannel && targetChannel.isTextBased()) {
                                const targetMsg = await targetChannel.messages.fetch(sub.message_id).catch(() => null);
                                if (targetMsg && targetMsg.edit) {
                                    await targetMsg.edit({ content: null, embeds: [embed] });
                                }
                            }
                        } catch (e) {
                            console.warn('[Poller] Failed to edit subscriber original reply:', { sub: sub.user_id, channel: sub.channel_id, message: sub.message_id }, e);
                        }
                    }
                }

                // DM subscribers instead of @mentioning in the channel
                for (const u of users.filter(u => u.queueNotifyTag !== false)) {
                    try {
                        const dmUser = await client.users.fetch(u.discordId);
                        if (dmUser) {
                            await dmUser.send({ content: contentMsg });
                            if (embed) await dmUser.send({ embeds: [embed] });
                        }
                    } catch (e) {
                        console.warn('[Poller] Failed to DM subscriber:', u.discordId, e);
                    }
                }

                // If no tracked subscriber message exists, send the embed publicly; otherwise skip to avoid duplicates
                const hasTracked = subscribers.some(s => !!s.channel_id && !!s.message_id);
                if (!hasTracked) {
                    if (embed) {
                        await channel.send({ embeds: [embed] });
                    } else {
                        console.warn(`[Poller] No embed built for job id: ${job.id}, url: ${job.fic_url}`);
                    }
                }
            } catch (err) {
                console.error('[Poller] Failed to send fic queue notification:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            if (subscribers.length) {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            }
            // Delete the job after notification to prevent repeated alerts
            await ParseQueue.destroy({ where: { id: job.id } });
        }
        
        // Process series-done jobs
        for (const job of seriesDoneJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            const userIds = subscribers.map(s => s.user_id);
            const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
            
            let embed = null;
            // Handle series jobs - get series data and create series embed
            if (job.result && job.result.type === 'series' && job.result.seriesId) {
                const { fetchSeriesWithUserMetadata } = await import('../../../models/index.js');
                const series = await fetchSeriesWithUserMetadata(job.result.seriesId);
                if (series) {
                    // Tie footer to the first subscriber (note-owner preference) and include notes/tags if provided
                    const firstSub = subscribers && subscribers.length ? subscribers[0] : null;
                    const overrideNotes = (job.notes || '').trim() ? job.notes : undefined;
                    const includeAdditionalTags = (job.additional_tags || '')
                        ? (job.additional_tags.split(',').map(t => t.trim()).filter(Boolean))
                        : undefined;
                    embed = createSeriesEmbed(series, {
                        preferredUserId: firstSub ? firstSub.user_id : undefined,
                        overrideNotes,
                        includeAdditionalTags
                    });
                } else {
                    console.warn(`[Poller] No Series found for series ID: ${job.result.seriesId}`);
                    continue;
                }
            } else {
                console.warn(`[Poller] Invalid series-done job result:`, job.result);
                continue;
            }

            // Send notification choosing channel: prefer the channel it was pulled/initiated in (if allowed),
            // else fall back in order: fic_queue_channel -> queue_notification_channel -> fic_rec_channel
            const { Config } = await import('../../../models/index.js');
            const recCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
            const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
            const noteCfg = await Config.findOne({ where: { key: 'queue_notification_channel' } });
            const recId = recCfg && recCfg.value ? recCfg.value : null;
            const queueId = queueCfg && queueCfg.value ? queueCfg.value : null;
            const noteId = noteCfg && noteCfg.value ? noteCfg.value : null;
            const allowedIds = new Set([queueId, noteId, recId].filter(Boolean));
            // Prefer subscriber's channel if it's one of the allowed three
            let preferredFromSub = null;
            for (const sub of subscribers) {
                if (sub.channel_id && allowedIds.has(sub.channel_id)) { preferredFromSub = sub.channel_id; break; }
            }
            const channelId = preferredFromSub || queueId || noteId || recId || null;
            let channel = channelId ? client.channels.cache.get(channelId) : null;
            if (!channel && channelId && client.channels && client.channels.fetch) {
                channel = await client.channels.fetch(channelId).catch(() => null);
            }
            if (!channel) {
                console.warn(`[Poller] Queue notification channel missing (checked subscriber channel, fic_queue_channel, queue_notification_channel, fic_rec_channel). Job id: ${job.id}, url: ${job.fic_url}, chosenId: ${channelId || 'none'}`);
                continue;
            }

            try {
                let contentMsg = `Your series parsing job is done!\n` + (job.fic_url ? `\n<${job.fic_url}>` : '');
                // DM subscribers instead of @mentioning in the channel
                for (const u of users.filter(u => u.queueNotifyTag !== false)) {
                    try {
                        const dmUser = await client.users.fetch(u.discordId);
                        if (dmUser) {
                            await dmUser.send({ content: contentMsg });
                            if (embed) await dmUser.send({ embeds: [embed] });
                        }
                    } catch (e) {
                        console.warn('[Poller] Failed to DM subscriber:', u.discordId, e);
                    }
                }
                
                console.log(`[Poller] Processing series-done job: job id ${job.id}, url: ${job.fic_url}, subscribers: [${subscribers.map(s => s.user_id).join(', ')}]`);
                
                // Prefer editing tracked subscriber messages; only post publicly if none exist
                const hasTracked = subscribers.some(s => !!s.channel_id && !!s.message_id);
                if (hasTracked && embed) {
                    for (const sub of subscribers) {
                        if (sub.channel_id && sub.message_id) {
                            try {
                                const targetChannel = await client.channels.fetch(sub.channel_id).catch(() => null);
                                if (targetChannel && targetChannel.isTextBased()) {
                                    const targetMsg = await targetChannel.messages.fetch(sub.message_id).catch(() => null);
                                    if (targetMsg && targetMsg.edit) {
                                        await targetMsg.edit({ content: null, embeds: [embed] });
                                    }
                                }
                            } catch (e) {
                                console.warn('[Poller] Failed to edit subscriber message for series job:', { sub: sub.user_id, channel: sub.channel_id, message: sub.message_id }, e);
                            }
                        }
                    }
                } else {
                    if (embed) {
                        await channel.send({ embeds: [embed] });
                    } else {
                        console.warn(`[Poller] No series embed built for job id: ${job.id}, url: ${job.fic_url}`);
                    }
                }
            } catch (err) {
                console.error('[Poller] Failed to send series queue notification:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            
            if (subscribers.length) {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            }
            // Delete the job after notification to prevent repeated alerts
            await ParseQueue.destroy({ where: { id: job.id } });
        }
    } catch (err) {
        console.error('Error in queue notification poller:', err);
    }
    // Heartbeat: summarize this cycle's job counts
    console.log(`[Poller] Heartbeat — nOTP: ${heartbeat_n}, done: ${heartbeat_done}, series-done: ${heartbeat_series_done}, error: ${heartbeat_error}`);
}


export default function startPoller(client) {
    // Helper: Notify users if their job was dropped due to being stuck (not normal 3-hour cleanup)
    async function notifyDroppedQueueJobs() {
        // Only notify for jobs that were stuck in 'pending' or 'processing' and dropped as 'error' with a stuck message
        const droppedJobs = await ParseQueue.findAll({
            where: {
                status: 'error',
                error_message: { [Op.iLike]: '%stuck%' }
            }
        });
        for (const job of droppedJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            for (const sub of subscribers) {
                const user = await User.findOne({ where: { discordId: sub.user_id } });
                if (user && user.queueNotifyTag !== false) {
                    const dmUser = await client.users.fetch(sub.user_id).catch(() => null);
                    if (dmUser) {
                        await dmUser.send({
                            content: `Hey, just a heads up—your fic parsing job for <${job.fic_url}> got stuck in the queue and I had to drop it. Sometimes the stacks get a little weird, but you can always try again.\n\nIf you want to turn off these DMs, just use the \`/rec notifytag\` command. (And if you have questions, you know where to find me.)`
                        });
                    }
                }
            }
            await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            await ParseQueue.destroy({ where: { id: job.id } });
        }
    }

    setInterval(() => {
        notifyQueueSubscribers(client);
        notifyDroppedQueueJobs();
    }, POLL_INTERVAL_MS || 10000);
    console.log('Fic queue notification poller started.');
}
