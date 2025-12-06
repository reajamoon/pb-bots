# Dean Bot Commands: Sprint & Project

This guide shows how to use sprints and projects day-to-day, with quick flows and tips to keep things smooth.

## Sprint
- `/sprint start minutes:<int> label:<string?>` — Start a solo sprint in the current channel.
- `/sprint host minutes:<int> label:<string?>` — Host a team sprint; generates a short join code.
- `/sprint join code:<string?>` — Join the active team sprint (or a specific host by code).
- `/sprint end` — End your active sprint (hosts end the team sprint for everyone).
- `/sprint status` — Show remaining time and participants (team) or solo status.
- `/sprint leave` — Leave your current team sprint (participants only).
- `/sprint list` — List active sprints in this channel.
- `/sprint setchannel channel:<#channel> allow_threads:<bool?>` — Mods/Admins: set the default sprint channel.

### Quick Start

- Start a solo sprint: `/sprint start minutes:25`
- Host a team sprint: `/sprint host minutes:25` (share the code)
- Join a team: `/sprint join` (or pass a `code`)
- Track words: `/sprint wc add new-words:250` (repeat as you write)
- See totals: `/sprint wc summary`
- End your sprint: `/sprint end`

### Wordcount
- `/sprint wc set count:<int>` — Set your current wordcount.
- `/sprint wc add new-words:<int>` — Add words to your current wordcount.
- `/sprint wc show` — Show your wordcount for the active sprint.
- `/sprint wc summary` — Show totals for the sprint (team or solo).
- `/sprint wc undo` — Undo your last wordcount entry.

### Project link
- `/sprint project use project_id:<uuid>` — Link your active sprint to a project you’re on.
	- Need to create or manage the project? Use `/project` commands below.

## Project
All project management is under `/project`.

- `/project create name:<string>` — Create a project; you’re owner.
- `/project info name:<string?>` — Show details for a project (owner, members, active sprint/channel, created, ID). Defaults to your most recent project if no name.
- `/project list` — List projects you’re a member of.
- `/project invite member:<@user>` — Invite a user to your active sprint-linked project. Owner or mod only.
- `/project remove member:<@user> confirm:<bool>` — Remove a member. Owner or mod only. Prompts ephemeral unless confirmed.
- `/project transfer member:<@user> confirm:<bool>` — Transfer project ownership. Owner only. Ephemeral prompt unless confirmed. (If not implemented yet, leave as planned.)
- `/project leave confirm:<bool>` — Leave the project. Owners must transfer first. Ephemeral prompt unless confirmed.
- `/project use project_id:<uuid>` — Link your active sprint to a project you’re on.
- `/project members` — List members for your current sprint-linked project.
	- Tip: After linking with `/project use`, summaries will show the project name.
## Project Wordcount Outside Sprints
Sometimes you write outside a sprint - in a cafe, on the bus, wherever. You can still keep your project total accurate:

- `/project wc add new-words:<number> [project_id:<id>]`: Adds words directly to a project without a sprint. If you’ve linked a sprint to a project with `/sprint project use`, you can omit `project_id`.
- `/project wc set count:<number> [project_id:<id>]`: Sets your current count for the project. The bot records the positive difference as new words.
- `/project wc show [project_id:<id>]`: Shows your personal total on that project.
Totals in `/project info` include everything - sprint logs and manual adds/sets - across all project members.
## Tips
- Use `/project` for management, `/sprint` for sprinting.
- Wrong-channel warnings are ephemeral to avoid noise.
- Sensitive actions (remove/transfer/leave) ask for `confirm:true` and reply ephemerally until confirmed.
- Totals clamp negatives; project names appear in summaries when linked.
- Keep sprints to the designated channel
