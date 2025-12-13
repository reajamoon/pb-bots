# Message Tracking Utility Documentation

## Overview
All Discord customId encoding, decoding, building, and parsing is handled by centralized utilities:
- `src/shared/utils/messageTracking.js` (primary)
- `src/shared/utils/buttonId.js` (for standardized button format)
Legacy `profileMessageTracker.js` is fully deprecated. All modules now use these utilities for profile, privacy, modal, button, and select menu interactions.

## Key Functions

### General
- `encodeMessageId(messageId)` / `decodeMessageId(encodedMessageId)`: Base64 encode/decode for safe customId inclusion.
- `buildButtonId({ action, context, primaryId, secondaryId })`: Standardized builder for all button customIds.
- `parseButtonId(customId)`: Robust parser for extracting action, context, primaryId, secondaryId.
- `buildModalCustomId(type, messageId)`, `buildSelectMenuCustomId(context, messageId)`, `buildInputCustomId(type, messageId)`: Centralized builders for Discord customIds.

### Profile-Specific
- `getProfileMessageId(interaction, customId)`: Robust extraction of profile card messageId from customId or interaction.
- `buildProfileButtonId(action, context, userId, messageId)`, `buildProfileSettingsCustomId(userId, messageId)`, `buildProfileSettingsDoneCustomId(userId, messageId)`: All use standardized format and encoding.
- `isTrackedProfileSettings(customId)`, `parseProfileSettingsCustomId(customId)`: Reliable tracking and parsing for profile settings.

### Privacy-Specific
- `buildPrivacySettingsCustomId(userId, messageId)`, `buildPrivacySettingsDoneCustomId(userId, messageId)`: Standardized format and encoding.
- `isTrackedPrivacySettings(customId)`, `parsePrivacySettingsCustomId(customId)`: Reliable tracking and parsing for privacy settings.

## Usage Patterns
- Always use the centralized utilities for building and parsing customIds for buttons, modals, and select menus.
- For profile and privacy interactions, use the standardized builders and parsers for robust message tracking and dual update logic.
- All handlers should import from `src/shared/utils/messageTracking.js` and `src/shared/utils/buttonId.js`.

## Best Practices & Common Pitfalls
- **Always propagate the original profile message ID (not ephemeral menu message ID) in all menu builders and button customIds.**
- When handling privacy/profile button interactions, extract and validate the original profile message ID, and use it for all menu and button construction.
- Never use the ephemeral menu message ID for encoding or propagation—this will break dual update and cause message tracking errors.
- Audit all handlers to ensure the correct message ID is passed through every menu and button builder.
- If dual update fails or targets the wrong message, check the propagation chain for message ID mixups.

## Migration Notes
- All legacy imports of `profileMessageTracker.js` have been removed.
- All routing for profile settings, privacy, done, and navigation buttons is now robust, modular, and uses standardized format.
- **Always validate and propagate the original profile message ID.**

## Example
```js
import { getProfileMessageId, buildModalCustomId } from '../../shared/utils/messageTracking.js';
import { buildButtonId } from '../../shared/utils/buttonId.js';
const messageId = getProfileMessageId(interaction, interaction.customId); // Must be original profile message ID
const modalCustomId = buildModalCustomId('bio', messageId);
const buttonCustomId = buildButtonId({ action: 'set_bio', context: 'profile_settings', primaryId: userId, secondaryId: messageId });
```

## Last Commit
- Unified message tracking and button ID utilities
- Refactored all imports and handlers
- All modules use standardized customId format
- Robust dual update logic and debug logging for customId parsing
