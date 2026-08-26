#!/bin/sh
set -eu

LABEL=com.ari.insights.visual-worker
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(/usr/bin/id -u)"

/bin/launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
if [ -f "$TARGET" ]; then
  /bin/rm "$TARGET"
fi
echo "uninstalled $LABEL"
