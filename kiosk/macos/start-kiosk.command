#!/bin/bash
# Isla Kiosk - macOS launcher (Google Chrome kiosk mode).
# Double-click in Finder, or add to System Settings > General > Login Items
# on an auto-login kiosk user. Staff exit: Cmd+Q (with a keyboard).
KIOSK_URL="${KIOSK_URL:-http://localhost:8080/?view=portrait&preview=0&keyboard=always}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ "$KIOSK_URL" == *localhost* || "$KIOSK_URL" == *127.0.0.1* ]]; then
  if command -v node >/dev/null 2>&1; then
    (cd "$APP_DIR" && nohup node server.js >/tmp/isla-kiosk-server.log 2>&1 &)
    sleep 2
  else
    echo "Node.js not found - host the app on a web server and set KIOSK_URL." >&2
  fi
fi

# Keep the display awake while the kiosk runs
caffeinate -dimsu -w $$ &

open -na "Google Chrome" --args --kiosk "$KIOSK_URL" --no-first-run --disable-pinch \
  --overscroll-history-navigation=0 --noerrdialogs --disable-translate --disable-session-crashed-bubble \
  --user-data-dir="$HOME/.isla-kiosk-chrome"
