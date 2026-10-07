@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Mingchangmian - One-click Start
echo ==============================================
echo.

set "NODE_VER=v24.19.0"
set "NODE_DIR=%~dp0node-%NODE_VER%-win-x64"
set "NODE_ZIP=node-%NODE_VER%-win-x64.zip"

rem --- 1. Find Node.js: system install first, then portable copy ---
where node >nul 2>nul
if not errorlevel 1 goto HAVE_NODE

if exist "%NODE_DIR%\node.exe" goto HAVE_NODE

rem --- 2. No Node.js: download a portable copy (no admin, no winget) ---
echo Node.js not found. Downloading a portable copy (about 36 MB).
echo This happens only once on this computer. Needs internet.
echo.

echo Downloading...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { (New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/%NODE_VER%/%NODE_ZIP%','%NODE_ZIP%') } catch { exit 1 }"
if errorlevel 1 (
  echo Official site failed. Trying China mirror...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { (New-Object Net.WebClient).DownloadFile('https://npmmirror.com/mirrors/node/%NODE_VER%/%NODE_ZIP%','%NODE_ZIP%') } catch { exit 1 }"
)
if not exist "%NODE_ZIP%" goto DL_FAIL

echo Extracting...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%~dp0' -Force"
if not exist "%NODE_DIR%\node.exe" goto DL_FAIL
del /q "%NODE_ZIP%"

:HAVE_NODE
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"

echo Node.js version:
node -v
echo.

rem --- 3. Install dependencies (first time only) ---
if exist node_modules goto START
echo Installing dependencies (about 1 min, needs internet)...
call npm install
if errorlevel 1 goto DEPS_FAIL

:START
echo.
echo Starting server... Keep this window open. Closing it stops the server.
echo.
call npm start
goto END

:DL_FAIL
echo.
echo [ERROR] Could not download Node.js. Check your internet and try again.
goto END

:DEPS_FAIL
echo.
echo [ERROR] Dependency install failed. Check your network and try again.
goto END

:END
echo.
pause
