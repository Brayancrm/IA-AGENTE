const admin = require('firebase-admin');
const fs = require('fs');

// Carregar credenciais do Firebase
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('📝 Carregando credenciais do Firebase da variável de ambiente');
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (fs.existsSync('./serviceAccountKey.json')) {
  console.log('📝 Carregando credenciais do Firebase do arquivo');
  serviceAccount = require('./serviceAccountKey.json');
} else {
  console.error('❌ Credenciais do Firebase não encontradas!');
  process.exit(1);
}

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
}

const db = admin.database();

async function testConversations() {
  try {
    console.log('\n🔍 Verificando dados no Realtime Database...\n');
    
    // Listar todos os usuários com conversas
    const conversationsRef = db.ref('conversations');
    const snapshot = await conversationsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('⚠️ Nenhum dado encontrado em /conversations');
      return;
    }
    
    const data = snapshot.val();
    const userIds = Object.keys(data);
    
    console.log(`✅ Encontrados ${userIds.length} usuários com conversas:\n`);
    
    for (const userId of userIds) {
      console.log(`\n👤 Usuário: ${userId}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      const userConversations = data[userId];
      const contactNumbers = Object.keys(userConversations);
      
      console.log(`   📱 Total de conversas: ${contactNumbers.length}`);
      
      contactNumbers.forEach((contactNumber, index) => {
        const conv = userConversations[contactNumber];
        const messages = conv.messages ? Object.values(conv.messages) : [];
        const lastMessage = messages[messages.length - 1];
        
        console.log(`\n   ${index + 1}. ${contactNumber}`);
        console.log(`      📊 Total de mensagens: ${messages.length}`);
        
        if (lastMessage) {
          console.log(`      💬 Última mensagem: ${lastMessage.body?.substring(0, 50) || 'N/A'}...`);
          console.log(`      🕐 Timestamp: ${lastMessage.timestamp || 'N/A'}`);
          console.log(`      👤 De: ${lastMessage.fromMe ? 'Eu' : 'Cliente'}`);
        }
      });
      
      console.log('');
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Erro ao buscar conversas:', error);
  } finally {
    process.exit(0);
  }
}

testConversations();

