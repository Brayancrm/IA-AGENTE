@echo off
echo ========================================
echo   Status do WhatsApp IA Backend
echo ========================================
echo.

cd /d "%~dp0"

call npm run pm2:status

echo.
pause

