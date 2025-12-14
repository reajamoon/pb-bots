# Reminders + Timers Spec (Draft v1)

Status: Draft for alignment

## Why this exists
Users want lightweight time-based tools that overlap with sprint usage, but should remain independent.

- `/reminder` is about being notified at a specific time in the future.
- `/timer` is about starting a countdown right now.

This doc defines what people are doing and how the system should behave before we choose commands, UI details, or implementation.

## Decisions already made
- Reminders support **one-shot** and **recurring** (daily, weekly, monthly).
- Monthly recurrence supports both **day-of-month** (e.g., 15th) and **nth weekday** (e.g., 2nd Tuesday).
- Timers allow **multiple active timers per user**.
- Default delivery is **in-channel** (in-thread if created in a thread), with sensible fallbacks.

Deployment note:
- This workspace is for a single Discord server. When this doc says “guild”, it refers to that one server.

---

## Shared principles

### Persistence
- Reminders and timers must be persisted so they survive bot restarts.
- Users must be able to list and cancel their active reminders and timers.

### Timezone rules
For any feature that takes a calendar time (like “tomorrow at 9am”), interpret it using:
1) user timezone if set and valid IANA
2) server (guild) timezone if set and valid IANA
3) UTC

DM note:
- If the reminder is created in DMs (no guild context), skip the server (guild) timezone fallback.

For any feature that takes a duration (like “25 minutes”), timezone does not matter.

### Delivery rules
- A reminder or timer should notify the user in a reliable, predictable place.
- Default delivery is the channel where it was created (or an explicitly chosen channel).
- If it was created in a thread, default delivery is that thread.
- If the target channel is not usable (missing perms, deleted, thread archived), fall back to DM.
- If DM fails (user closed DMs), attempt the original channel if it is usable; otherwise log and mark it failed.

### Reliability requirements
- Triggering should be idempotent. A reminder or timer firing twice must not post twice.
- Scheduling cannot rely only on in-memory timeouts. There must be a durable “due at” time and a periodic poller or job runner.

---

## What people are doing (workflows)

### Workflow 1: Set a reminder for myself
Intent:
- “Ping me later” for a task, event, or check-in.

Key behaviors:
- User sets a reminder with:
  - note text (what it’s for)
  - due time (absolute)
  - optional target channel preference
- When due, the bot posts a notification.

### Workflow 2: See what reminders I have
Intent:
- Confirm a reminder exists.
- Check timing.

Key behaviors:
- User can list active reminders, showing due time and the note.

### Workflow 3: Cancel a reminder
Intent:
- Remove something no longer needed.

Key behaviors:
- User can cancel by selecting from their list (or specifying an ID).

### Workflow 4: Start a timer
Intent:
- Countdown for a short duration.

Key behaviors:
- Timer starts immediately.
- Timer finishes after the duration and notifies.
- The timer note (if provided) should appear in the completion notification.

### Workflow 5: Manage timers
Intent:
- Check remaining time.
- Cancel a timer.

Key behaviors:
- User can list and cancel active timers, showing remaining time and the note.

---

## Domain model

### Reminder
A persisted record representing a notification due at a specific time.

Required fields:
- `id`
- `userId`
- `guildId` (nullable for DMs)
- `createdAt`
- `dueAt` (UTC timestamp)
- `message` (text; the user’s note describing what the reminder is for)
- `deliveryChannelId` (nullable)
- `status` (pending, delivered, canceled, error)
- `deliveredAt` (nullable)

Limits:
- There should be a safety cap on active reminders per user to prevent spam/abuse.
- Default cap: **20 pending reminders per user** (configurable).

Recurring reminders:
- A reminder can optionally be recurring.
- Recurring reminders do not “stay pending forever”; each firing should advance the next `dueAt`.

Suggested additional fields for recurrence:
- `isRecurring` (boolean)
- `recurrenceRule` (string; see below)
- `recurrenceEndsAt` (nullable UTC timestamp)
- `lastFiredAt` (nullable UTC timestamp)

Recurrence rule (v1 scope):
- Support simple intervals first (daily/weekly/monthly) rather than full RRULE complexity.
- For monthly recurrence, support both day-of-month and nth weekday patterns.
- Examples:
  - daily at 09:00 in user timezone
  - weekly on Mondays at 18:00 in user timezone
  - monthly on the 1st at 09:00 in user timezone
  - monthly on the 2nd Tuesday at 09:00 in user timezone

Timezone note for recurrence:
- Recurrence should be interpreted in the user’s timezone (with the same fallback chain).
- Each time it fires, compute the next occurrence and store the next `dueAt` in UTC.

Optional fields (v1 if needed):
- `sourceChannelId` and `sourceMessageId` for traceability

### Timer
A persisted record representing a countdown started at a moment.

Required fields:
- `id`
- `userId`
- `guildId` (nullable for DMs)
- `createdAt`
- `startedAt` (UTC timestamp)
- `durationSeconds`
- `endsAt` (UTC timestamp, denormalized for easy querying)
- `label` (nullable; the user’s note describing what the timer is for)
- `deliveryChannelId` (nullable)
- `status` (running, done, canceled, error)
- `completedAt` (nullable)

Notes:
- `endsAt = startedAt + durationSeconds`.
- Storing `endsAt` avoids recomputing and helps indexing.

Multiple active timers:
- A user may have multiple `running` timers at once.
- Listing and canceling must disambiguate timers (by ID and/or label).

Limits:
- There should be a safety cap on active timers per user to prevent spam/abuse.
- Default cap: **5 running timers per user**.
- Cap should be configurable (global or per guild).

---

## Triggering and scheduling

### Poller approach (recommended)
- A background loop wakes up every N seconds.
- It queries for due reminders and timers: `status in (pending/running)` and `dueAt/endsAt <= now`.
- It attempts delivery and updates status in a single transaction-like flow.

### Idempotency strategy
- Use a compare-and-set update when claiming a reminder/timer for delivery.
- Example: update status from `pending` to `delivering` only if it is still `pending`.
- If the update affects 0 rows, another worker already claimed it.

---

## Crossover with sprints and projects (no coupling)

These features overlap in real user behavior but should not share state.

- Users may run a `/timer` as an alternative to a sprint when they do not care about logging stats.
- Users may use `/reminder` to prompt themselves to start a sprint, end a sprint, or log results.

Rules:
- Starting a sprint must not auto-create timers.
- Creating a timer must not create sprints.
- We can optionally add gentle copy in responses to hint at the other tool, but the features remain separate.

