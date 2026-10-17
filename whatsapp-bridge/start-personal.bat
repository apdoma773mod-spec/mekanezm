@echo off
rem personal WhatsApp number listener (p1 / p2) - listen only, restarts itself
cd /d C:\mekanizm-whatsapp
set LINE=%1
if "%LINE%"=="" set LINE=p1
:loop
rem لو فيه جسر شغال على نفس الرقم من قبل (نسخة مكررة) نخرج من غير ما نقفل كروم بتاعه
powershell -NoProfile -Command "if (@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? { $_.CommandLine -match 'bridge-personal\.js %LINE%( |$)' }).Count -gt 0) { exit 3 }"
if %errorlevel%==3 goto :eof
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ? { $_.CommandLine -match 'mkwa-personal\\session-%LINE%' } | %% { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"
"C:\Program Files\nodejs\node.exe" bridge-personal.js %LINE% >> bridge-%LINE%-console.txt 2>&1
if %errorlevel%==3 goto :eof
echo stopped, restarting in 15s...
timeout /t 15 >nul
goto loop
