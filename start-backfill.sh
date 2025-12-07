#!/usr/bin/env bash
set -euo pipefail

# Run the one-time backfill for Rec Guidelines Hunt
export NODE_ENV=${NODE_ENV:-development}
node ./scripts/backfillRecGuidelinesHunt.js
