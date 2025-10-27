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

async function createTestConversations() {
  try {
    console.log('\n🎨 Criando conversas de teste...\n');
    
    // ID do usuário (você pode trocar pelo seu)
    const userId = '5vbbBm06amVAjYCKHuwLmA9kwcj2';
    
    // Criar 3 conversas de teste
    const testConversations = [
      {
        contactNumber: '5561999887766_c_us',
        messages: [
          {
            from: '5561999887766@c.us',
            to: userId,
            body: 'Olá! Gostaria de saber mais sobre seus produtos',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            type: 'chat',
            isFromMe: false,
            messageId: 'test_msg_1'
          },
          {
            from: userId,
            to: '5561999887766@c.us',
            body: 'Olá! Claro, temos diversos produtos disponíveis. O que você procura?',
            timestamp: new Date(Date.now() - 3500000).toISOString(),
            type: 'chat',
            isFromMe: true,
            messageId: 'test_msg_2'
          },
          {
            from: '5561999887766@c.us',
            to: userId,
            body: 'Estou interessado em notebooks',
            timestamp: new Date(Date.now() - 3400000).toISOString(),
            type: 'chat',
            isFromMe: false,
            messageId: 'test_msg_3'
          }
        ]
      },
      {
        contactNumber: '5561988776655_c_us',
        messages: [
          {
            from: '5561988776655@c.us',
            to: userId,
            body: 'Bom dia! Vocês trabalham com qual tipo de produtos?',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            type: 'chat',
            isFromMe: false,
            messageId: 'test_msg_4'
          },
          {
            from: userId,
            to: '5561988776655@c.us',
            body: 'Bom dia! Trabalhamos com eletrônicos, informática e acessórios',
            timestamp: new Date(Date.now() - 7100000).toISOString(),
            type: 'chat',
            isFromMe: true,
            messageId: 'test_msg_5'
          }
        ]
      },
      {
        contactNumber: '5561977665544_c_us',
        messages: [
          {
            from: '5561977665544@c.us',
            to: userId,
            body: 'Olá! Qual o horário de funcionamento?',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            type: 'chat',
            isFromMe: false,
            messageId: 'test_msg_6'
          }
        ]
      }
    ];
    
    console.log(`📱 Criando ${testConversations.length} conversas de teste para usuário: ${userId}\n`);
    
    for (const conv of testConversations) {
      const { contactNumber, messages } = conv;
      
      console.log(`\n✍️  Criando conversa: ${contactNumber}`);
      console.log(`   📊 ${messages.length} mensagens`);
      
      // Salvar cada mensagem
      for (const msg of messages) {
        const messageRef = db.ref(`conversations/${userId}/${contactNumber}/messages`).push();
        await messageRef.set(msg);
      }
      
      console.log(`   ✅ Conversa criada com sucesso!`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Conversas de teste criadas com sucesso!');
    console.log('\n📌 Agora você pode:');
    console.log('   1. Abrir o site e ir em "Conversas WhatsApp"');
    console.log('   2. Verificar se as conversas aparecem na lista');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Erro ao criar conversas:', error);
  } finally {
    process.exit(0);
  }
}

createTestConversations();

