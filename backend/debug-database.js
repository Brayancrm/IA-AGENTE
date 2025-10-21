// Script de debug para ver estrutura do banco
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ia-agente-b2f46.firebaseio.com"
});

const db = admin.database();

async function debugDatabase() {
  try {
    console.log('🔍 Verificando estrutura do banco de dados...\n');
    
    // Listar nós raiz
    const rootSnapshot = await db.ref('/').once('value');
    const rootData = rootSnapshot.val();
    
    if (!rootData) {
      console.log('❌ Banco de dados está vazio!');
      return;
    }
    
    console.log('📁 Nós no raiz do banco:');
    Object.keys(rootData).forEach(key => {
      console.log(`   - ${key}`);
    });
    
    // Verificar /data
    console.log('\n🔍 Verificando /data...');
    const dataSnapshot = await db.ref('data').once('value');
    const dataValue = dataSnapshot.val();
    
    if (!dataValue) {
      console.log('❌ /data não existe ou está vazio');
    } else {
      console.log('✅ /data existe!');
      console.log('\n👥 Usuários em /data:');
      Object.keys(dataValue).forEach(userId => {
        console.log(`   - ${userId}`);
        if (dataValue[userId].catalog_items) {
          const items = Object.keys(dataValue[userId].catalog_items).length;
          console.log(`     📦 ${items} produto(s) em catalog_items`);
        }
      });
    }
    
    // Verificar /products
    console.log('\n🔍 Verificando /products...');
    const productsSnapshot = await db.ref('products').once('value');
    const productsValue = productsSnapshot.val();
    
    if (!productsValue) {
      console.log('❌ /products não existe ou está vazio (normal antes da migração)');
    } else {
      console.log('✅ /products existe!');
      console.log('\n👥 Usuários em /products:');
      Object.keys(productsValue).forEach(userId => {
        console.log(`   - ${userId}`);
        const items = Object.keys(productsValue[userId]).length;
        console.log(`     📦 ${items} produto(s)`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

debugDatabase();

