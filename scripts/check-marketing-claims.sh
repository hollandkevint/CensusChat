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

# A dead link to a moved doc is how a retired claim survives: the README's top link
# pointed at docs/MVP_STATUS.md for months while the real file, carrying "89% test
# success rate", sat at docs/project-management/. Resolve every relative .md link in
# the scanned surfaces. Root-absolute links (/docs/x.md) resolve from the repo root.
SITE="https://hollandkevint.github.io/CensusChat"

# A relative link is read on GitHub as well as on Pages, so it resolves against the
# repo tree: the file itself, or the .md source behind an .html target.
resolve_repo_path() {
  t="${1%%#*}"; [ -n "$t" ] || return 0; t="${t%/}"
  [ -e "$t" ] || [ -e "${t%.html}.md" ] || return 1
}

# A same-site absolute URL is only ever read on Pages, so it must name something
# Jekyll actually serves. With no permalink overrides in _config.yml that is
# "dir/" (from dir/index.md) or "page.html" (from page.md) -- never a bare
# extensionless path. GitHub Pages does not fall back from /page to /page.html.
resolve_site_url() {
  t="${1%%#*}"; [ -n "$t" ] || return 0
  case "$t" in
    */) [ -e "${t}index.md" ] || [ -e "${t%/}.md" ] && return 0
        echo "    (no ${t}index.md backs this directory URL)" >&2; return 1 ;;
    *.html) [ -e "${t%.html}.md" ] || [ -e "$t" ] || return 1; return 0 ;;
    *.*) [ -e "$t" ] || return 1; return 0 ;;
    *)  if [ -e "${t}.md" ]; then
          echo "    (${t}.md exists but Jekyll serves it at ${t}.html; Pages does not fall back)" >&2
        fi
        return 1 ;;
  esac
}

while IFS= read -r f; do
  d=$(dirname "$f")
  # Two extractors. Relative links are only checked when they name a .md or .html
  # target, because an extensionless relative link is usually an anchor or a directory.
  # Same-site absolute URLs are checked whatever their shape: they are internal links
  # wearing a hostname, and three /about/ links pointed at a page that has never
  # existed precisely because a checker that skipped http* treated them as external.
  {
    grep -oI "](\([^)#]*\.\(md\|html\)\)[^)]*)" "$f" 2>/dev/null | sed 's/^](//;s/)$//'
    grep -oI "]($SITE[^)\"' ]*)" "$f" 2>/dev/null | sed 's/^](//;s/)$//'
  } | while IFS= read -r l; do
    case "$l" in
      mailto*) continue ;;
      "$SITE"*) t=".${l#$SITE}" ;;
      http*) continue ;;
      /*) t=".$l" ;;
      *) t="$d/$l" ;;
    esac
    case "$l" in
      "$SITE"*) resolve_site_url "$t" || echo "DEAD LINK: $f -> $l" ;;
      *)        resolve_repo_path "$t" || echo "DEAD LINK: $f -> $l" ;;
    esac
  done
done < <(git ls-files '*.md' \
          | grep -E '^(README|index|CONTRIBUTING|QUICK_START|API_KEY_SETUP|SECURITY|CLAUDE)\.md$|^(landing|docs)/' \
          | grep -v '^docs/archive/') > /tmp/ccm-dead.$$ || true
if [ -s /tmp/ccm-dead.$$ ]; then
  cat /tmp/ccm-dead.$$; rm -f /tmp/ccm-dead.$$
  echo
  echo "FAIL: broken documentation links above. Repoint them or remove the link."
  exit 1
fi
rm -f /tmp/ccm-dead.$$

echo "OK: no retired marketing claims found, no broken doc links."
