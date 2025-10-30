@echo off
echo.
echo ========================================
echo   DEPLOY AUTOMATICO - CRM v2.0
echo ========================================
echo.

REM Cores para PowerShell
powershell Write-Host "🔍 Verificando mudancas..." -ForegroundColor Cyan

REM Ir para o diretorio do projeto
cd /d "%~dp0"

REM Adicionar todos os arquivos
git add -A

REM Verificar se ha mudancas
git diff --staged --quiet
if %errorlevel% equ 0 (
    powershell Write-Host "✅ Nenhuma mudanca para commitar" -ForegroundColor Green
    powershell Write-Host "📡 Verificando status do GitHub..." -ForegroundColor Cyan
    git status
) else (
    powershell Write-Host "📦 Commitando mudancas..." -ForegroundColor Yellow
    git commit -m "Deploy automatico: %date% %time%"
    
    powershell Write-Host "🚀 Enviando para o GitHub..." -ForegroundColor Cyan
    git push origin main
    
    if %errorlevel% equ 0 (
        powershell Write-Host "✅ Push realizado com sucesso!" -ForegroundColor Green
    ) else (
        powershell Write-Host "❌ Erro ao fazer push!" -ForegroundColor Red
        pause
        exit /b 1
    )
)

echo.
powershell Write-Host "========================================" -ForegroundColor Cyan
powershell Write-Host "  DEPLOY AUTOMATICO EM PROGRESSO" -ForegroundColor Yellow
powershell Write-Host "========================================" -ForegroundColor Cyan
echo.

powershell Write-Host "✅ GitHub: Atualizado" -ForegroundColor Green
powershell Write-Host "⏳ Vercel: Deploy sera iniciado automaticamente" -ForegroundColor Yellow
powershell Write-Host "⏳ Railway: Deploy sera iniciado automaticamente (se configurado)" -ForegroundColor Yellow

echo.
echo Proximos passos:
echo.
echo 1. Acesse: https://vercel.com/dashboard
echo 2. Veja o deploy em progresso
echo 3. Aguarde 2-3 minutos
echo 4. Teste o sistema na URL gerada
echo.
echo URL esperada: https://ia-agente.vercel.app
echo.

powershell Write-Host "🎉 Deploy iniciado com sucesso!" -ForegroundColor Green
echo.

pause

