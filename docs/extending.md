# Extending the Bot

This project is modular and designed for incremental feature additions.

## Commands
- Add new Sam commands by creating modules in `src/bots/sam/commands/`.
- Follow existing patterns in `src/bots/sam/handlers/` and `src/bots/sam/events/` for wiring.

## Features
- Add new profile fields or rec features by updating models and utility logic.
- Use standardized custom ID formats for buttons and navigation.
- All fic metadata parsing must go through the queue; do not bypass it.

## References
- See `docs/bot-architecture-overview.md` for structure.
- See `docs/NAMING_REFERENCE.md` for naming conventions.
