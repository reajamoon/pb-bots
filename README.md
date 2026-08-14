# PB Bots (Profound Bond)

Heya! Welcome to the codebase for the Profound Bond Discord bots. If you are a PB member and you are here to peek behind the curtain, you are in the right place.

This repo runs four separate processes under PM2:
- Sam - the main community bot (the Bunker Library, profiles, birthdays, moderation utilities)
- Jack - background queue worker (fic metadata fetch + parsing)
- Dean - sprints + projects
- Cas - modmail relay and small utilities

If Sam starts acting weird, it is probably leviathans. or some aggressive rate limiting to be as nice to AO3's servers as we possibly can (read about that [here](./docs/)).

## Already Here?

- `/rec` for fic recs and the library
- `/profile` for profile stuff
- If something is on fire, you can DM Cas and he'll pass a message to mods for you.

## Not Here Yet?

Join us, give Crypto a cookie: https://discord.gg/profoundbond

## What This Project Is

Profound Bond is a community for adult fans of Destiel and Supernatural hosted on Discord. The three bots that serve the community are written by the developer and server owner crypto/reaja to be in-character (but consider them her fanon interpretations, so don't sweat the small stuff.)

## In-Jokes & Personality

Sam is snarky, helpful, and a giant nerd about organization. If he recs Tor Valen for the hundredth time, just let him cook.
Dean is the server's sprint master and also welcomes new members to the fold. Why did Crypto give him a whistle again?
Cas is happy to give a hug when a member needs it and is always listening for member prayers (modmail), but don't cross him he's still a stone cold badass and has been known to smite trolls.

If you are considering contributing and want to submit any member-facing text, please follow the voice guides, I've tried to explain some of my characterization for the boys and how to keep it consistent:
- `docs/sam-voice-guidelines.md`
- `docs/dean-voice-guidelines.md`
- `docs/cas-voice-guidelines.md`

## Architecture (Short Version)

- Node.js + discord.js v14
- Sequelize ORM
- Development DB - SQLite fallback at `./database/bot.sqlite`
- Production DB - Postgres via `DATABASE_URL`
- Fic metadata fetches are queued - Sam enqueues, Jack processes, and Sam notifies via a poller

For a deeper overview, start with `docs/bot-architecture-overview.md`.

## Run The Bots (Contributor Stuff)

This repo intentionally disables `npm start` and `npm run dev`.

### Start all bots

```bash
npm run deploy:all
```

Or:

```bash
./start-bots.sh
```

### Start an individual bot

```bash
npm run deploy:sam
npm run deploy:jack
npm run deploy:dean
npm run deploy:cas
```

See `docs/deployment.md` for operational details.

## Repo Layout

- `src/bots/` - bot entrypoints and bot-specific code
- `src/shared/` - shared utilities (logging, message tracking, rec parsing utilities)
- `src/models/` - Sequelize models + association setup
- `migrations/` - database migrations
- `scripts/` - maintenance scripts and slash command deploy/clear utilities
- `docs/` - technical documentation and project notes
- `tests/` - Jest tests

## Documentation Index

- `docs/profile-system.md`
- `docs/rec-system.md`
- `docs/fic-metadata-queue.md`
- `docs/message-tracking-utility.md`
- `docs/sprint-and-projects-guide.md`
- `docs/security.md`
- `docs/extending.md`
- `docs/modmail-guide.md`
- `CHANGELOG.md`

## Bot Readmes

- Sam: `src/bots/sam/README.md`
- Jack: `src/bots/jack/README.md`
- Dean: `src/bots/dean/README.md`
- Cas: `src/bots/cas/README.md`

## Project Status

This is primarily a single-developer project. If you want to tackle a small task, start with the bot README for the area you are touching, then skim the related docs in `docs/`.
