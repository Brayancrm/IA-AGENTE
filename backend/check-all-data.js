const admin = require('firebase-admin');
const fs = require('fs');

// Carregar credenciais do Firebase
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (fs.existsSync('./serviceAccountKey.json')) {
  serviceAccount = require('./serviceAccountKey.json');
} else {
  console.error('❌ Credenciais do Firebase não encontradas!');
  process.exit(1);
}

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://ia-agente-b2f46.firebaseio.com' // Mesma URL do server.js
  });
}

const db = admin.database();

async function checkAllData() {
  try {
    console.log('\n🔍 Verificando TODOS os dados no Realtime Database...\n');
    
    // Pegar a raiz inteira
    const rootRef = db.ref('/');
    const snapshot = await rootRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('⚠️ Database completamente vazio!');
      return;
    }
    
    const data = snapshot.val();
    const rootKeys = Object.keys(data);
    
    console.log(`✅ Encontradas ${rootKeys.length} chaves na raiz:\n`);
    
    for (const key of rootKeys) {
      console.log(`\n📂 /${key}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      const keyData = data[key];
      
      if (typeof keyData === 'object' && keyData !== null) {
        const subKeys = Object.keys(keyData);
        console.log(`   📊 Contém ${subKeys.length} itens`);
        
        // Mostrar primeiros 5 sub-itens
        subKeys.slice(0, 5).forEach((subKey, index) => {
          console.log(`   ${index + 1}. ${subKey}`);
          
          // Se for um objeto, mostrar mais detalhes
          if (typeof keyData[subKey] === 'object' && keyData[subKey] !== null) {
            const subSubKeys = Object.keys(keyData[subKey]);
            console.log(`      └─ ${subSubKeys.length} sub-itens: ${subSubKeys.slice(0, 3).join(', ')}${subSubKeys.length > 3 ? '...' : ''}`);
          }
        });
        
        if (subKeys.length > 5) {
          console.log(`   ... e mais ${subKeys.length - 5} itens`);
        }
      } else {
        console.log(`   Valor: ${JSON.stringify(keyData).substring(0, 100)}`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error);
  } finally {
    process.exit(0);
  }
}

checkAllData();

