@echo off
echo.
echo  NEXUS — Starting local HTTPS server...
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js not found.
    echo  Download from https://nodejs.org/  (LTS version)
    echo.
    pause
    exit /b 1
)

node "%~dp0serve.js"
pause
