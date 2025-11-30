# Fic Parsing Queue System: Implementation Documentation

## Overview
This document describes the **implemented** database-backed queue system that manages fic parsing jobs (AO3, FFN, Wattpad, etc.) for the Discord bot. The system prevents duplicate/clashing fetches, avoids timeouts, and provides a robust, scalable, and user-friendly experience.

**Status:** ✅ **FULLY IMPLEMENTED** as of November 2025

The queue system is now live and handles all metadata fetching through the Jack bot worker process, with Sam bot handling Discord interactions and user management.

---

## 1. Current Implementation

### Database Schema (Implemented)

#### ParseQueue Table
```sql
- id (PK, auto-increment)
- fic_url (string, unique) - The fanfiction URL to process
- status (enum: 'pending', 'processing', 'done', 'error', 'nOTP', 'series-done')
- instant_candidate (boolean) - Flags jobs for instant completion detection
- batch_type (enum: 'series' or null) - Type of batch processing
- submitted_at (datetime) - When the job was created
- requested_by (string) - Original requester's Discord ID
- notes (text, nullable) - User-provided notes
- additional_tags (text, nullable) - User-provided additional tags
- result (JSON, nullable) - Parsed metadata result
- error_message (text, nullable) - Error details if failed
- validation_reason (text, nullable) - Validation failure reason
```

#### ParseQueueSubscribers Table
```sql
- id (PK, auto-increment)
- queue_id (FK to ParseQueue) - Associated queue job
- user_id (string) - Discord user ID to notify
- created_at, updated_at (datetime) - Timestamps
```

### Bot Architecture (Implemented)

#### Sam Bot (Discord Interface)
- **Location:** `src/bots/sam/`
- **Role:** Handles Discord interactions, enqueues jobs, manages user subscriptions
- **Commands:** `/rec add`, `/rec update`, `/rec queue`, etc.
- **Features:** User notification, instant result polling, subscription management

#### Jack Bot (Queue Worker)
- **Location:** `src/bots/jack/jack.js`
- **Role:** Background worker that processes queue jobs
- **Process:** Independent Node.js process managed by PM2
- **Features:** Rate limiting, metadata parsing, error handling, notification dispatch

---

## 2. Current Workflow (Implemented)

### How a User Request Works
1. **Command:** User runs `/rec add <url>` or `/rec update <id>`
2. **URL Cleanup:** I normalize the URL (remove `/chapters/12345` stuff, etc.)
3. **Queue Check:** I see if that URL is already in the queue
4. **Job Creation/Subscription:**
   - **New URL:** Creates a new queue entry marked as 'pending'
   - **Existing Job:** Just adds the user to the subscriber list for that job
5. **User Feedback:** I tell the user what's going on and how long it might take

### How Jack Does His Thing
1. **Queue Polling:** Jack checks the queue for `status='pending'` jobs (oldest first)
2. **Rate Limiting:** Checks if it's okay to hit AO3 again before starting
3. **Job Processing:**
   - Updates status to 'processing'
   - Grabs metadata using the right parser (AO3, FFN, etc.)
   - Saves the parsed data to the Recommendation table
   - Updates the queue entry with the result and marks it 'done'
4. **Notification:** Tells everyone who subscribed that their fic is ready
5. **Cleanup:** Removes the completed subscribers after sending notifications

### Status Types (Implemented)
- **pending:** Job waiting in queue
- **processing:** Currently being processed by Jack
- **done:** Successfully completed
- **error:** Failed with error message
- **nOTP:** Failed Dean/Cas validation (mods can override with `/modutility override_validation`)
- **series-done:** Series batch processing completed

### Rate Limiting (Be kind to AO3, Seriously if I find out you forked this and removed rate limiting I'll hunt you down and shit on your lawn)
- **AO3 Rate Limiter:** At least 20 seconds between AO3 requests
- **Queue-Aware:** Looks at all pending jobs when deciding when to go next
- **Adaptive Delays:** Variable delays (12-30s) based on how busy the servers seem
- **Think Time:** Random 0.5-2s pauses between jobs
- **Long Pauses:** Every 10-20 jobs, take a 1-3 minute break

---

## 3. Key Features (Implemented)

### Instant Result Detection
- **Fast Polling:** Sam polls for job completion for ~3 seconds after enqueuing
- **Threshold Config:** Configurable via `instant_queue_suppress_threshold_ms` in Config table
- **User Experience:** Users get immediate feedback for quickly-processed jobs
- **Notification Suppression:** Redundant notifications avoided for instant completions

### Error Handling & Recovery
- **Dean/Cas Validation:** AO3 fics validated for ship content, failures marked as 'nOTP'
- **Mod Override:** Mods can approve nOTP fics with `/modutility override_validation`
- **Retry Logic:** Failed jobs can be manually retried or cleared by mods
- **Timeout Protection:** Jobs stuck in 'processing' auto-expire after 15 minutes

### Queue Management Commands
- **`/rec queue`:** View current queue status and pending jobs
- **`/rec resetqueue`:** Reset all stuck jobs (admin only)
- **`/rec clearqueue <url>`:** Remove specific URL from queue (admin only)
- **`/setficqueuechannel`:** Configure notification channel for queue updates (admin only)

### User Experience Features
- **Subscription System:** Multiple users can subscribe to the same job
- **Progress Notifications:** Users notified when jobs start, complete, or fail
- **Queue Visibility:** Users can see queue status and their position
- **Smart Deduplication:** If someone tries to add the same URL twice, I just ignore the duplicate

## 4. Configuration (Implemented)

### Environment Variables
```bash
AO3_MIN_REQUEST_INTERVAL_MS=20000  # Minimum interval between AO3 requests
DATABASE_URL=postgresql://...      # Database connection
```

### Runtime Configuration (Config Table)
```sql
instant_queue_suppress_threshold_ms = 3000  # Instant completion detection window
fic_queue_channel = <channel_id>            # Notification channel for queue updates
```

### PM2 Configuration
```bash
# Start both bots
./start-bots.sh

# Or individually
pm2 start ecosystem.sam.config.cjs
pm2 start ecosystem.jack.config.cjs
```

## What This Gets You

### Performance & Reliability
- **No More Conflicts:** No more duplicate fetches stepping on each other
- **Responsive Discord Bot:** Sam stays snappy even when Jack's grinding through a bunch of parsing
- **Rate Limit Compliance:** I play nice with AO3 and other sites so we don't get banned
- **Error Recovery:** When sites timeout or break, I handle it gracefully

### User Experience
- **Transparent Progress:** You can see where your stuff is in the queue and get notified when it's done
- **Multi-User Support:** Multiple people can request the same fic without stepping on each other
- **Instant Feedback:** Quick jobs give you immediate results
- **Reliable Notifications:** You always get told when your requests are done

### Maintainability
- **Clean Separation:** UI stuff (Sam) is separate from background processing (Jack)
- **Extensible:** Easy to add new fanfic sites or features
- **Good Logging:** Detailed logs for debugging and figuring out what went wrong
- **Database-Driven:** All queue state is saved and recoverable if something crashes

---

*This queue system has been fully operational since November 2025 and successfully handles all fic metadata parsing for the PB community.*

---

## 5. Future Enhancements
- Add admin dashboard for monitoring queue/jobs.
- Integrate with caching layer (e.g., Redis) for faster lookups.
---

## 6. References
- See `docs/bot-architecture-overview.md` for overall system design.
- See `docs/message-tracking-utility.md` for notification patterns.
- See `docs/profile-module-architecture.md` for Sequelize usage patterns.

---
