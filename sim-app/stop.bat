@echo off
rem Stops everything start.bat started (the bridge also stops the robot program it launched).
taskkill /FI "WINDOWTITLE eq FRC9427 Sim - bridge*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq FRC9427 Sim - web*" /T /F >nul 2>nul
echo Simulator stopped.
timeout /t 2 >nul
