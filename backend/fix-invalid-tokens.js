/**
 * Script de limpeza: Remove tokens inválidos do Firebase
 * Execução única para corrigir dados corrompidos
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Inicializar Firebase
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://ia-agente-b2f46.firebaseio.com"
});

const db = admin.database();

async function fixInvalidTokens() {
  console.log('🔧 [FIX] Iniciando limpeza de tokens inválidos...');
  console.log('='.repeat(60));
  
  try {
    // Buscar todas as sessões
    const sessionsSnapshot = await db.ref('whatsapp_sessions').once('value');
    const sessions = sessionsSnapshot.val();
    
    if (!sessions) {
      console.log('ℹ️ Nenhuma sessão encontrada no Firebase');
      return;
    }
    
    const allSessions = Object.entries(sessions);
    console.log(`📊 Total de sessões encontradas: ${allSessions.length}`);
    console.log('');
    
    let fixed = 0;
    let alreadyValid = 0;
    
    for (const [userId, data] of allSessions) {
      console.log(`🔍 Verificando sessão: ${userId}`);
      console.log(`   Status atual: ${data.status}`);
      console.log(`   Tem token: ${!!data.sessionToken}`);
      console.log(`   Tipo do token: ${typeof data.sessionToken}`);
      
      // Verificar se o token é inválido
      if (data.sessionToken && typeof data.sessionToken !== 'string') {
        console.log(`   ❌ Token inválido (tipo: ${typeof data.sessionToken})`);
        
        // Tentar converter para string se for object
        let newToken = null;
        if (typeof data.sessionToken === 'object' && data.sessionToken !== null) {
          try {
            newToken = JSON.stringify(data.sessionToken);
            console.log(`   🔄 Convertendo object para string JSON...`);
          } catch (error) {
            console.log(`   ⚠️ Não foi possível converter - removendo token`);
          }
        }
        
        // Atualizar no Firebase
        await db.ref(`whatsapp_sessions/${userId}`).update({
          sessionToken: newToken,
          status: newToken ? data.status : 'disconnected',
          lastActivity: new Date().toISOString(),
          fixedAt: new Date().toISOString()
        });
        
        if (newToken) {
          console.log(`   ✅ Token convertido e salvo como string (${newToken.length} chars)`);
        } else {
          console.log(`   ✅ Token removido e status atualizado para disconnected`);
        }
        
        fixed++;
      } else if (data.sessionToken && typeof data.sessionToken === 'string') {
        console.log(`   ✅ Token já é uma string válida (${data.sessionToken.length} chars)`);
        alreadyValid++;
      } else {
        console.log(`   ℹ️ Sem token (normal para sessões não conectadas)`);
      }
      
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('📊 RESUMO DA LIMPEZA:');
    console.log(`   Total de sessões: ${allSessions.length}`);
    console.log(`   ✅ Tokens já válidos: ${alreadyValid}`);
    console.log(`   🔧 Tokens corrigidos: ${fixed}`);
    console.log(`   ℹ️ Sem token: ${allSessions.length - alreadyValid - fixed}`);
    console.log('='.repeat(60));
    console.log('🎉 Limpeza concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao limpar tokens:', error);
    console.error('   Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar
fixInvalidTokens();

