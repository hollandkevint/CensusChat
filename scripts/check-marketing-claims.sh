#!/usr/bin/env bash
# Fails if a retired, unsubstantiated marketing claim reappears on a public surface.
# Each pattern was removed because no file in this repo supports it. If you want one
# back, add the evidence first and delete the pattern here in the same commit.
set -euo pipefail

PATHS=(README.md index.md _config.yml landing docs/landing marketing content frontend/src)

# ponytail: one grep -E, no per-pattern loop. Add a pattern, not a framework.
PATTERN='Sarah L\.|2\.8B Regional|\$150M facility|196,436|5,500% ROI|89% [Tt]est|80%\+ Cache|99\.9% uptime|11M\+ records|23 minutes|6-second|delivers them in 6 seconds|~300x|~200x'

# Plans quote the claims they retire verbatim. docs/ is the Jekyll published tree
# with an output:true "docs" collection, so a plan left there renders as a live page
# reprinting every claim this guard exists to block. Plans belong in internal/ (gitignored).
if [ -d docs/plans ]; then
  echo "FAIL: docs/plans/ is inside the published Jekyll tree. Move plans to internal/plans/."
  exit 1
fi

if grep -rInE "$PATTERN" "${PATHS[@]}"; then
  echo
  echo "FAIL: a retired marketing claim reappeared above. See internal/plans/ for the plan behind this list"
  exit 1
fi

echo "OK: no retired marketing claims found."
