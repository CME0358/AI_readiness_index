#!/bin/sh
# Sync the dedicated launchd Visual Worker workspace to origin/main.
# Safe to run on ARI_VISUAL_WORKER_WORKSPACE only — never on dev clones.
set -eu

WORKSPACE="${ARI_VISUAL_WORKER_WORKSPACE:-$HOME/ARIInsightsVisualWorker}"
BRANCH="${ARI_VISUAL_WORKER_BRANCH:-main}"
REMOTE="${ARI_VISUAL_WORKER_REMOTE:-origin}"

if [ ! -d "$WORKSPACE/.git" ]; then
  echo "VISUAL_WORKER_SYNC_NO_REPO: $WORKSPACE" >&2
  exit 1
fi

if [ -n "${ARI_VISUAL_WORKER_SYNC_SKIP:-}" ]; then
  echo "VISUAL_WORKER_SYNC_SKIPPED"
  exit 0
fi

cd "$WORKSPACE"
/usr/bin/git fetch --prune "$REMOTE"
TARGET_SHA="$(/usr/bin/git rev-parse "$REMOTE/$BRANCH")"
CURRENT_SHA="$(/usr/bin/git rev-parse HEAD)"
/usr/bin/git reset --hard "$TARGET_SHA"
/usr/bin/git clean -fd

echo "VISUAL_WORKER_SYNC_OK workspace=$WORKSPACE sha=$TARGET_SHA previous=$CURRENT_SHA"
