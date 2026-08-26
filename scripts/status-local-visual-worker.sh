#!/bin/sh
set -eu

LABEL=com.ari.insights.visual-worker
DOMAIN="gui/$(/usr/bin/id -u)"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"

if /bin/launchctl print "$DOMAIN/$LABEL" 2>/dev/null; then
  exit 0
fi
if [ -f "$TARGET" ]; then
  echo "plist present but not bootstrapped: $TARGET"
else
  echo "NOT INSTALLED"
fi
