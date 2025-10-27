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

async function listAllUsers() {
  try {
    console.log('\n📋 Listando TODOS os usuários e suas conversas...\n');
    console.log('═'.repeat(80));
    
    // 1. Buscar usuários registrados
    const registeredUsersSnapshot = await db.ref('users/registered').once('value');
    
    console.log('\n👥 USUÁRIOS REGISTRADOS:');
    console.log('─'.repeat(80));
    
    if (registeredUsersSnapshot.exists()) {
      const users = registeredUsersSnapshot.val();
      Object.entries(users).forEach(([key, user]) => {
        console.log(`\n🔑 Key: ${key}`);
        console.log(`   📧 Email: ${user.email || 'N/A'}`);
        console.log(`   🆔 UID: ${user.uid || 'N/A'}`);
        console.log(`   👤 Nome: ${user.displayName || 'N/A'}`);
        console.log(`   📅 Criado em: ${user.createdAt || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️ Nenhum usuário registrado encontrado');
    }
    
    // 2. Buscar conversas
    console.log('\n\n💬 CONVERSAS POR USUÁRIO:');
    console.log('─'.repeat(80));
    
    const conversationsSnapshot = await db.ref('conversations').once('value');
    
    if (conversationsSnapshot.exists()) {
      const conversations = conversationsSnapshot.val();
      
      for (const [userId, userConversations] of Object.entries(conversations)) {
        console.log(`\n👤 UserID: ${userId}`);
        
        // Tentar encontrar info do usuário
        const userDataSnapshot = await db.ref(`users/data/${userId}`).once('value');
        if (userDataSnapshot.exists()) {
          const userData = userDataSnapshot.val();
          console.log(`   📧 Email: ${userData.email || 'N/A'}`);
          console.log(`   👤 Nome: ${userData.displayName || 'N/A'}`);
        }
        
        const contactNumbers = Object.keys(userConversations);
        console.log(`   📱 Total de conversas: ${contactNumbers.length}`);
        
        contactNumbers.forEach((contactNumber, index) => {
          const conv = userConversations[contactNumber];
          const messages = conv.messages ? Object.values(conv.messages) : [];
          const lastMessage = messages[messages.length - 1];
          
          console.log(`\n   ${index + 1}. 📞 ${contactNumber}`);
          console.log(`      💬 Mensagens: ${messages.length}`);
          
          if (lastMessage) {
            const preview = lastMessage.body?.substring(0, 60) || 'N/A';
            console.log(`      📝 Última: "${preview}${lastMessage.body?.length > 60 ? '...' : ''}"`);
            console.log(`      🕐 Data: ${lastMessage.timestamp || 'N/A'}`);
          }
        });
        
        console.log('');
      }
    } else {
      console.log('   ⚠️ Nenhuma conversa encontrada');
    }
    
    // 3. Buscar sessões WhatsApp
    console.log('\n\n📱 SESSÕES WHATSAPP:');
    console.log('─'.repeat(80));
    
    const sessionsSnapshot = await db.ref('whatsapp_sessions').once('value');
    
    if (sessionsSnapshot.exists()) {
      const sessions = sessionsSnapshot.val();
      
      Object.entries(sessions).forEach(([userId, session]) => {
        console.log(`\n👤 UserID: ${userId}`);
        console.log(`   Status: ${session.status || 'N/A'}`);
        console.log(`   Telefone: ${session.phoneNumber || 'N/A'}`);
        console.log(`   Conectado em: ${session.connectedAt || 'N/A'}`);
        console.log(`   Última atividade: ${session.lastActivity || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️ Nenhuma sessão encontrada');
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ Listagem completa!\n');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

listAllUsers();

