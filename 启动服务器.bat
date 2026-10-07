@echo off
setlocal
cd /d "%~dp0"

set "NODE_DIR=%~dp0node-v24.19.0-win-x64"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Run the setup bat in this folder first, or install Node.js from https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing dependencies (about 1 min, needs internet)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Dependency install failed. Check your network and try again.
    pause
    exit /b 1
  )
)

echo Starting server... Keep this window open. Closing it stops the server.
echo.
call npm start
pause
