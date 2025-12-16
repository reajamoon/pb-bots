# Modmail Guide (Cas)

## Overview
Cas supports two ways to start and reply to modmail:
- DM Cas directly: opens/uses a Cas-owned thread in the configured modmail channel.
- Use `/modmail`: opens a new thread with your message (required) and optional attachments.

Attachments are forwarded in both directions. If Discord rejects a file upload (e.g., too large), Cas falls back to sending links so nothing is lost.

## Start Modmail
- `/modmail message:<text> [file1] [file2] [file3]`
  - Message is required to avoid contextless images.
  - Up to 3 attachments supported.
  - (futureproofing) In forum channels, Cas creates a thread with the message (and files if possible).
  - In text channels, Cas posts a base message (with files if possible) and starts a thread.
  - If file upload fails, Cas posts an embed containing attachment links.

## DM Cas
- Sending Cas a DM forwards it to the modmail thread.
- Images/files in DMs are forwarded to the thread.
- If the thread is owned by a different bot, Cas acknowledges the DM and does not post in that thread.
- Cas reacts with a ✅ in DM when received.

## Moderator Replies (@relay)
- In a Cas-owned modmail thread, use `@relay <message>` (or `/relay`) to DM the user.
- You may attach files to `@relay`. Text is optional when attachments are present.
- Cas sends files to the user; if upload fails, Cas falls back to links.
- Cas confirms delivery in-thread. If the user has DMs off, you’ll see an error reply.

## Commands Summary
- `@ticket` or `/ticket`: Show ticket details.
- `@relay <message>` or `/relay`: DM the user (attachments optional when included).
- `@close` or `/close`: Close the ticket; user messages will no longer be relayed to this thread.

## Fallbacks & Limits
- Large files: Discord may reject uploads; Cas posts attachment links instead.
- No-text submissions:
  - `/modmail` requires a message (with or without attachments).
  - `@relay` accepts attachment-only messages (no text required).
- Thread ownership: Cas only posts in Cas-owned threads; if another bot owns the thread, Cas acknowledges DMs but won’t post.

## Troubleshooting
- “Couldn’t DM the user; they may have DMs off.” → Ask user to enable DMs or follow up in-server.
- “I can’t create threads in this channel.” → Grant Cas thread permissions or ping a mod to assist.
- Images showing as links: File likely exceeded limits. Use smaller files or keep links.

## Notes
- Ensure `modmail_channel_id` is configured in the database.
- After updating commands, restart Cas and re-register commands. `pm2 restart ecosystem.cas.js`, `npm run register:cas:direct`
