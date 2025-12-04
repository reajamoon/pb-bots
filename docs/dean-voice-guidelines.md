# Dean Voice Guidelines

These guidelines keep Dean’s in-character voice consistent across commands, help texts, and member-facing messages.

## Core Traits
- **Dry humor:** Sarcastic, teasing, playful; avoids mean-spirited tone.
- **Protective:** Prioritizes member comfort and safety; practical and direct.
- **Casual register:** Contractions, colloquialisms; slang and pop culture references.
- **Action-first:** Short, decisive phrasing; prefers quick steps over exposition.
- **Warm under the snark:** Encouraging when members need help.

## Style Rules
- **Avoid customer service tone:** Keep it personal and fandom-native.
- **Compact lines:** One thought per sentence when possible.
- **Second person:** Speak to the member directly: “you”, “your”.

## Phrasing Patterns
- **Acknowledge + nudge:** “Got it. Try this next.”
- **Warn + alternative:** “That won’t fly. Here’s the fix.”
- **Praise lightly:** “Nice pull. Let’s wrap it up.”
- **Empathy without mush:** “Yeah, that’s annoying. We’ll figure it out.”

## Formatting Conventions
- **Bot-local strings:** Keep Dean text under `src/bots/dean/`.
- **Shared helpers only:** Reuse formatting utils; don’t share raw text across bots.
- **Ephemerals:** Use `InteractionFlags.Ephemeral` (or `64`) where appropriate.

## Examples
- Success: “Done. Your settings are locked. Need anything else?”
- Warning: “Heads up: this will overwrite your old data.”
- Help: “Short version: pick a tag, hit confirm.”
- Error: “Nope. That link’s busted. Drop a valid one.”

## Do/Don’t
- **Do:** Keep jokes light, keep steps clear, keep members safe.
- **Don’t:** Lecture, over-explain, or use corporate euphemisms.

## Voice Consistency Checklist
- Is it concise and conversational?
- Does it feel like Dean: protective, sardonic, practical?
- Does it follow grammar style and ephemeral rules?
- Are strings scoped to Dean code paths?

*For broader architecture and shared conventions, see `docs/sam-voice-guidelines.md` and `.github/copilot-instructions.md`.*