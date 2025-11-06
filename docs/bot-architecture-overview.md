# Sam Bot Architecture Overview

## 1. Project Structure
```
root/
  src/
    commands/         # Slash and message command handlers (profile, rec, etc.)
    events/           # Discord event handlers (ready, interactionCreate, etc.)
    handlers/
      buttons/        # Modular button handlers (profile, privacy, navigation, etc.)
      modals/         # Modular modal handlers (bio, birthday, region, etc.)
      selectMenus/    # Modular select menu handlers
    models/           # Sequelize models (User, Guild, Recommendation, etc.)
    utils/            # Centralized utilities (messageTracking, buttonId, logging, etc.)
  config/             # Configuration files
  database/           # Migrations and seeders
  docs/               # Documentation
```

## 2. Modular Handler & Utility Design
- **Handlers:** Each feature (profile, privacy, rec, etc.) has dedicated button, modal, and select menu handlers. Event handlers route all Discord interactions to the correct modular handler.
- **Utilities:** All customId building, parsing, encoding, and decoding are centralized in `messageTracking.js` and `buttonId.js`. Utilities handle message tracking, ID propagation, and dual update logic for all menus and buttons.
- **Naming Scheme:** All customIds use the format `[action]_[context]_[primaryId]_[secondaryId]` (see `buttonId.js`). Message IDs are encoded (base64) for compactness and reliability.
- **Redundancy Prevention:** All modules use shared utilities for ID building and parsing, eliminating duplicate code and reducing recurring bugs.

## 3. Centralized ID & Message Tracking
- **messageTracking.js:**
  - Encodes/decodes message IDs for safe customId inclusion
  - Builds and parses customIds for profile, privacy, modal, and select menu interactions
  - Ensures all buttons/menus propagate the original messageId for dual updates
- **buttonId.js:**
  - Standardized builder and parser for all button customIds
  - Enforces length limits and hashes IDs if needed
- **Best Practice:** Always use these utilities for any customId logic. Never build or parse IDs manually.

## 4. Unified Button System
- All buttons (profile, privacy, rec, navigation) use the standardized customId format and centralized builders/parsers
- Security and permission checks use parsed IDs for reliability
- Dual update logic is available for all button types where relevant
- Error handling and logging are standardized via the logging utility

## 5. Database Integration
- **Sequelize ORM:** Models for User, Guild, Recommendation, etc.
- **Migrations:** All schema changes managed via migration files
- **Seeders:** Initial data population for development/testing

## 6. Configuration & Deployment
- **Config files:** Environment variables and bot settings in `/config`
- **PM2:** Process manager for production deployment
- **Database:** SQLite for development, PostgreSQL for production

## 7. Extensibility & Maintainability
- **Modularization:** All features are split into dedicated handlers and utilities
- **Centralized tracking:** All message, user, and context tracking is handled by utilities, preventing duplication and errors
- **Clear separation:** UI logic (menus, buttons, modals) is separated from business logic and database operations
- **Documentation:** All architectural decisions, migration steps, and utility APIs are documented in `/docs`

## 8. Best Practices
- Always use centralized utilities for customId and message tracking
- Add new features by creating dedicated handler and utility files
- Keep UI logic (Discord components) separate from business/database logic
- Use migrations for all database schema changes
- Document new architecture decisions and utility APIs

---

## Privacy Button Handler Cleanup (2025-11-05)

All privacy button handlers (`togglePrivacyModeFull.js`, `togglePrivacyModeAgeHidden.js`) have been cleaned up and unified:
- Patch artifacts and excess logging removed
- Reliable privacy setting toggling even if dual-update fails
- Warning embed added when dual-update is bypassed
- Unified customId format and centralized parsing utilities used throughout
- Error handling and logging standardized

All documentation and changelogs have been updated. The codebase is ready for further privacy features and morning review.

---

This overview reflects the current bot architecture and should guide future development. For details on utilities, ID schemes, and migration steps, see the documentation in `/docs`.
