# Dean Bot

This folder contains all code specific to the Dean Discord bot.

## Writing Quickstart (Dean’s Voice)
- Member-facing strings live under `src/bots/dean/` only.
- Follow `docs/dean-voice-guidelines.md` for tone and phrasing.
- Use shared helpers for formatting (`src/shared/text/*`), not shared raw text.
- Prefer ephemerals for sensitive info: `InteractionFlags.Ephemeral` (or `64`).
- CustomID pattern: `action_context_primaryId_secondaryId`; build via `src/shared/text/buttonId.js`.

## Where Things Go
- Commands: `src/bots/dean/commands/*`
- Events: `src/bots/dean/events/*`
- Handlers: `src/bots/dean/handlers/{buttons,modals,selectMenus}`
