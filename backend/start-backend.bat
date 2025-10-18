    @echo off
echo ========================================
echo   WhatsApp IA Backend - Inicializador
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando instalacao do Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js: https://nodejs.org
    pause
    exit /b 1
)
echo     OK - Node.js instalado

echo.
echo [2/3] Verificando dependencias...
if not exist "node_modules\" (
    echo     Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias
        pause
        exit /b 1
    )
)
echo     OK - Dependencias instaladas

echo.
echo [3/3] Iniciando backend com PM2...
call npm run pm2:start

echo.
echo ========================================
echo   Backend iniciado com sucesso!
echo ========================================
echo.
echo Comandos uteis:
echo   - Ver status:  npm run pm2:status
echo   - Ver logs:    npm run pm2:logs
echo   - Parar:       npm run pm2:stop
echo   - Reiniciar:   npm run pm2:restart
echo.
echo O backend continuara rodando mesmo se voce fechar esta janela.
echo Acesse: http://localhost:3001
echo.
pause

