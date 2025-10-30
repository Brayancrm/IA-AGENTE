@echo off
echo.
echo ========================================
echo   FORCANDO DEPLOY NA VERCEL
echo ========================================
echo.

REM Cores para PowerShell
powershell Write-Host "🔧 Verificando Vercel CLI..." -ForegroundColor Cyan

REM Verificar se Vercel CLI esta instalada
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    powershell Write-Host "❌ Vercel CLI nao encontrada!" -ForegroundColor Red
    echo.
    echo Instalando Vercel CLI...
    npm install -g vercel
    echo.
)

powershell Write-Host "✅ Vercel CLI encontrada" -ForegroundColor Green
echo.

powershell Write-Host "🚀 Iniciando deploy forçado na Vercel..." -ForegroundColor Yellow
echo.

REM Fazer login (se necessario)
echo Verificando autenticacao...
vercel whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    powershell Write-Host "🔐 Fazendo login na Vercel..." -ForegroundColor Cyan
    vercel login
    echo.
)

REM Deploy forçado
powershell Write-Host "⚡ Forcando novo deploy..." -ForegroundColor Yellow
vercel --prod --force

if %errorlevel% equ 0 (
    echo.
    powershell Write-Host "✅ Deploy forçado com sucesso!" -ForegroundColor Green
    echo.
    echo Proximos passos:
    echo.
    echo 1. Aguarde 2-3 minutos
    echo 2. Acesse: https://ia-agente.vercel.app
    echo 3. Teste o CRM
    echo.
) else (
    echo.
    powershell Write-Host "❌ Erro ao fazer deploy!" -ForegroundColor Red
    echo.
    echo Tente:
    echo 1. Verificar se esta logado: vercel whoami
    echo 2. Fazer login: vercel login
    echo 3. Tentar novamente
    echo.
)

pause

