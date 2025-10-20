const wppconnect = require('@wppconnect-team/wppconnect');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

console.log('🚀 Iniciando servidor WPPConnect + IA...');

// Inicializar Firebase Admin
let serviceAccount;

// Tentar carregar de arquivo (desenvolvimento local)
try {
  serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ serviceAccountKey.json carregado do arquivo');
} catch (error) {
  // Se não encontrar arquivo, tentar variável de ambiente (produção)
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      console.log('✅ serviceAccountKey carregado da variável de ambiente');
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse da variável SERVICE_ACCOUNT_KEY:', parseError.message);
      process.exit(1);
    }
  } else {
    console.error('❌ Erro: serviceAccountKey não encontrado!');
    console.log('📝 Para desenvolvimento local, baixe o arquivo do Firebase Console:');
    console.log('   1. Vá para: https://console.firebase.google.com');
    console.log('   2. Selecione seu projeto: ia-agente-b2f46');
    console.log('   3. Project Settings → Service Accounts');
    console.log('   4. "Generate New Private Key"');
    console.log('   5. Salve como: backend/serviceAccountKey.json');
    console.log('');
    console.log('📝 Para produção (Railway/Render), adicione a variável de ambiente:');
    console.log('   SERVICE_ACCOUNT_KEY = [conteúdo completo do JSON]');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://ia-agente-b2f46.firebaseio.com'
});

const db = admin.database();
const app = express();

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://ia-agente.vercel.app',
    'https://ia-agente.vercel.app/',
    /\.vercel\.app$/  // Permite todos os subdomínios da Vercel
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Armazenar clientes WPPConnect ativos
const activeClients = new Map();

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

// Função para criar/restaurar sessão WhatsApp
async function createSession(userId) {
  console.log(`📱 Criando sessão WhatsApp para usuário: ${userId}`);
  
  const sessionRef = db.ref(`whatsapp_sessions/${userId}`);
  
  try {
    const client = await wppconnect.create({
      session: `user_${userId}`,
      catchQR: (base64Qr, asciiQR) => {
        console.log('📷 QR Code gerado para:', userId);
        // Salvar QR Code no Realtime Database
        sessionRef.update({
          status: 'qrcode',
          qrCode: base64Qr,
          lastActivity: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      },
      statusFind: (statusSession, session) => {
        console.log('📊 Status da sessão:', statusSession, 'para:', userId);
        
        if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess') {
          sessionRef.update({
            status: 'connected',
            connectedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            qrCode: null // Limpar QR Code após conexão
          });
          console.log('✅ WhatsApp conectado para:', userId);
        } else if (statusSession === 'notLogged' || statusSession === 'qrReadFail') {
          sessionRef.update({
            status: 'disconnected',
            lastActivity: new Date().toISOString()
          });
          console.log('❌ WhatsApp desconectado para:', userId);
        }
      },
      headless: true,
      devtools: false,
      useChrome: true,
      debug: false,
      logQR: false,
      disableWelcome: true,
      updatesLog: false,
      autoClose: 180000, // 180 segundos (3 minutos)
      puppeteerOptions: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || '/nix/store/chromium/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-dev-profile'
        ]
      }
    });

    // Configurar listeners de mensagens
    client.onMessage(async (message) => {
      await handleIncomingMessage(userId, message, client);
    });

    // Salvar cliente ativo
    activeClients.set(userId, client);
    
    console.log('✅ Sessão criada com sucesso para:', userId);
    return client;
    
  } catch (error) {
    console.error('❌ Erro ao criar sessão:', error);
    sessionRef.update({
      status: 'error',
      error: error.message || error.toString() || 'Erro desconhecido',
      lastActivity: new Date().toISOString()
    });
    throw error;
  }
}

// Função para sanitizar número do WhatsApp para uso como chave no Firebase
// Remove caracteres proibidos: ".", "#", "$", "[", "]", "@"
function sanitizePhoneNumber(phoneNumber) {
  return phoneNumber.replace(/[\.\#\$\[\]@]/g, '_');
}

// Handler de mensagens recebidas
async function handleIncomingMessage(userId, message, client) {
  try {
    console.log(`📨 Mensagem recebida de ${message.from}:`, message.body);
    
    // Ignorar mensagens de status e grupos
    if (message.isGroupMsg || message.from === 'status@broadcast') {
      return;
    }
    
    // Sanitizar número do WhatsApp para usar como chave no Firebase
    const sanitizedNumber = sanitizePhoneNumber(message.from);
    
    // Salvar mensagem no Realtime Database
    const messageRef = db.ref(`conversations/${userId}/${sanitizedNumber}/messages`).push();
    await messageRef.set({
      from: message.from || '',
      to: message.to || '',
      body: message.body || '',
      timestamp: new Date().toISOString(),
      type: message.type || 'chat',
      isFromMe: message.isFromMe || false,
      messageId: message.id || ''
    });
    
    console.log('💾 Mensagem salva no banco de dados');
    
    // Se não for mensagem enviada pelo usuário, processar com IA
    if (!message.isFromMe) {
      // Buscar configuração de IA do usuário
      const aiConfigSnapshot = await db.ref(`users/data/${userId}/assistant_settings`).once('value');
      let aiConfig = aiConfigSnapshot.val();
      
      // Se o usuário não tiver API Key (usuário comum), buscar do master
      if (aiConfig && !aiConfig.apiKey) {
        console.log('📌 Usuário comum detectado, buscando API Key do master...');
        
        let masterUserId = null;
        
        // Estratégia 1: Buscar em users/registered
        const usersSnapshot = await db.ref('users/registered').once('value');
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          console.log('🔍 Buscando master entre', Object.keys(users).length, 'usuários em users/registered...');
          
          const masterUser = Object.values(users).find(u => 
            u.email === 'brayan@master.com' || u.isMaster === true
          );
          
          if (masterUser) {
            masterUserId = masterUser.uid;
            console.log('✅ Master encontrado em users/registered:', masterUser.email, 'UID:', masterUserId);
          }
        }
        
        // Estratégia 2: Se não encontrou, buscar todas as configurações em users/data até encontrar uma com API Key
        if (!masterUserId) {
          console.log('🔍 Master não encontrado em users/registered, buscando em users/data...');
          
          const allDataSnapshot = await db.ref('users/data').once('value');
          
          if (allDataSnapshot.exists()) {
            const allUsersData = allDataSnapshot.val();
            console.log('🔍 Verificando', Object.keys(allUsersData).length, 'usuários em users/data...');
            
            // Procurar o primeiro usuário que tem API Key configurada
            for (const [uid, userData] of Object.entries(allUsersData)) {
              if (userData.assistant_settings && userData.assistant_settings.apiKey) {
                masterUserId = uid;
                console.log('✅ Encontrada API Key no UID:', uid);
                break;
              }
            }
          }
        }
        
        // Se encontrou o master, buscar suas configurações
        if (masterUserId) {
          const masterConfigSnapshot = await db.ref(`users/data/${masterUserId}/assistant_settings`).once('value');
          const masterConfig = masterConfigSnapshot.val();
          
          console.log('🔍 Configuração do master:', masterConfig ? 'Encontrada' : 'Não encontrada');
          
          if (masterConfig && masterConfig.apiKey) {
            // Usar API Key do master, mas manter outras configs do usuário
            aiConfig = {
              ...aiConfig,
              apiKey: masterConfig.apiKey,
              aiProvider: masterConfig.aiProvider || 'openai',
              model: aiConfig.model || masterConfig.model || 'gpt-3.5-turbo'
            };
            console.log('✅ Usando API Key do master (primeiros 10 caracteres):', masterConfig.apiKey.substring(0, 10) + '...');
          } else {
            console.log('❌ Master não tem API Key configurada');
          }
        } else {
          console.log('❌ Nenhuma API Key de master encontrada no sistema');
        }
      }
      
      if (aiConfig && aiConfig.apiKey) {
        console.log('🤖 Gerando resposta com IA...');
        
        // Gerar resposta com IA
        const aiResult = await generateAIResponse(userId, sanitizedNumber, message.body, aiConfig);
        const aiResponse = aiResult.text;
        
        // Enviar resposta de texto
        await client.sendText(message.from, aiResponse);
        console.log('✅ Resposta enviada:', aiResponse);
        
        // Salvar resposta da IA
        const responseRef = db.ref(`conversations/${userId}/${sanitizedNumber}/messages`).push();
        await responseRef.set({
          from: message.to || '',
          to: message.from || '',
          body: aiResponse || '',
          timestamp: new Date().toISOString(),
          type: 'chat',
          isFromMe: true,
          aiGenerated: true
        });
        
        // Detectar produtos mencionados e enviar imagens automaticamente
        const mentionedItems = detectMentionedProducts(aiResponse, aiResult.catalogItemsMap);
        
        if (mentionedItems.length > 0) {
          console.log(`📸 Detectados ${mentionedItems.length} produto(s) com imagem na resposta`);
          
          // Enviar imagens dos produtos mencionados
          for (const item of mentionedItems) {
            try {
              console.log(`📤 Enviando imagem de: ${item.name}`);
              
              // Criar legenda para a imagem
              const caption = `📦 *${item.name}*\n💰 R$ ${item.price}\n\n${item.description || ''}`;
              
              // Verificar se é Base64 ou URL
              const isBase64 = item.image.startsWith('data:image/');
              
              if (isBase64) {
                console.log(`📸 Imagem em Base64 detectada para: ${item.name}`);
                // Enviar imagem Base64 diretamente
                await client.sendImageFromBase64(
                  message.from,
                  item.image,
                  item.name,
                  caption
                );
              } else {
                console.log(`🌐 URL de imagem detectada para: ${item.name}`);
                // Enviar imagem por URL
                await client.sendImage(
                  message.from,
                  item.image,
                  item.name,
                  caption
                );
              }
              
              console.log(`✅ Imagem enviada: ${item.name}`);
              
              // Salvar envio da imagem no histórico
              const imageRef = db.ref(`conversations/${userId}/${sanitizedNumber}/messages`).push();
              await imageRef.set({
                from: message.to || '',
                to: message.from || '',
                body: caption,
                imageUrl: isBase64 ? '[Base64 Image]' : item.image,
                imageBase64: isBase64 ? item.image.substring(0, 100) + '...' : null,
                timestamp: new Date().toISOString(),
                type: 'image',
                isFromMe: true,
                aiGenerated: true,
                productName: item.name
              });
              
              // Aguardar um pouco entre imagens para não sobrecarregar
              await new Promise(resolve => setTimeout(resolve, 1000));
              
            } catch (imageError) {
              console.error(`❌ Erro ao enviar imagem de ${item.name}:`, imageError.message);
              // Continuar mesmo se houver erro em uma imagem
            }
          }
        }
      } else {
        console.log('⚠️ Configuração de IA não encontrada ou incompleta');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
}

// Gerar resposta com IA
async function generateAIResponse(userId, contactNumber, userMessage, aiConfig) {
  try {
    // Buscar histórico da conversa (últimas 10 mensagens)
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
    
    // Buscar dados da empresa para contexto
    const companySnapshot = await db.ref(`users/data/${userId}/company_profile`).once('value');
    const company = companySnapshot.val() || {};
    
    // Buscar configurações do assistente para verificar o que incluir
    const assistantSettingsSnapshot = await db.ref(`users/data/${userId}/assistant_settings`).once('value');
    const assistantSettings = assistantSettingsSnapshot.val() || {};
    
    // Buscar catálogo de produtos/serviços (respeitando as configurações)
    const catalogSnapshot = await db.ref(`users/data/${userId}/catalog_items`).once('value');
    const catalogProducts = [];
    const catalogServices = [];
    const catalogItemsMap = {}; // Mapa para buscar itens por nome
    
    if (catalogSnapshot.exists()) {
      catalogSnapshot.forEach((child) => {
        const item = child.val();
        if (item.type === 'product' && assistantSettings.includeCatalogProducts) {
          const productData = {
            name: item.name,
            description: item.description || '',
            price: item.price,
            stock: item.stockQuantity || 0,
            image: item.image || null
          };
          catalogProducts.push(productData);
          catalogItemsMap[item.name.toLowerCase()] = productData;
        } else if (item.type === 'service' && assistantSettings.includeCatalogServices) {
          const serviceData = {
            name: item.name,
            description: item.description || '',
            price: item.price,
            capacity: item.stockQuantity || 0,
            image: item.image || null
          };
          catalogServices.push(serviceData);
          catalogItemsMap[item.name.toLowerCase()] = serviceData;
        }
      });
    }
    
    // Construir prompt do sistema com contexto
    let systemPrompt = aiConfig.systemPrompt || 'Você é um assistente virtual prestativo.';
    
    if (company.companyName) {
      systemPrompt += `\n\nVocê trabalha para a empresa: ${company.companyName}`;
    }
    
    if (company.whatsappNumber) {
      systemPrompt += `\nNúmero de contato: ${company.whatsappNumber}`;
    }
    
    // Incluir produtos no contexto se habilitado
    if (catalogProducts.length > 0) {
      systemPrompt += `\n\n📦 PRODUTOS DISPONÍVEIS:\n`;
      catalogProducts.forEach((product, index) => {
        systemPrompt += `${index + 1}. ${product.name} - R$ ${product.price}`;
        if (product.description) systemPrompt += ` - ${product.description}`;
        if (product.stock > 0) systemPrompt += ` (Estoque: ${product.stock} unidades)`;
        if (product.image) systemPrompt += ` [TEM FOTO DISPONÍVEL]`;
        systemPrompt += '\n';
      });
    }
    
    // Incluir serviços no contexto se habilitado
    if (catalogServices.length > 0) {
      systemPrompt += `\n\n🛠️ SERVIÇOS DISPONÍVEIS:\n`;
      catalogServices.forEach((service, index) => {
        systemPrompt += `${index + 1}. ${service.name} - R$ ${service.price}`;
        if (service.description) systemPrompt += ` - ${service.description}`;
        if (service.capacity > 0) systemPrompt += ` (Capacidade: ${service.capacity})`;
        if (service.image) systemPrompt += ` [TEM FOTO DISPONÍVEL]`;
        systemPrompt += '\n';
      });
    }
    
    // Instruções adicionais se houver produtos/serviços
    if (catalogProducts.length > 0 || catalogServices.length > 0) {
      systemPrompt += `\n⚠️ INSTRUÇÕES IMPORTANTES:
- Você DEVE mencionar e oferecer esses produtos/serviços quando relevante
- Seja proativo e sugira produtos/serviços que possam ajudar o cliente
- Forneça informações detalhadas sobre preços e disponibilidade
- Ajude o cliente a tomar a melhor decisão de compra
- Quando mencionar produtos/serviços com foto disponível, eu enviarei a imagem automaticamente para o cliente`;
    }
    
    if (aiConfig.enabledFeatures && aiConfig.enabledFeatures.length > 0) {
      systemPrompt += `\n\nFuncionalidades habilitadas: ${aiConfig.enabledFeatures.join(', ')}`;
    }
    
    // Chamar API de IA (OpenAI exemplo)
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: aiConfig.model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
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
    
    const aiResponse = response.data.choices[0].message.content;
    
    // Retornar resposta e mapa de itens para detecção de imagens
    return {
      text: aiResponse,
      catalogItemsMap: catalogItemsMap
    };
    
  } catch (error) {
    console.error('❌ Erro ao gerar resposta IA:', error.response?.data || error.message);
    
    // Resposta padrão em caso de erro
    return {
      text: 'Desculpe, estou com dificuldades para processar sua mensagem no momento. Por favor, tente novamente em instantes.',
      catalogItemsMap: {}
    };
  }
}

// Função para detectar produtos mencionados na resposta e retornar suas imagens
function detectMentionedProducts(responseText, catalogItemsMap) {
  const mentionedItems = [];
  
  // Percorrer todos os itens do catálogo
  for (const [itemName, itemData] of Object.entries(catalogItemsMap)) {
    // Verificar se o nome do produto aparece na resposta (case insensitive)
    const regex = new RegExp(`\\b${itemName}\\b`, 'i');
    if (regex.test(responseText.toLowerCase()) && itemData.image) {
      mentionedItems.push({
        name: itemData.name,
        image: itemData.image,
        price: itemData.price,
        description: itemData.description
      });
    }
  }
  
  return mentionedItems;
}

// ============================================
// ROTAS DA API
// ============================================

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'WhatsApp IA Backend',
    version: '1.0.0',
    activeSessions: activeClients.size
  });
});

// Criar/Conectar sessão WhatsApp
app.post('/api/sessions/create', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }
    
    // Verificar se já existe sessão ativa
    if (activeClients.has(userId)) {
      return res.json({ 
        status: 'already_active',
        message: 'Sessão já está ativa' 
      });
    }
    
    // Criar nova sessão
    await createSession(userId);
    
    res.json({ 
      status: 'success', 
      message: 'Sessão criada. Escaneie o QR Code no dashboard.' 
    });
    
  } catch (error) {
    console.error('❌ Erro ao criar sessão:', error);
    res.status(500).json({ 
      error: error.message,
      status: 'error'
    });
  }
});

// Desconectar sessão WhatsApp
app.post('/api/sessions/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }
    
    const client = activeClients.get(userId);
    if (client) {
      await client.close();
      activeClients.delete(userId);
      
      await db.ref(`whatsapp_sessions/${userId}`).update({
        status: 'disconnected',
        lastActivity: new Date().toISOString(),
        qrCode: null
      });
      
      console.log('✅ Sessão desconectada:', userId);
    }
    
    res.json({ 
      status: 'success',
      message: 'Sessão desconectada' 
    });
    
  } catch (error) {
    console.error('❌ Erro ao desconectar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter status da sessão
app.get('/api/sessions/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const sessionSnapshot = await db.ref(`whatsapp_sessions/${userId}`).once('value');
    const session = sessionSnapshot.val();
    
    const isActive = activeClients.has(userId);
    
    res.json({
      status: session?.status || 'disconnected',
      qrCode: session?.qrCode || null,
      phoneNumber: session?.phoneNumber || null,
      connectedAt: session?.connectedAt || null,
      isActive: isActive
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem manualmente
app.post('/api/messages/send', async (req, res) => {
  try {
    const { userId, to, message } = req.body;
    
    if (!userId || !to || !message) {
      return res.status(400).json({ error: 'userId, to e message são obrigatórios' });
    }
    
    const client = activeClients.get(userId);
    if (!client) {
      return res.status(404).json({ error: 'Sessão não encontrada ou inativa' });
    }
    
    await client.sendText(to, message);
    
    // Salvar mensagem enviada
    const messageRef = db.ref(`conversations/${userId}/${to}/messages`).push();
    await messageRef.set({
      from: 'me',
      to: to,
      body: message,
      timestamp: new Date().toISOString(),
      type: 'chat',
      isFromMe: true,
      manual: true
    });
    
    res.json({ 
      status: 'success',
      message: 'Mensagem enviada' 
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter conversas
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const conversationsSnapshot = await db.ref(`conversations/${userId}`).once('value');
    const conversations = [];
    
    if (conversationsSnapshot.exists()) {
      conversationsSnapshot.forEach((child) => {
        const contactNumber = child.key;
        const data = child.val();
        
        // Pegar última mensagem
        let lastMessage = null;
        if (data.messages) {
          const messages = Object.values(data.messages);
          lastMessage = messages[messages.length - 1];
        }
        
        conversations.push({
          contactNumber,
          lastMessage: lastMessage?.body || '',
          lastMessageTime: lastMessage?.timestamp || null,
          messageCount: data.messages ? Object.keys(data.messages).length : 0
        });
      });
    }
    
    res.json({ conversations });
    
  } catch (error) {
    console.error('❌ Erro ao buscar conversas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log(`✅ Servidor WPPConnect + IA rodando!`);
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔥 Firebase: ${process.env.FIREBASE_DATABASE_URL}`);
  console.log('='.repeat(50));
  console.log('');
  console.log('📝 Endpoints disponíveis:');
  console.log(`   GET  /                              - Status do servidor`);
  console.log(`   POST /api/sessions/create          - Criar sessão WhatsApp`);
  console.log(`   POST /api/sessions/disconnect      - Desconectar WhatsApp`);
  console.log(`   GET  /api/sessions/status/:userId  - Status da sessão`);
  console.log(`   POST /api/messages/send            - Enviar mensagem`);
  console.log(`   GET  /api/conversations/:userId    - Listar conversas`);
  console.log('');
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Erro não tratado:', error);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  
  // Fechar todas as sessões ativas
  for (const [userId, client] of activeClients.entries()) {
    try {
      await client.close();
      console.log(`✅ Sessão fechada: ${userId}`);
    } catch (error) {
      console.error(`❌ Erro ao fechar sessão ${userId}:`, error);
    }
  }
  
  process.exit(0);
});

