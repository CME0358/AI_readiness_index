#!/usr/bin/env bash
# Safe git commit + push for GitHub Actions.
#
# Commits worker output on top of the latest origin branch without
# commit-then-rebase (which repeatedly conflicts on insights/index.html and
# insights/_scheduled/schedule.json when multiple publishing workflows overlap).
#
# Usage: scripts/lib/gha-git-push.sh "Commit message" path1 path2 ...
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: gha-git-push.sh <message> <paths...>" >&2
  exit 1
fi

MSG="$1"
shift

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

branch="${GITHUB_REF_NAME:-main}"

for attempt in 1 2 3 4 5; do
  git fetch origin "$branch"

  # Preserve worker modifications in the working tree; align HEAD/index to remote.
  git reset --mixed "origin/${branch}"

  git add "$@"

  if git diff --staged --quiet; then
    echo "No staged changes — skip commit"
    exit 0
  fi

  git commit -m "$MSG"

  if git push origin "HEAD:${branch}"; then
    echo "Pushed on attempt ${attempt}"
    exit 0
  fi

  # Non-FF push — drop the local commit but keep working-tree edits for retry.
  git reset --mixed HEAD~1
  echo "Push failed (attempt ${attempt}) — retry in 5s"
  sleep 5
done

echo "git push failed after 5 attempts" >&2
exit 1
