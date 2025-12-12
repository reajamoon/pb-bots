
import { Op } from 'sequelize';
import { ParseQueue, ParseQueueSubscriber, User, Recommendation, Config, Series, RecommendationFields, sequelize } from '../../models/index.js';
import processAO3Job from '../../shared/recUtils/processAO3Job.js';
import path from 'node:path';
import fs from 'node:fs';

// Helper: clear AO3 cookies file at startup to ensure clean login
function clearAO3Cookies() {
	try {
		const cookiesPath = path.resolve(process.cwd(), 'ao3_cookies.json');
		if (fs.existsSync(cookiesPath)) {
			fs.rmSync(cookiesPath, { force: true });
			console.log('[Jack][Startup] Cleared AO3 cookies at', cookiesPath);
		} else {
			console.log('[Jack][Startup] No AO3 cookies file to clear.');
		}
	} catch (e) {
		console.error('[Jack][Startup] Failed to clear AO3 cookies:', e);
	}
}

// Helper: warm the AO3 browser/page prior to queue processing
async function warmAO3Browser() {
	try {
		const { getLoggedInAO3Page } = await import('../../shared/recUtils/ao3/ao3Utils.js');
		const warmUrl = 'https://archiveofourown.org/';
		const start = Date.now();
		const loginResult = await getLoggedInAO3Page(warmUrl);
		const warmMs = Date.now() - start;
		if (loginResult && loginResult.page) {
			console.log(`[Jack][Startup] AO3 browser warmed in ${warmMs}ms`);
			try { await loginResult.page.close(); } catch {}
		} else {
			console.log('[Jack][Startup] AO3 warmup did not return a page; continuing.');
		}
	} catch (e) {
		console.error('[Jack][Startup] AO3 browser warmup failed:', e);
	}
}
import batchSeriesRecommendationJob from '../../shared/recUtils/batchSeriesRecommendationJob.js';
import processFicJob from '../../shared/recUtils/processFicJob.js';
import { detectSiteAndExtractIDs } from '../../shared/recUtils/processUserMetadata.js';
import dotenv from 'dotenv';
import { getNextAvailableAO3Time, markAO3Requests, MIN_INTERVAL_MS } from '../../shared/recUtils/ao3/ao3QueueRateHelper.js';
import updateMessages from '../../shared/text/updateMessages.js';
dotenv.config();
console.log('Node.js version:', process.version);

// Optimized: get mention string for subscribers using a user map
function getTagMentions(subscribers, userMap) {
	if (!subscribers.length) return '';
	return subscribers
		.filter(sub => userMap.has(sub.user_id) && userMap.get(sub.user_id).queueNotifyTag !== false)
		.map(sub => `<@${sub.user_id}>`).join(' ');
}

async function cleanupOldQueueJobs() {
	const now = new Date();
	// Remove 'done' and 'series-done' jobs older than 3 hours
	const doneCutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000);
	const doneDeleted = await ParseQueue.destroy({ where: { status: ['done', 'series-done'], updated_at: { [Op.lt]: doneCutoff } } });
	if (doneDeleted > 0) {
		console.log(`[QueueWorker] Cleanup: Removed ${doneDeleted} completed jobs older than 3 hours.`);
	} else {
		console.log('[QueueWorker] Cleanup: No old completed jobs to remove.');
	}

	// Stuck thresholds: env-driven with sensible defaults
	const pendingMinutes = parseInt(process.env.PARSEQUEUE_PENDING_STUCK_MIN, 10);
	const processingMinutes = parseInt(process.env.PARSEQUEUE_PROCESSING_STUCK_MIN, 10);
	const seriesProcessingMinutes = parseInt(process.env.PARSEQUEUE_SERIES_PROCESSING_STUCK_MIN, 10);
	const pendingCutoffMinutes = !isNaN(pendingMinutes) && pendingMinutes > 0 ? pendingMinutes : 1440; // default 24h for pending
	const processingCutoffMinutes = !isNaN(processingMinutes) && processingMinutes > 0 ? processingMinutes : 90;
	const seriesProcessingCutoffMinutes = !isNaN(seriesProcessingMinutes) && seriesProcessingMinutes > 0 ? seriesProcessingMinutes : 120;
	const pendingCutoff = new Date(now.getTime() - pendingCutoffMinutes * 60 * 1000);
	const processingCutoff = new Date(now.getTime() - processingCutoffMinutes * 60 * 1000);
	const processingSeriesCutoff = new Date(now.getTime() - seriesProcessingCutoffMinutes * 60 * 1000);

	// For pending, measure time since enqueue using submitted_at, not updated_at
	const stuckPendingJobs = await ParseQueue.findAll({ where: { status: 'pending', submitted_at: { [Op.lt]: pendingCutoff } } });
	// Processing non-series (work jobs)
	const stuckProcessingJobsWork = await ParseQueue.findAll({ where: { status: 'processing', updated_at: { [Op.lt]: processingCutoff }, batch_type: { [Op.not]: 'series' } } });
	// Processing series jobs (longer cutoff)
	const stuckProcessingJobsSeries = await ParseQueue.findAll({ where: { status: 'processing', updated_at: { [Op.lt]: processingSeriesCutoff }, batch_type: 'series' } });

	const stuckJobs = [...stuckPendingJobs, ...stuckProcessingJobsWork, ...stuckProcessingJobsSeries];
	const errorJobs = [];
	const allJobs = [...stuckJobs, ...errorJobs];
	if (allJobs.length === 0) return;

	// Batch fetch all subscribers for these jobs
	const allJobIds = allJobs.map(j => j.id);
	const allSubscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: allJobIds } });
	if (stuckJobs.length > 0) {
		console.log(`[QueueWorker] Cleanup: Found ${stuckJobs.length} stuck jobs. Cutoffs => pending: ${pendingCutoffMinutes}m, processing(work): ${processingCutoffMinutes}m, processing(series): ${seriesProcessingCutoffMinutes}m`);
	} else {
		console.log('[QueueWorker] Cleanup: No stuck pending/processing jobs to remove.');
	}
	for (const job of stuckJobs) {
		// Mark stuck jobs as error and preserve subscribers for Sam to DM via poller
		try {
			const existingResult = job.result && typeof job.result === 'object' ? job.result : {};
			await job.update({ status: 'error', error_message: 'stuck: marked by cleanup', result: { ...existingResult, cleanupPingTs: Date.now() } });
			console.log(`[QueueWorker] Cleanup: Marked stuck job id=${job.id} as error for DM (prev status: ${job.status}, url: ${job.fic_url})`);
		} catch (e) {
			console.error('[QueueWorker] Failed to mark stuck job as error:', job.id, e);
		}
		// Do NOT destroy subscribers or the job here; Sam will notify and clean them up
	}
	for (const job of allJobs) {
		const subscribers = allSubscribers.filter(sub => sub.queue_id === job.id);
	}
}
// Estimate AO3 requests for a job (can be improved for series, etc.)
function estimateAO3Requests(job) {
	// For AO3 series, estimate 1 + N works; for single fic, 1
	if (/archiveofourown\.org\/series\//.test(job.fic_url) && job.result && Array.isArray(job.result.series_works)) {
		return 1 + job.result.series_works.length;
	}
	return 1;
}

async function processQueueJob(job) {
	try {
		pollQueue.currentPhase = { jobId: job.id, phase: 'mark-processing', ts: Date.now() };
		await job.update({ status: 'processing' });
		// Use the original requester's user context for the rec
		// Try to get the username from the first subscriber, fallback to 'Unknown User'
		let user = { id: job.requested_by || 'queue', username: 'Unknown User' };
		const firstSub = await ParseQueueSubscriber.findOne({ where: { queue_id: job.id }, order: [['created_at', 'ASC']] });
		let userMap = new Map();
		if (firstSub) {
			const userRecord = await User.findOne({ where: { discordId: firstSub.user_id } });
			user = {
				id: firstSub.user_id,
				username: userRecord ? userRecord.username : `User ${firstSub.user_id}`
			};
			if (userRecord) userMap.set(userRecord.discordId, userRecord);
		}

		// Do not clear AO3 cookies per job; cookies are cleared once at startup

		const startTime = Date.now();
		// NEW ARCHITECTURE: URL-only processing
		// User metadata (notes, manual fields) is handled by Sam command handlers upfront
		// Jack only processes URLs and fetches AO3/site metadata
		const siteInfo = detectSiteAndExtractIDs(job.fic_url);

		let result;
		if (siteInfo.site !== 'ao3') {
			pollQueue.currentPhase = { jobId: job.id, phase: 'non-ao3-route', ts: Date.now(), url: job.fic_url };
			// Route to general fanfiction processor
			result = await processFicJob({
				url: job.fic_url,
				user,
				isUpdate: false, // Queue doesn't track updates for non-AO3
				site: siteInfo.site
			});
		} else if (siteInfo.isSeriesUrl) {
			pollQueue.currentPhase = { jobId: job.id, phase: 'ao3-series-route', ts: Date.now(), url: job.fic_url };
			// Series URL: Route to batch series processor
			const existingSeries = await Series.findOne({ where: { url: job.fic_url } });
			const isUpdate = !!existingSeries;

			result = await batchSeriesRecommendationJob({
				url: job.fic_url,
				user,
				isUpdate
			});
		} else if (siteInfo.isWorkUrl) {
			pollQueue.currentPhase = { jobId: job.id, phase: 'ao3-work-route', ts: Date.now(), url: job.fic_url };
			// Work URL: Route to single work processor
			// Use model field constant to avoid mismatches
			const existingRec = await Recommendation.findOne({ where: { [RecommendationFields.ao3ID]: siteInfo.ao3ID } });
			const isUpdate = !!existingRec;

			result = await processAO3Job({
				ao3ID: siteInfo.ao3ID,
				user,
				isUpdate,
				type: 'work',
				batch_type: job.batch_type || null
			});
		} else {
			throw new Error('Invalid URL format');
		}

		// Handle processing result
		console.log(`[QueueWorker] Result for job ${job.id}:`, {
			url: job.fic_url,
			site: siteInfo.site,
			isSeries: !!siteInfo.isSeriesUrl,
			isWork: !!siteInfo.isWorkUrl,
			batch_type: job.batch_type || null,
			error: result && result.error ? result.error : null,
			recommendationId: result && result.recommendation && result.recommendation.id ? result.recommendation.id : (result && result.id ? result.id : null)
		});
		pollQueue.currentPhase = { jobId: job.id, phase: 'result-logged', ts: Date.now(), error: !!(result && result.error) };
		await handleJobResult(job, result, siteInfo);

	} catch (error) {
		console.error('[QueueWorker] Job processing failed:', error);
		try { pollQueue.currentPhase = { jobId: job.id, phase: 'job-error', ts: Date.now(), message: error.message }; } catch {}
		await job.update({ status: 'error', error_message: error.message || 'Processing failed' });
		// Set status to error for Sam to handle. Do not destroy subscribers.
	}
}
async function handleJobResult(job, result, siteInfo) {
	try {
		// Handle error cases
		if (result.error) {
			console.warn(`[QueueWorker] Job ${job.id} result error`, { url: job.fic_url, error: result.error, message: result.error_message || null });
			const errCode = (result.error || '').toLowerCase();
			const errMsg = (result.error_message || result.error || '').toLowerCase();
			const isValidationFail = errCode === 'validation_failed' || errMsg.includes('dean/cas') || errMsg.includes('validation');
			if (isValidationFail) {
				await job.update({
					status: 'nOTP',
					validation_reason: result.error_message || result.error,
					error_message: null,
					result: result.failures ? { type: siteInfo.isSeriesUrl ? 'series' : 'work', failures: result.failures } : null
				});
				// Leave subscribers intact for Sam to notify via modmail.
				console.log(`[QueueWorker] Marked job ${job.id} as nOTP; subscribers retained for modmail notification.`);
			} else {
				await job.update({ status: 'error', error_message: result.error });
				// Set error and leave subscribers intact for Sam to notify/cleanup
			}
			return;
		}

		// Handle successful processing
		let resultPayload;
		let finalStatus = 'done'; // Default status for regular jobs
		if (siteInfo.isSeriesUrl) {
			// Series result
			resultPayload = {
				id: result.processedWorks?.[0]?.recommendation?.id || null,
				type: 'series',
				seriesId: result.seriesId,
				workCount: result.totalWorks || 0
			};
			// Series batch jobs use series-done status
			if (job.batch_type === 'series') {
				finalStatus = 'series-done';
			}
			// Guard: if series info missing, treat as error
			if (!result.seriesId && !(result.seriesRecord && result.seriesRecord.id)) {
				console.warn(`[QueueWorker] Job ${job.id} series processing returned no seriesId; marking error`, { url: job.fic_url });
				await job.update({ status: 'error', error_message: 'Series processing returned no seriesId' });
				// Set status to error for Sam to handle. Do not destroy subscribers.
				return;
			}
		} else {
			// Work result
			resultPayload = {
				id: result.recommendation?.id || null,
				type: 'work'
			};
			// Guard: if no recommendation id, treat as error
			if (!resultPayload.id) {
				console.warn(`[QueueWorker] Job ${job.id} work processing created no recommendation; marking error`, { url: job.fic_url });
				await job.update({ status: 'error', error_message: 'Work processing created no recommendation' });
				// Set status to error for Sam to handle. Do not destroy subscribers.
				return;
			}
		}
		console.log(`[QueueWorker] Job ${job.id} success`, { url: job.fic_url, finalStatus, payload: resultPayload });
		await job.update({ 
			status: finalStatus, 
			result: resultPayload, 
			error_message: null, 
			validation_reason: null 
		});
		let thresholdMs = 3000; // default 3 seconds
		const thresholdConfig = await Config.findOne({ where: { key: 'instant_queue_suppress_threshold_ms' } });
		if (thresholdConfig && !isNaN(Number(thresholdConfig.value))) {
			thresholdMs = Number(thresholdConfig.value);
		}
		const elapsed = Date.now() - new Date(job.submitted_at).getTime();
		if (job.instant_candidate && elapsed < thresholdMs) {
			// Clean up subscribers silently
			// Keep subscribers for Sam to process notifications
			return;
		}
		// Clean up subscribers after notification
		// Keep subscribers for Sam to process notifications
	} catch (error) {
		console.error('[QueueWorker] Error handling job result:', error);
		await job.update({ status: 'error', error_message: error.message || 'Result handling failed' });
	}
}

async function pollQueue() {
	while (true) {
		try {
			await sequelize.sync();
			const job = await ParseQueue.findOne({ where: { status: 'pending' }, order: [['created_at', 'ASC']] });
			if (job) {
				// AO3 rate-aware queue: estimate requests and wait for next available slot
				const numRequests = estimateAO3Requests(job);
				const nextAvailable = getNextAvailableAO3Time(numRequests);
				const now = Date.now();
				// Mark as processing immediately to avoid cleanup dropping long waits
				try { await job.update({ status: 'processing' }); } catch {}
				if (nextAvailable > now) {
					const wait = nextAvailable - now;
					console.log(`[QueueWorker] AO3 rate limit: waiting ${wait}ms before processing job ${job.id}`);
					// Periodic keepalive touch during long waits (45–75s jitter)
					let remaining = wait;
					while (remaining > 0) {
						const step = 45000 + Math.floor(Math.random() * 30000); // 45–75s
						const sleepMs = Math.min(step, remaining);
						await new Promise(res => setTimeout(res, sleepMs));
						remaining -= sleepMs;
						try {
							const existingResult = job.result && typeof job.result === 'object' ? job.result : {};
							await job.update({ result: { ...existingResult, lastKeepaliveTs: Date.now() } });
						} catch {}
					}
				}
				// Simulate 'think time' before starting each job (0.5–2s)
				const thinkTime = 500 + Math.floor(Math.random() * 1500);
				console.log(`[QueueWorker] Waiting think time: ${thinkTime}ms before processing job ${job.id}`);
				await new Promise(res => setTimeout(res, thinkTime));

				console.log(`[QueueWorker] Starting job ${job.id} at ${new Date().toISOString()}`);
				let jobErrored = false;
				try {
					await processQueueJob(job);
				} catch (e) {
					jobErrored = true;
					throw e;
				}
				// Mark AO3 slot as used for this job
				markAO3Requests(numRequests);
				console.log(`[QueueWorker] Finished job ${job.id} at ${new Date().toISOString()}`);
				pollQueue.currentPhase = { jobId: job.id, phase: 'post-job-delay', ts: Date.now() };
				// Vary delay range (12–20s normal, 20–30s rare)
				// Use a weighted random: 75% chance 12–20s, 25% chance 20–30s
				let delayMs;
				const r = Math.random();
				if (r < 0.75) {
					delayMs = 12000 + Math.floor(Math.random() * 8000); // 12–20s
				} else {
					delayMs = 20000 + Math.floor(Math.random() * 10000); // 20–30s
				}
				// Rare long pause: every 10–20 jobs, pause 1–3 min
				pollQueue.jobCount = (pollQueue.jobCount || 0) + 1;
				const jobsPerPause = 10 + Math.floor(Math.random() * 11);
				if (pollQueue.jobCount % jobsPerPause === 0) {
					const longPause = 60000 + Math.floor(Math.random() * 120000); // 1–3 min
					console.log(`[QueueWorker] Taking a long pause for ${Math.round(longPause/1000)} seconds after job ${job.id} (jobCount: ${pollQueue.jobCount}, jobsPerPause: ${jobsPerPause})`);
					// Keepalive during long pauses every 45–75s
					let remainingPause = longPause;
					while (remainingPause > 0) {
						const step = 45000 + Math.floor(Math.random() * 30000);
						const sleepMs = Math.min(step, remainingPause);
						await new Promise(res => setTimeout(res, sleepMs));
						remainingPause -= sleepMs;
						try {
							const existingResult = job.result && typeof job.result === 'object' ? job.result : {};
							await job.update({ result: { ...existingResult, lastKeepaliveTs: Date.now() } });
						} catch {}
					}
					console.log(`[QueueWorker] Finished long pause after job ${job.id} at ${new Date().toISOString()}`);
				} else {
					console.log(`[QueueWorker] Waiting delay: ${delayMs}ms after job ${job.id}`);
					// Keepalive during post-job delay if very long (>30s)
					if (delayMs > 30000) {
						let remainingDelay = delayMs;
						while (remainingDelay > 0) {
							const step = 45000 + Math.floor(Math.random() * 30000);
							const sleepMs = Math.min(step, remainingDelay);
							await new Promise(res => setTimeout(res, sleepMs));
							remainingDelay -= sleepMs;
							try {
								const existingResult = job.result && typeof job.result === 'object' ? job.result : {};
								await job.update({ result: { ...existingResult, lastKeepaliveTs: Date.now() } });
							} catch {}
						}
					} else {
						await new Promise(res => setTimeout(res, delayMs));
					}
					console.log(`[QueueWorker] Finished delay after job ${job.id} at ${new Date().toISOString()}`);
					pollQueue.currentPhase = { jobId: job.id, phase: 'delay-finished', ts: Date.now() };
				}

				// Handle AO3 cooldown after consecutive AO3-related errors
				try {
					pollQueue.consecutiveAO3Errors = pollQueue.consecutiveAO3Errors || 0;
					if (jobErrored && /archiveofourown\.org|AO3/i.test(job.fic_url || '') ) {
						pollQueue.consecutiveAO3Errors += 1;
					} else {
						pollQueue.consecutiveAO3Errors = 0;
					}
					const threshold = 3;
					if (pollQueue.consecutiveAO3Errors >= threshold) {
						console.warn('[QueueWorker] Entering AO3 cooldown due to repeated errors.');
						// Emit cooldown start sentinel
						await ParseQueue.create({
							fic_url: 'ao3://cooldown',
							status: 'cooldown',
							requested_by: 'queue',
							result: { action: 'start' },
							notes: 'Automatic AO3 cooldown after repeated errors.'
						});
						// Pause for cooldown window (default 60s)
						let cooldownMs = 60000;
						const cfg = await Config.findOne({ where: { key: 'ao3_queue_cooldown_ms' } });
						if (cfg && !isNaN(Number(cfg.value))) cooldownMs = Number(cfg.value);
						await new Promise(res => setTimeout(res, cooldownMs));
						// Emit cooldown end sentinel
						await ParseQueue.create({
							fic_url: 'ao3://cooldown',
							status: 'cooldown',
							requested_by: 'queue',
							result: { action: 'end' },
							notes: 'AO3 cooldown ended.'
						});
						pollQueue.consecutiveAO3Errors = 0;
					}
				} catch (coolErr) {
					console.error('[QueueWorker] Failed during cooldown handling:', coolErr);
				}

			} else {
				// No pending jobs, wait before polling again (randomize 4–7s)
				pollQueue.currentPhase = { jobId: null, phase: 'idle', ts: Date.now() };
				const idleDelay = 4000 + Math.floor(Math.random() * 3000);
				await new Promise(res => setTimeout(res, idleDelay));
			}
		} catch (err) {
			console.error('[QueueWorker] Polling error:', err);
			try { pollQueue.currentPhase = { jobId: null, phase: 'poll-error', ts: Date.now(), message: err.message }; } catch {}
			await new Promise(res => setTimeout(res, 10000));
		}
	}
}

// Jack does not interact with Discord directly, so no Discord.js client is started here.

// Startup tasks: clear AO3 cookies and warm browser, then start polling
clearAO3Cookies();
await warmAO3Browser();
// Start polling the queue and run cleanup on interval
pollQueue();
setInterval(() => {
	console.log('[QueueWorker] Running scheduled cleanup of old queue jobs...');
	cleanupOldQueueJobs();
}, 30 * 60 * 1000);
// Also run once at startup
console.log('[QueueWorker] Running initial cleanup of old queue jobs...');
cleanupOldQueueJobs();
// Heartbeat: emit current phase every 60s for observability
setInterval(() => {
	try {
		const p = pollQueue.currentPhase || { phase: 'unknown' };
		const since = p.ts ? (Date.now() - p.ts) : null;
		const sinceText = since != null ? `${since}ms ago` : 'n/a';
		console.log('[QueueWorker][Heartbeat]', {
			phase: p.phase,
			jobId: p.jobId || null,
			url: p.url || undefined,
			error: p.error || false,
			since: sinceText
		});
	} catch (e) {
		console.log('[QueueWorker][Heartbeat] emit failed:', e.message);
	}
}, 60 * 1000);
