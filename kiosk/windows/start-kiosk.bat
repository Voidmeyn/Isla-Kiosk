@echo off







setlocal
set "APP_DIR=%~dp0..\.."
set "KIOSK_URL=http://localhost:8080/?keyboard=always"


echo "%KIOSK_URL%" | findstr /I "localhost 127.0.0.1" >nul
if %errorlevel%==0 (
  where node >nul 2>nul && start "Isla Kiosk Server" /min node "%APP_DIR%\server.js"
  timeout /t 2 /nobreak >nul
)


start "" msedge.exe --kiosk "%KIOSK_URL%" --edge-kiosk-type=fullscreen --kiosk-idle-timeout-minutes=5 ^
  --no-first-run --disable-features=Translate --overscroll-history-navigation=0 --disable-pinch




endlocal
