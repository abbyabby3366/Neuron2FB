@echo off
cd /d C:\Users\user\Desktop\Neuronwin

:loop
start /b cmd /c "npm run start"
timeout /t 1000 /nobreak
taskkill /F /IM node.exe
taskkill /F /IM "chrome.exe"
timeout /t 10 /nobreak
goto loop