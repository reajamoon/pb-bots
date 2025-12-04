# Maintenance Workflow

This repo includes a GitHub Actions workflow to run routine checks and optional data fixes.

## What Runs Automatically
- **Bot text scope check:** Ensures member-facing strings don’t leak into `src/shared/` to preserve per-bot voices.
- **Unit tests:** Runs Jest tests for shared utilities.
- **Schedule:** Weekly on Mondays at 06:00 UTC, and on every push/PR to `main`.

## Optional Data Fix (Birthdays)
Normalize legacy `User.birthday` values to ISO `YYYY-MM-DD` to avoid date parsing warnings.

- Workflow: `.github/workflows/maintenance.yml`
- Job: `fix-birthdays` (manual only)
- Secret required: `DATABASE_URL` pointing to your target DB (PostgreSQL).

### Configure Secret
1. In GitHub: Settings → Secrets and variables → Actions → New repository secret.
2. Name: `DATABASE_URL`
3. Value: e.g. `postgres://user:pass@host:5432/dbname`

### Run the Fix Manually
- GitHub → Actions → Maintenance Checks → Run workflow → set “Run birthday normalization” to true.

## Local Commands
- Scope check: `npm run lint:bot-text`
- Unit tests: `npm test`
- Normalize birthdays: `npm run fix:birthdays`

## Notes
- The normalization script updates only non-ISO dates (e.g., `MM/DD/YYYY`). Privacy format `MM/DD` is stored as `1900-MM-DD` for year-hidden mode.
- Future writes are normalized in the modal handler; this job is for catching historical data.