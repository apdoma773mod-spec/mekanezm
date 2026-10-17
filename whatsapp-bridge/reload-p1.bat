@echo off
chcp 65001 >nul
title Reload personal number 1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? { $_.CommandLine -match 'bridge-personal\.js p1' } | %% { Stop-Process -Id $_.ProcessId -Force }"
echo.
echo   Number 1 will restart by itself in about 15 seconds with the new settings.
echo.
timeout /t 20 >nul
