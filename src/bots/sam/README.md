# SamBot (PB’s Fic Librarian, Tor Valen Stan, Probably Possessed)

Sam is one of PB's community-facing bots. In-universe, he is basically Sam Winchester trapped in Discord and put in charge of the Bunker Library.

If he gets a little too excited about stats or alphabetization, no he didn’t.

## What Sam Does (In Plain English)

- Fic recs - `/rec` is the library: add, update, search, random, stats, queue utilities
- Profiles - `/profile` for bio, birthday, timezone, pronouns, region, privacy
- Birthday notifications and daily lists
- Help menus - `/profile help` and `/rec help`
- Moderation tools - validation and queue administration

All fic metadata fetching goes through the queue system. Sam enqueues jobs and runs a poller to notify users; Jack processes the jobs.

## Writing Quickstart (Sam’s Voice)

If you are touching member-facing text, match Sam’s voice.

- First-person, conversational, practical. Avoid corporate bot vibes.
- Dry wit is fine. Long speeches are not.
- Use plain words for tech: library, shelves, archives.
- Follow `docs/sam-voice-guidelines.md`.

Implementation notes:
- Member-facing strings live under `src/bots/sam/` only.
- Use shared helpers for formatting (`src/shared/text/*` and `src/shared/recUtils/*`), not shared raw text.
- Prefer ephemerals for sensitive info: `MessageFlags.Ephemeral` (or `64`).
- CustomID pattern: `action_context_primaryId_secondaryId`; build via `src/shared/utils/buttonId.js`.

## Where Things Go

- Commands: `src/bots/sam/commands/*`
- Events: `src/bots/sam/events/*`
- Handlers: `src/bots/sam/handlers/{buttons,modals,selectMenus}`

## Running Sam

- Entrypoint: `src/bots/sam/sam.js`
- PM2: `pm2 start ecosystem.sam.config.cjs --env production`
- Required env: `SAM_BOT_TOKEN`
- Optional env (for command registration scripts): `SAM_CLIENT_ID`, `SAM_GUILD_ID`
- Optional env: `SAM_REGISTER_ON_BOOT=true` to register slash commands after login

## Related Docs

- `docs/rec-system.md`
- `docs/profile-system.md`
- `docs/fic-metadata-queue.md`
- `docs/message-tracking-utility.md`
- `docs/sam-voice-guidelines.md`
