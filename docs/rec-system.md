# PB Recommendation System – Documentation

## The PB Library (In-World Context)
So get this! Around here, we call the recommendation system "the Library" (sometimes "our library" or "the stacks" if you’re feeling bookish). It’s not just a bunch of fanfic recs; it’s the living archive of the PB community, where hunters swap stories, dig up old favorites, and keep the lore alive. Every time you add a rec, search the stacks, or check out stats, you’re helping build something bigger than just a list. You’re keeping the community inspired and connected.

Whenever you see rec features, help menus, or stats, I’m the one walking you through it. I keep things practical, direct, and clear, like I’m showing a friend how to find the good stuff. All member-facing text uses my voice (Sam Winchester), so you’ll get dry wit, a little sarcasm, and zero nonsense. If you’re ever lost, just ask for help and I'll come running.

The PB Library is modular, reliable, and always speaks in my voice. All documentation and features use "The PB Library" to keep things immersive and consistent with our server lore.
For help text style, see `docs/sam-voice-guidelines.md`.

## Overview
The Rec System lets PB members share, search, and discover fanfiction recommendations. It’s modular, reliable, and always speaks in Sam Winchester’s voice.

## Features
- Add new recommendations with metadata
- Search and filter by tags, author, title, rating, and more
- Get random recs and library stats
- Remove or update recs (with permission checks)
- Multi-page help system and navigation


## Architecture
- **Queue System:** All fic metadata fetches (AO3 and others) are handled through a robust, deduplicated queue system managed by Jack bot. This ensures no overlap, prevents conflicts, and keeps Sam responsive even under heavy load.
- **Dual Bot Design:** Sam handles Discord interactions while Jack processes metadata in the background
- **Modular Structure:** Command routing in `rec.js` with dedicated handler modules
- **Search System:** Comprehensive search with multiple filter options and pagination
- **Rate Limiting:** Sophisticated AO3 rate limiting with queue awareness
- **Utility Modules:** Shared utilities for embed creation, validation, pagination, and statistics
- **All buttons and navigation use standardized custom IDs
- Sam Winchester voice integration for all member-facing text

## Commands
- `/rec add` – Add a new recommendation with metadata
- `/rec search` – Search the library by title, author, tags, rating, summary
- `/rec random` – Get a random rec from the library
- `/rec stats` – View library statistics and analytics
- `/rec remove` – Remove a rec (with permission checks)
- `/rec update` – Update rec metadata via queue system
- `/rec queue` – View current parsing queue status
- `/rec help` – Get help and tips for using the system
- `/rec add_ao3share` – Add a rec by pasting AO3 share HTML
- `/rec notifytag` – Toggle queue notification preferences
- `/rec resetqueue` – Reset stuck queue jobs (admin only)
- `/rec clearqueue` – Remove specific URLs from queue (admin only)

## File Structure
- `src/bots/sam/commands/rec.js` – Main command router
- `src/bots/sam/commands/recHandlers/` – Handler modules (add, search, random, stats, remove, update, help, queue)
- `src/shared/recUtils/` – Shared utilities (parsing, validation, metadata processing)
- `src/bots/jack/jack.js` – Background queue worker for metadata parsing

## Best Practices
- Use utility modules for all embed, validation, and pagination logic
- Keep Sam’s voice consistent in all member-facing text
- Modularize new features for maintainability
- Validate all input and provide clear, friendly error messages

## Extending the System
- Add new subcommands by creating handler modules
- Update utility modules for new metadata or filtering
- Use standardized custom ID format for all new buttons and navigation


## Search System

### What You Can Search For
- **Title Search:** Find fics by title (doesn't have to be exact)
- **Author Search:** Find fics by author name (partial matches work)
- **Tag Search:** Search by tags (use commas to separate multiple tags)
- **Rating Search:** Filter by content rating (Teen, Explicit, etc.)
- **Summary Search:** Search through fic summaries and descriptions
- **Combined Search:** Mix and match multiple filters together

### Search Interface
- **Pagination:** Results displayed in pages with navigation buttons
- **Result Display:** Clean embed format with key metadata
- **Smart Matching:** Case-insensitive partial string matching
- **Result Limit:** Configurable results per page

### Usage Examples
```
/rec search title:destiel author:cas summary:hurt/comfort
/rec search tags:angst,fluff rating:Teen
/rec search author:dean title:impala
```

## AO3 Integration & Parser

### Modern Parser (Because the Old One Sucked)
- **Cheerio & Zod:** Fast, reliable HTML parsing instead of fragile regex
- **Zod Validation:** Makes sure the parsed data actually makes sense
- **Error Recovery:** When things break, I try to figure out what went wrong and tell you about it
- **HTML Entity Decoding:** Properly handles weird special characters in tags and text

### Metadata Extraction
- **Required Fields:** Title, Author, Summary (others optional)
- **Stats Fields:** Published, Updated, Words, Chapters, Kudos, Comments, Bookmarks, Hits
- **Tag Normalization:** Standardized tag formatting and deduplication
- **Plain Text Output:** Summary, notes, and chapter text stripped of HTML

### Content Validation
- **Dean/Cas Focus:** AO3 fics get checked to make sure they're actually Dean/Cas
- **nOTP Handling:** Non-compliant fics get flagged as 'nOTP' for mod review
- **Mod Override:** Mods can approve flagged content with `/modutility override_validation`
- **Flexible Validation:** Easy to add other validation rules later if needed

## Queue & Notification System

### Configurable Instant Suppression Threshold

- The key `instant_queue_suppress_threshold_ms` in the `Config` table controls the time window (in milliseconds) for instant job suppression and instant result polling.
- Both the queue worker and the `/rec update` handler read this value to determine how long to wait before suppressing notifications or returning instant results.
- This value can be updated in the database at any time to adjust the threshold without code changes.
- This key is intended for future dashboard/config UI use—documented here for reference.

### Queue Features
- All fic metadata fetches are queued, deduplicated, and processed in order. No direct parsing is allowed outside the queue.
- Subscribers (users who requested or are interested in a job) are tracked and notified when the job completes.
- If a job is processed instantly (queue was empty and job completes within a few seconds), redundant notifications are suppressed.
- The queue worker, subscriber, and job processor logic are hip to edge cases and restarts.

### User Experience
- **Transparent Progress:** Users see queue position and status
- **Multiple Subscribers:** Multiple users can request same fic without conflicts
- **Notification Control:** Users can toggle queue notifications with `/rec notifytag`
- **Queue Visibility:** `/rec queue` shows current queue status and pending jobs

## Migration Status

The rec system is **fully implemented and operational**. Key achievements:

### Completed Features ✅
- **Dual Bot Architecture:** Sam (UI) + Jack (processing) separation complete
- **Queue System:** Full implementation with rate limiting and notifications
- **Search Functionality:** Comprehensive search with multiple filters
- **AO3 Parser:** Modern cheerio/zod implementation
- **Command Structure:** All subcommands implemented and documented
- **Error Handling:** Robust error recovery and user feedback
- **Moderation Tools:** Queue management and content validation systems

### Current Capabilities
- **Full Metadata Support:** AO3, FFN, and extensible to other sites
- **Advanced Search:** Multiple filter combinations with pagination
- **Queue Management:** Complete admin tools for queue monitoring
- **User Notifications:** Configurable notification system
- **Content Validation:** I check stuff automatically and mods can review anything that looks weird

## Benefits

- **Maintainability:** Each feature in its own module
- **Extensibility:** Easy to add new subcommands
- **Testability:** Individual components can be unit tested
- **Readability:** Clear separation of concerns
- **Consistency:** Unified error handling and styling
- **Performance:** Reduced memory footprint per operation

## AO3 Parser & Metadata Handling (Current Implementation)
- **Cheerio & Zod:** Modern HTML parsing with schema validation for reliability
- **HTML Entity Decoding:** All tag fields properly decode HTML entities and special characters
- **Flexible Field Requirements:** Title, Author, and Summary required; all other fields optional
- **Dynamic Stats Extraction:** Published, Updated, Completed, Words, Chapters, Comments, Kudos, Bookmarks, Hits dynamically extracted
- **Plain Text Output:** Summary, notes, and chapter text always output as plain text (HTML stripped)
- **Rate Limiting:** Sophisticated rate limiting system respects AO3 policies
- **Login System:** I log into AO3 automatically so I can grab age-restricted fics
- **Error Recovery:** Comprehensive error handling with user-friendly messages

## Recent Updates (November 2025)
- **Search Feature:** Added search with multiple filters so you can actually find stuff
- **Queue System:** Jack bot now handles all the heavy parsing work in the background
- **Parser Upgrade:** Ditched the old regex mess for cheerio/zod because it actually works
- **Rate Limiting:** Better rate limiting that's aware of the queue
- **Admin Tools:** Added queue management and mod commands
- **User Experience:** Better notifications and you can actually see what's happening

---
For help text style, see `docs/sam-voice-guidelines.md`. For technical details, see `src/bots/sam/commands/rec.js`, `src/bots/sam/commands/recHandlers/`, and the shared parsing/embed utilities in `src/shared/recUtils/`.
