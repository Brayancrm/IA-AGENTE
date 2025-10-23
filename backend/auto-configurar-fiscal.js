// Script que detecta automaticamente o userId e configura fiscal
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://ia-agente-b2f46.firebaseio.com'
  });
}

const db = admin.database();

const fiscalConfig = {
  enabled: true,
  municipalServiceCode: '0101',
  municipalServiceDescription: 'Análise e desenvolvimento de sistemas',
  issRate: 5, // ✅ 5% de ISS - IMPORTANTE!
  retainIss: false,
  cofinsRate: 0,
  csllRate: 0,
  inssRate: 0,
  irRate: 0,
  pisRate: 0,
  deductions: 0,
  observations: 'Nota fiscal emitida automaticamente',
  updatedAt: new Date().toISOString()
};

async function configurar() {
  try {
    console.log('🔍 Buscando usuários no Firebase...\n');
    
    // Buscar todos os usuários
    const usersRef = db.ref('users/data');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val();
    
    if (!users) {
      console.error('❌ Nenhum usuário encontrado no Firebase!');
      process.exit(1);
    }
    
    const userIds = Object.keys(users);
    console.log(`📋 Encontrados ${userIds.length} usuário(s):\n`);
    
    // Mostrar usuários
    userIds.forEach((userId, index) => {
      const userData = users[userId];
      console.log(`${index + 1}. userId: ${userId}`);
      if (userData.email) console.log(`   Email: ${userData.email}`);
      if (userData.name) console.log(`   Nome: ${userData.name}`);
      console.log();
    });
    
    // Configurar para TODOS os usuários
    console.log('💾 Salvando configuração fiscal para todos os usuários...\n');
    
    for (const userId of userIds) {
      const fiscalConfigRef = db.ref(`users/data/${userId}/fiscal_config`);
      await fiscalConfigRef.set(fiscalConfig);
      console.log(`✅ Configurado para userId: ${userId}`);
    }
    
    console.log('\n🎉 Configuração fiscal salva com sucesso para todos os usuários!');
    console.log('\n📋 Configuração aplicada:');
    console.log('   - Código municipal: 0101');
    console.log('   - ISS Rate: 5%');
    console.log('   - Descrição: Análise e desenvolvimento de sistemas');
    
    // Verificar
    console.log('\n🔍 Verificando configuração salva...');
    const firstUserId = userIds[0];
    const verifyRef = db.ref(`users/data/${firstUserId}/fiscal_config`);
    const verifySnapshot = await verifyRef.once('value');
    const saved = verifySnapshot.val();
    
    if (saved && saved.issRate === 5) {
      console.log('✅ Verificação OK - ISS configurado como 5%');
    } else {
      console.log('⚠️ Atenção - Verifique manualmente');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

configurar();

