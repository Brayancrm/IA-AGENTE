# 🤖 Configuração do Assistente Virtual com WPPConnect

## 📋 Visão Geral

Sistema completo de integração WhatsApp + IA usando WPPConnect e Realtime Database.

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js App   │────────▶│  Backend Node.js │────────▶│   Realtime DB   │
│  (Dashboard)    │         │   (WPPConnect)   │         │   (Firebase)    │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │                             │
        │                            │                             │
        ▼                            ▼                             ▼
  - QR Code Display          - WhatsApp API              - Sessions
  - Config Settings          - Message Handler           - Messages
  - Status Monitor           - AI Integration            - Logs
```

---

## 📁 Estrutura de Dados no Realtime Database

```json
{
  "whatsapp_sessions": {
    "{userId}": {
      "sessionId": "session_123",
      "sessionToken": "encrypted_token",
      "status": "connected",  // "disconnected", "qrcode", "connected"
      "qrCode": "base64_qr_image",
      "phoneNumber": "+5511999999999",
      "connectedAt": "2025-10-17T20:00:00.000Z",
      "lastActivity": "2025-10-17T20:30:00.000Z"
    }
  },
  "conversations": {
    "{userId}": {
      "{contactNumber}": {
        "messages": {
          "{messageId}": {
            "from": "+5511999999999",
            "to": "+5511888888888",
            "body": "Texto da mensagem",
            "timestamp": "2025-10-17T20:00:00.000Z",
            "type": "chat",  // "chat", "image", "audio", etc
            "isFromMe": false,
            "aiResponse": "Resposta gerada pela IA"
          }
        },
        "lastMessage": "2025-10-17T20:00:00.000Z",
        "unreadCount": 3
      }
    }
  },
  "ai_config": {
    "{userId}": {
      "provider": "openai",  // "openai", "anthropic", "google"
      "apiKey": "encrypted_key",
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 150,
      "systemPrompt": "Você é um assistente virtual...",
      "enabledFeatures": ["sales", "support", "stock"]
    }
  }
}
```

---

## 🚀 Implementação do Backend (Node.js + WPPConnect)

### 1. Criar Servidor Backend

Crie um novo diretório `backend/` na raiz do projeto:

```bash
mkdir backend
cd backend
npm init -y
```

### 2. Instalar Dependências

```bash
npm install @wppconnect-team/wppconnect
npm install firebase-admin
npm install express
npm install cors
npm install dotenv
npm install axios
```

### 3. Criar `backend/server.js`

```javascript
const wppconnect = require('@wppconnect-team/wppconnect');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inicializar Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ia-agente-b2f46.firebaseio.com'
});

const db = admin.database();
const app = express();
app.use(cors());
app.use(express.json());

// Armazenar clientes WPPConnect ativos
const activeClients = new Map();

// Função para criar/restaurar sessão
async function createSession(userId) {
  console.log(`Criando sessão para usuário: ${userId}`);
  
  const sessionRef = db.ref(`whatsapp_sessions/${userId}`);
  
  const client = await wppconnect.create({
    session: `user_${userId}`,
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR Code gerado');
      // Salvar QR Code no Realtime Database
      sessionRef.update({
        status: 'qrcode',
        qrCode: base64Qr,
        lastActivity: new Date().toISOString()
      });
    },
    statusFind: (statusSession, session) => {
      console.log('Status:', statusSession);
      
      if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess') {
        sessionRef.update({
          status: 'connected',
          connectedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        });
      } else if (statusSession === 'notLogged' || statusSession === 'qrReadFail') {
        sessionRef.update({
          status: 'disconnected',
          lastActivity: new Date().toISOString()
        });
      }
    },
    headless: true,
    devtools: false,
    useChrome: true,
    debug: false,
    logQR: false,
    browserArgs: [
      '--disable-web-security',
      '--no-sandbox',
      '--disable-web-security',
      '--aggressive-cache-discard',
      '--disable-cache',
      '--disable-application-cache',
      '--disable-offline-load-stale-cache',
      '--disk-cache-size=0',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list'
    ]
  });

  // Configurar listeners de mensagens
  client.onMessage(async (message) => {
    await handleIncomingMessage(userId, message, client);
  });

  // Salvar sessão ativa
  activeClients.set(userId, client);
  
  return client;
}

// Handler de mensagens recebidas
async function handleIncomingMessage(userId, message, client) {
  console.log(`Mensagem recebida de ${message.from}:`, message.body);
  
  // Salvar mensagem no Realtime Database
  const messageRef = db.ref(`conversations/${userId}/${message.from}/messages`).push();
  await messageRef.set({
    from: message.from,
    to: message.to,
    body: message.body,
    timestamp: new Date().toISOString(),
    type: message.type,
    isFromMe: message.isFromMe
  });
  
  // Se não for mensagem enviada pelo usuário
  if (!message.isFromMe) {
    // Buscar configuração de IA
    const aiConfigSnapshot = await db.ref(`ai_config/${userId}`).once('value');
    const aiConfig = aiConfigSnapshot.val();
    
    if (aiConfig && aiConfig.apiKey) {
      // Gerar resposta com IA
      const aiResponse = await generateAIResponse(userId, message.from, message.body, aiConfig);
      
      // Enviar resposta
      await client.sendText(message.from, aiResponse);
      
      // Salvar resposta da IA
      const responseRef = db.ref(`conversations/${userId}/${message.from}/messages`).push();
      await responseRef.set({
        from: message.to,
        to: message.from,
        body: aiResponse,
        timestamp: new Date().toISOString(),
        type: 'chat',
        isFromMe: true,
        aiGenerated: true
      });
    }
  }
}

// Gerar resposta com IA
async function generateAIResponse(userId, contactNumber, userMessage, aiConfig) {
  try {
    // Buscar histórico da conversa
    const messagesSnapshot = await db.ref(`conversations/${userId}/${contactNumber}/messages`)
      .orderByChild('timestamp')
      .limitToLast(10)
      .once('value');
    
    const messages = [];
    messagesSnapshot.forEach((child) => {
      const msg = child.val();
      messages.push({
        role: msg.isFromMe ? 'assistant' : 'user',
        content: msg.body
      });
    });
    
    // Chamar API de IA (OpenAI exemplo)
    const axios = require('axios');
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: aiConfig.model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: aiConfig.systemPrompt || 'Você é um assistente virtual prestativo.'
        },
        ...messages,
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: aiConfig.temperature || 0.7,
      max_tokens: aiConfig.maxTokens || 150
    }, {
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao gerar resposta IA:', error);
    return 'Desculpe, estou com dificuldades para processar sua mensagem no momento.';
  }
}

// Endpoints da API
app.post('/api/sessions/create', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }
    
    // Verificar se já existe sessão ativa
    if (activeClients.has(userId)) {
      return res.json({ status: 'already_active' });
    }
    
    await createSession(userId);
    res.json({ status: 'success', message: 'Sessão criada' });
  } catch (error) {
    console.error('Erro ao criar sessão:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const client = activeClients.get(userId);
    if (client) {
      await client.close();
      activeClients.delete(userId);
      
      await db.ref(`whatsapp_sessions/${userId}`).update({
        status: 'disconnected',
        lastActivity: new Date().toISOString()
      });
    }
    
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const sessionSnapshot = await db.ref(`whatsapp_sessions/${userId}`).once('value');
    const session = sessionSnapshot.val();
    
    res.json({
      status: session?.status || 'disconnected',
      qrCode: session?.qrCode || null,
      phoneNumber: session?.phoneNumber || null,
      connectedAt: session?.connectedAt || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor na porta 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor WPPConnect rodando na porta ${PORT}`);
});
```

### 4. Variáveis de Ambiente

Criar `backend/.env`:

```env
PORT=3001
FIREBASE_DATABASE_URL=https://ia-agente-b2f46.firebaseio.com
```

### 5. Configurar Service Account

1. Vá para Firebase Console → Project Settings → Service Accounts
2. Clique em "Generate New Private Key"
3. Salve o arquivo como `backend/serviceAccountKey.json`

---

## 🔐 Regras do Realtime Database

Atualizar as regras para incluir os novos caminhos:

```json
{
  "rules": {
    "users": {
      "registered": {
        ".read": "auth != null",
        ".write": "auth != null"
      },
      "data": {
        "$userId": {
          ".read": "auth != null && auth.uid == $userId",
          ".write": "auth != null && auth.uid == $userId"
        }
      }
    },
    "whatsapp_sessions": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    },
    "conversations": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    },
    "ai_config": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    }
  }
}
```

---

## 🎨 Interface do Dashboard (Next.js)

A interface já está implementada, mas vou adicionar os componentes de WhatsApp:

- QR Code Display
- Status da Conexão
- Configuração de IA
- Histórico de Conversas

---

## 🚀 Como Executar

### Backend:
```bash
cd backend
npm install
node server.js
```

### Frontend:
```bash
npm run dev
```

---

## 📊 Fluxo Completo

1. **Usuário** acessa Dashboard → Configuração do Assistente
2. **Dashboard** solicita criação de sessão ao backend
3. **Backend** gera QR Code via WPPConnect
4. **QR Code** é salvo no Realtime Database
5. **Dashboard** exibe QR Code em tempo real
6. **Usuário** escaneia QR Code no WhatsApp
7. **Sessão** é estabelecida e salva no DB
8. **Mensagens** chegam via WPPConnect
9. **Backend** salva mensagem no DB
10. **Backend** consulta histórico + gera resposta IA
11. **IA** responde via WhatsApp
12. **Resposta** é salva no DB

---

## 🔧 Próximos Passos

1. Implementar interface de QR Code no dashboard
2. Adicionar configuração de API Keys de IA
3. Criar visualizador de conversas
4. Implementar analytics de mensagens
5. Adicionar templates de resposta

