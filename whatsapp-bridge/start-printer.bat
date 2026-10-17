@echo off
rem جسر الطباعة لوحده — مستقل عن جسور واتساب تمامًا، بيعيد نفسه لوحده لو وقع
cd /d C:\mekanizm-whatsapp
:loop
"C:\Program Files\nodejs\node.exe" printer-bridge.js >> printer-bridge-console.txt 2>&1
echo stopped, restarting in 5s...
timeout /t 5 >nul
goto loop
