

KIOSK_URL="${KIOSK_URL:-http://localhost:8080/?keyboard=always}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "$KIOSK_URL" == *localhost* ]] && command -v node >/dev/null; then
  (cd "$APP_DIR" && nohup node server.js >/tmp/isla-kiosk-server.log 2>&1 &); sleep 2
fi
xset s off; xset -dpms; xset s noblank 2>/dev/null || true
BROWSER=$(command -v chromium-browser || command -v chromium || command -v google-chrome)
exec "$BROWSER" --kiosk "$KIOSK_URL" --noerrdialogs --disable-infobars --disable-pinch \
  --overscroll-history-navigation=0 --disable-translate --disable-session-crashed-bubble --check-for-update-interval=31536000
