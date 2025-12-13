# Fic Metadata Queue

This document describes the fic metadata queue as a feature.

The queue exists so Sam can stay responsive on Discord while Jack does the slow stuff (fetching metadata, parsing, and saving results) in the background.

## What This Feature Does

- Deduplicates fetches so the same URL is not processed multiple times in parallel
- Keeps Discord interactions fast by moving network work into Jack
- Adds rate limiting and pacing so we are as gentle as possible to AO3 and other sites
- Notifies the right people when a job finishes, fails, or gets flagged for validation

## Who Does What

- Sam (Discord bot)
  - Normalizes URLs, stores user-provided notes/tags/manual overrides
  - Creates or joins a queue job and subscribes the requesting user
  - Runs a poller that posts results and cleans up subscriptions

- Jack (queue worker)
  - Pulls the next queued job, fetches metadata, and writes results back to the database
  - Applies AO3 pacing and automatic cooldown behavior

## What Users See

When a user runs `/rec add <url>` or `/rec update <id>`, Sam:

1. Normalizes the URL
2. Creates a new queue job, or joins an existing job for the same URL
3. Replies immediately with status
4. Later, edits the original reply (when possible) and/or posts the final embed when the job completes

Multiple users can subscribe to the same job and get notified when it finishes.

## Queue Statuses

These are the statuses you will see on a job:

- `pending` - waiting to be processed
- `processing` - being worked on by Jack
- `done` - completed successfully (single work)
- `series-done` - completed successfully (series batch)
- `nOTP` - failed Dean or Cas validation and requires a mod decision
- `error` - failed with an error message
- `cooldown` - a sentinel job used to announce AO3 cooldown start or end in the configured queue channel

## Notifications

Sam’s poller handles notifications and cleanup:

- `done` and `series-done`
  - Builds an embed from stored data and posts it to an appropriate channel
  - Prefers editing the original command reply if the subscriber row includes `channel_id` and `message_id`
  - Cleans up subscriber rows and removes the queue job

- `error`
  - DMs subscribed users (unless they disabled queue notify tagging)
  - Cleans up subscriber rows and removes the queue job

- `nOTP`
  - Creates a modmail thread for review
  - Includes relevant context and mod actions
  - Clears subscribers after the modmail is created so we do not spam
  - Keeps the job in `nOTP` until a mod acts

- `cooldown`
  - Posts a short announcement to `fic_queue_channel`
  - Deletes the sentinel job

## Rate Limiting and AO3 Cooldown

Jack spaces AO3 requests using `AO3_MIN_REQUEST_INTERVAL_MS` (default 20000ms) and adds small randomized delays.

If Jack hits repeated AO3-related errors, it will:

1. Emit a `cooldown` sentinel job with `result.action = start`
2. Wait for a cooldown window (see `ao3_queue_cooldown_ms`)
3. Emit a `cooldown` sentinel job with `result.action = end`

## Commands That Touch The Queue

- `/rec queue` - show queue status
- `/rec resetqueue` - reset stuck jobs (admin)
- `/rec clearqueue <url>` - clear a specific URL (admin)
- `/setficqueuechannel` - set `fic_queue_channel` (admin)

## Configuration

Environment variables:

- `AO3_MIN_REQUEST_INTERVAL_MS` - minimum time between AO3 requests (default 20000)
- `PARSEQUEUE_PENDING_STUCK_MIN` - pending cutoff for “stuck” handling
- `PARSEQUEUE_PROCESSING_STUCK_MIN` - processing cutoff for “stuck” handling
- `PARSEQUEUE_SERIES_PROCESSING_STUCK_MIN` - series processing cutoff for “stuck” handling

Config table keys:

- `fic_queue_channel` - channel ID for queue announcements and some notifications
- `instant_queue_suppress_threshold_ms` - threshold for suppressing redundant “instant completion” notifications
- `ao3_queue_cooldown_ms` - cooldown window after repeated AO3 errors

## Troubleshooting

- Job stuck in `processing`
  - Check Jack logs first
  - Use `/rec resetqueue` if needed
  - Verify `PARSEQUEUE_*_STUCK_MIN` values are sane

- Users not getting notified
  - Confirm `fic_queue_channel` is set
  - Confirm the subscriber row has `channel_id` and `message_id` when you expect an edit
  - Confirm the user did not disable queue notify tagging

## References

- `docs/bot-architecture-overview.md`
- `docs/rec-system.md`
- `docs/message-tracking-utility.md`
