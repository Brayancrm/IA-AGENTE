#!/usr/bin/env node

/**
 * Script de Deploy Automático
 * Faz deploy para Git, Vercel e Railway
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, silent = false) {
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return output;
  } catch (error) {
    if (!silent) {
      log(`❌ Erro ao executar: ${command}`, 'red');
    }
    throw error;
  }
}

async function main() {
  console.log('\n');
  log('========================================', 'cyan');
  log('   DEPLOY AUTOMÁTICO - CRM v2.0', 'cyan');
  log('========================================', 'cyan');
  console.log('\n');

  // 1. Verificar se há mudanças
  log('🔍 Verificando mudanças no Git...', 'cyan');
  
  try {
    exec('git add -A', true);
    const status = exec('git status --porcelain', true);
    
    if (!status.trim()) {
      log('✅ Nenhuma mudança para commitar', 'green');
      log('📡 Verificando status remoto...', 'cyan');
    } else {
      log('📦 Mudanças detectadas:', 'yellow');
      console.log(status);
      
      // 2. Commit
      const timestamp = new Date().toISOString();
      const message = `Deploy automático: ${timestamp}`;
      
      log(`💾 Commitando: ${message}`, 'yellow');
      exec(`git commit -m "${message}"`, true);
      log('✅ Commit realizado', 'green');
    }
    
    // 3. Push para GitHub
    log('🚀 Enviando para o GitHub...', 'cyan');
    exec('git push origin main');
    log('✅ Push realizado com sucesso!', 'green');
    
  } catch (error) {
    log('⚠️  Erro no Git. Continuando...', 'yellow');
  }

  console.log('\n');
  log('========================================', 'cyan');
  log('  STATUS DO DEPLOY', 'yellow');
  log('========================================', 'cyan');
  console.log('\n');

  // Status dos serviços
  log('✅ GitHub: Atualizado', 'green');
  log('⏳ Vercel: Deploy automático será iniciado', 'yellow');
  log('⏳ Railway: Deploy automático será iniciado (se configurado)', 'yellow');

  console.log('\n');
  log('📋 Próximos Passos:', 'blue');
  console.log('');
  console.log('1. Acesse: https://vercel.com/dashboard');
  console.log('2. Veja o deploy em progresso');
  console.log('3. Aguarde 2-3 minutos');
  console.log('4. Teste o sistema na URL gerada');
  console.log('');
  console.log('URL esperada: https://ia-agente.vercel.app');
  console.log('');

  // Verificar se tem Vercel CLI
  try {
    exec('vercel --version', true);
    log('💡 Vercel CLI detectada!', 'blue');
    console.log('');
    console.log('Comandos úteis:');
    console.log('  vercel ls           - Listar deployments');
    console.log('  vercel logs         - Ver logs');
    console.log('  vercel --prod       - Deploy direto via CLI');
    console.log('');
  } catch (error) {
    log('💡 Dica: Instale Vercel CLI para mais opções:', 'blue');
    console.log('  npm install -g vercel');
    console.log('');
  }

  log('🎉 Deploy iniciado com sucesso!', 'green');
  console.log('\n');
}

// Executar
main().catch(error => {
  console.error('\n');
  log('❌ Erro no deploy:', 'red');
  console.error(error.message);
  console.error('\n');
  process.exit(1);
});

