

param(
  [string]$Url = "http://localhost:8080/?keyboard=always",
  [ValidateSet("edge", "chrome")] [string]$Browser = "edge"
)
$appDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")

if ($Url -match "localhost|127\.0\.0\.1") {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    Start-Process node -ArgumentList "`"$appDir\server.js`"" -WindowStyle Minimized
    Start-Sleep -Seconds 2
  } else { Write-Warning "Node.js not found - host the app on a web server and pass -Url." }
}

if ($Browser -eq "edge") {
  Start-Process "msedge.exe" -ArgumentList "--kiosk `"$Url`" --edge-kiosk-type=fullscreen --kiosk-idle-timeout-minutes=5 --no-first-run --disable-pinch --overscroll-history-navigation=0"
} else {
  $chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
  Start-Process $chrome -ArgumentList "--kiosk `"$Url`" --no-first-run --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-translate --disable-session-crashed-bubble"
}
