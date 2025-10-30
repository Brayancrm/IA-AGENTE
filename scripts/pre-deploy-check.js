#!/usr/bin/env node

/**
 * Script de Verificação Pré-Deploy
 * Verifica se tudo está pronto antes de fazer deploy
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando sistema antes do deploy...\n');

let hasErrors = false;
let warnings = [];

// 1. Verificar arquivos essenciais
console.log('📁 Verificando arquivos essenciais...');
const essentialFiles = [
  'package.json',
  'next.config.js',
  'components/FirebaseApp.jsx',
  'components/CRMDashboard.jsx',
  'components/SimpleLanding.jsx',
  'app/page.tsx',
  'hooks/useFirebase.js'
];

essentialFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - NÃO ENCONTRADO!`);
    hasErrors = true;
  }
});

// 2. Verificar package.json
console.log('\n📦 Verificando package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Verificar scripts necessários
  const requiredScripts = ['dev', 'build', 'start'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`  ✅ Script "${script}" encontrado`);
    } else {
      console.log(`  ❌ Script "${script}" não encontrado!`);
      hasErrors = true;
    }
  });
  
  // Verificar dependências principais
  const requiredDeps = ['next', 'react', 'firebase', 'lucide-react'];
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`  ✅ Dependência "${dep}" instalada`);
    } else {
      console.log(`  ❌ Dependência "${dep}" não encontrada!`);
      hasErrors = true;
    }
  });
} catch (error) {
  console.log(`  ❌ Erro ao ler package.json: ${error.message}`);
  hasErrors = true;
}

// 3. Verificar variáveis de ambiente
console.log('\n🔐 Verificando variáveis de ambiente...');
const envExample = 'env.example';
if (fs.existsSync(envExample)) {
  console.log(`  ✅ ${envExample} existe`);
  
  // Ler variáveis necessárias
  const envContent = fs.readFileSync(envExample, 'utf8');
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_APP_ID'
  ];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      console.log(`  ✅ ${varName} definida em env.example`);
    } else {
      console.log(`  ⚠️  ${varName} não encontrada em env.example`);
      warnings.push(`Variável ${varName} não está em env.example`);
    }
  });
} else {
  console.log(`  ⚠️  ${envExample} não encontrado`);
  warnings.push('env.example não existe');
}

// 4. Verificar estrutura de diretórios
console.log('\n📂 Verificando estrutura de diretórios...');
const requiredDirs = [
  'app',
  'components',
  'hooks',
  'public',
  'constants'
];

requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`  ✅ ${dir}/`);
  } else {
    console.log(`  ❌ ${dir}/ - NÃO ENCONTRADO!`);
    hasErrors = true;
  }
});

// 5. Verificar build (se node_modules existir)
if (fs.existsSync('node_modules')) {
  console.log('\n🔨 Testando build...');
  try {
    const { execSync } = require('child_process');
    console.log('  ⏳ Executando: npm run build');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('  ✅ Build bem-sucedido!');
  } catch (error) {
    console.log('  ❌ Erro no build!');
    console.log('  Detalhes:', error.message);
    hasErrors = true;
  }
} else {
  console.log('\n⚠️  node_modules não encontrado. Execute: npm install');
  warnings.push('Dependências não instaladas. Execute npm install antes do deploy.');
}

// 6. Verificar tamanho dos arquivos
console.log('\n📊 Verificando tamanho dos arquivos principais...');
const filesToCheck = [
  'components/FirebaseApp.jsx',
  'components/CRMDashboard.jsx'
];

filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`  📄 ${file}: ${sizeKB} KB`);
    
    if (stats.size > 100000) { // > 100KB
      warnings.push(`${file} é muito grande (${sizeKB} KB). Considere otimizar.`);
    }
  }
});

// 7. Resumo final
console.log('\n' + '='.repeat(50));
console.log('📋 RESUMO DA VERIFICAÇÃO');
console.log('='.repeat(50));

if (hasErrors) {
  console.log('\n❌ ERROS ENCONTRADOS!');
  console.log('\nO sistema tem problemas que precisam ser corrigidos antes do deploy.');
  console.log('Revise os erros acima e corrija-os.\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n⚠️  AVISOS:');
  warnings.forEach((warning, index) => {
    console.log(`  ${index + 1}. ${warning}`);
  });
  console.log('\n✅ Sistema pronto para deploy, mas considere resolver os avisos.');
  console.log('Para fazer deploy na Vercel, execute: vercel deploy\n');
  process.exit(0);
} else {
  console.log('\n✅ TUDO OK!');
  console.log('\n🚀 Sistema pronto para deploy!');
  console.log('\nPróximos passos:');
  console.log('  1. Commit suas alterações: git add . && git commit -m "Deploy com CRM"');
  console.log('  2. Push para o GitHub: git push origin main');
  console.log('  3. Vercel fará deploy automático!');
  console.log('  OU');
  console.log('  Execute: vercel deploy\n');
  process.exit(0);
}

