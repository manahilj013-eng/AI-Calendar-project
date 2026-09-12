@echo off
title SmartTime AI
echo ====================================================
echo           SMARTTIME AI - STARTING APPLICATION
echo      "Your Schedule. Automatically Organized."
echo ====================================================
echo.

set "PATH=%~dp0.bin\node-v22.14.0-win-x64;%PATH%"

echo Starting server on http://localhost:3000...
start http://localhost:3000
node server/index.js
pause
