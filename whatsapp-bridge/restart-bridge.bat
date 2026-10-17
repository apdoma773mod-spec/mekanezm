@echo off
rem restart the WhatsApp bridge (start.bat brings it back in 10 seconds)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? { $_.CommandLine -match 'bridge\.js' } | %% { Stop-Process -Id $_.ProcessId -Force }"
echo Bridge restarting... this window closes in 5 seconds
timeout /t 5 >nul
