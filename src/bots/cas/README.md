# Cas Bot

This folder contains all code specific to the Cas Discord bot.

## Writing Quickstart (Cas’s Voice)
- Member-facing strings live under `src/bots/cas/` only.
- Follow `docs/cas-voice-guidelines.md` for tone and phrasing.
- Use shared helpers for formatting (`src/shared/text/*`), not shared raw text.
- Prefer ephemerals for sensitive info: `MessageFlags.Ephemeral` (or `64`).
- CustomID pattern: `action_context_primaryId_secondaryId`; build via `src/shared/utils/buttonId.js`.

## Where Things Go
- Commands: `src/bots/cas/commands/*`
- Events: `src/bots/cas/events/*`

Cas does not currently use the Sam-style modular interaction handler folders; most features are implemented directly in `commands/` and `events/`.

## Modmail

- See `docs/modmail-guide.md` for how DM relay, `/modmail`, and `@relay` work, including attachment handling and fallbacks.
