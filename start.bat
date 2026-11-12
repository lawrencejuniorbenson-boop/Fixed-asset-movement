@echo off
title Fixed Asset Movement Platform
echo ===================================================
echo   Fixed Asset Movement Platform - Starting Services
echo ===================================================
echo.

:: Free up ports 3001 and 5173 if previously running
echo Clearing any previous background instances...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5174" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Starting Backend API on http://localhost:3001 ...
start "Fixed Asset Backend (Port 3001)" cmd /k "cd /d "%~dp0backend" && npm.cmd start"

timeout /t 3 /nobreak >nul

echo Starting Frontend UI on http://localhost:5173 ...
start "Fixed Asset Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

echo.
echo ===================================================
echo   Services are running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001/api
echo ===================================================
echo.
pause
