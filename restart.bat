@echo off
title Restart Fixed Asset Movement Services
echo ===================================================
echo   Restarting Fixed Asset Movement Services
echo ===================================================
echo.
echo Terminating previous background node instances...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Starting fresh services...
call "%~dp0start.bat"

