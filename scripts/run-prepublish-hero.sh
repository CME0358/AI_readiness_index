#!/bin/sh
# Insights heroes: Codex Native (`codex exec`) + convert-webp.mjs only.
# A missing toolchain exits INSIGHTS_HERO_TOOLCHAIN_MISSING. Do not draw a hero another way.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

export HOME="${HOME:-$(/usr/bin/dscl . -read /Users/$(/usr/bin/id -un) NFSHomeDirectory 2>/dev/null | /usr/bin/awk '{print $2}')}"
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export ARI_VISUAL_WORKER_LOG_DIR="${ARI_VISUAL_WORKER_LOG_DIR:-$HOME/Library/Logs/ARIInsightsVisualWorker}"
export ARI_VISUAL_WORKER_LOCK_PATH="${ARI_VISUAL_WORKER_LOCK_PATH:-/private/tmp/ari-insights-prepublish-hero.lock}"

# Production launchd workspace must track origin/main before each run.
if [ -z "${ARI_VISUAL_WORKER_SYNC_SKIP:-}" ]; then
  /bin/sh "$SCRIPT_DIR/sync-visual-worker-workspace.sh"
fi

exec /usr/bin/env node "$SCRIPT_DIR/run-prepublish-hero.mjs" --root "$REPO_ROOT" "$@"
