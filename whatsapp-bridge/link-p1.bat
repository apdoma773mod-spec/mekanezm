@echo off
chcp 65001 >nul
cd /d C:\mekanizm-whatsapp
title Link personal WhatsApp number 1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? { $_.CommandLine -match 'bridge-personal\.js p1' } | %% { Stop-Process -Id $_.ProcessId -Force }"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ? { $_.CommandLine -match 'mkwa-personal\\session-p1' } | %% { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"
echo.
echo   Scan the QR code with WhatsApp on your personal number 1
echo   WhatsApp - Settings - Linked devices - Link a device
echo.
"C:\Program Files\nodejs\node.exe" bridge-personal.js p1 --link
if %errorlevel%==0 (
  wscript "C:\mekanizm-whatsapp\start-personal-hidden.vbs" p1
  echo   Done: number 1 is linked and running in the background.
)
timeout /t 10 >nul
