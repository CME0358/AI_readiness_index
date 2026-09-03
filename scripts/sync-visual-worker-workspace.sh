#!/bin/sh
# Sync the dedicated launchd Visual Worker workspace to origin/main.
# Safe to run on ARI_VISUAL_WORKER_WORKSPACE only — never on dev clones.
set -eu

WORKSPACE="${ARI_VISUAL_WORKER_WORKSPACE:-$HOME/ARIInsightsVisualWorker}"
BRANCH="${ARI_VISUAL_WORKER_BRANCH:-main}"
REMOTE="${ARI_VISUAL_WORKER_REMOTE:-origin}"
EXPECTED_REPO_SUBSTR="${ARI_VISUAL_WORKER_EXPECTED_REPO:-CME0358/AI_readiness_index}"
RUNTIME_MARKER=".ari-visual-worker-runtime"
DEFAULT_WORKSPACE="$HOME/ARIInsightsVisualWorker"

fail_identity() {
  echo "VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH: $1" >&2
  exit 1
}

if [ ! -d "$WORKSPACE/.git" ]; then
  echo "VISUAL_WORKER_SYNC_NO_REPO: $WORKSPACE" >&2
  exit 1
fi

if [ -n "${ARI_VISUAL_WORKER_SYNC_SKIP:-}" ]; then
  echo "VISUAL_WORKER_SYNC_SKIPPED"
  exit 0
fi

RESOLVED_WORKSPACE="$(/usr/bin/python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$WORKSPACE")"
EXPECTED_RESOLVED="$(/usr/bin/python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$DEFAULT_WORKSPACE")"

if [ "$RESOLVED_WORKSPACE" != "$EXPECTED_RESOLVED" ]; then
  fail_identity "resolved workspace must be dedicated runtime clone ($EXPECTED_RESOLVED), got $RESOLVED_WORKSPACE"
fi

case "$RESOLVED_WORKSPACE" in
  *Obsidian_Vault*|*"/Downloads/"*|*"/Documents/"*)
    fail_identity "refusing sync on user development path ($RESOLVED_WORKSPACE)"
    ;;
esac

cd "$RESOLVED_WORKSPACE"
REMOTE_URL="$(/usr/bin/git remote get-url "$REMOTE" 2>/dev/null || true)"
case "$REMOTE_URL" in
  *"$EXPECTED_REPO_SUBSTR"*) ;;
  *) fail_identity "remote origin must reference $EXPECTED_REPO_SUBSTR (got ${REMOTE_URL:-missing})" ;;
esac

/usr/bin/git fetch --prune "$REMOTE"

if [ ! -f "$RUNTIME_MARKER" ]; then
  if ! /usr/bin/git cat-file -e "$REMOTE/$BRANCH:$RUNTIME_MARKER" 2>/dev/null; then
    fail_identity "missing runtime marker $RUNTIME_MARKER on origin/$BRANCH"
  fi
fi

TARGET_SHA="$(/usr/bin/git rev-parse "$REMOTE/$BRANCH")"
CURRENT_SHA="$(/usr/bin/git rev-parse HEAD)"
/usr/bin/git reset --hard "$TARGET_SHA"
/usr/bin/git clean -fd
AFTER_SHA="$(/usr/bin/git rev-parse HEAD)"

echo "VISUAL_WORKER_SYNC_OK workspace=$RESOLVED_WORKSPACE origin_main_sha=$TARGET_SHA head_before=$CURRENT_SHA head_after=$AFTER_SHA"

if [ "$AFTER_SHA" != "$TARGET_SHA" ]; then
  fail_identity "post-sync HEAD does not match origin/$BRANCH"
fi
