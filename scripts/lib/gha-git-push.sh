#!/usr/bin/env bash
# Safe git commit + push for GitHub Actions (rebase on concurrent workflow commits).
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

git add "$@"

if git diff --staged --quiet; then
  echo "No staged changes — skip commit"
  exit 0
fi

git commit -m "$MSG"

branch="${GITHUB_REF_NAME:-main}"
for attempt in 1 2 3 4 5; do
  if git pull --rebase origin "$branch"; then
    if git push origin "HEAD:${branch}"; then
      echo "Pushed on attempt ${attempt}"
      exit 0
    fi
  else
    git rebase --abort 2>/dev/null || true
  fi
  echo "Push/rebase failed (attempt ${attempt}) — retry in 5s"
  sleep 5
done

echo "git push failed after 5 attempts" >&2
exit 1
