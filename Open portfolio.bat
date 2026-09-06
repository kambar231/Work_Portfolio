@echo off
REM Opens the latest portfolio through a local web server. Double-clicking index.html does not work:
REM browsers block module scripts and data files when a page is opened from disk.
cd /d "%~dp0"
powershell -NoProfile -Command "if (-not (Test-NetConnection 127.0.0.1 -Port 8790 -InformationLevel Quiet)) { Start-Process -WindowStyle Minimized python -ArgumentList '-m http.server 8790 --bind 127.0.0.1' }"
timeout /t 2 >nul
start http://localhost:8790/v2/
