# Multi-Bot Migration Todo List – COMPLETED ✅

**Status: COMPLETED** as of November 2025

This document tracked the step-by-step migration of the Sam bot codebase to support a unified multi-bot workspace. The migration is now **fully complete**.

## ✅ Migration Completed Successfully

### Final Architecture
- **Sam Bot:** `src/bots/sam/` - Discord interface and user interactions
- **Jack Bot:** `src/bots/jack/` - Queue worker for background processing  
- **Shared Code:** `src/shared/` - Common utilities and functions
- **Models:** `src/models/` - Database models shared across bots
- **Deployment:** Separate PM2 configs for each bot

### Current Status
- **Sam:** Fully operational with all commands and features
- **Jack:** Operational queue worker handling all metadata parsing
- **Dean & Cas:** Placeholder structure ready for future development
- **Configuration:** PM2 ecosystem configs working for both active bots
- **Deployment:** `./start-bots.sh` script starts both Sam and Jack

## Original Migration Checklist (All Complete)

---

## 1. Plan and Prepare

- [X] Define new folder structure for multi-bot support
- [X] Identify all bot-specific and shared code
- [X] Backup current codebase

## 2. Create New Folder Structure

- [x] Create `src/bots/sam/` for Sam-specific code
- [x] Create `src/bots/dean/` for Dean-specific code
- [x] Create `src/bots/cas/` for Cas-specific code
- [x] Create `src/bots/jack/` for Jack (queue worker) specific code (formerly queueWorker.js)
- [x] Create `src/shared/` for shared utilities, models, and helpers

## 3. Migrate Sam's Code

- [x] Move `src/commands` to `src/bots/sam/commands`
- [x] Move `src/events` to `src/bots/sam/events`
- [x] Move Sam's entry point (main bot file) to `src/bots/sam/`
- [x] Update all imports in Sam's code to reflect new paths
- [x] Test Sam bot after each move

## 4. Migrate and Refactor Shared Code

- [x] Move shared utilities to `src/shared/`
- [x] Move shared models to `src/shared/`
- [x] Update imports in all bots to use shared code
- [x] Test Sam bot for shared code integration

## 5. Prepare for Dean and Cas

- [x] Scaffold `src/bots/dean/` and `src/bots/cas/` with placeholder files
- [x] Set up entry points for Dean and Cas
- [x] Ensure shared code is accessible to all bots

## 6. Update Configuration and Scripts

- [x] Update configuration files for multi-bot support
- [x] Update PM2 ecosystem config for multiple bots
- [x] Update deployment scripts as needed

## 7. Final Testing and Cleanup

- [x] Run full test suite for Sam
- [x] Verify no broken imports or runtime errors
- [x] Document new structure and migration process

---

### Notes

- Commit after each major step for easy rollback
- Use global search/replace to update imports
- Test frequently to catch issues early

---

This checklist will be updated as the migration progresses.
