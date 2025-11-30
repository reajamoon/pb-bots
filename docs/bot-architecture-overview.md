# Sam Bot Architecture Overview

## Dual Bot System

As of now, we're running on a dual bot system:

- **Sam** (`src/bots/sam/`): The main Discord bot that handles everything you see and interact with—slash commands, buttons, all the UI stuff
- **Jack** (`src/bots/jack/`): Background worker that does the heavy lifting of fetching and parsing fic metadata

Basically, Sam stays responsive for Discord stuff while Jack grinds away at parsing AO3 pages in the background. No more laggy interactions when someone's queuing up a bunch of fics.

## Process Management

Both bots run as separate PM2 processes:
- Sam: `pm2 start ecosystem.sam.config.cjs`  
- Jack: `pm2 start ecosystem.jack.config.cjs`
- Both: `./start-bots.sh`

## How They Talk to Each Other

- Sam and Jack chat through the **shared database** (ParseQueue and ParseQueueSubscriber tables)
- Sam throws metadata parsing jobs into the queue and signs up users for notifications
- Jack grabs jobs from the queue, does the work, and updates the status
- Sam checks for finished jobs and lets users know when their stuff is ready

## Queue System Stuff

The fic parsing queue system handles:
- **Deduplication**: No more fetching the same URL twice
- **Rate Limiting**: I play nice with AO3 and don't hammer their servers
- **User Notifications**: Everyone who asked for a fic gets pinged when it's ready
- **Error Handling**: When stuff breaks, I try to fix it and let you know what happened
- **Instant Results**: If the queue is empty and I can grab something fast, you get it right away

## 1. Project Structure
```
root/
  src/
    bots/
      sam/              # Sam Discord bot (main interface)
        commands/       # Slash command handlers (profile, rec, etc.)
        events/         # Discord event handlers (ready, interactionCreate, etc.)
        handlers/
          buttons/      # Modular button handlers (profile, privacy, navigation, etc.)
          modals/       # Modular modal handlers (bio, birthday, region, etc.)
          selectMenus/  # Modular select menu handlers
        utils/          # Sam-specific utilities
      jack/             # Jack queue worker (background processing)
      dean/             # Dean bot (placeholder for future)
      cas/              # Cas bot (placeholder for future)
    shared/
      recUtils/         # Shared recommendation utilities
      text/            # Shared text and message utilities
      utils/           # Shared utilities (logging, etc.)
    models/             # Sequelize models (User, Guild, Recommendation, ParseQueue, etc.)
  config/               # Configuration files
  database/             # Migrations and seeders
  docs/                 # Documentation
  ecosystem.*.config.cjs # PM2 configuration for each bot
  start-bots.sh         # Script to start both Sam and Jack
```

## 2. Sam Bot (Discord Interface)

### What Sam Does
- **Profile System:** User profiles with birthday, timezone, bio, and privacy stuff
- **Rec System:** Add, search, update, and manage fanfic recommendations
- **Birthday Notifications:** I automatically post birthday shoutouts every day
- **Help System:** Tons of help and navigation menus when you get lost
- **Moderation Tools:** Rec validation, queue management, and admin utilities

### How It's Built
- **Commands:** Slash command handlers in `src/bots/sam/commands/`
- **Handlers:** Modular button, modal, and select menu handlers
- **Events:** Discord event processing (interactions, ready, etc.)
- **Utilities:** Sam-specific utilities for UI and interaction stuff

## 3. Jack Bot (Queue Worker)

### What Jack Does
- **Metadata Parsing:** Grabs and processes AO3 and other fanfic site info
- **Rate Limiting:** Plays nice with site policies so we don't get banned
- **Queue Management:** Works through jobs in order and doesn't double-up
- **Error Handling:** When things go wrong, tries to recover and lets people know
- **Background Processing:** Runs separately so Discord doesn't get laggy

### Architecture
- **Main Process:** Single Node.js process that polls the ParseQueue
- **Job Processing:** Routes to appropriate metadata processors (AO3, FFN, etc.)
- **Rate Control:** Smart timing and backoff algorithms for site respect
- **Shared Utilities:** Uses shared recUtils for metadata processing

## 4. Shared Components

### Models (src/models/)
- **User, Guild, Recommendation:** Core data models
- **ParseQueue, ParseQueueSubscriber:** Queue system tables
- **Config, ModLock, Series:** Additional feature models

### Utilities (src/shared/)
- **recUtils:** Metadata parsing, validation, and processing
- **text:** Message formatting and update utilities
- **utils:** Logging, database helpers, and common functions
## 5. Queue System Details

### Workflow
1. **User Request:** User runs `/rec add` or `/rec update`
2. **Queue Check:** Sam checks if URL already queued
3. **Enqueue/Subscribe:** Creates queue entry or subscribes to existing
4. **Processing:** Jack picks up job, sets status to 'processing'
5. **Metadata Fetch:** Jack fetches metadata from AO3/other sites
6. **Database Update:** Jack saves parsed data and updates job status
7. **Notification:** Jack notifies subscribers of completion

### Status Types
- `pending`: Job waiting to be processed
- `processing`: Job currently being processed by Jack
- `done`: Job completed successfully
- `error`: Job failed with error
- `nOTP`: Job failed Dean/Cas validation (mods can override)
- `series-done`: Series processing completed

### Rate Limiting
- **AO3 Rate Limiter:** 20-second minimum intervals (configurable)
- **Queue-Aware:** Considers all pending jobs when scheduling
- **Adaptive Delays:** Variable delays based on server load
- **Think Time:** Random 0.5-2 second pauses between jobs

## 6. UI & Interaction System

### CustomID Format
All buttons use standardized format: `[action]_[context]_[primaryId]_[secondaryId]`

### Message Tracking
- **Encoding:** Message IDs base64-encoded for customID inclusion
- **Dual Updates:** Original message updated alongside ephemeral responses
- **Centralized Utilities:** `messageTracking.js` and `buttonId.js` handle all ID logic

### Modular Handlers
- **Buttons:** Dedicated handlers for profile, privacy, rec, navigation
- **Modals:** Separate handlers for bio, birthday, region input
- **Select Menus:** Handlers for various selection interfaces

## 7. Database & Configuration

### Database Setup
- **Development:** SQLite (`./database/bot.sqlite`)
- **Production:** PostgreSQL (via `DATABASE_URL` environment variable)
- **Migrations:** Sequelize migrations in `/migrations` folder
- **Models:** Sequelize models with relationships in `/src/models`

### Configuration
- **Environment Variables:** Database URL, Discord tokens, AO3 credentials
- **Config Table:** Runtime configuration stored in database Config model
- **PM2 Configs:** Separate ecosystem files for Sam and Jack

## 8. AO3 Integration

### Parser Features
- **Cheerio & Zod:** Modern HTML parsing with schema validation
- **Login System:** Automated AO3 login for age-restricted content
- **Rate Limiting:** Respectful request spacing and queue awareness
- **Error Recovery:** Robust error handling with retry logic

### Supported Sites
- **AO3:** Full metadata parsing including series support
- **Other Sites:** Extensible system for additional fanfiction sites

## 9. Development & Deployment Stuff

### Process Management
- **PM2:** Production process manager for both bots
- **Ecosystem Configs:** `ecosystem.sam.config.cjs` and `ecosystem.jack.config.cjs`
- **Start Script:** `./start-bots.sh` for convenient dual startup

### Making It Bigger
- **Modular Design:** Easy to add new commands and features
- **Shared Utilities:** Common functions so I don't have to write the same thing twice
- **Clear Architecture:** Well-defined separation between UI and business logic
- **Documentation:** Docs for all the major systems so you don't have to guess

## 10. How to Not Break Things

### Development Guidelines
- **Use the Queue System:** Don't try to bypass the queue for metadata fetching, seriously
- **Use the Utilities:** messageTracking.js and buttonId.js exist for a reason—use them for all UI interactions
- **Keep Things Modular:** Make separate handlers for new features
- **Database Migrations:** Use migrations for all schema changes, don't just edit the models
- **Shared Code:** Put reusable stuff in `/src/shared` so both bots can use it

### Where Things Go
- **Sam-Specific:** Discord interaction code goes in `/src/bots/sam`
- **Jack-Specific:** Background processing code goes in `/src/bots/jack`
- **Shared:** Common utilities and models in `/src/shared` and `/src/models`
- **Documentation:** Update docs when you add new features or change how things work

---

*This overview reflects the current dual-bot architecture as of November 2025. For specific implementation details, see the individual documentation files in `/docs`.*
