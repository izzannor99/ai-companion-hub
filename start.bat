@echo off
title Offline AI Chat - Development Server
echo ========================================
echo   Offline AI Chat - Starting...
echo ========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting development server...
echo Frontend will be available at: http://localhost:8080
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

:: Start the dev server and open browser
start "" http://localhost:8080
npm run dev
