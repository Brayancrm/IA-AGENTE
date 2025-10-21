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

// IMPORTANTE: Forçar uso do banco secundário onde estão os dados do Firestore
// NÃO usar a variável de ambiente que pode estar apontando para o banco default vazio
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ia-agente-b2f46.firebaseio.com' // Banco secundário com dados
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
    
    // ============================================
    // DETECÇÃO E SALVAMENTO AUTOMÁTICO DE DADOS DO CLIENTE
    // ============================================
    if (!message.isFromMe) {
      await detectAndSaveCustomerData(userId, message.from, message.body, sanitizedNumber);
    }
    
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
        
        // ============================================
        // DETECTAR SE O AGENTE FEZ UMA PERGUNTA (nome, cpf, email)
        // ============================================
        await detectAgentQuestion(userId, sanitizedNumber, aiResponse);
        
        // ============================================
        // DETECTAR MENSAGEM DE GATILHO PARA GERAR LINK
        // ============================================
        const triggerMessage = 'Perfeito! Vou enviar abaixo seu Link para que efetue o Pagamento.';
        if (aiResponse.includes(triggerMessage)) {
          console.log('🎯 MENSAGEM DE GATILHO DETECTADA! Gerando link de pagamento...');
          await tryAutoGeneratePaymentLink(userId, message.from, sanitizedNumber);
        }
        
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
              // Buscar dados salvos do cliente
              const phoneNumber = message.from.replace(/[^0-9]/g, '');
              const customerDataRef = db.ref(`customerData/${userId}/${phoneNumber}`);
              const customerSnapshot = await customerDataRef.once('value');
              const savedCustomerData = customerSnapshot.val();
              
              // Preparar dados do cliente (usando dados salvos se existirem)
              const customerData = {
                name: savedCustomerData?.name || 'Cliente WhatsApp',
                phone: message.from,
                mobilePhone: message.from,
                // Adicionar dados coletados se disponíveis
                ...(savedCustomerData?.cpfCnpj && { cpfCnpj: savedCustomerData.cpfCnpj }),
                ...(savedCustomerData?.email && { email: savedCustomerData.email }),
                ...(savedCustomerData?.address && { 
                  address: savedCustomerData.address.street,
                  addressNumber: savedCustomerData.address.number,
                  complement: savedCustomerData.address.complement,
                  province: savedCustomerData.address.neighborhood,
                  postalCode: savedCustomerData.address.zipCode
                })
              };
              
              console.log('📋 Dados do cliente:', savedCustomerData ? 'Encontrados ✅' : 'Não encontrados (usando padrão) ⚠️');
              
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

// Função para detectar e salvar dados do cliente automaticamente
// Função para detectar qual pergunta o agente está fazendo
async function detectAgentQuestion(userId, sanitizedNumber, messageText) {
  try {
    const contextRef = db.ref(`collectionContext/${userId}/${sanitizedNumber}`);
    const lowerText = messageText.toLowerCase();
    
    // Detectar se o agente está perguntando QUANTIDADE
    const quantityKeywords = [
      'quantas unidades',
      'quantos',
      'quantas',
      'qual quantidade',
      'quantidade deseja',
      'quantas gostaria',
      'quantos gostaria',
      'me informe quantas',
      'me informe quantos'
    ];
    
    if (quantityKeywords.some(keyword => lowerText.includes(keyword))) {
      // Tentar detectar qual produto está sendo perguntado
      let productAsked = null;
      
      // Buscar produtos para identificar qual está sendo mencionado
      const productsSnapshot = await db.ref(`products/${userId}`).once('value');
      if (productsSnapshot.exists()) {
        const products = Object.values(productsSnapshot.val());
        for (const product of products) {
          const productName = product.name ? product.name.toLowerCase() : '';
          if (lowerText.includes(productName)) {
            productAsked = product.name;
            break;
          }
        }
      }
      
      await contextRef.set({ 
        waitingFor: 'quantity',
        productName: productAsked,
        askedAt: new Date().toISOString()
      });
      console.log(`🎯 Agente perguntou a QUANTIDADE ${productAsked ? `de "${productAsked}"` : ''} - aguardando resposta`);
      return;
    }
    
    // Detectar se o agente está perguntando o NOME
    const nameKeywords = [
      'nome completo',
      'seu nome',
      'qual o nome',
      'qual é o nome',
      'me informe seu nome',
      'poderia me informar seu nome',
      'informe seu nome'
    ];
    
    if (nameKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'name',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o NOME - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando CPF/CNPJ
    const cpfKeywords = [
      'cpf',
      'cnpj',
      'seu documento',
      'número do documento',
      'informe seu cpf'
    ];
    
    if (cpfKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'cpfCnpj',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o CPF/CNPJ - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando EMAIL
    const emailKeywords = [
      'e-mail',
      'email',
      'seu e-mail',
      'qual o email',
      'qual é o email',
      'informe seu email'
    ];
    
    if (emailKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'email',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o EMAIL - aguardando resposta do cliente');
      return;
    }
    
  } catch (error) {
    console.error('❌ Erro ao detectar pergunta do agente:', error);
  }
}

// Função MELHORADA para detectar e salvar dados do cliente (baseada no contexto)
async function detectAndSaveCustomerData(userId, phone, messageText, sanitizedNumber) {
  try {
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    const customerRef = db.ref(`customerData/${userId}/${phoneNumber}`);
    const contextRef = db.ref(`collectionContext/${userId}/${sanitizedNumber}`);
    
    // Buscar dados existentes
    const snapshot = await customerRef.once('value');
    let customerData = snapshot.val() || {};
    
    // Buscar contexto (qual pergunta foi feita)
    const contextSnapshot = await contextRef.once('value');
    const context = contextSnapshot.val();
    
    let dataUpdated = false;
    
    if (context && context.waitingFor) {
      console.log(`📝 Processando resposta para: ${context.waitingFor}`);
      
      // Cliente está respondendo à pergunta de QUANTIDADE
      if (context.waitingFor === 'quantity') {
        const numbersOnly = messageText.replace(/[^0-9]/g, '');
        const quantity = parseInt(numbersOnly);
        
        if (quantity > 0 && quantity <= 1000) {
          // Salvar quantidade no customerData com referência ao produto
          if (!customerData.quantities) {
            customerData.quantities = {};
          }
          
          // Se sabemos qual produto, salvar com o nome do produto
          if (context.productName) {
            customerData.quantities[context.productName] = quantity;
            console.log(`✅ Quantidade detectada e salva: ${quantity}x ${context.productName}`);
          } else {
            // Se não sabemos o produto específico, salvar como quantidade geral (última mencionada)
            customerData.lastQuantity = quantity;
            console.log(`✅ Quantidade detectada e salva: ${quantity} unidades`);
          }
          
          dataUpdated = true;
          await contextRef.remove();
        }
      }
      
      // Cliente está respondendo à pergunta do NOME
      else if (context.waitingFor === 'name' && !customerData.name) {
        const words = messageText.trim().split(/\s+/);
        const hasNoNumbers = !/\d/.test(messageText);
        const hasNoSpecialChars = !/[@#$%&*()_+=\[\]{}|\\:;"'<>,.?/]/.test(messageText);
        const isReasonableLength = messageText.length >= 2 && messageText.length <= 100;
        
        if (words.length >= 1 && hasNoNumbers && hasNoSpecialChars && isReasonableLength) {
          customerData.name = messageText.trim();
          dataUpdated = true;
          console.log('✅ Nome detectado e salvo:', customerData.name);
          
          // Limpar contexto após salvar
          await contextRef.remove();
        }
      }
      
      // Cliente está respondendo à pergunta do CPF/CNPJ
      else if (context.waitingFor === 'cpfCnpj' && !customerData.cpfCnpj) {
        const numbersOnly = messageText.replace(/[^0-9]/g, '');
        
        // CPF: 11 dígitos
        if (numbersOnly.length === 11) {
          customerData.cpfCnpj = numbersOnly;
          dataUpdated = true;
          console.log('✅ CPF detectado e salvo:', numbersOnly);
          await contextRef.remove();
        }
        // CNPJ: 14 dígitos
        else if (numbersOnly.length === 14) {
          customerData.cpfCnpj = numbersOnly;
          dataUpdated = true;
          console.log('✅ CNPJ detectado e salvo (14 dígitos):', numbersOnly);
          await contextRef.remove();
        }
      }
      
      // Cliente está respondendo à pergunta do EMAIL
      else if (context.waitingFor === 'email' && !customerData.email) {
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
        const emailMatch = messageText.match(emailRegex);
        
        if (emailMatch) {
          customerData.email = emailMatch[0].toLowerCase().trim();
          dataUpdated = true;
          console.log('✅ Email detectado e salvo:', customerData.email);
          await contextRef.remove();
        }
      }
    }
    
    // Se algum dado foi atualizado, salvar no Firebase
    if (dataUpdated) {
      customerData.phone = phone;
      customerData.updatedAt = new Date().toISOString();
      
      await customerRef.set(customerData);
      console.log('💾 Dados do cliente atualizados no Firebase');
      
      // Log de resumo dos dados coletados
      console.log('📊 Dados coletados até agora:');
      console.log('   Nome:', customerData.name || '❌ Ainda não coletado');
      console.log('   Email:', customerData.email || '❌ Ainda não coletado');
      console.log('   CPF/CNPJ:', customerData.cpfCnpj || '❌ Ainda não coletado');
    }
    
  } catch (error) {
    console.error('❌ Erro ao detectar/salvar dados do cliente:', error);
  }
}

// 🎯 Função para tentar gerar link automaticamente quando todos os dados estão completos
async function tryAutoGeneratePaymentLink(userId, phone, sanitizedNumber) {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🎯 INICIANDO GERAÇÃO DE LINK         ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('📍 UserID:', userId);
    console.log('📍 Phone:', phone);
    console.log('📍 Sanitized:', sanitizedNumber);
    
    const client = activeClients.get(userId);
    if (!client) {
      console.log('❌ Cliente WhatsApp não encontrado para geração automática');
      return;
    }
    console.log('✅ Cliente WhatsApp conectado\n');

    // Buscar produtos mencionados recentemente na conversa (últimas 10 mensagens)
    console.log('[1/6] 🔍 Buscando mensagens da conversa...');
    const conversationRef = db.ref(`conversations/${userId}/${sanitizedNumber}/messages`);
    
    console.log('   📂 Path:', `conversations/${userId}/${sanitizedNumber}/messages`);
    const messagesSnapshot = await conversationRef.orderByChild('timestamp').limitToLast(10).once('value');
    
    if (!messagesSnapshot.exists()) {
      console.log('❌ [1/6] Nenhuma conversa encontrada');
      return;
    }
    console.log(`✅ [1/6] ${messagesSnapshot.numChildren()} mensagens encontradas\n`);

    // Buscar produtos cadastrados
    console.log('[2/6] 🔍 Buscando produtos cadastrados...');
    console.log('   📂 Path:', `products/${userId}`);
    const productsSnapshot = await db.ref(`products/${userId}`).once('value');
    const productsData = productsSnapshot.val();
    
    if (!productsData) {
      console.log('❌ [2/6] Nenhum produto cadastrado');
      console.log('💡 Cadastre produtos em: Dashboard → Catálogo');
      return;
    }

    const products = Object.values(productsData);
    console.log(`✅ [2/6] ${products.length} produto(s) cadastrado(s):`);
    products.forEach(p => console.log(`   • ${p.name} - R$ ${p.price}`));
    
    const mentionedProducts = [];
    
    console.log('\n[3/6] 🔍 Analisando mensagens para encontrar produtos...');
    
    // Analisar mensagens para encontrar produtos mencionados
    let messageCount = 0;
    messagesSnapshot.forEach((messageSnap) => {
      const msg = messageSnap.val();
      const messageText = msg.body ? msg.body.toLowerCase() : '';
      messageCount++;
      
      if (messageText) {
        const preview = messageText.substring(0, 60);
        console.log(`   📝 Msg ${messageCount}: "${preview}${messageText.length > 60 ? '...' : ''}"`);
      }
      
      products.forEach(product => {
        // Validação de segurança
        if (!product || !product.name || typeof product.name !== 'string') {
          return;
        }

        const productName = product.name.toLowerCase();
        
        // DETECÇÃO INTELIGENTE (versão segura)
        // 1. Match exato do nome completo
        const isExactMatch = messageText.includes(productName);
        
        // 2. Match de palavras-chave (palavras com 4+ caracteres)
        const words = productName.split(/\s+/).filter(w => w.length >= 4);
        let keywordMatch = false;
        let matchedWord = '';
        
        for (const word of words) {
          // Aceita palavra exata ou sem 's' final (plural)
          const wordBase = word.replace(/s$/, '');
          if (messageText.includes(word) || messageText.includes(wordBase)) {
            keywordMatch = true;
            matchedWord = word;
            break;
          }
        }
        
        // Adicionar produto se encontrou match e ainda não foi adicionado
        if ((isExactMatch || keywordMatch) && !mentionedProducts.find(p => p.id === product.id)) {
          const matchType = isExactMatch ? 'exato' : 'palavra-chave';
          console.log(`      ✅ MATCH ${matchType}! Produto "${product.name}" encontrado!`);
          if (keywordMatch && matchedWord) {
            console.log(`         🔍 Detectado pela palavra: "${matchedWord}"`);
          }
          mentionedProducts.push(product);
        }
      });
    });

    console.log(`\n✅ [3/6] Análise concluída:`);
    console.log(`   📊 Mensagens analisadas: ${messageCount}`);
    console.log(`   📦 Produtos encontrados: ${mentionedProducts.length}`);

    if (mentionedProducts.length === 0) {
      console.log('\n❌ [3/6] Nenhum produto mencionado na conversa');
      console.log('💡 Produtos disponíveis:', products.map(p => `"${p.name}"`).join(', '));
      console.log('💡 Certifique-se de que o cliente mencionou o nome do produto na conversa');
      return;
    }

    mentionedProducts.forEach(p => console.log(`   • ${p.name} - R$ ${p.price}`));

    // Buscar quantidades salvas pelo agente (quando perguntou "quantas unidades?")
    console.log('\n[4/6] 🔍 Buscando quantidades salvas...');
    const productsWithQuantity = await getProductQuantities(userId, phone, mentionedProducts);
    console.log('✅ [4/6] Quantidades aplicadas:');
    productsWithQuantity.forEach(p => console.log(`   • ${p.quantity}x ${p.name} = R$ ${(p.price * p.quantity).toFixed(2)}`));

    // Buscar API Key do Asaas usando a função getIntegrationsConfig
    console.log('\n[5/6] 🔍 Buscando API Key do Asaas...');
    const integrations = await getIntegrationsConfig(userId);
    let asaasApiKey = null;

    if (integrations) {
      // Formato Firestore: integrations.asaasConfig.asaasApiKey
      if (integrations.asaasConfig && integrations.asaasConfig.asaasApiKey) {
        asaasApiKey = integrations.asaasConfig.asaasApiKey;
        console.log('✅ [5/6] API Key encontrada (Firestore)');
      }
      // Formato Realtime Database: integrations.asaasApiKey (direto)
      else if (integrations.asaasApiKey) {
        asaasApiKey = integrations.asaasApiKey;
        console.log('✅ [5/6] API Key encontrada (Realtime DB)');
      }
      else {
        console.log('❌ [5/6] API Key não encontrada em integrations_config');
      }
    } else {
      console.log('❌ [5/6] Configurações de integração não encontradas');
    }

    if (!asaasApiKey) {
      console.log('💡 Cadastre sua API Key em: Dashboard → Integrações → Asaas');
      return;
    }

    // Buscar dados salvos do cliente
    console.log('\n[6/6] 🔍 Verificando dados do cliente...');
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    const customerDataRef = db.ref(`customerData/${userId}/${phoneNumber}`);
    const customerSnapshot = await customerDataRef.once('value');
    const savedCustomerData = customerSnapshot.val();

    if (!savedCustomerData || !savedCustomerData.name || !savedCustomerData.email || !savedCustomerData.cpfCnpj) {
      console.log('❌ [6/6] Dados do cliente incompletos:');
      console.log('   👤 Nome:', savedCustomerData?.name || '❌');
      console.log('   📧 Email:', savedCustomerData?.email || '❌');
      console.log('   📄 CPF/CNPJ:', savedCustomerData?.cpfCnpj || '❌');
      return;
    }

    console.log('✅ [6/6] Dados do cliente completos:');
    console.log(`   👤 Nome: ${savedCustomerData.name}`);
    console.log(`   📧 Email: ${savedCustomerData.email}`);
    console.log(`   📄 CPF/CNPJ: ${savedCustomerData.cpfCnpj}`);

    // Preparar dados do cliente
    const customerData = {
      name: savedCustomerData.name,
      phone: phone,
      mobilePhone: phone,
      cpfCnpj: savedCustomerData.cpfCnpj,
      email: savedCustomerData.email,
      ...(savedCustomerData.address && {
        address: savedCustomerData.address.street,
        addressNumber: savedCustomerData.address.number,
        complement: savedCustomerData.address.complement,
        province: savedCustomerData.address.neighborhood,
        postalCode: savedCustomerData.address.zipCode
      })
    };

    // Preparar itens do pedido COM QUANTIDADES DETECTADAS
    const orderItems = productsWithQuantity.map(item => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity, // Quantidade detectada da conversa!
      description: item.description || ''
    }));

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🚀 GERANDO LINK DE PAGAMENTO        ║');
    console.log('╚════════════════════════════════════════╝');
    orderItems.forEach(i => {
      console.log(`   📦 ${i.quantity}x ${i.name} = R$ ${(i.price * i.quantity).toFixed(2)}`);
    });
    const totalValue = orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    console.log(`   💰 TOTAL: R$ ${totalValue.toFixed(2)}\n`);

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
        paymentUrl: chargeResult.invoiceUrl,
        autoGenerated: true // Flag para indicar que foi gerado automaticamente
      });

      // Enviar link de pagamento
      const paymentMessage = `✅ *Pedido Criado!*\n\n` +
        `📦 *Itens:*\n` +
        orderItems.map(item => `• ${item.quantity}x ${item.name} - R$ ${parseFloat(item.price).toFixed(2)}`).join('\n') +
        `\n\n💰 *Total: R$ ${chargeResult.value.toFixed(2)}*\n\n` +
        `🔗 *Link de Pagamento:*\n${chargeResult.invoiceUrl}\n\n` +
        `💳 *Formas de pagamento disponíveis:*\n` +
        `• 💚 Pix (aprovação instantânea)\n` +
        `• 💳 Cartão de crédito\n` +
        `• 🎫 Boleto bancário\n\n` +
        `📅 Vencimento: ${new Date(chargeResult.dueDate).toLocaleDateString('pt-BR')}\n\n` +
        `Após a confirmação do pagamento, você receberá uma notificação automática! 🎉`;

      await client.sendText(phone, paymentMessage);
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║  ✅ LINK ENVIADO COM SUCESSO!         ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('🔗 URL:', chargeResult.invoiceUrl);
      console.log('💰 Valor: R$', chargeResult.value.toFixed(2));
      console.log('');

      // Salvar mensagem de pagamento no histórico
      const paymentMsgRef = db.ref(`conversations/${userId}/${sanitizedNumber}/messages`).push();
      await paymentMsgRef.set({
        from: 'system',
        to: phone,
        body: paymentMessage,
        timestamp: new Date().toISOString(),
        type: 'payment_link',
        isFromMe: true
      });

      console.log('🎉 PROCESSO AUTOMÁTICO CONCLUÍDO COM SUCESSO!');
    } else {
      console.log('❌ Erro ao gerar cobrança:', chargeResult.error);
    }

  } catch (error) {
    console.error('❌ Erro na geração automática do link:', error);
  }
}

// Função para detectar quantidade mencionada no texto
function detectQuantity(messageText, productName) {
  try {
    const lowerText = messageText.toLowerCase();
    const lowerProduct = productName.toLowerCase();
    
    // Padrões de quantidade comuns
    // Ex: "2 sabões", "quero 3", "pode ser 5 unidades", "10 produtos"
    const patterns = [
      // Número + produto: "2 sabões", "3 lavagens"
      new RegExp(`(\\d+)\\s*${lowerProduct}`, 'i'),
      // Número + palavras indicativas + produto: "quero 2 do sabão"
      new RegExp(`(\\d+)\\s*(?:do|de|da)?\\s*${lowerProduct}`, 'i'),
      // Produto + número: "sabão, quero 2"
      new RegExp(`${lowerProduct}[^\\d]*(\\d+)`, 'i'),
      // Número + unidades/produtos: "quero 5 unidades", "pode ser 3 produtos"
      new RegExp(`(\\d+)\\s*(?:unidades?|produtos?|itens?)`, 'i'),
      // Apenas número seguido de espaço: "quero 2", "pode ser 3"
      /(?:quero|pode ser|gostaria de?|vou levar)\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        const quantity = parseInt(match[1]);
        if (quantity > 0 && quantity <= 1000) { // Limite razoável
          console.log(`🔢 Quantidade detectada: ${quantity}x ${productName}`);
          return quantity;
        }
      }
    }
    
    // Se não encontrar quantidade específica, retornar 1
    return 1;
  } catch (error) {
    console.error('❌ Erro ao detectar quantidade:', error);
    return 1;
  }
}

// Função para buscar quantidades salvas dos produtos
async function getProductQuantities(userId, phone, products) {
  try {
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    const customerRef = db.ref(`customerData/${userId}/${phoneNumber}`);
    const snapshot = await customerRef.once('value');
    const customerData = snapshot.val();
    
    if (!customerData) {
      console.log('📝 Nenhuma quantidade salva, usando padrão (1)');
      return products.map(p => ({ ...p, quantity: 1 }));
    }
    
    console.log('📝 Buscando quantidades salvas...');
    
    // Para cada produto, buscar quantidade salva
    const productsWithQuantity = products.map(product => {
      let quantity = 1; // Padrão
      
      // Verificar se há quantidade específica salva para este produto
      if (customerData.quantities && customerData.quantities[product.name]) {
        quantity = customerData.quantities[product.name];
        console.log(`✅ Quantidade salva encontrada: ${quantity}x ${product.name}`);
      }
      // Se houver apenas uma última quantidade e só um produto, usar ela
      else if (customerData.lastQuantity && products.length === 1) {
        quantity = customerData.lastQuantity;
        console.log(`✅ Usando última quantidade salva: ${quantity}x ${product.name}`);
      }
      else {
        console.log(`⚠️ Nenhuma quantidade específica para ${product.name}, usando 1`);
      }
      
      return {
        ...product,
        quantity: quantity
      };
    });
    
    return productsWithQuantity;
    
  } catch (error) {
    console.error('❌ Erro ao buscar quantidades:', error);
    return products.map(p => ({ ...p, quantity: 1 }));
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
      const customerPayload = {
        name: customerData.name || 'Cliente WhatsApp',
        mobilePhone: customerData.mobilePhone || customerData.phone,
        externalReference: `whatsapp_${userId}_${customerData.phone}`
      };
      
      // Adicionar campos opcionais apenas se existirem
      if (customerData.cpfCnpj) {
        customerPayload.cpfCnpj = customerData.cpfCnpj;
      }
      if (customerData.email) {
        customerPayload.email = customerData.email;
      }
      if (customerData.phone) {
        customerPayload.phone = customerData.phone;
      }
      
      console.log('📝 Criando cliente no Asaas (sem CPF/CNPJ)...');
      
      const customerResponse = await axios.post('https://www.asaas.com/api/v3/customers', customerPayload, {
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
    console.log('💳 Criando cobrança no Asaas...');
    console.log(`   Cliente ID: ${customerId}`);
    console.log(`   Valor: R$ ${totalValue.toFixed(2)}`);
    console.log(`   Descrição: ${description}`);
    
    const chargePayload = {
      customer: customerId,
      billingType: 'UNDEFINED', // Permite pix, cartão e boleto
      value: totalValue,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias
      description: description,
      externalReference: `order_${userId}_${Date.now()}`,
      postalService: false
    };
    
    const chargeResponse = await axios.post('https://www.asaas.com/api/v3/payments', chargePayload, {
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
// FUNÇÕES DE NOTA FISCAL
// ============================================

// Função para emitir Nota Fiscal no Asaas
async function emitirNotaFiscal(userId, orderId, orderData, payment) {
  try {
    console.log('📄 [NF] Iniciando emissão de nota fiscal...');
    console.log('   Pedido:', orderId);
    console.log('   Valor:', payment.value);
    
    // 1. Buscar API Key do Asaas
    const integrations = await getIntegrationsConfig(userId);
    let asaasApiKey = null;

    if (integrations) {
      if (integrations.asaasConfig && integrations.asaasConfig.asaasApiKey) {
        asaasApiKey = integrations.asaasConfig.asaasApiKey;
      } else if (integrations.asaasApiKey) {
        asaasApiKey = integrations.asaasApiKey;
      }
    }

    if (!asaasApiKey) {
      console.log('❌ [NF] API Key do Asaas não encontrada');
      return { success: false, error: 'API Key não encontrada' };
    }
    
    console.log('✅ [NF] API Key encontrada');
    
    // 2. Buscar configurações fiscais do usuário
    const fiscalConfigRef = db.ref(`users/data/${userId}/fiscal_config`);
    const fiscalConfigSnapshot = await fiscalConfigRef.once('value');
    const fiscalConfig = fiscalConfigSnapshot.val();
    
    if (!fiscalConfig || !fiscalConfig.enabled) {
      console.log('⚠️ [NF] Emissão de nota fiscal não está habilitada');
      return { success: false, error: 'Emissão de NF não habilitada' };
    }
    
    console.log('✅ [NF] Configurações fiscais encontradas');
    
    // 3. Preparar dados da nota fiscal
    const serviceDescription = orderData.items.map(item => 
      `${item.quantity}x ${item.name}${item.description ? ` - ${item.description}` : ''}`
    ).join(', ');
    
    const invoiceData = {
      customer: payment.customer, // ID do cliente no Asaas
      serviceDescription: serviceDescription,
      value: payment.value,
      
      // Dados do tomador (cliente)
      deductions: fiscalConfig.deductions || 0,
      effectiveDate: new Date().toISOString().split('T')[0], // Data de hoje YYYY-MM-DD
      
      // Configurações de impostos
      taxes: {
        retainIss: fiscalConfig.retainIss || false,
        iss: fiscalConfig.issRate || 0, // Alíquota ISS em %
        cofins: fiscalConfig.cofinsRate || 0,
        csll: fiscalConfig.csllRate || 0,
        inss: fiscalConfig.inssRate || 0,
        ir: fiscalConfig.irRate || 0,
        pis: fiscalConfig.pisRate || 0
      },
      
      // Observações
      observations: fiscalConfig.observations || 'Nota fiscal emitida automaticamente'
    };
    
    console.log('📝 [NF] Dados da nota fiscal preparados');
    
    // 4. Criar nota fiscal via API do Asaas
    const asaasUrl = process.env.ASAAS_ENV === 'production' 
      ? 'https://api.asaas.com/v3/invoices'
      : 'https://sandbox.asaas.com/api/v3/invoices';
    
    console.log('🌐 [NF] Enviando para Asaas:', asaasUrl);
    
    const response = await axios.post(asaasUrl, invoiceData, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ [NF] Nota fiscal criada no Asaas');
    console.log('   ID:', response.data.id);
    console.log('   Número:', response.data.number);
    
    // 5. Salvar dados da nota fiscal no Firebase
    const invoiceRef = db.ref(`invoices/${userId}/${orderId}`);
    await invoiceRef.set({
      invoiceId: response.data.id,
      invoiceNumber: response.data.number,
      orderId: orderId,
      chargeId: payment.id,
      customer: orderData.customer,
      value: payment.value,
      items: orderData.items,
      status: response.data.status,
      effectiveDate: response.data.effectiveDate,
      taxes: invoiceData.taxes,
      pdfUrl: response.data.pdfUrl || null,
      xmlUrl: response.data.xmlUrl || null,
      createdAt: new Date().toISOString(),
      asaasData: response.data
    });
    
    console.log('✅ [NF] Nota fiscal salva no Firebase');
    
    // 6. Atualizar pedido com ID da nota fiscal
    await db.ref(`orders/${userId}/${orderId}`).update({
      invoiceId: response.data.id,
      invoiceNumber: response.data.number,
      invoiceStatus: response.data.status,
      invoiceEmittedAt: new Date().toISOString()
    });
    
    console.log('✅ [NF] Pedido atualizado com dados da NF');
    
    return {
      success: true,
      invoiceId: response.data.id,
      invoiceNumber: response.data.number,
      invoiceUrl: response.data.pdfUrl || response.data.xmlUrl,
      status: response.data.status
    };
    
  } catch (error) {
    console.error('❌ [NF] Erro ao emitir nota fiscal:', error.response?.data || error.message);
    
    // Salvar erro no Firebase para análise
    try {
      await db.ref(`invoices/${userId}/${orderId}_error`).set({
        orderId: orderId,
        error: error.response?.data || error.message,
        attemptedAt: new Date().toISOString()
      });
    } catch (saveError) {
      console.error('❌ [NF] Erro ao salvar log de erro:', saveError);
    }
    
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
    
    // Se pagamento foi confirmado, enviar mensagem no WhatsApp E EMITIR NOTA FISCAL
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
        
        // 📄 EMITIR NOTA FISCAL AUTOMATICAMENTE
        console.log('📄 Iniciando emissão de nota fiscal...');
        try {
          const invoiceResult = await emitirNotaFiscal(userId, orderId, orderData, payment);
          
          if (invoiceResult.success) {
            console.log('✅ Nota fiscal emitida com sucesso:', invoiceResult.invoiceNumber);
            
            // Enviar NF para o cliente
            const invoiceMessage = `📄 *Nota Fiscal Emitida!*\n\n` +
              `Número: ${invoiceResult.invoiceNumber}\n` +
              `Valor: R$ ${payment.value.toFixed(2)}\n\n` +
              `🔗 Acesse: ${invoiceResult.invoiceUrl || 'Processando...'}`;
            
            await client.sendText(orderData.customer.phone, invoiceMessage);
            console.log('✅ Nota fiscal enviada para o cliente');
          } else {
            console.error('❌ Erro ao emitir nota fiscal:', invoiceResult.error);
          }
        } catch (invoiceError) {
          console.error('❌ Erro ao processar nota fiscal:', invoiceError);
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
// ENDPOINTS DE DADOS DO CLIENTE
// ============================================

// Salvar dados do cliente coletados via WhatsApp
app.post('/api/customer-data/save', async (req, res) => {
  try {
    const { userId, phone, data } = req.body;

    if (!userId || !phone || !data) {
      return res.status(400).json({ error: 'userId, phone e data são obrigatórios' });
    }

    console.log(`💾 Salvando dados do cliente: ${phone}`);

    // Salvar no Realtime Database
    const customerRef = ref(realtimeDb, `customerData/${userId}/${phone.replace(/[^0-9]/g, '')}`);
    await set(customerRef, {
      ...data,
      phone: phone,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Dados do cliente salvos com sucesso');
    res.json({ success: true, message: 'Dados salvos com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao salvar dados do cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Buscar dados do cliente
app.get('/api/customer-data/get/:userId/:phone', async (req, res) => {
  try {
    const { userId, phone } = req.params;
    
    console.log(`🔍 Buscando dados do cliente: ${phone}`);

    const customerRef = ref(realtimeDb, `customerData/${userId}/${phone.replace(/[^0-9]/g, '')}`);
    const snapshot = await get(customerRef);

    if (snapshot.exists()) {
      console.log('✅ Dados do cliente encontrados');
      res.json({ success: true, data: snapshot.val() });
    } else {
      console.log('⚠️ Dados do cliente não encontrados');
      res.json({ success: false, data: null });
    }

  } catch (error) {
    console.error('❌ Erro ao buscar dados do cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENDPOINTS DE CONFIGURAÇÕES FISCAIS
// ============================================

// Salvar configurações fiscais para emissão de NF
app.post('/api/fiscal-config/save', async (req, res) => {
  try {
    const { userId, config } = req.body;

    if (!userId || !config) {
      return res.status(400).json({ error: 'userId e config são obrigatórios' });
    }

    console.log('💾 Salvando configurações fiscais para userId:', userId);

    const fiscalConfigRef = db.ref(`users/data/${userId}/fiscal_config`);
    await fiscalConfigRef.set({
      ...config,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Configurações fiscais salvas com sucesso');
    res.json({ success: true, message: 'Configurações fiscais salvas com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao salvar configurações fiscais:', error);
    res.status(500).json({ error: error.message });
  }
});

// Buscar configurações fiscais
app.get('/api/fiscal-config/get/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔍 Buscando configurações fiscais para userId:', userId);

    const fiscalConfigRef = db.ref(`users/data/${userId}/fiscal_config`);
    const snapshot = await fiscalConfigRef.once('value');

    if (snapshot.exists()) {
      console.log('✅ Configurações fiscais encontradas');
      res.json({ success: true, data: snapshot.val() });
    } else {
      console.log('⚠️ Configurações fiscais não encontradas, usando padrão');
      res.json({
        success: true,
        data: {
          enabled: false,
          issRate: 0,
          retainIss: false,
          cofinsRate: 0,
          csllRate: 0,
          inssRate: 0,
          irRate: 0,
          pisRate: 0,
          deductions: 0,
          observations: ''
        }
      });
    }

  } catch (error) {
    console.error('❌ Erro ao buscar configurações fiscais:', error);
    res.status(500).json({ error: error.message });
  }
});

// Buscar notas fiscais emitidas
app.get('/api/invoices/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔍 Buscando notas fiscais para userId:', userId);

    const invoicesRef = db.ref(`invoices/${userId}`);
    const snapshot = await invoicesRef.once('value');

    if (snapshot.exists()) {
      const invoices = [];
      snapshot.forEach((childSnapshot) => {
        const invoice = childSnapshot.val();
        if (!childSnapshot.key.endsWith('_error')) { // Ignorar logs de erro
          invoices.push({
            id: childSnapshot.key,
            ...invoice
          });
        }
      });

      console.log(`✅ ${invoices.length} nota(s) fiscal(is) encontrada(s)`);
      res.json({ success: true, invoices });
    } else {
      console.log('⚠️ Nenhuma nota fiscal encontrada');
      res.json({ success: true, invoices: [] });
    }

  } catch (error) {
    console.error('❌ Erro ao buscar notas fiscais:', error);
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

