// Script para migrar produtos do lugar errado para o lugar certo
// Execute com: node backend/migrate-products.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://ia-agente-b2f46-default-rtdb.firebaseio.com"
});

const db = admin.database();

async function migrateProducts() {
  try {
    console.log('🚀 Iniciando migração de produtos...\n');
    
    // Buscar todos os usuários que têm produtos em data/*/catalog_items
    const dataSnapshot = await db.ref('data').once('value');
    const data = dataSnapshot.val();
    
    if (!data) {
      console.log('❌ Nenhum dado encontrado em /data');
      return;
    }
    
    let totalMigrated = 0;
    
    // Iterar por cada usuário
    for (const [userId, userData] of Object.entries(data)) {
      console.log(`\n📁 Processando usuário: ${userId}`);
      
      if (!userData.catalog_items) {
        console.log('   ⚠️  Sem produtos (catalog_items não existe)');
        continue;
      }
      
      const catalogItems = userData.catalog_items;
      console.log(`   📦 Encontrados ${Object.keys(catalogItems).length} produto(s)`);
      
      // Migrar cada produto
      for (const [productId, product] of Object.entries(catalogItems)) {
        try {
          // Verificar se já existe em products/
          const existingProductRef = db.ref(`products/${userId}/${productId}`);
          const existingSnapshot = await existingProductRef.once('value');
          
          if (existingSnapshot.exists()) {
            console.log(`   ⏭️  Produto "${product.name}" já existe em products/, pulando...`);
            continue;
          }
          
          // Preparar dados do produto
          const productData = {
            id: productId,
            name: product.name || 'Produto sem nome',
            description: product.description || '',
            price: parseFloat(product.price) || 0,
            stock: parseInt(product.stockQuantity) || 0,
            category: product.category || '',
            image: product.image || '',
            type: product.type || 'product',
            active: true,
            createdAt: product.createdAt || new Date().toISOString(),
            updatedAt: product.updatedAt || new Date().toISOString()
          };
          
          // Salvar no local correto
          await db.ref(`products/${userId}/${productId}`).set(productData);
          
          console.log(`   ✅ Migrado: "${product.name}" → products/${userId}/${productId}`);
          totalMigrated++;
          
        } catch (error) {
          console.error(`   ❌ Erro ao migrar produto ${productId}:`, error.message);
        }
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Migração concluída!`);
    console.log(`📊 Total de produtos migrados: ${totalMigrated}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Verificar resultado
    console.log('🔍 Verificando produtos em products/...\n');
    const productsSnapshot = await db.ref('products').once('value');
    const products = productsSnapshot.val();
    
    if (products) {
      for (const [userId, userProducts] of Object.entries(products)) {
        console.log(`👤 Usuário ${userId}:`);
        for (const [productId, product] of Object.entries(userProducts)) {
          console.log(`   📦 ${product.name} (${product.type}) - R$ ${product.price}`);
        }
      }
    } else {
      console.log('⚠️  Nenhum produto encontrado em products/');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

// Executar migração
migrateProducts();

