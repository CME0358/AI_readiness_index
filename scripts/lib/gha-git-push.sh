#!/usr/bin/env bash
# Safe git commit + push for GitHub Actions.
#
# The worker computes against the checkout it started from. Commits can land
# on the branch before push (schedule PR merges, sidecar commits). Replaying
# that stale tree with `git reset --mixed` + `git add <dir>` stages deletions
# for every path that exists on the new HEAD but not in the working tree, and
# it also overwrites full-file outputs such as schedule.json.
#
# That is how 7a575ac (2026-09-25T01:00:01Z, parent b52359d) deleted the five
# October Insights merged in PR #5 about twenty minutes earlier.
#
# This script:
#   - reapplies only the worker's own edits onto the latest origin tip
#   - refuses (exit 42, nothing pushed) when origin changed a path this run
#     also edited — the caller must reset and recompute
#   - refuses to stage a deletion the worker did not make
#   - refuses to drop schedule entries or scheduled article HTML this run
#     did not publish
#
# Usage: scripts/lib/gha-git-push.sh "Commit message" path1 path2 ...
# Exit 42: stale base. No commit was pushed.
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: gha-git-push.sh <message> <paths...>" >&2
  exit 1
fi

MSG="$1"
shift

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
branch="${GITHUB_REF_NAME:-main}"
retry_sleep="${GHA_GIT_PUSH_RETRY_SLEEP:-5}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

ORIGINAL_BASE="$(git rev-parse HEAD)"
SNAPSHOT="$(mktemp -d)"
trap 'rm -rf "$SNAPSHOT"' EXIT

git diff --name-only --diff-filter=D -z HEAD > "$SNAPSHOT/deletions.z" || true
git diff --name-only --diff-filter=ACMRTUXB -z HEAD > "$SNAPSHOT/modified.z" || true
git ls-files --others --exclude-standard -z > "$SNAPSHOT/untracked.z" || true

mkdir -p "$SNAPSHOT/files"
copy_blob() {
  local list="$1"
  while IFS= read -r -d '' f; do
    [ -n "$f" ] || continue
    if [ -e "$f" ]; then
      mkdir -p "$SNAPSHOT/files/$(dirname "$f")"
      cp -a "$f" "$SNAPSHOT/files/$f"
    fi
  done < "$list"
}
copy_blob "$SNAPSHOT/modified.z"
copy_blob "$SNAPSHOT/untracked.z"

{
  tr '\0' '\n' < "$SNAPSHOT/deletions.z" || true
  tr '\0' '\n' < "$SNAPSHOT/modified.z" || true
  tr '\0' '\n' < "$SNAPSHOT/untracked.z" || true
} | sed '/^$/d' | sort -u > "$SNAPSHOT/worker-paths.txt"

path_in_spec() {
  local f="$1"
  shift
  local spec
  for spec in "$@"; do
    spec="${spec%/}"
    if [ "$f" = "$spec" ] || [[ "$f" == "$spec"/* ]]; then
      return 0
    fi
  done
  return 1
}

: > "$SNAPSHOT/worker-staged-paths.txt"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if path_in_spec "$f" "$@"; then
    printf '%s\n' "$f"
  fi
done < "$SNAPSHOT/worker-paths.txt" | sort -u > "$SNAPSHOT/worker-staged-paths.txt"

tr '\0' '\n' < "$SNAPSHOT/deletions.z" | sed '/^$/d' | sort -u > "$SNAPSHOT/intentional-deletions.txt"

reapply_snapshot() {
  if [ -d "$SNAPSHOT/files" ]; then
    while IFS= read -r -d '' src; do
      rel="${src#"$SNAPSHOT/files/"}"
      mkdir -p "$(dirname "$rel")"
      cp -a "$src" "$rel"
    done < <(find "$SNAPSHOT/files" -type f -print0)
  fi
  while IFS= read -r -d '' f; do
    [ -n "$f" ] || continue
    rm -rf -- "$f"
  done < "$SNAPSHOT/deletions.z"
  return 0
}

for attempt in 1 2 3 4 5; do
  git fetch origin "$branch"
  UPSTREAM="$(git rev-parse "origin/${branch}")"

  if [ "$UPSTREAM" != "$ORIGINAL_BASE" ]; then
    git diff --name-only "$ORIGINAL_BASE" "$UPSTREAM" | sed '/^$/d' | sort -u > "$SNAPSHOT/upstream-paths.txt" || true
    overlap="$(comm -12 "$SNAPSHOT/worker-staged-paths.txt" "$SNAPSHOT/upstream-paths.txt" || true)"
    if [ -n "$overlap" ]; then
      echo "Refusing to push: origin/${branch} changed paths this run also edited:" >&2
      printf '%s\n' "$overlap" >&2
      echo "Recompute from origin/${branch} and retry. No commit was pushed." >&2
      exit 42
    fi
  fi

  git reset --hard "$UPSTREAM"
  git clean -fd

  reapply_snapshot

  git add -- "$@"

  if git diff --staged --quiet; then
    echo "No staged changes — skip commit"
    exit 0
  fi

  git diff --cached --name-only --diff-filter=D | sed '/^$/d' | sort -u > "$SNAPSHOT/staged-deletions.txt" || true
  unexpected="$(comm -13 "$SNAPSHOT/intentional-deletions.txt" "$SNAPSHOT/staged-deletions.txt" || true)"
  if [ -n "$unexpected" ]; then
    echo "Refusing to delete paths this run did not remove:" >&2
    printf '%s\n' "$unexpected" >&2
    exit 42
  fi

  if ! node "$SCRIPT_DIR/schedule-push-guard.mjs"; then
    echo "Refusing to drop scheduled articles or entries this run did not publish." >&2
    exit 42
  fi

  git commit -m "$MSG"

  if git push origin "HEAD:${branch}"; then
    echo "Pushed on attempt ${attempt}"
    exit 0
  fi

  echo "Push rejected (attempt ${attempt}) — retry against latest origin" >&2
  if [ "$attempt" -lt 5 ]; then
    sleep "$retry_sleep"
  fi
done

echo "git push failed after 5 attempts" >&2
exit 1
