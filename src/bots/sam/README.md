# Sam Bot

This folder contains all code specific to the Sam Discord bot.

## Writing Quickstart (Sam’s Voice)
- Member-facing strings live under `src/bots/sam/` only.
- Follow `docs/sam-voice-guidelines.md` for tone and phrasing.
- Use shared helpers for formatting (`src/shared/text/*`), not shared raw text.
- Prefer ephemerals for sensitive info: `MessageFlags.Ephemeral` (or `64`).
- CustomID pattern: `action_context_primaryId_secondaryId`; build via `src/shared/text/buttonId.js`.

## Where Things Go
- Commands: `src/bots/sam/commands/*`
- Events: `src/bots/sam/events/*`
- Handlers: `src/bots/sam/handlers/{buttons,modals,selectMenus}`
