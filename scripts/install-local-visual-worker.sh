#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
LABEL=com.ari.insights.visual-worker
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="${HOME}/Library/Logs/ARIInsightsVisualWorker"
WORKSPACE="${ARI_VISUAL_WORKER_WORKSPACE:-$HOME/ARIInsightsVisualWorker}"
REPO_URL="${ARI_VISUAL_WORKER_REPO_URL:-https://github.com/CME0358/AI_readiness_index.git}"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if [ ! -d "$WORKSPACE/.git" ]; then
  if [ -e "$WORKSPACE" ]; then
    echo "VISUAL_WORKER_INSTALL_DIR_NOT_EMPTY: $WORKSPACE" >&2
    exit 1
  fi
  /usr/bin/git clone "$REPO_URL" "$WORKSPACE"
else
  if [ -n "$(/usr/bin/git -C "$WORKSPACE" status --porcelain)" ]; then
    echo "VISUAL_WORKER_INSTALL_DIR_DIRTY: $WORKSPACE" >&2
    exit 1
  fi
  /usr/bin/git -C "$WORKSPACE" fetch --prune origin
fi

if [ "$(/usr/bin/git -C "$WORKSPACE" rev-parse HEAD)" != "$(/usr/bin/git -C "$WORKSPACE" rev-parse origin/main)" ]; then
  echo "VISUAL_WORKER_INSTALL_WORKSPACE_NOT_AT_ORIGIN_MAIN: $WORKSPACE" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
sed \
  -e "s|__ARI_WORKER_REPO__|$WORKSPACE|g" \
  -e "s|__ARI_HOME__|$HOME|g" \
  -e "s|__ARI_CODEX_HOME__|${CODEX_HOME:-$HOME/.codex}|g" \
  -e "s|__ARI_LOG_DIR__|$LOG_DIR|g" \
  "$REPO_ROOT/launchd/$LABEL.plist" > "$TARGET"

/usr/bin/plutil -lint "$TARGET"
/bin/launchctl bootstrap "gui/$(/usr/bin/id -u)" "$TARGET"
/bin/launchctl print "gui/$(/usr/bin/id -u)/$LABEL"
