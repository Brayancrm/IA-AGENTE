const wppconnect = require('@wppconnect-team/wppconnect');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const APP_ID = 'whatsapp-sales-agent';

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
const firestore = admin.firestore();
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
        
        // Detectar intenção de compra e gerar link de pagamento
        const hasPurchaseIntent = detectPurchaseIntent(message.body);
        
        if (hasPurchaseIntent && mentionedItems.length > 0) {
          console.log('🛒 Intenção de compra detectada!');
          
          // Buscar configuração do Asaas no Firestore ou Realtime Database
          const integrations = await getIntegrationsConfig(userId);
          
          // Tentar acessar a API Key em diferentes formatos
          let asaasApiKey = null;
          if (integrations) {
            // Formato Firestore: integrations.asaasConfig.asaasApiKey
            if (integrations.asaasConfig && integrations.asaasConfig.asaasApiKey) {
              asaasApiKey = integrations.asaasConfig.asaasApiKey;
              console.log('🔍 API Key do Asaas: Encontrada no formato Firestore ✅');
            }
            // Formato Realtime Database: integrations.asaasApiKey (direto)
            else if (integrations.asaasApiKey) {
              asaasApiKey = integrations.asaasApiKey;
              console.log('🔍 API Key do Asaas: Encontrada no formato Realtime Database ✅');
            }
            else {
              console.log('❌ API Key do Asaas: Não encontrada em nenhum formato');
            }
          }
          
          if (asaasApiKey) {
            try {
              // Preparar dados do cliente
              const customerData = {
                name: 'Cliente WhatsApp',
                phone: message.from,
                mobilePhone: message.from
              };
              
              // Preparar itens do pedido
              const orderItems = mentionedItems.map(item => ({
                name: item.name,
                price: item.price,
                quantity: 1,
                description: item.description
              }));
              
              // Criar cobrança no Asaas
              const chargeResult = await createAsaasCharge(asaasApiKey, customerData, orderItems, userId);
              
              if (chargeResult.success) {
                // Salvar pedido no Firebase
                const orderRef = db.ref(`orders/${userId}`).push();
                await orderRef.set({
                  orderId: orderRef.key,
                  chargeId: chargeResult.chargeId,
                  customer: customerData,
                  items: orderItems,
                  totalValue: chargeResult.value,
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                  paymentUrl: chargeResult.invoiceUrl
                });
                
                // Enviar link de pagamento
                const paymentMessage = `✅ *Pedido Criado!*\n\n` +
                  `📦 Itens:\n` +
                  orderItems.map(item => `• ${item.quantity}x ${item.name} - R$ ${parseFloat(item.price).toFixed(2)}`).join('\n') +
                  `\n\n💰 *Total: R$ ${chargeResult.value.toFixed(2)}*\n\n` +
                  `🔗 *Link de Pagamento:*\n${chargeResult.invoiceUrl}\n\n` +
                  `💳 *Formas de pagamento:*\n` +
                  `• Pix (instantâneo)\n` +
                  `• Cartão de crédito\n` +
                  `• Boleto bancário\n\n` +
                  `Vencimento: ${new Date(chargeResult.dueDate).toLocaleDateString('pt-BR')}\n\n` +
                  `Após o pagamento, você receberá uma confirmação automática! 🎉`;
                
                await client.sendText(message.from, paymentMessage);
                console.log('✅ Link de pagamento enviado!');
                
                // Salvar mensagem no histórico
                const paymentMsgRef = db.ref(`conversations/${userId}/${sanitizedNumber}/messages`).push();
                await paymentMsgRef.set({
                  from: message.to || '',
                  to: message.from || '',
                  body: paymentMessage,
                  timestamp: new Date().toISOString(),
                  type: 'payment_link',
                  isFromMe: true,
                  orderId: orderRef.key,
                  chargeId: chargeResult.chargeId
                });
              } else {
                console.error('❌ Erro ao criar cobrança:', chargeResult.error);
                await client.sendText(message.from, 
                  'Desculpe, tivemos um problema ao processar seu pedido. Por favor, tente novamente em instantes ou entre em contato conosco.'
                );
              }
            } catch (paymentError) {
              console.error('❌ Erro ao processar pagamento:', paymentError);
            }
          } else {
            console.log('⚠️ API Key do Asaas não configurada');
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

// Função para buscar configurações (Firestore e Realtime Database)
async function getIntegrationsConfig(userId) {
  try {
    // Tentar buscar no Firestore primeiro
    const firestorePath = `artifacts/${APP_ID}/users/${userId}/integrations_config/config`;
    console.log(`🔍 Tentando buscar no Firestore:`);
    console.log(`   Path: ${firestorePath}`);
    console.log(`   UserId: ${userId}`);
    
    const docRef = firestore.doc(firestorePath);
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      console.log('✅ Configurações encontradas no Firestore!');
      console.log('📄 Dados:', JSON.stringify(data, null, 2));
      return data;
    }
    
    console.log('⚠️ Não encontrado no Firestore, tentando Realtime Database...');
    
    // Fallback: tentar buscar no Realtime Database
    const realtimePath = `users/data/${userId}/integrations_config`;
    console.log(`🔍 Tentando buscar no Realtime Database:`);
    console.log(`   Path: ${realtimePath}`);
    
    const snapshot = await db.ref(realtimePath).once('value');
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log('✅ Configurações encontradas no Realtime Database!');
      console.log('📄 Dados:', JSON.stringify(data, null, 2));
      return data;
    }
    
    console.log('❌ Configurações não encontradas em nenhum banco!');
    console.log('💡 Verifique:');
    console.log('   1. Se você salvou a API Key do Asaas no site');
    console.log('   2. Se está logado com o mesmo usuário');
    console.log('   3. Se o userId está correto:', userId);
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    return null;
  }
}

// Função para detectar intenção de compra
function detectPurchaseIntent(messageText) {
  const purchaseKeywords = [
    'quero comprar',
    'vou comprar',
    'quero levar',
    'pode fazer o pedido',
    'fechar pedido',
    'confirmar pedido',
    'finalizar compra',
    'quero esse',
    'quero este',
    'vou levar',
    'me vende',
    'comprar',
    'adquirir'
  ];
  
  const lowerText = messageText.toLowerCase();
  return purchaseKeywords.some(keyword => lowerText.includes(keyword));
}

// Função para gerar cobrança no Asaas
async function createAsaasCharge(asaasApiKey, customerData, items, userId) {
  try {
    console.log('💳 Gerando cobrança no Asaas...');
    
    // Calcular valor total
    const totalValue = items.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * (item.quantity || 1));
    }, 0);
    
    // Criar descrição do pedido
    const description = items.map(item => 
      `${item.quantity || 1}x ${item.name}`
    ).join(', ');
    
    // Criar ou buscar cliente no Asaas
    let customerId;
    
    // Tentar criar cliente
    try {
      const customerResponse = await axios.post('https://www.asaas.com/api/v3/customers', {
        name: customerData.name || 'Cliente WhatsApp',
        cpfCnpj: customerData.cpfCnpj || null,
        email: customerData.email || null,
        phone: customerData.phone || null,
        mobilePhone: customerData.mobilePhone || customerData.phone,
        externalReference: `whatsapp_${userId}_${customerData.phone}`
      }, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      customerId = customerResponse.data.id;
      console.log('✅ Cliente criado no Asaas:', customerId);
    } catch (error) {
      // Se cliente já existe, buscar pelo externalReference
      if (error.response?.status === 400) {
        const searchResponse = await axios.get('https://www.asaas.com/api/v3/customers', {
          params: {
            externalReference: `whatsapp_${userId}_${customerData.phone}`
          },
          headers: {
            'access_token': asaasApiKey
          }
        });
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          customerId = searchResponse.data.data[0].id;
          console.log('✅ Cliente encontrado no Asaas:', customerId);
        }
      }
    }
    
    if (!customerId) {
      throw new Error('Não foi possível criar ou encontrar cliente no Asaas');
    }
    
    // Criar cobrança
    const chargeResponse = await axios.post('https://www.asaas.com/api/v3/payments', {
      customer: customerId,
      billingType: 'UNDEFINED', // Permite pix, cartão e boleto
      value: totalValue,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias
      description: description,
      externalReference: `order_${userId}_${Date.now()}`,
      postalService: false
    }, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Cobrança criada no Asaas:', chargeResponse.data.id);
    
    return {
      success: true,
      chargeId: chargeResponse.data.id,
      invoiceUrl: chargeResponse.data.invoiceUrl,
      bankSlipUrl: chargeResponse.data.bankSlipUrl,
      pixQrCode: chargeResponse.data.pixQrCode,
      value: totalValue,
      dueDate: chargeResponse.data.dueDate
    };
    
  } catch (error) {
    console.error('❌ Erro ao criar cobrança no Asaas:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.description || error.message
    };
  }
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

// Criar cobrança Asaas
app.post('/api/asaas/create-charge', async (req, res) => {
  try {
    const { userId, customerData, items } = req.body;
    
    if (!userId || !customerData || !items) {
      return res.status(400).json({ error: 'userId, customerData e items são obrigatórios' });
    }
    
    // Buscar API Key do Asaas no Firestore ou Realtime Database
    const integrations = await getIntegrationsConfig(userId);
    
    let asaasApiKey = null;
    if (integrations) {
      // Formato Firestore
      if (integrations.asaasConfig && integrations.asaasConfig.asaasApiKey) {
        asaasApiKey = integrations.asaasConfig.asaasApiKey;
      }
      // Formato Realtime Database
      else if (integrations.asaasApiKey) {
        asaasApiKey = integrations.asaasApiKey;
      }
    }
    
    if (!asaasApiKey) {
      return res.status(400).json({ error: 'API Key do Asaas não configurada' });
    }
    
    // Criar cobrança
    const result = await createAsaasCharge(asaasApiKey, customerData, items, userId);
    
    if (result.success) {
      // Salvar pedido no Firebase
      const orderRef = db.ref(`orders/${userId}`).push();
      await orderRef.set({
        orderId: orderRef.key,
        chargeId: result.chargeId,
        customer: customerData,
        items: items,
        totalValue: result.value,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paymentUrl: result.invoiceUrl
      });
      
      res.json({
        success: true,
        orderId: orderRef.key,
        ...result
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar cobrança:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook Asaas (receber notificações de pagamento)
app.post('/api/asaas/webhook', async (req, res) => {
  try {
    console.log('📬 Webhook Asaas recebido:', req.body);
    
    const { event, payment } = req.body;
    
    // Ignorar eventos que não são de pagamento
    const paymentEvents = [
      'PAYMENT_RECEIVED',
      'PAYMENT_CONFIRMED', 
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED'
    ];
    
    if (!paymentEvents.includes(event)) {
      console.log(`⚠️ Evento ignorado (não é de pagamento): ${event}`);
      return res.json({ received: true, ignored: true, reason: 'Evento não é relacionado a pagamento' });
    }
    
    if (!payment) {
      console.log('⚠️ Webhook sem dados de pagamento');
      return res.json({ received: true, ignored: true, reason: 'Sem dados de pagamento' });
    }
    
    // Buscar pedido pelo externalReference
    const ordersSnapshot = await db.ref('orders').once('value');
    let userId, orderId, orderData;
    
    if (ordersSnapshot.exists()) {
      ordersSnapshot.forEach((userOrders) => {
        userOrders.forEach((order) => {
          if (order.val().chargeId === payment.id) {
            userId = userOrders.key;
            orderId = order.key;
            orderData = order.val();
          }
        });
      });
    }
    
    if (!userId || !orderId) {
      console.log('⚠️ Pedido não encontrado para chargeId:', payment.id);
      return res.json({ received: true });
    }
    
    // Atualizar status do pedido
    const newStatus = {
      'PAYMENT_RECEIVED': 'paid',
      'PAYMENT_CONFIRMED': 'paid',
      'PAYMENT_OVERDUE': 'overdue',
      'PAYMENT_DELETED': 'cancelled'
    }[event] || 'pending';
    
    await db.ref(`orders/${userId}/${orderId}`).update({
      status: newStatus,
      updatedAt: new Date().toISOString(),
      paymentData: payment
    });
    
    console.log(`✅ Pedido ${orderId} atualizado para status: ${newStatus}`);
    
    // Se pagamento foi confirmado, enviar mensagem no WhatsApp
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const client = activeClients.get(userId);
      
      if (client && orderData.customer.phone) {
        const successMessage = `✅ *Pagamento Confirmado!*\n\n` +
          `Pedido #${orderId.substring(0, 8)}\n` +
          `Valor: R$ ${payment.value.toFixed(2)}\n\n` +
          `Obrigado pela sua compra! 🎉\n` +
          `Em breve você receberá mais informações sobre a entrega.`;
        
        try {
          await client.sendText(orderData.customer.phone, successMessage);
          console.log('✅ Mensagem de confirmação enviada');
        } catch (error) {
          console.error('❌ Erro ao enviar mensagem de confirmação:', error);
        }
      }
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('❌ Erro no webhook Asaas:', error);
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

