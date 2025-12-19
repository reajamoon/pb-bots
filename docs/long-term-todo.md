# Sam Bot: Long-Term To-Do List

---

## Core Features
- [ ] Fic club features
- [x] Add regular backup/export for recommendations
- [x] Implement data migration scripts for schema changes
- [ ] Optimize database queries for large library
- [ ] Preempt case where library grows outsized
- [x] Color rec embed by rating/warnings

## User Experience
- [x] Unify `/rec update <id>` to use a single identifier field
- [x] **Search functionality** COMPLETED: Full search system implemented with multiple filters
- [ ] (Sprints/WC) Optional chat message parsing for logging
    - Opt-in per user (and/or per channel), off by default.
    - Strict patterns only (examples: `+200`, `-50`, `set 12345`, `wc +200`) to avoid accidental triggers.
    - Guardrails: only when a sprint is active or within late-log window; confirmation response; `allowedMentions: { parse: [] }`.
    - Defer until after current sprint/projects refactor is complete.
- [ ] Enhance help and onboarding (interactive guides)
- [ ] Add user profile pages (show contributions, stats)
- [ ] Allow users to favorite fics
- [ ] Add notification system for fic updates based on completion status or chapter count
- [ ] Birthday wishes with timezone fallback
    - Add logic to send birthday wishes to users based on their set timezone, with a fallback to the server time if user timezone is not set. Integrate with birthday notification and profile logic.

## Attachments & Permissions
- [ ] Enforce stricter author permission checks for uploads
- [ ] Add mod review queue for new attachments
- [ ] Add audit log for edits/removals
- [ ] Implement recommendation flag/report system
- [ ] Add support for author requests (removal, corrections)

## Logging & Monitoring
- [x] Integrate advanced logging (Winston)
- [x] Queue system implementation
- [ ] Add health checks and uptime monitoring

## Community & Moderation
- [/] add /modmail improvements
- [ ]

## DevOps
- [/] Add test coverage for all modules

## Deprecations
- [ ] Deprecate and remove `*_REGISTER_ON_BOOT` flags across bots
    - Rationale: Boot-time registration is brittle under PM2 restarts and causes REST churn and silent failures.
    - Keep: Direct registration scripts under `scripts/*/deploy-commands-direct.js`.
    - Steps: Remove env references once direct scripts are stable; verify command counts via logs.

## Privacy Modularization Implementation Details
- [ ] If privacy button bugs persist, plan to rebuild privacy buttons from scratch

---

*Last updated: November 29, 2025*
*Recent updates: Marked completed features from major implementation push*
