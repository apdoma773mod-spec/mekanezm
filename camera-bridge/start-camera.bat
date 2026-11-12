@echo off
rem جسر الكاميرات — بيعيد نفسه لوحده لو وقع. لازم camera.config.json جنب الملف ده (فيه باسورد الـDVR، مش في الريبو)
cd /d C:\mekanizm-camera
powershell -NoProfile -Command "if (@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? { $_.CommandLine -match 'bridge\.cjs' }).Count -gt 0) { exit 3 }"
if %errorlevel%==3 goto :eof
:loop
"C:\Program Files\nodejs\node.exe" bridge.cjs >> camera-console.txt 2>&1
echo stopped, restarting in 5s...
ping -n 6 127.0.0.1 >nul
goto loop
