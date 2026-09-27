@echo off
rem FRC 9427 Simulator - double-click to start.
rem Starts the bridge (runs the robot project in simulation) and the web UI, then opens the browser.
rem The robot project is the one last picked in the UI (Robot > Code & bindings), remembered in sim-config.json.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing packages, this takes a minute...
  call npm install
  if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )
)

rem already running? just open the page
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if not errorlevel 1 (
  start "" http://localhost:5173
  exit /b 0
)

start "FRC9427 Sim - bridge" /min cmd /k node bridge/server.mjs
start "FRC9427 Sim - web" /min cmd /k npx vite --port 5173
echo Starting the simulator...
timeout /t 5 /nobreak >nul
start "" http://localhost:5173
echo.
echo Simulator is running (two minimised windows). Close them, or run stop.bat, to shut it down.
timeout /t 5 >nul
