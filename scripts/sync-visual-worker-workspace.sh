#!/bin/sh
# Sync the dedicated launchd Visual Worker workspace to origin/main.
# Safe to run on ARI_VISUAL_WORKER_WORKSPACE only — never on dev clones.
set -eu

WORKSPACE="${ARI_VISUAL_WORKER_WORKSPACE:-$HOME/ARIInsightsVisualWorker}"
BRANCH="${ARI_VISUAL_WORKER_BRANCH:-main}"
REMOTE="${ARI_VISUAL_WORKER_REMOTE:-origin}"
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

if [ -n "${ARI_VISUAL_WORKER_EXPECTED_REPO:-}" ]; then
  case "$REMOTE_URL" in
    *"$ARI_VISUAL_WORKER_EXPECTED_REPO"*) ;;
    *) fail_identity "remote origin must reference $ARI_VISUAL_WORKER_EXPECTED_REPO (got ${REMOTE_URL:-missing})" ;;
  esac
else
  if ! /usr/bin/python3 - "$REMOTE_URL" <<'PY'
import re
import sys
from urllib.parse import urlparse

ALLOWED = {
    ("CoaRetail", "AI_readiness_index"),
    ("CME0358", "AI_readiness_index"),
}


def parse_github_owner_repo(url: str):
    url = (url or "").strip()
    if not url:
        return None
    if url.startswith("git@github.com:"):
        path = url.split(":", 1)[1]
    elif url.startswith("ssh://"):
        parsed = urlparse(url)
        if parsed.hostname != "github.com":
            return None
        path = parsed.path.lstrip("/")
    else:
        parsed = urlparse(url)
        if parsed.hostname != "github.com":
            return None
        path = parsed.path.lstrip("/")
    path = re.sub(r"\.git$", "", path)
    parts = [p for p in path.split("/") if p]
    if len(parts) != 2:
        return None
    return parts[0], parts[1]


pair = parse_github_owner_repo(sys.argv[1])
if pair not in ALLOWED:
    sys.exit(1)
PY
  then
    fail_identity "remote must be github.com/CoaRetail/AI_readiness_index or github.com/CME0358/AI_readiness_index (got ${REMOTE_URL:-missing})"
  fi
fi

if [ "${ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY:-}" = "1" ]; then
  echo "VISUAL_WORKER_REMOTE_OK url=$REMOTE_URL"
  exit 0
fi

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
