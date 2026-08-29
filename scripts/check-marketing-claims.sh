#!/usr/bin/env bash
# Fails if a retired, unsubstantiated marketing claim reappears on a public surface.
# Each pattern was removed because no file in this repo supports it. If you want one
# back, add the evidence first and delete the pattern here in the same commit.
set -euo pipefail

# docs/ is not in the Jekyll exclude list, so every .md under it renders as a live page.
# It is scanned in full; only docs/archive is exempt (historical record, not a live surface).
# README.md:188 carries a "~$2.8B" market-sizing estimate under an explicit
# "Illustrative framing ... not audited market data" disclaimer (README.md:185), so the
# bare-number pattern below would false-positive on it. It is scanned for every other
# pattern via the second pass.
PATHS=(index.md _config.yml landing marketing content frontend/src docs)
EXCLUDES=(--exclude-dir=archive --exclude-dir=node_modules)

# ponytail: one grep -E, no per-pattern loop. Add a pattern, not a framework.
PATTERN='Sarah L\.|2\.8B|\$150M facility|196,436|5,500% ROI|89% [Tt]est|80%\+ Cache|99\.9%|11M\+|23 minutes|6-second|delivers them in 6 seconds|~300x|~200x'

# Plans quote the claims they retire verbatim, so a plan under docs/ renders as a live
# page reprinting every claim this guard exists to block. Plans belong in internal/,
# which .gitignore already excludes.
if [ -d docs/plans ]; then
  echo "FAIL: docs/plans/ is inside the published Jekyll tree. Move plans to internal/plans/."
  exit 1
fi

# README.md is scanned separately, skipping only its disclaimered market-sizing line.
if grep -rInE "${EXCLUDES[@]}" "$PATTERN" "${PATHS[@]}" \
   || grep -nE "$PATTERN" README.md | grep -v 'estimated annual spend on demographic consulting'; then
  echo
  echo "FAIL: a retired marketing claim reappeared above. See CONTRIBUTING.md, section 'Marketing and Public Claims'"
  exit 1
fi

echo "OK: no retired marketing claims found."
