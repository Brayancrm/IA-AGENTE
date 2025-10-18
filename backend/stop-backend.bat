@echo off
echo ========================================
echo   Parando WhatsApp IA Backend
echo ========================================
echo.

cd /d "%~dp0"

call npm run pm2:stop

echo.
echo Backend parado com sucesso!
echo.
pause

