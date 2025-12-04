# PB Profile System – Documentation

## The Hunter Network (In-World Context)
So get this! The profile system isn’t just a bunch of settings—it’s the Hunter Network. That’s what I call it, and it’s how I keep everyone connected, safe, and in the loop. When you open up your profile, tweak your privacy, or check out birthdays, you’re using the same network I use to keep tabs on hunters and friends. It’s all in-world, all part of the PB community’s lore, and every feature is designed to feel like you’re part of something bigger than just a Discord server.

Whenever you see profile features, help menus, or privacy controls, I’m the one walking you through it. I keep things practical, direct, and a little sarcastic—like I’m showing a friend how to set up their gear before a hunt. All member-facing text uses my voice (Sam Winchester), so you’ll get dry wit and patience. If you’re ever stuck, just ask. I’ll explain it like we’re sitting at a diner booth or around a motel dinette.

The Hunter Network is modular, reliable, and always speaks in my voice. All documentation and features use "The Hunter Network" to keep things immersive and consistent with our lore. For help text style, see `docs/sam-voice-guidelines.md`.

## Overview
The Profound Bond Profile System lets members create, view, and customize their Discord profiles, manage privacy, and celebrate birthdays. All features are modular, reliable, and designed for a smooth community experience.

## Features
- View and edit your profile (bio, birthday, timezone, pronouns, region)
- Privacy controls: hide birthday, age, or profile
- Birthday notifications and daily lists
- Help and navigation system
- Sam Winchester’s voice for all member-facing text

## Architecture & Modularization
The profile system is fully modular, maintainable, and robust. All profile features, help pages, privacy controls, and navigation are split into dedicated modules and utilities. Centralized ID/message tracking and dual update logic keep things reliable and prevent recurring bugs (and headaches).

### Module Structure
 - **Core Command:**
	 - `src/commands/profile.js` – Main command handler and interaction flow
 - **Utility Modules:**
	 - `src/utils/profileCard.js` – Profile generation and user management
	 - `src/utils/birthdayFormatter.js` – Birthday display logic and privacy handling
	 - `src/utils/zodiacCalculator.js` – Western and Chinese zodiac calculations
	 - `src/utils/messageTracking.js` – CustomId/message tracking, encoding/decoding, dual update logic
	 - `src/utils/buttonId.js` – Standardized button customId builder/parser
	 - `src/utils/profileHelp.js` – Aggregator for help pages and navigation
	 - `src/utils/profileHelpBirthday.js`, `profileHelpBio.js`, `profileHelpPrivacy.js`, `profileHelpTips.js`, `profileHelpTimezoneRegion.js` – Modular help category pages
	 - `src/utils/profileHelpButtons.js` – Shared navigation button logic for help menus

### Module Responsibilities
- **profileCard.js:** User DB ops, profile embed generation, button creation, privacy logic
- **birthdayFormatter.js:** Birthday text formatting, age calculation, privacy respect
- **zodiacCalculator.js:** Zodiac sign/animal calculation, emoji integration
- **messageTracking.js & buttonId.js:** CustomId building/parsing, message tracking, dual update
- **profileHelp.js & Modular Help Pages:** Aggregates help categories, multi-page docs, navigation

## Button & ID Structure
All profile and privacy buttons use a unified custom ID format:
`[action]_[context]_[primaryId]_[secondaryId]`
- Message IDs are always base64-encoded for reliability and compactness.
- Centralized utilities (`messageTracking.js`, `buttonId.js`) handle building, parsing, encoding, and decoding.

### Best Practices
- Always propagate the original profile message ID (not ephemeral menu message ID) in all menu builders and button customIds.
- Extract and validate the original profile message ID for all button interactions.
- Never use the ephemeral menu message ID for encoding or propagation—this breaks dual update and message tracking.
- Audit all handlers to ensure the correct message ID is passed through every menu and button builder.
- If dual update fails or targets the wrong message, check the propagation chain for message ID mixups.

### Example
```js
// Building a customId for a privacy button:
const encodedMsgId = encodeMessageId(originalProfileMessageId); // base64
const customId = `privacy_settings_${userId}_${encodedMsgId}`;
// Extracting for dual update:
const { messageId: encodedMsgId } = parsePrivacySettingsCustomId(customId);
const rawMessageId = decodeMessageId(encodedMsgId);
// Use this for fetch/edit
```

### Migration Notes
- All new handlers and menu builders must use base64 encoding for customIds and decode before dual update.
- Legacy handlers used raw snowflakes; all new code must follow the encoding/decoding pattern.
- Always validate and propagate the original profile message ID.

### References
- See `src/utils/messageTracking.js` for all encoding/decoding utilities.
- See `docs/message-tracking-utility.md` for usage patterns and migration notes.

## Privacy & Help System
All privacy logic and help features are modularized for maintainability and future extensibility.
- Privacy settings, help menus, and navigation are split into dedicated modules (e.g., `privacySettingsHandler.js`, `privacyHelp.js`, `profileHelpBirthday.js`, etc.).
- Static help texts and menu descriptions are loaded from a centralized JSON file (`helpTexts.json`) for easy editing and consistency.
- Navigation and button logic is shared across profile and privacy menus using utilities like `profileHelpButtons.js`.

### Modularization Highlights
- Privacy and help logic moved out of shared/profile modules into dedicated files.
- All category help modules export a single function (e.g., `createBirthdayHelp(interaction)`).
- Navigation button row construction is centralized for consistency.
- All handler imports updated to use the new modular structure.
- Orphaned modules and legacy code removed.

### Directory Structure Example
```plaintext
src/utils/profileHelp/
  profileHelp.js
  profileHelpBirthday.js
  profileHelpBio.js
  profileHelpPrivacy.js
  profileHelpTips.js
  profileHelpTimezoneRegion.js
  profileHelpButtons.js
  helpTexts.json
```

### Best Practices
- Update all handler imports to use modular help and privacy logic.
- Keep static texts in the centralized data file for easy updates.
- Validate help menu navigation and static text loading after changes.

## Commands
- `/profile` – View and edit your profile
- `/profile help` – Get help and tips
- `/birthday-notifications` – Manage birthday alerts
- `/birthday-config` – Admin birthday settings

## File Structure
- `src/commands/profile.js` – Main command handler
- `src/handlers/buttons/profileButtons.js` – Profile button logic
- `src/handlers/modals/bioModal.js`, `birthdayModal.js`, etc. – Modal forms
- `src/utils/profileCard.js` – Profile embed generation
- `src/utils/messageTracking.js`, `buttonId.js` – ID and message tracking
- `src/utils/profileHelp.js` and category modules – Help system

## Best Practices
- Always use centralized utilities for custom ID and message tracking
- Validate and propagate original message IDs for dual updates
- Follow Sam’s voice guidelines for all member-facing text
- Modularize new features for maintainability

## Extending the System
- Add new profile fields by updating the model and embed logic
- Create new help pages as separate modules
- Use the standardized custom ID format for all new buttons and modals

---
For details on privacy logic, see the Privacy Modes section. For help text style, see `docs/sam-voice-guidelines.md`.
