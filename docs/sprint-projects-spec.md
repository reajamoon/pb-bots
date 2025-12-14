# Projects + Sprints Spec (Draft v1)

Status: Draft

## Why this exists
Projects and Sprints currently work, but their underlying math rules are inconsistent (especially around corrections and time windows). This doc defines the data semantics and calculations first, so implementation can be refactored without ambiguity.

## Decisions already made
- **Project total = current net words on project** (not “words written only”).
- **Project linking is per participant** (especially for team sprints).
- **Timezone for day/week windows**: user timezone if set, else server (guild) timezone, else UTC.

Deployment note:
- This workspace is for a single server. When this doc says “guild”, it refers to that one server.

Scope note:
- These decisions apply to **writing projects** (wordcount-based). Other project types may exist and can integrate with sprints via **time tracking**.

## Goals
- Make sprint logging reliable and low-friction.
- Make project totals mathematically correct and stable over time.
- Ensure every displayed number has an unambiguous definition.

## Non-goals (v1)
- No milestones/deadlines, reminders, AO3 integration, tags/search, progress charts.

## Reliability requirements

### Guard rails for concurrent sprints (prevent collisions)
Members may run multiple sprints concurrently (example: a long sprint running while doing short burst sprints inside it). The system must support this without getting confused about which sprint is being referenced.

Requirements:
- The bot must never “guess wrong” and end, notify, or log against the wrong sprint.
- Any action that targets a sprint must resolve to exactly one sprint participation row.

Disambiguation rules:
- If the user has exactly one active relevant sprint participation, commands may default to it.
- If the user has multiple active relevant sprint participations, the bot must always force explicit selection (no implicit defaulting).

Disambiguation methods:
- Require disambiguation by:
  - sprint hunt code (team), and/or
  - sprint label/note, and/or
  - an explicit internal ID, and/or
  - an interactive picker list.

Picker ordering rule:
- When presenting a picker list, group by sprint type (team first, then solo).
- Within each group, sort by soonest ending first.

Picker contents for logging:
- When the user is selecting a sprint for logging actions, include active sprints and recently ended sprints.
- Recently ended items must be clearly labeled as ended (with end time) to reduce accidental selection.
- Default “recently ended” window: last 15 minutes.
- This window should be configurable per user.
- Hard maximum for this setting: 6 hours.
- Late logging rule: within the “recently ended” window, users may still log to that sprint and it should update the sprint’s totals.

Late logging messaging:
- If late logging changes totals after an end summary was posted, the bot should edit the original end summary message when possible.
- If the end summary includes a leaderboard/placements, late logging within the allowed window may change placements; the edited end summary must reflect the recalculated ranking.
- If editing is not possible (missing message reference/perms), do not post a new message automatically; totals remain correct in history/views.

Sprint end ping rule:
- The sprint end message is the only sprint-related message allowed to ping users.
- At sprint end, ping all participants in that sprint (solo: the sprinter; team: all participants).
- If the sprint is wordcount-capable (mode `words` or `mixed`), the end message must remind participants of the late logging window to enter their words.
- If the sprint is time-only (no wordcounts), do not include a “log your words” reminder.

End-of-sprint message templates

General rules:
- These templates are structural. Exact wording can vary, but the sections and rules must hold.
- The ping line is only allowed in end messages.
- The end message must be edited (not replaced) when late logging changes totals and the bot can still edit.

Template: `mode=words`
```text
{PING_ALL_PARTICIPANTS}

Sprint's over: {SPRINT_IDENTIFIER}
Duration: {DURATION_MINUTES}m

Leaderboard (words)
1) {NAME} - NET {NET_WORDS} (minutes {MINUTES})
2) {NAME} - NET {NET_WORDS} (minutes {MINUTES})
...

Also participated (time)
{NAME} - minutes {MINUTES}
{NAME} - minutes {MINUTES}

Log your words: You can still drop your numbers during your late logging window with `/wc` (default 15 minutes; your setting may differ; hard max 6 hours).
Note: This summary might update if late logs roll in.
```

Template: `mode=mixed`
```text
{PING_ALL_PARTICIPANTS}

Sprint's over: {SPRINT_IDENTIFIER}
Duration: {DURATION_MINUTES}m

Participants (host first, then join order)
{NAME} - minutes {MINUTES} - words NET {NET_WORDS} (only if logged)
{NAME} - minutes {MINUTES}
...

Log your words: You can still drop your numbers during your late logging window with `/wc` (default 15 minutes; your setting may differ; hard max 6 hours).
Note: This summary might update if late logs roll in.
```

Template: `mode=time`
```text
{PING_ALL_PARTICIPANTS}

Sprint's over: {SPRINT_IDENTIFIER}
Duration: {DURATION_MINUTES}m

Participants (host first, then join order)
{NAME} - minutes {MINUTES}
{NAME} - minutes {MINUTES}
...
```

Messaging support:
- All midpoint/check-in/end messages must include the sprint identifier so humans can tell which sprint fired.

Mid-sprint messages (no pings)

Rules:
- No pings. No role mentions. No user mentions.
- Keep it short. One screen max.
- Always include `{SPRINT_IDENTIFIER}`.

Template: midpoint/check-in (`mode=words`)
```text
Check-in: {SPRINT_IDENTIFIER}
Time left: {TIME_LEFT_MINUTES}m

Logged so far
{NAME} - NET {NET_WORDS_SO_FAR}
{NAME} - NET {NET_WORDS_SO_FAR}
...

If you haven't logged yet, chill. Drop it with `/wc` when you're ready.
```

Template: midpoint/check-in (`mode=mixed`)
```text
Check-in: {SPRINT_IDENTIFIER}
Time left: {TIME_LEFT_MINUTES}m

So far (host first, then join order)
{NAME} - minutes {MINUTES_SO_FAR} - words NET {NET_WORDS_SO_FAR} (only if logged)
{NAME} - minutes {MINUTES_SO_FAR}
...

No pressure. Log words with `/wc` if you feel like it.
```

Template: midpoint/check-in (`mode=time`)
```text
Check-in: {SPRINT_IDENTIFIER}
Time left: {TIME_LEFT_MINUTES}m

So far (host first, then join order)
{NAME} - minutes {MINUTES_SO_FAR}
{NAME} - minutes {MINUTES_SO_FAR}
...

Keep it rolling.
```

Template: status (on-demand)

Rules:
- This is for a member asking "what sprint am I in / how much time is left".
- Still no pings.
- Must include `{SPRINT_IDENTIFIER}`.

Status template (`mode=words`)
```text
Status: {SPRINT_IDENTIFIER}
Time left: {TIME_LEFT_MINUTES}m

You: NET {YOUR_NET_WORDS_SO_FAR} (minutes {YOUR_MINUTES_SO_FAR})

Log with `/wc` whenever. You've got this.
```

Status template (`mode=mixed`)
```text
Status: {SPRINT_IDENTIFIER}
Time left: {TIME_LEFT_MINUTES}m

You: minutes {YOUR_MINUTES_SO_FAR}{OPTIONAL_WORDS_FRAGMENT}
{OPTIONAL_WORDS_FRAGMENT} = " - words NET {YOUR_NET_WORDS_SO_FAR}" (only if logged)
```

Status template (`mode=time`)
```text
Status: {SPRINT_IDENTIFIER}
Time left: {TIME_LEFT_MINUTES}m

You: minutes {YOUR_MINUTES_SO_FAR}
```

Sprint lifecycle confirmations (no pings)

Rules:
- No pings. No mentions.
- Always include `{SPRINT_IDENTIFIER}`.
- Confirmations should be public by default unless the interaction is a picker/confirm UI (handled elsewhere).

Template: join (team)
```text
You're in: {SPRINT_IDENTIFIER}
Timer: {DURATION_MINUTES}m

Optional: set a baseline now so `/wc set` can do the math for you. Or don't. I'm not your dad.
```

Template: join (team, `mode=words`, track=time)
```text
You're in (time track): {SPRINT_IDENTIFIER}
Timer: {DURATION_MINUTES}m

You're here for vibes and minutes. If you end up logging words, I'll count you in the leaderboard too.
```

Template: leave (team)
```text
Got it. You're out: {SPRINT_IDENTIFIER}
Catch you next round.
```

Template: extend (host)
```text
Extended: {SPRINT_IDENTIFIER}
New end time: {NEW_END_TIME_RELATIVE}

Alright, we ride longer.
```

Template: cancel/end early (host)
```text
Ended early: {SPRINT_IDENTIFIER}

Nice work. If you logged words, the end summary will show up when I wrap it.
```

### Idempotent end behavior
- Sprint end processing (status changes + end notification) must be safe to run more than once without double-posting or corrupting state.
- Team sprint end should be coordinated by the host only, but must not depend on in-memory timers surviving restarts.
- Team sprint participants (non-host) may leave the sprint, but must not be able to end the sprint for everyone.

---

## What people are doing (workflows)

This section defines the feature from the user’s perspective first. Commands/UX are just one way to support these actions.

### Workflow 1: Do a focused writing burst (solo)
Intent:
- Start a timer.
- Track how much you got done during that window.

Key behaviors:
- Sprint progress starts at 0.
- Optionally set a starting baseline so the bot can show “started at X / ended at Y.”
- Optionally set a short label or note so you can tell later what the sprint was for.

Critical UX requirement from user feedback:
- People often only know their **absolute document total** (example: “I’m at 31,000 now”), not “words written this sprint.”
- The system must support: set a starting wordcount, later provide a new absolute wordcount, and have the bot compute “words written during the sprint” correctly.

Proactive behavior:
- When a sprint starts and the participant has not set a baseline explicitly, Dean should proactively prompt to set one before the sprint is underway.
- The prompt must allow a fast “skip” so baseline remains 0.

### Workflow 2: Sprint together (team)
Intent:
- One person hosts a timer.
- Others join.
- Everyone logs progress independently.

Key behaviors:
- Each participant’s progress is independent and 0-based.
- Each participant can set their own baseline.
- Each participant can optionally set their own label or note.

Proactive behavior:
- When a participant joins a team sprint, Dean should proactively prompt them to set a baseline (or skip).

### Workflow 3: Attribute sprint work to a project
Intent:
- While sprinting, treat your work as contributing to a specific project (or sometimes no project).

Key behaviors:
- Project attribution is per participant (especially in team sprints).
- Project attribution is ultimately stored on entries; any “linked project” is just a default.

Applies to:
- Writing projects.

Critical UX requirement from user feedback:
- If sprint work is attributed to a project, users should be able to use the project’s current total as the sprint baseline.
- When a user reports an absolute new total (31,000) after starting at 30,000, the sprint should show “+1,000” and the project net should become 31,000 (not 61,000).

### Workflow 4: Log project progress outside of sprints
Intent:
- You wrote, but not in a sprint.
- You still want project totals to stay accurate.

Key behaviors:
- Logging outside a sprint creates entries attached to the project (no sprint).

Applies to:
- Writing projects.

Note:
- Other project types (cleaning, craft, work) can still be “projects,” and people often use productivity sprints for these.
- In v1, non-writing projects are supported by rolling up **time spent in sprints** (not wordcounts).

### Workflow 5: Correct numbers without breaking totals
Intent:
- Fix an incorrect total (fat-finger, wrong starting point, etc.).

Key behaviors:
- Corrections can be negative or positive.
- Project net totals and sprint net totals must reflect corrections (no clamping).

### Workflow 6: Check “how am I doing recently”
Intent:
- View today’s change and rolling 7-day change.

Key behaviors:
- Time windows use user timezone if set; else server (guild) timezone; else UTC.

### Workflow 7: Use sprints for non-writing productivity
Intent:
- Use a sprint as a timer for cleaning/crafts/work.
- Track progress by total time spent (solo or team).

Key behaviors:
- Sprints always track time.
- If a sprint (participant) is attributed to a time-tracked project, the participant’s sprint time contributes to that project’s time total.

### Workflow 8: Sprint without a project (persistent personal stats)
Intent:
- Use a sprint as a personal timer and/or wordcount tracker without tying it to any project.
- Still be able to view sprint stats later (so the sprint doesn’t “disappear”).

Key behaviors:
- Sprints and their entries must persist after ending.
- Wordcount entries for a sprint must be linked to the sprint participation row even when `projectId` is null.
- Time spent in a sprint must be attributable to the sprint participation row even when `projectId` is null.
- These sprint-only stats should be queryable for personal summaries (example: “words sprinted all-time,” “minutes sprinted in last 7 days,” recent sprint history).

---

## Domain model

Scope note (member usage):
- Sprints are created and run in a specific guild/channel context.
- Projects are user-owned and can be referenced wherever the bot supports projects; when displaying rolling windows inside a guild, use the normal timezone fallback chain.
- In DMs (no guild context), timezone fallback is: user timezone if set, else UTC.

### Project
A personal-first container for tracking what someone is working on.

Key properties:
- A project is usually owned by one person.
- A project can optionally include buddies (cowriters, beta readers, accountability partners).
- Buddies have **project roles** (not Discord roles) that describe how they participate.

Project types:
- Writing projects are the primary focus for v1 wordcount + sprint integration.
- Other project types may exist (cleaning, crafts, work) and are supported in v1 as **time-tracked projects**.

Writing project requirement:
- A writing project has a **total wordcount** (net) and supports attribution from sprints and non-sprint logging.

Time-tracked project requirement:
- A time-tracked project has a **total time** (minutes) and supports attribution from sprints.

#### Buddy roles (project roles)
Pre-defined roles for buddies on a project:
- `co-writer`
- `alpha reader`
- `beta reader`
- `cheerleader`
- `buddy`

Role title alias (display only):
- Any buddy entry (regardless of role) may optionally define a short `roleTitleAlias` used for display in project views.
- If set, display the alias instead of the raw role name (example: role `buddy` with alias `accountability partner`).
- This is display only; permissions and defaults continue to be based on the underlying role.

Each buddy has a boolean setting:
- `includeWordcountInProjectTotal`

For time-tracked projects (or time totals on mixed projects), there is an analogous setting:
- `includeTimeInProjectTotal`

Defaults:
- `co-writer`: `includeWordcountInProjectTotal = true`
- all other roles: `includeWordcountInProjectTotal = false`

Default suggestion for time totals:
- `co-writer`: `includeTimeInProjectTotal = true`
- all other roles: `includeTimeInProjectTotal = false`

Role change behavior:
- If a buddy’s project role is changed, auto-set inclusion toggles to the defaults for the new role only for metrics that the project actually uses.
  - Writing projects: apply to `includeWordcountInProjectTotal`.
  - Time-tracked projects (or projects tracking time totals): apply to `includeTimeInProjectTotal`.
- The bot must notify that this auto-change happened so both the buddy and the project owner can adjust the toggles if needed.

Rule:
- Permission model (shared control):
  - The project owner can edit inclusion toggles for any buddy on the project.
  - Each buddy can edit their own inclusion toggle for that project.

Logging and visibility rules:
- Buddies may always log entries linked to the project (during sprints or outside sprints).
- A buddy’s **personal stats** for that project include their own entries regardless of inclusion.
- The project’s displayed **total** includes only entries from contributors whose `includeWordcountInProjectTotal` is enabled.

For time-tracked projects:
- Buddies may participate in sprints attributed to the project regardless of inclusion.
- The project’s displayed time totals use the `includeTimeInProjectTotal` toggle.

### Sprint
A timed session.
- **Solo sprint**: one participant.
- **Team sprint**: multiple participants, each with their own participation row.

Sprints are metric-agnostic:
- Wordcount tracking is enabled by default (writing-oriented).
- Time tracking is always available (productivity-oriented).

Time-only sprint option:
- A sprint may be explicitly started as time-only (wordcount logging is not expected, but is still allowed).
- Time-only sprints:
  - should not ask for or display baselines,
  - should not include a “log your words” reminder at the end.
  - should keep default displays time-focused (minutes) even if some participants choose to log words.

Mixed sprint option:
- A sprint may be explicitly started as mixed (time + optional wordcounts).
- Mixed sprints:
  - should show minutes for all participants,
  - should show word totals only for participants who logged words,
  - should include a “log your words” reminder at the end (late logging window applies),
  - should always use a non-ranked participant list (no placements), even if everyone logs words.

Optional labeling/notes (to match how members remember what a sprint was for):
- Each sprint participation row may have a short `label` and/or longer `notes`.
- These are used for display in lists and summaries; they do not affect any totals.

Message consistency requirements (member UX):
- Any sprint-related message that could be seen out of context (start, midpoint/check-in, end, history entries) must include:
  - the sprinter name (solo), or the sprinter names (team), and
  - a sprint identifier.
- Sprint identifier rules:
  - Team sprint: include the hunt code (example: `GHOUL`) and optionally the sprint title/label.
  - Solo sprint: include the sprint label/note when present; otherwise include enough context to avoid confusion (for example, start time).
- Label display should be consistent across messages: if a label exists, show it everywhere sprint identity is shown.
- Pings:
  - Default: do not ping users (use display names in plain text or disable allowed mentions).
  - Exception: the sprint end message may ping sprint participants (see “Sprint end ping rule”).

Time participation semantics:
- Each participant has one or more participation intervals (to support leave + rejoin).
- Participant minutes are the sum of elapsed minutes across all of their intervals (clamped to be non-negative per interval).
- For team sprints, joiners accrue time starting at their own **join moment** (not the host’s start time), until end/leave.

Per-participant word tracking (team sprints):
- In a team sprint, each participant may choose whether they are tracking words for this sprint.
- This is a per-participant preference inside the team sprint; it does not change the sprint’s mode.
- Joiners who are not tracking words:
  - are still sprint participants,
  - are still pinged at sprint end,
  - appear in end summaries without a wordcount shown.

#### Sprint wordcount baseline (important)
Sprint progress is always **0-based**.

- A sprint starts with the participant’s sprint wordcount assumed to be **0**.
- When starting a sprint, the starter may optionally provide a **starting wordcount baseline** (an absolute number from their document/app). The sprint baseline is then calculated by the default **0** from this starting wc baseline. i.e. Baseline 3000, 0, +30 during sprint, 30 words sprinted, ending total new baseline 3030. 
- In a team sprint, that baseline applies to the **host’s** participation row only (each participant can set their own baseline separately).
- The baseline does **not** change sprint progress math; it only affects display of absolute start/end.

Absolute-total reporting support:
- If a participant provides an absolute wordcount `A` (example: “I’m at 31,000 now”), the system must convert it into sprint progress via the baseline:
  - $SprintProgress = A - B$
  - Then adjust sprint net to match `SprintProgress`.
- This prevents the common confusion where “set” accidentally counts the entire absolute total as sprint-written.

Proactive baseline prompt requirement:
- On sprint start (solo) and sprint host (team host), Dean prompts the starter to set a baseline if it was not provided.
- On team join, Dean prompts the joiner to set a baseline if it is not set and they joined as `track=words`.
- The prompt should mention the consequence plainly: baseline lets you report a new absolute total later and get an accurate “words written this sprint.”
- The prompt must support skipping (baseline stays 0).

Note:
- The proactive baseline prompt is only relevant when the sprint is wordcount-capable (mode `words` or `mixed`). Time-only sprints do not need a baseline.

### Entry (canonical event)
All totals derive from a stream of entries.

Each entry must have:
- `userId`
- `recordedAt` (UTC timestamp)
- optional `projectId`
- optional `sprintId`
- `type` (defined below)
- `amount` (integer; can be positive or negative depending on type)

#### Entry types
We need two distinct intents to keep “net totals” correct without losing auditability:

1) `WRITE`
- Meaning: “I wrote new words.”
- `amount` must be `> 0`.

2) `ADJUST`
- Meaning: “Correction to net total.”
- `amount` can be positive or negative.

Rationale: Net totals must allow negative corrections. If we clamp negatives, totals inflate over time.

Persistence note:
- Entries must exist regardless of whether `projectId` is set. A sprint can be meaningful and measurable without any project linkage.

---

## Metrics and calculations

Notation: Let $E$ be the set of entries after filtering.

### 1) Project net total (PRIMARY)
For a project `P`, the displayed **included total** is based on which members are marked as included.

Let `IncludedUsers(P)` be the set of users where `includeWordcountInProjectTotal = true` for this project.


$$ProjectNetIncluded(P) = \sum_{e \in E(P)} e.amount \;\;\text{where } e.userId \in IncludedUsers(P)$$


Where $E(P)$ are entries with `projectId = P` and `type ∈ {WRITE, ADJUST}`.

Important:
- **No clamping**. Negative adjustments are allowed and must reduce net.
- This number represents “where the project stands right now,” not lifetime words written.

### 1b) Project excluded contributions (visibility)
The project view should also show **excluded contributions** so it’s visible when non-included buddies have logged progress.

Let `ExcludedUsers(P)` be members of the project where `includeWordcountInProjectTotal = false`.

$$\ProjectNetExcluded(P) = \sum_{e \in E(P)} e.amount \;\;\text{where } e.userId \in ExcludedUsers(P)$$

Display intent:
- “Project total” uses `ProjectNetIncluded(P)`.
- “Excluded contributions” shows `ProjectNetExcluded(P)`.

### 1c) Time-tracked project totals
Time-tracked projects roll up participation time from sprints.

Let `SprintMinutes(P, U)` be the total minutes user `U` spent in sprints attributed to project `P`.

Then:

$$\ProjectTimeIncludedMinutes(P) = \sum SprintMinutes(P, U) \;\;\text{for } U \in IncludedUsersTime(P)$$

$$\ProjectTimeExcludedMinutes(P) = \sum SprintMinutes(P, U) \;\;\text{for } U \in ExcludedUsersTime(P)$$

Where:
- `IncludedUsersTime(P)` are members with `includeTimeInProjectTotal = true`
- `ExcludedUsersTime(P)` are members with `includeTimeInProjectTotal = false`

Display intent:
- Show both included and excluded time totals on the project view.

### 2) User net total on a project

$$UserProjectNet(U, P) = \sum_{e \in E(U,P)} e.amount$$

### 3) Sprint net total per participant
For a sprint participation row `S` and user `U`:

$$SprintUserNet(S,U) = \sum_{e \in E(S,U)} e.amount$$

Default rule for sprint totals:
- Sprint summaries and status numbers use **net** totals: include `WRITE` and `ADJUST` created within sprint context.

If a participant has set a starting baseline `B` (absolute wordcount), then for display only:

- Absolute start = $B$
- Absolute current/end = $B + SprintUserNet(S,U)$

### 3b) Sprint time per participant
For a sprint participation row `S` and user `U`:

$$SprintUserMinutes(S,U) = \max(0, endTime(S,U) - startTime(S,U))$$

This is independent of wordcount entries.

Rounding rule:
- Reported minutes should be rounded to the nearest whole minute.

Team sprint rule:
- `startTime(S,U)` is the participant’s join timestamp.

### 4) Rolling window totals (7-day)
Define a window start $t_0 = now - 7\times24h$.

For project `P`:

$$ProjectNetWindow(P, t_0, now) = \sum_{e \in E(P,t_0,now)} e.amount$$

Where entries are filtered by `recordedAt ∈ [t_0, now)`.

This is a **net change** number (includes negative adjustments).

### 5) “Today” totals
We need a user-specific start-of-day.

Let `zone(U, guild)` be:
1) user timezone if set and valid IANA
2) server (guild) timezone if set and valid IANA
3) `UTC`

Let `startOfDay(zone)` be midnight in that zone for “today”, converted to UTC instant $t_{day}$.

Then:

$$UserDayNet(U) = \sum_{e: e.userId=U \land e.recordedAt \ge t_{day}} e.amount$$

We can also compute `ProjectDayNet(P)` similarly.

---

## Project linking rules (per participant)

### Principle
A sprint does not have to be globally tied to a single project. Each participant can write on different projects in the same team sprint.

### Defaulting
- A participant may set a **default project** for their active sprint participation.
- When they log an entry in sprint context without specifying a project, the default is applied.

Baseline defaulting (writing projects):
- If a participant has a default project set for the sprint and has not provided a starting baseline, the system should be able to default the sprint baseline to that participant’s **current project net**.
- This is optional behavior (implementation detail), but the workflow must be supported because it matches how people track writing.

### Entry truth
The entry’s `projectId` is what counts for project totals, not the sprint’s default link.

---

## Implementation notes: command mapping

Maps the workflows and math to Discord commands.

The current system nested wordcount logging under both `/sprint` and `/project`. This spec recommends splitting it into a dedicated top-level command so members only have to learn one place to log words.

### Recommended command layout (v2)
Top-level commands:
- `/sprint` - starts and manages timed sessions (solo/team) and sprint-specific settings.
- `/project` - creates and manages projects and buddies.
- `/wc` - logs wordcounts and corrections (sprint-aware and project-aware).

Migration note:
- This spec assumes a clean switch to the new command layout; we do not need to preserve legacy command shapes.

### Sprint management
Sprints should keep a small set of verbs:
- `/sprint start minutes:N label:<optional> mode:<optional words|time|mixed>`
- `/sprint host minutes:N label:<optional> mode:<optional words|time|mixed>`
- `/sprint join code:<hunt-code> track:<optional words|time>`
- `/sprint leave`
- `/sprint end`
- `/sprint status`
- `/sprint list`

Mode default:
- If `mode` is omitted, default to `words` (wordcount-enabled sprint).

Team join mode rule:
- For team sprints, joiners always inherit the host’s sprint mode (`words`, `time`, or `mixed`).
- Join does not support per-joiner mode overrides.

Team join word tracking rule:
- For `mode=words` team sprints, joiners may set `track=time` to participate without tracking words.
- Default: `track=words`.

Project linking for active sprint participation:
- `/sprint project use project:<id|name>`
  - Sets the participant’s default project for the active sprint participation.

### Wordcount logging (one place)
Wordcount logging should live under `/wc` only.

Core commands:
- `/wc add new-words:N project:<optional>`
  - Creates `WRITE(amount=N)`.
  - If the user has exactly one active sprint participation, attach to that sprint participation by default.
  - If the user has multiple active sprint participations, require explicit sprint selection (picker or identifier) before attaching.
  - If `project` is provided, set `projectId`.
  - If `project` is omitted but the user has a default project on the active sprint participation, apply it.
  - If there is no active sprint participation and `project` is omitted, prompt the user with a project picker.
    - If the user has no projects (or the picker times out), show instructions to either create a project or start/host a sprint.

- `/wc set count:X scope:<optional sprint|project> ...`
  - `scope` is optional.
  - If `scope` is omitted, prompt with a scope picker first: “Set sprint progress” vs “Set project total.”
  - For `scope=sprint`: `X` is the participant’s 0-based sprint net progress.
    - If multiple relevant sprints exist (active or recently ended, per the late logging window rules), require explicit sprint selection.
  - For `scope=project`: `X` is the user’s desired net total on the project.
    - If `project` is omitted, prompt the user with a project picker.
  - After scope + target are resolved, show a confirm/cancel step that clearly names the target (sprint identifier or project name) before writing the `ADJUST(amount=delta)` entry.
  - Compute `delta = X - currentNet(scope)` and create `ADJUST(amount=delta)`.

Starting baseline (optional):
- There should be a way for a participant to set their starting baseline `B` (absolute wordcount) for the active sprint.
- That value is only used to display absolute start/end numbers; sprint progress still starts at 0.

- `/wc baseline count:B`
  - Sets the participant’s baseline for the active sprint participation (display only).
  - If multiple relevant sprints exist (active or recently ended, per the late logging window rules), require explicit sprint selection.
  - Show a confirm/cancel step that clearly names the sprint before saving.
  - This does not create a wordcount entry.

- `/wc undo scope:<optional sprint|project> ...`
  - `scope` is optional.
  - If `scope` is omitted, prompt with a scope picker first: “Undo sprint entry” vs “Undo project entry.”
  - Removes the most recent entry created by the user in that scope.
  - For `scope=sprint`: if multiple relevant sprints exist (active or recently ended, per the late logging window rules), require explicit sprint selection.
  - For `scope=project`: if `project` is omitted, prompt the user with a project picker.
  - Show a confirm/cancel step that clearly names the target and shows the entry to be undone (type + amount + timestamp) before removing it.
  - Recompute derived display values from remaining entries.

Convenience display:
- `/wc show`
  - If exactly one active sprint exists, show that sprint progress.
  - Otherwise prompt with a scope picker (sprint vs project), then a sprint/project picker if needed.
- `/wc summary`
  - If exactly one active sprint exists, show that sprint summary.
  - Otherwise prompt with a scope picker (sprint vs project), then a sprint/project picker if needed.

Picker + confirmation UX rules (for `/wc`)
- General:
  - Default visibility: public.
  - Ephemeral is reserved for pickers, confirm/cancel steps, and error messages.
  - Prefer select menus for pickers.
  - Use confirm/cancel for any action that modifies state in a way that is hard to mentally undo (`/wc set`, `/wc undo`, `/wc baseline`).
  - If the user does not respond within 60 seconds, time out and do nothing.
  - After a confirm/cancel click, disable components and edit the message to prevent double-submits.

- Success message visibility:
  - Normal success responses should be public.
  - If the success message is sprint-targeted, it must follow sprint message consistency rules (include the sprint identifier).

- Scope picker:
  - Only used when `scope` is omitted.
  - Options: “Sprint” and “Project.”
  - If the user has any active sprint participation, show “Sprint” first.

- Sprint picker (when needed):
  - Include active sprints and recently ended sprints (per the late logging window rules).
  - Group order: team first, then solo.
  - Within each group:
    - Active sprints first, sorted by soonest ending first.
    - Recently ended sprints next, sorted by most recently ended first.
  - Each option label must include a human-meaningful sprint identifier:
    - Team: hunt code plus label when present (example: `GHOUL - Night Words`).
    - Solo: label when present; otherwise include start time.
  - Each option must clearly indicate whether it is active or ended (and include end time for ended items).

- Project picker (when needed):
  - Include projects the user is a member of.
  - Order:
    - Most recently used project first (based on the user’s recent `/wc` activity), then
    - Alphabetical by project name.
  - If there are no projects, show instructions to create a project or start/host a sprint.

- Confirm/cancel content requirements:
  - Confirm prompts must explicitly name the target:
    - Sprint: sprint identifier and whether it is active or ended.
    - Project: project name.
  - For `/wc set`:
    - Show the intended new value `X`.
    - Show the current net value and the computed delta.
  - For `/wc undo`:
    - Show the entry that will be undone (type, amount, timestamp).
  - Confirm/cancel prompts must not ping users.

Dean voice copy (for `/wc` pickers + confirmations)

Scope picker prompt (ephemeral):
```text
Alright. What are we messing with?
Pick one: Sprint or Project.
```

Sprint picker prompt (ephemeral):
```text
Which sprint?
Pick the one you mean. I am not guessing wrong on purpose.
```

Project picker prompt (ephemeral):
```text
Which project?
Pick one so I can put the words in the right place.
```

No projects (ephemeral):
```text
You don't have any projects yet.
Make one with `/project create`, or start a sprint and log without a project.
```

Confirm: `/wc set` (ephemeral):
```text
Confirm `/wc set`
Target: {TARGET_LABEL}

New value: {NEW_X}
Current net: {CURRENT_NET}
Delta: {DELTA_SIGNED}

Hit confirm if that's right. If not, cancel and try again.
```

Confirm: `/wc baseline` (ephemeral):
```text
Confirm baseline
Sprint: {SPRINT_IDENTIFIER} ({ACTIVE_OR_ENDED})

Baseline: {BASELINE_B}

This is display-only. Your sprint progress still starts at 0.
```

Confirm: `/wc undo` (ephemeral):
```text
Confirm undo
Target: {TARGET_LABEL}

Undoing: {ENTRY_TYPE} {ENTRY_AMOUNT_SIGNED} at {ENTRY_TIMESTAMP}

If that's the wrong one, cancel. No shame.
```

Confirm timeout (ephemeral):
```text
Timed out.
If you still want to do it, run the command again.
```

Project wordcounts outside a sprint are handled by `/wc` with `scope=project` and a `project` selector.

### Buddy management (project members)
We need a small set of commands to support buddy roles, role title aliases, and inclusion toggles.

Suggested minimal additions under `/project` (smallest practical set):
- `/project member set project:<id|name> member:<optional @user> role:<optional role> role_title_alias:<optional string> include_wordcount:<optional true|false> include_time:<optional true|false>`
  - Updates only the fields provided.
  - `member` defaults to the caller (supports shared control where buddies can manage their own settings).
  - Permission enforcement:
    - Project owner may set fields for any member.
    - A buddy may set fields only for themselves.
  - Role change behavior:
    - If `role` changes, auto-flip inclusion toggles to that role’s defaults only for metrics the project uses.
    - Notify both the buddy and the project owner that the toggles were auto-flipped so they can override if needed.
  - `role_title_alias` is display only. If provided as an empty string, clear it.

Everything else stays under existing commands:
- Membership list: `/project members`
- Adding/removing buddies: `/project invite`, `/project remove`, `/project leave`

---

## Sprint UX parity add-ons (explicit follow-ups)

Additive UX and reporting layers; they do not change any of the core math rules above.

### A) Team sprint leaderboard + placements (per sprint)
At sprint end, the team sprint summary should include:
- A ranked list of participants by their sprint net: $SprintUserNet(S,U)$.
- Placements (1st/2nd/3rd or equivalent).

Mode rule:
- Ranked leaderboard + placements apply only to `mode=words`.
- `mode=mixed` is always non-ranked and uses the mixed display rule.

Per-participant tracking rule (team sprints):
- In `mode=words`, the ranked leaderboard includes only participants who joined as `track=words`.
- Participants who joined as `track=time` must still appear in the end summary in a separate friendly “also participated” section (not ranked), ordered host first then join order, with minutes shown and no wordcount shown.
- If a participant joined as `track=time` but logs any wordcount entry during the sprint, treat them as `track=words` for summary purposes (include them in the ranked leaderboard).

Late logging interaction:
- Placements are derived from current sprint totals. If late logging is permitted for that sprint, placements can change until the late logging window closes.

Display rule for participant totals:
- Show `NET` as the primary number.
- If there were any adjustments, also show `WRITE` and `ADJUST` as secondary detail.

Tie behavior:
- If two participants have the same net, show them tied at the same placement.

### B) WPM stats (fun, derived)
For each participant, compute a words-per-minute pace for the sprint:

Let $SprintUserWrite(S,U)$ be the sum of `WRITE` amounts for the participant in the sprint.

$$SprintUserWrite(S,U) = \sum_{e \in E(S,U): e.type = WRITE} e.amount$$

WPM is computed from `WRITE` only:

$$SprintUserWPM(S,U) = \frac{SprintUserWrite(S,U)}{SprintUserMinutes(S,U)}$$

Display rules:
- If $SprintUserMinutes(S,U) = 0$, show WPM as N/A.
- WPM is derived display only; it does not affect totals.
- WPM should be available in active sprint status displays (computed from WRITE so far and minutes elapsed) and shown in end summaries.

### C) Sprint extensions
Members often want to extend a sprint without restarting.

Rules:
- Solo: the participant may extend their sprint.
- Team: the host may extend the sprint for all participants.
- Team sprint participants (non-host) must not be able to extend the sprint for everyone.
- Extending updates the sprint’s planned end time and must preserve idempotent end behavior.
- If the sprint is extended and the midpoint/check-in prompt has not fired yet, its scheduled time should be recalculated based on the new duration.
- Extension input should support both quick presets (example: +5/+10/+15) and a custom minutes value.

### D) Mid-sprint check-in prompt
In addition to encouragement copy, the bot should support an optional “check-in” prompt during the sprint.

Intent:
- Reduce missed logging by prompting users at a predictable moment.

Targeting rule:
- Send the check-in prompt only to participants who have not logged anything yet in that sprint.

Rules:
- The check-in prompt should ask for either:
  - the participant’s current 0-based sprint progress, or
  - a new absolute total if they set a baseline.
- The prompt should be skippable.

Default input rule:
- If a baseline exists, the prompt should default to asking for a new absolute total.
- Otherwise, the prompt should default to asking for the current 0-based sprint total.
- The check-in prompt must be delivered at most once per participant per sprint (no duplicates due to rescheduling).

Disambiguation requirement (member UX):
- Any midpoint/check-in/encouragement message must make it obvious which sprint it refers to.
- Solo sprint: include the participant’s name and (if present) the sprint label/note.
- Team sprint: include the sprint identity (hunt code and/or sprint title/label) and the participant names.

No-ping requirement:
- These messages should not ping users.
- Use display names in plain text, or render mentions while disabling allowed mentions.

### E) Quick restart (“run it again”)
At sprint end, offer a quick way to start another sprint with the same common settings.

Rules:
- Defaults can include duration, solo/team mode, and the participant’s default project.
- Baseline behavior stays the same: prompt if not set, and support absolute-total reporting.
- If the user quick-restarts immediately after a sprint, the new sprint should carry over the prior sprint’s baseline by default.
- This behavior must be explained clearly in the restart UI so members understand why absolute totals keep working across back-to-back sprints.

### F) Per-user sprint history view (must-have)
Members need to be able to view their recent sprints.

Minimum viable history output:
- Recent sprint list showing both active and ended sprints.
- Each row should show: status (active/ended), start time, duration, remaining time (if active), sprint wordcounts (NET primary; include WRITE/ADJUST detail if non-zero), and the participant’s label/note.
- A “last 7 days” summary for: words sprinted (net) and minutes sprinted.

7-day summary inclusion rule:
- Include ended sprints and active-so-far contributions.

Default list sizing:
- Include all active sprints.
- Include all ended sprints from the last 7 days.

Time-only sprint display rule:
- If a sprint is used as a time-only productivity sprint (no wordcounts), do not show a leaderboard.
- End messaging should treat participants as equal and report the total minutes for the sprint.

Time-only + optional wordcounts:
- Logging wordcounts to a time-only sprint is allowed.
- Time-only rules above still apply: no baseline prompts, no “log your words” end reminder, and no leaderboard by default.
- Wordcount entries, if present, should remain visible via explicit `/wc show` or `/wc summary` flows.

Mixed sprint display rule:
- Mixed mode shows both minutes and wordcounts without ranking.
- End summary participant list ordering: host first, then join order.
- For each participant:
  - Always show minutes.
  - Show word totals only if the participant logged wordcounts.
- No placements and no ranked leaderboard in mixed mode.

### G) Team sprint join/leave QoL + friendly aliases
Members need to reliably manage active items without copying raw IDs.

Rules:
- Join: records a join moment and begins accruing time from that moment.
- Join inherits the sprint mode from the host (no per-joiner mode overrides).
- Leave: ends that participant’s participation early and stops accruing time.
- Rejoin: allowed. Rejoining starts a new participation interval for that participant in the same sprint.

Friendly aliases (hunt codes):
- Each active team sprint should have a short, server-themed keyword code that members can use to join.
- These codes are case-insensitive and should be displayed in a consistent canonical form (example: `GHOUL`).
- Hunt codes are assigned randomly from the available pool when the team sprint is created.
- Hunt codes should be shown in join/list/disambiguation contexts and included in team sprint lifecycle messages as part of the sprint identifier.
- For team sprints, the hunt code is sufficient identity; a host-provided label/title remains optional.

Alias pool (initial curated list):
- alien
- angel
- banshee
- changeling
- chupacabra
- curse
- demon
- djinn
- dragon
- fairy
- fishtaco
- ghost
- ghoul
- hellhound
- horseman
- jefferson-starship
- kitsune
- kraken
- lamia
- leviathan
- manticore
- mandragora
- nachzehrer
- nephilim
- pigeon
- poltergeist
- rakshasa
- reaper
- rugaru
- scarecrow
- shapeshifter
- siren
- starship
- trickster
- vampire
- vampirate
- werepire
- werewolf
- wraith
- witch
- zombie

Uniqueness and reuse rules:
- A hunt code must be unique among concurrently active team sprints.
- Hunt codes may be reused after a sprint ends.

Fallback behavior:
- If the alias pool is exhausted (or collisions prevent assignment), fall back to a short generated join code.
- The generated code should still be stable for the sprint’s lifetime.

Optional extension (nice-to-have):
- Per-participant aliases within a sprint can still exist for list/cancel/leave flows, but the must-have is the sprint-level hunt code for joining.

---

## Timezone requirements

### User timezone
Already exists on user model (`timezone`). Must be valid IANA.

### Server (guild) timezone
Not currently present in the DB models.

Spec requirement:
- Add a server (guild)-level timezone value (IANA string) used only as fallback.
- If absent/invalid, default to UTC.

Where to store it (implementation choice later):
- Option 1: `guilds.timezone`
- Option 2: a new table like `GuildSettings` or extend existing `GuildSprintSettings`

---

## Current-state pain points
These are not requirements to preserve, just issues motivating the refactor:
- Many totals currently sum only positive deltas (clamping negatives), which makes “set/correction” impossible and inflates totals over time.
- “Today” totals appear to use UTC midnight, not user/server (guild) timezone.
- Project totals and “last sprint total” definitions are inconsistent (what counts, which sprint is “last”).
- User-reported issue: providing an absolute total via a “set” style action can be misinterpreted as “words written,” and when a project is involved can effectively double-count (example: 30k → set 31k becomes 61k).

---

## Migration notes (high level)
We likely have existing rows that represent:
- sprint adds (safe to treat as `WRITE`)
- sprint sets (should become `ADJUST`)
- project adds (safe to treat as `WRITE`)
- project sets (should become `ADJUST`, including negative deltas)

We can migrate by:
- Adding `type` to existing Wordcount rows (or creating a new Entries table).
- Backfilling `type` based on which command created it (if detectable) or based on heuristics.

---

## Hunts and achievements

Hunt/achievement triggers that care about “words written” (example: 5k in a sprint) must use `WRITE` totals only.

Rationale:
- Prevents gaming via `ADJUST` entries.
- Keeps achievements aligned with actual writing output.

## Team sprint summary formatting

Sprint summaries should be unambiguous when multiple sprints are active.

Requirements:
- Always include the sprint identifier (hunt code and/or title/label).
- Always include the sprinter(s) (solo: one name; team: list of participant names).
- Do not ping users.

Multi-project sprint summary requirement (explicit stats):
- If a participant logged entries across multiple projects in a sprint, do not collapse to a single default project label.
- Prefer to show per-project breakdowns as explicitly as possible (for example, `Project A: +300`, `Project B: +200`).
- If the message would be too long, show a “multiple projects” indicator plus the top 3 projects by net, and include a total (no “+X more” count).
- When sorting projects within the breakdown, sort by highest NET contribution first.

Project inclusion vs sprint breakdown:
- Sprint breakdowns should include all sprint contributions for a project regardless of whether a contributor is included or excluded from that project’s displayed total.
- Inclusion toggles affect project totals, not whether a participant’s sprint work is shown in the sprint summary.

Absolute totals (baseline) display:
- If a participant set a baseline for the sprint, end summaries should include absolute start and end totals in addition to the delta (example: `+1000 (30000 → 31000)`).
- History list rows should remain compact by default (delta-first), but may include absolute totals in a details view or selection output.
