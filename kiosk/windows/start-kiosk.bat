@echo off
REM ==========================================================================
REM  Isla Kiosk - Windows 10/11 launcher (Microsoft Edge kiosk mode)
REM  1. Edit KIOSK_URL if the app is hosted elsewhere (recommended: an https URL).
REM  2. Put a shortcut to this file in shell:startup (Win+R -> shell:startup)
REM     on an auto-login kiosk account, or use Assigned Access (see README).
REM  Staff exit: Alt+F4 (with a keyboard) or the Windows kiosk exit sequence.
REM ==========================================================================
setlocal
set "APP_DIR=%~dp0..\.."
set "KIOSK_URL=http://localhost:8080/?view=portrait&preview=0&keyboard=always"

REM Start the bundled static server if Node.js is installed and the URL is local
echo "%KIOSK_URL%" | findstr /I "localhost 127.0.0.1" >nul
if %errorlevel%==0 (
  where node >nul 2>nul && start "Isla Kiosk Server" /min node "%APP_DIR%\server.js"
  timeout /t 2 /nobreak >nul
)

REM Edge kiosk: fullscreen, no address bar, auto-reset browsing data after 5 min idle
start "" msedge.exe --kiosk "%KIOSK_URL%" --edge-kiosk-type=fullscreen --kiosk-idle-timeout-minutes=5 ^
  --no-first-run --disable-features=Translate --overscroll-history-navigation=0 --disable-pinch

REM Alternative - Google Chrome:
REM start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk "%KIOSK_URL%" --no-first-run ^
REM   --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-translate --disable-session-crashed-bubble
endlocal
