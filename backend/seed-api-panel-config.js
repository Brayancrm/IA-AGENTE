'use strict';

/**
 * Cria ou atualiza o documento Firestore `configs/api_panel` com `bearer_token`.
 * Usa as mesmas credenciais que o servidor: serviceAccountKey.json ou SERVICE_ACCOUNT_KEY.
 *
 * Preferível definir o token por variável de ambiente (evita ficar no histórico do terminal):
 *   cd backend
 *   set PANEL_BEARER_TOKEN=seu_token_aqui
 *   node seed-api-panel-config.js
 *
 * PowerShell:
 *   $env:PANEL_BEARER_TOKEN="seu_token"; node seed-api-panel-config.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

function loadServiceAccount() {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  }
  if (process.env.SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  }
  console.error('❌ Credenciais não encontradas.');
  console.error('   Coloque backend/serviceAccountKey.json ou defina SERVICE_ACCOUNT_KEY (JSON).');
  process.exit(1);
}

async function main() {
  const token = String(process.env.PANEL_BEARER_TOKEN || process.argv[2] || '').trim();
  if (!token) {
    console.error('❌ Falta o token do painel.');
    console.error('');
    console.error('   Opção 1 (recomendada): variável de ambiente PANEL_BEARER_TOKEN');
    console.error('   Opção 2: node seed-api-panel-config.js \"<token>\"');
    console.error('');
    console.error('   Guarde só o valor do token (sem o prefixo \"Bearer \").');
    process.exit(1);
  }

  const serviceAccount = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://ia-agente-b2f46.firebaseio.com'
    });
  }

  const ref = admin.firestore().collection('configs').doc('api_panel');
  await ref.set(
    {
      bearer_token: token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  console.log('✅ Firestore: configs/api_panel — bearer_token definido (merge).');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
