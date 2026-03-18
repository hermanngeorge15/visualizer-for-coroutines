#!/bin/bash
# Generate changelog from conventional commits since last tag
#
# Usage:
#   ./scripts/generate-changelog.sh           # changes since last tag
#   ./scripts/generate-changelog.sh v0.1.0    # changes since specific tag
#
# Groups commits by conventional commit type and outputs markdown.

set -euo pipefail

# Determine the range of commits to include
SINCE_TAG="${1:-}"

if [[ -z "$SINCE_TAG" ]]; then
  # Find the previous tag (second most recent) to compare against
  SINCE_TAG=$(git tag --sort=-v:refname | head -n 2 | tail -n 1 2>/dev/null || true)
fi

if [[ -n "$SINCE_TAG" ]]; then
  RANGE="${SINCE_TAG}..HEAD"
  COMPARE_TEXT="since ${SINCE_TAG}"
else
  RANGE="HEAD"
  COMPARE_TEXT="(all commits)"
fi

# Collect commits in the range
COMMITS=$(git log "$RANGE" --pretty=format:"%s|%h|%an" --no-merges 2>/dev/null || true)

if [[ -z "$COMMITS" ]]; then
  echo "No changes found ${COMPARE_TEXT}."
  exit 0
fi

# Accumulators for each category
FEATURES=""
FIXES=""
DOCS=""
TESTS=""
REFACTORS=""
PERF=""
BUILD=""
CI=""
CHORE=""
OTHER=""

while IFS='|' read -r subject hash author; do
  # Parse conventional commit prefix
  case "$subject" in
    feat:*|feat\(*) FEATURES="${FEATURES}\n- ${subject#feat:} (\`${hash}\` — ${author})" ;;
    fix:*|fix\(*)   FIXES="${FIXES}\n- ${subject#fix:} (\`${hash}\` — ${author})" ;;
    docs:*|docs\(*) DOCS="${DOCS}\n- ${subject#docs:} (\`${hash}\` — ${author})" ;;
    test:*|test\(*) TESTS="${TESTS}\n- ${subject#test:} (\`${hash}\` — ${author})" ;;
    refactor:*|refactor\(*) REFACTORS="${REFACTORS}\n- ${subject#refactor:} (\`${hash}\` — ${author})" ;;
    perf:*|perf\(*) PERF="${PERF}\n- ${subject#perf:} (\`${hash}\` — ${author})" ;;
    build:*|build\(*) BUILD="${BUILD}\n- ${subject#build:} (\`${hash}\` — ${author})" ;;
    ci:*|ci\(*)     CI="${CI}\n- ${subject#ci:} (\`${hash}\` — ${author})" ;;
    chore:*|chore\(*) CHORE="${CHORE}\n- ${subject#chore:} (\`${hash}\` — ${author})" ;;
    *)              OTHER="${OTHER}\n- ${subject} (\`${hash}\` — ${author})" ;;
  esac
done <<< "$COMMITS"

# Output markdown
echo "## What's Changed"
echo ""

if [[ -n "$FEATURES" ]]; then
  echo "### Features"
  echo -e "$FEATURES"
  echo ""
fi

if [[ -n "$FIXES" ]]; then
  echo "### Bug Fixes"
  echo -e "$FIXES"
  echo ""
fi

if [[ -n "$PERF" ]]; then
  echo "### Performance"
  echo -e "$PERF"
  echo ""
fi

if [[ -n "$REFACTORS" ]]; then
  echo "### Refactoring"
  echo -e "$REFACTORS"
  echo ""
fi

if [[ -n "$DOCS" ]]; then
  echo "### Documentation"
  echo -e "$DOCS"
  echo ""
fi

if [[ -n "$TESTS" ]]; then
  echo "### Tests"
  echo -e "$TESTS"
  echo ""
fi

if [[ -n "$BUILD" ]]; then
  echo "### Build"
  echo -e "$BUILD"
  echo ""
fi

if [[ -n "$CI" ]]; then
  echo "### CI/CD"
  echo -e "$CI"
  echo ""
fi

if [[ -n "$CHORE" ]]; then
  echo "### Chores"
  echo -e "$CHORE"
  echo ""
fi

if [[ -n "$OTHER" ]]; then
  echo "### Other"
  echo -e "$OTHER"
  echo ""
fi

# Summary line
TOTAL=$(echo "$COMMITS" | wc -l | tr -d ' ')
echo "---"
echo "_${TOTAL} commits ${COMPARE_TEXT}_"
