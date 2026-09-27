@echo off
title Push SmartTime AI to GitHub
echo ====================================================
echo      PUSHING TO GITHUB (manahilj013-eng/AI-Calendar-project)
echo ====================================================
echo.
set "PATH=%~dp0.bin\git\cmd;%~dp0.bin\node-v22.14.0-win-x64;%PATH%"

echo Checking Git status...
git status
echo.
echo Pushing latest commits to GitHub...
git push origin main
echo.
pause
