const wppconnect = require('@wppconnect-team/wppconnect');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const Stripe = require('stripe');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Inicializar AWS SES
let sesClient = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  sesClient = new SESClient({
    region: process.env.AWS_SES_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
  console.log('✅ AWS SES inicializado');
  console.log('   Região:', process.env.AWS_SES_REGION || 'us-east-1');
  console.log('   Email remetente:', process.env.AWS_SES_FROM_EMAIL || 'não configurado');
} else {
  console.log('⚠️ AWS SES não configurado - Configure AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY');
  console.log('   Verifique se o arquivo .env existe na pasta backend/');
  console.log('   Variáveis encontradas:', {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '✅' : '❌',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '✅' : '❌'
  });
}

const APP_ID = 'whatsapp-sales-agent';

console.log('🚀 Iniciando servidor WPPConnect + IA...');

// Inicializar Firebase Admin
let serviceAccount;

// Função para inicializar Firebase (chamada apenas quando necessário)
function initializeFirebase() {
  if (serviceAccount) {
    return; // Já inicializado
  }

  // Tentar carregar de arquivo (desenvolvimento local)
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(serviceAccountFile);
      console.log('✅ serviceAccountKey.json carregado do arquivo');
      return;
    } catch (error) {
      console.error('⚠️ Erro ao ler serviceAccountKey.json:', error.message);
      // Continuar para tentar variável de ambiente
    }
  }

  // Se não encontrar arquivo, tentar variável de ambiente (produção)
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      console.log('✅ serviceAccountKey carregado da variável de ambiente');
      return;
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse da variável SERVICE_ACCOUNT_KEY:', parseError.message);
      throw new Error('Erro ao fazer parse da variável SERVICE_ACCOUNT_KEY');
    }
  }

  // Se chegou aqui, não encontrou nenhuma credencial
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
  throw new Error('serviceAccountKey não encontrado');
}

// Inicializar Firebase (chamado apenas quando o servidor iniciar)
try {
  initializeFirebase();
  
  // IMPORTANTE: Forçar uso do banco secundário onde estão os dados do Firestore
  // NÃO usar a variável de ambiente que pode estar apontando para o banco default vazio
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://ia-agente-b2f46.firebaseio.com' // Banco secundário com dados
  });
  console.log('✅ Firebase Admin inicializado');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase:', error.message);
  console.log('⚠️ O servidor não pode iniciar sem as credenciais do Firebase.');
  console.log('   Configure SERVICE_ACCOUNT_KEY no Railway antes de fazer deploy.');
  // Não fazer exit durante o build, apenas logar o erro
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_ACCOUNT_KEY) {
    console.error('❌ Deploy falhou: SERVICE_ACCOUNT_KEY não configurado no Railway');
    process.exit(1);
  }
}

const db = admin.database();
const firestore = admin.firestore();
const app = express();
const ENABLE_ASAAS_LEGACY = process.env.ENABLE_ASAAS_LEGACY === 'true';

// Stripe Webhook (precisa de body raw)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(400).send('STRIPE_WEBHOOK_SECRET não configurado');
    }

    const stripe = new Stripe(process.env.STRIPE_API_KEY || 'dummy', { apiVersion: '2023-10-16' });
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      console.error('❌ Stripe webhook signature inválida:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const orderId = session.metadata?.orderId;
      const isSubscription = session.mode === 'subscription';
      const nowIso = new Date().toISOString();

      if (userId && orderId) {
        const orderRef = db.ref(`orders/${userId}/${orderId}`);
        await orderRef.update({
          status: 'paid',
          paidAt: nowIso,
          paymentProvider: 'stripe'
        });
        const paidOrderSnap = await orderRef.once('value');
        const paidOrderData = paidOrderSnap.val() || {};
        if (!isSubscription) {
          await deliverTvLoginsForPaidOrder(userId, orderId, paidOrderData);
        }
        console.log('✅ Pedido atualizado via Stripe webhook:', { userId, orderId });
      }

      if (isSubscription && userId && session.subscription) {
        const subscriptionsRef = db.ref(`subscriptions/${userId}`);
        const subscriptionsSnapshot = await subscriptionsRef.once('value');
        let subscriptionKey = null;
        let subscriptionData = null;

        if (subscriptionsSnapshot.exists()) {
          subscriptionsSnapshot.forEach((sub) => {
            const subVal = sub.val();
            if (
              subVal.stripeSessionId === session.id ||
              subVal.stripeSubscriptionId === session.subscription
            ) {
              subscriptionKey = sub.key;
              subscriptionData = subVal;
            }
          });
        }

        if (subscriptionKey && subscriptionData) {
          await db.ref(`subscriptions/${userId}/${subscriptionKey}`).update({
            status: 'active',
            stripeSubscriptionId: session.subscription,
            lastPaymentDate: nowIso,
            updatedAt: nowIso
          });

          const now = new Date();
          const isYearly = subscriptionData.cycle === 'YEARLY';
          const nextDueDate = new Date(now);
          nextDueDate.setDate(nextDueDate.getDate() + (isYearly ? 365 : 30));

          await db.ref(`users/data/${userId}/activePlan`).set({
            planId: subscriptionData.planId || session.metadata?.planId || null,
            planName: subscriptionData.planName || session.metadata?.planName || 'Plano',
            status: 'active',
            startDate: nowIso,
            nextDueDate: nextDueDate.toISOString(),
            subscriptionId: session.subscription,
            stripeSubscriptionId: session.subscription,
            paymentProvider: 'stripe',
            limits: subscriptionData.limits || {},
            updatedAt: nowIso
          });
          console.log('✅ Assinatura Stripe ativada via webhook:', { userId, subscriptionKey });
        } else {
          console.log('⚠️ Assinatura Stripe não encontrada para sessão:', session.id);
        }
      }
    } else if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const stripeSubscriptionId = invoice.subscription;
      if (stripeSubscriptionId) {
        const allSubscriptionsSnapshot = await db.ref('subscriptions').once('value');
        let targetUserId = null;
        let targetSubKey = null;
        let targetSubData = null;

        if (allSubscriptionsSnapshot.exists()) {
          allSubscriptionsSnapshot.forEach((userSubs) => {
            userSubs.forEach((sub) => {
              const subVal = sub.val();
              if (subVal?.stripeSubscriptionId === stripeSubscriptionId) {
                targetUserId = userSubs.key;
                targetSubKey = sub.key;
                targetSubData = subVal;
              }
            });
          });
        }

        if (targetUserId && targetSubKey) {
          const paid = event.type === 'invoice.payment_succeeded';
          const nowIso = new Date().toISOString();
          const periodEndUnix = invoice.lines?.data?.[0]?.period?.end || null;
          const nextDueDate = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

          await db.ref(`subscriptions/${targetUserId}/${targetSubKey}`).update({
            status: paid ? 'active' : 'past_due',
            lastPayment: invoice.payment_intent || invoice.id,
            ...(paid ? { lastPaymentDate: nowIso } : {}),
            ...(nextDueDate ? { nextDueDate } : {}),
            updatedAt: nowIso
          });

          if (paid) {
            const activePlanRef = db.ref(`users/data/${targetUserId}/activePlan`);
            const activePlanSnapshot = await activePlanRef.once('value');
            const existingPlan = activePlanSnapshot.val() || {};
            await activePlanRef.update({
              status: 'active',
              paymentProvider: 'stripe',
              subscriptionId: stripeSubscriptionId,
              stripeSubscriptionId: stripeSubscriptionId,
              planId: existingPlan.planId || targetSubData?.planId || null,
              planName: existingPlan.planName || targetSubData?.planName || 'Plano',
              ...(nextDueDate ? { nextDueDate } : {}),
              updatedAt: nowIso
            });

            await handleTvSubscriptionStripeInvoice({
              buyerUserId: targetUserId,
              subscriptionKey: targetSubKey,
              subData: targetSubData,
              invoice
            });
          }

          console.log(`✅ Webhook Stripe ${event.type} processado:`, {
            userId: targetUserId,
            subscriptionKey: targetSubKey
          });
        } else {
          console.log('⚠️ Assinatura Stripe não encontrada para invoice:', stripeSubscriptionId);
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const stripeSubscriptionId = subscription.id;
      const allSubscriptionsSnapshot = await db.ref('subscriptions').once('value');
      let targetUserId = null;
      let targetSubKey = null;

      if (allSubscriptionsSnapshot.exists()) {
        allSubscriptionsSnapshot.forEach((userSubs) => {
          userSubs.forEach((sub) => {
            const subVal = sub.val();
            if (subVal?.stripeSubscriptionId === stripeSubscriptionId) {
              targetUserId = userSubs.key;
              targetSubKey = sub.key;
            }
          });
        });
      }

      if (targetUserId && targetSubKey) {
        const nowIso = new Date().toISOString();
        await db.ref(`subscriptions/${targetUserId}/${targetSubKey}`).update({
          status: 'cancelled',
          updatedAt: nowIso
        });

        const activePlanRef = db.ref(`users/data/${targetUserId}/activePlan`);
        const activePlanSnapshot = await activePlanRef.once('value');
        const activePlan = activePlanSnapshot.val();
        if (activePlan && (activePlan.stripeSubscriptionId === stripeSubscriptionId || activePlan.subscriptionId === stripeSubscriptionId)) {
          await activePlanRef.update({
            status: 'cancelled',
            updatedAt: nowIso
          });
        }
        console.log('✅ Cancelamento de assinatura Stripe processado:', { targetUserId, targetSubKey });
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const orderId = session.metadata?.orderId;
      if (userId && orderId) {
        await releaseTvReservationsForOrder(userId, orderId);
        await db.ref(`orders/${userId}/${orderId}`).update({
          status: 'checkout_expired',
          updatedAt: new Date().toISOString()
        });
        console.log('✅ Checkout expirado — reservas TV liberadas:', { userId, orderId });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('❌ Erro no webhook Stripe:', error);
    return res.status(500).send('Erro interno');
  }
});

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://ia-agente.vercel.app',
    'https://ia-agente.vercel.app/',
    'https://www.dadosia.com.br',
    'https://www.dadosia.com.br/',
    'https://dadosia.com.br',
    'https://dadosia.com.br/',
    /\.vercel\.app$/  // Permite todos os subdomínios da Vercel
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Armazenar clientes WPPConnect ativos
const activeClients = new Map();
/** Evita dois wppconnect.create em paralelo para o mesmo user (mesmo userDataDir → "browser already running") */
const wppSessionCreationInFlight = new Map();
const wppHealthCheckIntervals = new Map();
/** Chave sanitizada do wid da linha WhatsApp atual (histórico separado por número conectado) */
const wppConnectedLineByUser = new Map();
/** WID serializado da última linha amarrada (detecta troca de número sem desligar pela app) */
const wppBoundWidByUser = new Map();

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/** Pasta base dos tokens WPPConnect (volume persistente no Railway: ex. /data/wpp-tokens) */
function getWppTokensBase() {
  const raw = (process.env.WPP_TOKENS_BASE || process.env.WPP_FOLDER_TOKEN || '/tokens').trim();
  return path.resolve(raw);
}

function getWppChromeProfileDir(userId) {
  return path.join(getWppTokensBase(), `chrome_profile_${userId}`);
}

function cleanChromiumSingletonArtifacts(profileDir) {
  if (!profileDir || !fs.existsSync(profileDir)) return;
  const names = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
  for (const name of names) {
    const p = path.join(profileDir, name);
    try {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: false, force: true });
        console.log(`🧹 [WPP] Removido artefato Chromium: ${name}`);
      }
    } catch (e) {
      console.warn(`⚠️ [WPP] Não foi possível remover ${name}:`, e.message);
    }
  }
}

function clearWppHealthCheck(userId) {
  const id = wppHealthCheckIntervals.get(userId);
  if (id) {
    clearInterval(id);
    wppHealthCheckIntervals.delete(userId);
  }
}

async function forceCloseWhatsAppSession(userId) {
  clearWppHealthCheck(userId);
  wppConnectedLineByUser.delete(userId);
  wppBoundWidByUser.delete(userId);
  const client = activeClients.get(userId);
  if (client) {
    try {
      await client.close();
    } catch (e) {
      console.warn('⚠️ [WPP] Erro ao fechar cliente:', e.message);
    }
    activeClients.delete(userId);
  }
  cleanChromiumSingletonArtifacts(getWppChromeProfileDir(userId));
}

/**
 * Identifica o número/WID da linha conectada e grava em Firebase + cache.
 * Mensagens passam a ir para conversations/.../lines/{lineKey}/...
 */
async function bindWhatsAppLineKey(userId) {
  if (!userId) return null;
  const client = activeClients.get(userId);
  if (!client) return null;
  try {
    let serialized = null;
    if (typeof client.getWid === 'function') {
      const wid = await client.getWid();
      if (typeof wid === 'string') serialized = wid;
      else if (wid && wid._serialized) serialized = wid._serialized;
      else if (wid && wid.user && wid.server) serialized = `${wid.user}@${wid.server}`;
    }
    if (!serialized && typeof client.getHostDevice === 'function') {
      const h = await client.getHostDevice();
      const w = h && h.wid;
      if (typeof w === 'string') serialized = w;
      else if (w && w._serialized) serialized = w._serialized;
      else if (w && w.user && w.server) serialized = `${w.user}@${w.server}`;
    }
    if (!serialized) {
      console.warn('⚠️ [WPP] Não foi possível obter WID da linha para userId:', userId);
      return null;
    }
    const lineKey = sanitizePhoneNumber(serialized);
    const prevWid = wppBoundWidByUser.get(userId);
    const prevLine = wppConnectedLineByUser.get(userId);
    if (prevWid === serialized && prevLine === lineKey) {
      return lineKey;
    }
    if (prevWid != null && prevWid !== serialized) {
      console.log('📌 [WPP] Linha WhatsApp alterada (troca de número/conta):', prevWid, '→', serialized);
    }
    wppBoundWidByUser.set(userId, serialized);
    wppConnectedLineByUser.set(userId, lineKey);
    await db.ref(`whatsapp_sessions/${userId}`).update({
      connectedWid: serialized,
      connectedLineKey: lineKey,
      lineBoundAt: new Date().toISOString()
    });
    console.log('📌 [WPP] Histórico amarrado à linha:', serialized, '→', lineKey);
    return lineKey;
  } catch (e) {
    console.warn('⚠️ bindWhatsAppLineKey:', e.message);
    return null;
  }
}

/** Ref às mensagens do contacto, por linha WhatsApp conectada (evita misturar números antigos). */
function conversationMessagesRef(userId, contactSanitized) {
  const lineKey = wppConnectedLineByUser.get(userId);
  if (lineKey) {
    return db.ref(`conversations/${userId}/lines/${lineKey}/${contactSanitized}/messages`);
  }
  return db.ref(`conversations/${userId}/${contactSanitized}/messages`);
}

async function resolveConversationLineKey(userId) {
  let lk = wppConnectedLineByUser.get(userId);
  if (lk) return lk;
  const snap = await db.ref(`whatsapp_sessions/${userId}`).once('value');
  const session = snap.val() || {};
  lk = session.connectedLineKey || null;
  if (lk) wppConnectedLineByUser.set(userId, lk);
  if (typeof session.connectedWid === 'string' && session.connectedWid) {
    wppBoundWidByUser.set(userId, session.connectedWid);
  }
  return lk;
}

/** Mapa contactKey → { messages } para a linha atual (ou legado sem lines/). */
async function loadConversationThreadsMap(userId) {
  const lineKey = await resolveConversationLineKey(userId);
  if (lineKey) {
    const snap = await db.ref(`conversations/${userId}/lines/${lineKey}`).once('value');
    return { lineKey, threads: snap.val() || {} };
  }
  // Já existe pasta lines/ — não ler raiz legada (evita misturar outras linhas / lixo antigo)
  const linesRootSnap = await db.ref(`conversations/${userId}/lines`).once('value');
  if (linesRootSnap.exists()) {
    return { lineKey: null, threads: {} };
  }
  const snap = await db.ref(`conversations/${userId}`).once('value');
  const raw = snap.val() || {};
  const threads = {};
  Object.keys(raw).forEach((k) => {
    if (k === 'lines') return;
    threads[k] = raw[k];
  });
  return { lineKey: null, threads };
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPuppeteerUserDataDirConflict(err) {
  const m = String(err?.message || err || '');
  return (
    m.includes('already running') ||
    m.includes('userDataDir') ||
    m.includes('Browser is already')
  );
}

/** Lock do perfil noutro processo/host — limpar locks locais não resolve (ex.: 2 réplicas Railway no mesmo volume). */
function isChromiumProfileRemoteLock(err) {
  const m = String(err?.message || err || '');
  return (
    m.includes('profile appears to be in use') ||
    m.includes('Code: 21') ||
    m.includes("doesn't get corrupted")
  );
}

function formatWhatsAppLaunchError(err) {
  const raw = err?.message || String(err || '');
  if (isChromiumProfileRemoteLock(err)) {
    return (
      'Perfil do Chrome bloqueado: outro processo usa o mesmo diretório (muito comum com 2+ réplicas no Railway a partilhar o volume). ' +
      'Solução: no painel do hosting, defina exatamente 1 réplica para o serviço que corre o WhatsApp, ou não monte o mesmo volume em várias instâncias. '
      + `Detalhe técnico: ${raw.slice(0, 400)}`
    );
  }
  return raw.slice(0, 800);
}

function ensureDirSync(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('⚠️ ensureDirSync:', dir, e.message);
  }
}

/**
 * Cria ou restaura sessão WPPConnect. Chamadas concorrentes para o mesmo userId serializam-se
 * (evita erro "The browser is already running for ... userDataDir").
 */
async function createSession(userId) {
  if (!userId) throw new Error('userId obrigatório');
  if (wppSessionCreationInFlight.has(userId)) {
    console.log(`⏳ [WPP] Sessão ${userId}: criação já em andamento — aguardando a mesma Promise`);
    return wppSessionCreationInFlight.get(userId);
  }
  const task = createSessionInternal(userId).finally(() => {
    wppSessionCreationInFlight.delete(userId);
  });
  wppSessionCreationInFlight.set(userId, task);
  return task;
}

async function createSessionInternal(userId) {
  console.log(`📱 Verificando sessão WhatsApp para usuário: ${userId}`);
  
  const sessionRef = db.ref(`whatsapp_sessions/${userId}`);
  const tokensBase = getWppTokensBase();
  ensureDirSync(tokensBase);

  try {
    // 🔥 NOVO: Verificar se já existe client ATIVO em memória
    const existingClient = activeClients.get(userId);
    if (existingClient) {
      console.log('✅ Sessão JÁ EXISTE e está ativa em memória');
      console.log('🔄 Reutilizando sessão existente (SEM criar nova)');
      
      // Apenas atualizar status no Firebase
      await sessionRef.update({
        status: 'connected',
        lastActivity: new Date().toISOString()
      });
      
      return existingClient; // ✅ RETORNA A SESSÃO EXISTENTE
    }
    
    console.log(`📂 WPP tokens base: ${tokensBase}`);
    const tokenDir = path.join(tokensBase, `user_${userId}`);
    
    if (fs.existsSync(tokenDir)) {
      const files = fs.readdirSync(tokenDir);
      if (files.length > 0) {
        console.log(`✅ Sessão encontrada nos arquivos (${files.length} arquivos)`);
        console.log('🔄 WPPConnect vai reutilizar automaticamente');
      }
    } else {
      console.log('🆕 Primeira conexão - criando nova sessão');
    }
    
    const profileDir = getWppChromeProfileDir(userId);
    ensureDirSync(profileDir);
    clearWppHealthCheck(userId);
    cleanChromiumSingletonArtifacts(profileDir);
    
    // 🔥 Configuração do cliente WPPConnect
    // O WPPConnect gerencia automaticamente a persistência via tokenStore: 'file'
    const clientOptions = {
      session: `user_${userId}`,
      // 🔥 NOVO: Habilitar persistência de sessão
      tokenStore: 'file',
      folderNameToken: tokensBase,
      // 🔥 CRÍTICO: Flags adicionais para evitar conflitos de perfil
      disableWelcome: true,
      updatesLog: false,
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
      statusFind: async (statusSession, session) => {
        console.log('📊 Status da sessão:', statusSession, 'para:', userId);
        
        if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess') {
          // Atualizar status inicial
          await sessionRef.update({
            status: 'connected',
            connectedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            qrCode: null
          });
          
          console.log('✅ WhatsApp conectado para:', userId);
          setTimeout(() => bindWhatsAppLineKey(userId).catch((e) => console.warn('bindWhatsAppLineKey:', e.message)), 2500);
          
          // 🔥 Salvar token após o client estar pronto (com delay)
          setTimeout(async () => {
            try {
              const activeClient = activeClients.get(userId);
              if (activeClient) {
                const sessionTokenRaw = await activeClient.getSessionTokenBrowser();
                
                // 🔥 CRÍTICO: Converter token para string se for object
                let sessionToken;
                if (typeof sessionTokenRaw === 'object' && sessionTokenRaw !== null) {
                  sessionToken = JSON.stringify(sessionTokenRaw);
                  console.log('💾 Token convertido de object para string (JSON)');
                } else if (typeof sessionTokenRaw === 'string') {
                  sessionToken = sessionTokenRaw;
                } else {
                  console.error('⚠️ Token em formato inválido:', typeof sessionTokenRaw);
                  return;
                }
                
                console.log('💾 Salvando token de sessão no Firebase...');
                console.log(`   Tipo: ${typeof sessionToken}`);
                console.log(`   Tamanho: ${sessionToken.length} caracteres`);
                
                await sessionRef.update({
                  sessionToken: sessionToken,
                  sessionSaved: true,
                  tokenSavedAt: new Date().toISOString()
                });
                
                console.log('✅ Token de sessão PERSISTIDO no Firebase como STRING!');
              }
            } catch (tokenError) {
              console.error('⚠️ Erro ao salvar token:', tokenError.message);
            }
          }, 2000); // Aguardar 2 segundos para o client estar pronto
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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || undefined,
        userDataDir: profileDir,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-dev-profile',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-web-security',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
          // 🔥 Flags adicionais para reduzir dependências de bibliotecas do sistema
          '--single-process', // Executa em processo único, reduz dependências de IPC
          '--disable-gpu-sandbox', // Desabilita sandbox do GPU
          '--disable-breakpad', // Desabilita sistema de crash reporting
          '--disable-crash-reporter', // Desabilita reporte de crashes
          '--disable-crashpad', // Desabilita sistema Crashpad
          '--disable-background-timer-throttling', // Reduz uso de recursos de background
          '--disable-backgrounding-occluded-windows', // Desabilita otimizações de janelas
          '--disable-renderer-backgrounding', // Desabilita backgrounding do renderer
          '--disable-features=TranslateUI', // Desabilita UI de tradução
          '--disable-ipc-flooding-protection' // Desabilita proteção contra flooding de IPC
        ]
      }
    };
    
    // 🔥 Criar/Restaurar client WPPConnect (retry se perfil Chromium preso)
    console.log('🚀 Iniciando WPPConnect...');
    let client;
    let lastCreateErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        console.warn(`🔄 [WPP] Nova tentativa de launch (${attempt + 1}/2) após conflito de userDataDir`);
      }
      try {
        client = await wppconnect.create(clientOptions);
        lastCreateErr = null;
        break;
      } catch (e) {
        lastCreateErr = e;
        if (isChromiumProfileRemoteLock(e)) {
          console.error('❌ [WPP] Perfil Chromium bloqueado (outro processo/host). Não adianta retry local.');
          throw e;
        }
        if (attempt === 0 && isPuppeteerUserDataDirConflict(e)) {
          console.warn('⚠️ [WPP] Conflito de browser/perfil — fechando, limpando locks e aguardando...');
          await forceCloseWhatsAppSession(userId);
          cleanChromiumSingletonArtifacts(profileDir);
          await sleepMs(2500);
          continue;
        }
        throw e;
      }
    }
    if (!client) throw lastCreateErr || new Error('Falha ao iniciar WPPConnect');

    // Configurar listeners de mensagens
    client.onMessage(async (message) => {
      await handleIncomingMessage(userId, message, client);
    });

    // 🔥 NOVO: Monitorar desconexão e reconectar automaticamente
    client.onStateChange((state) => {
      console.log('🔄 Estado do WhatsApp mudou:', state, 'para:', userId);
      
      if (state === 'CONFLICT' || state === 'UNPAIRED' || state === 'UNLAUNCHED') {
        console.log('⚠️ WhatsApp desconectado! Tentando reconectar em 10 segundos...');
        
        sessionRef.update({
          status: 'disconnected',
          lastActivity: new Date().toISOString(),
          disconnectReason: state
        });
        
        setTimeout(async () => {
          try {
            console.log('🔄 Tentando reconectar WhatsApp para:', userId);
            await forceCloseWhatsAppSession(userId);
            await sleepMs(2000);
            await createSession(userId);
          } catch (error) {
            console.error('❌ Erro ao reconectar:', error.message);
          }
        }, 10000);
      }
    });

    // Salvar cliente ativo
    activeClients.set(userId, client);
    
    console.log('✅ Sessão criada com sucesso para:', userId);
    setTimeout(() => bindWhatsAppLineKey(userId).catch((e) => console.warn('bindWhatsAppLineKey (post-create):', e.message)), 4000);
    
    clearWppHealthCheck(userId);
    const healthCheckInterval = setInterval(async () => {
      try {
        const c = activeClients.get(userId);
        if (!c) {
          clearWppHealthCheck(userId);
          return;
        }
        const isConnected = await c.isConnected();
        
        if (isConnected) {
          await sessionRef.update({
            lastActivity: new Date().toISOString()
          });
        } else {
          console.log('⚠️ [Healthcheck] WhatsApp desconectado para:', userId);
          clearWppHealthCheck(userId);
          await forceCloseWhatsAppSession(userId);
          await sleepMs(2000);
          try {
            await createSession(userId);
          } catch (error) {
            console.error('❌ Erro ao reconectar:', error.message);
          }
        }
      } catch (error) {
        const errStr = String(error.message || error);
        console.error('❌ [Healthcheck] Erro:', errStr);
        if (
          errStr.includes('detached') ||
          errStr.includes('Target closed') ||
          errStr.includes('Protocol error') ||
          errStr.includes('Execution context')
        ) {
          clearWppHealthCheck(userId);
          await forceCloseWhatsAppSession(userId);
          try {
            await sessionRef.update({
              status: 'disconnected',
              lastActivity: new Date().toISOString(),
              disconnectReason: 'browser_stale'
            });
          } catch (_) { /* ignore */ }
        }
      }
    }, 30000);
    wppHealthCheckIntervals.set(userId, healthCheckInterval);
    
    return client;
    
  } catch (error) {
    console.error('❌ Erro ao criar sessão:', error);
    const errorText = formatWhatsAppLaunchError(error);
    sessionRef.update({
      status: 'error',
      error: errorText,
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

/** JID do chat (ex.: 5511...@c.us) a partir do objeto id do WPPConnect */
function widSerializedFromChat(chat) {
  const id = chat?.id;
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (id._serialized) return id._serialized;
  if (id.user && id.server) return `${id.user}@${id.server}`;
  return '';
}

function previewFromWaLastMessage(lm) {
  if (!lm) return { body: '', ts: null };
  const body =
    lm.body ||
    lm.caption ||
    (lm.type && lm.type !== 'chat' ? `[${lm.type}]` : '') ||
    '';
  let ts = null;
  if (lm.timestamp) ts = new Date(lm.timestamp).toISOString();
  else if (typeof lm.t === 'number') ts = new Date(lm.t * 1000).toISOString();
  return { body: String(body).slice(0, 500), ts };
}

// ============================================
// FUNÇÕES DE ÁUDIO
// ============================================

// Função para buscar API Key do master para áudio
async function getMasterApiKeyForAudio() {
  try {
    let masterUserId = null;
    
    // Estratégia 1: Buscar master em users/registered
    const usersSnapshot = await db.ref('users/registered').once('value');
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const masterUser = Object.values(users).find(u => 
        u.email === 'brayan.italy@gmail.com' || u.isMaster === true
      );
      
      if (masterUser && masterUser.uid) {
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
        for (const [uid, userData] of Object.entries(allUsersData)) {
          if (userData.assistant_settings && userData.assistant_settings.apiKey) {
            // Verificar se é master
            const userRegisteredSnapshot = await db.ref(`users/registered/${uid}`).once('value');
            if (userRegisteredSnapshot.exists()) {
              const userRegistered = userRegisteredSnapshot.val();
              if (userRegistered.isMaster || userRegistered.email === 'brayan.italy@gmail.com') {
                masterUserId = uid;
                console.log('✅ Master encontrado em users/data, UID:', masterUserId);
                break;
              }
            }
          }
        }
      }
    }
    
    // Estratégia 3: Se ainda não encontrou, buscar qualquer usuário com API Key (fallback)
    if (!masterUserId) {
      console.log('🔍 Master não encontrado, buscando qualquer API Key disponível...');
      
      const allDataSnapshot = await db.ref('users/data').once('value');
      if (allDataSnapshot.exists()) {
        const allUsersData = allDataSnapshot.val();
        for (const [uid, userData] of Object.entries(allUsersData)) {
          if (userData.assistant_settings && userData.assistant_settings.apiKey) {
            masterUserId = uid;
            console.log('✅ Usando API Key encontrada no UID:', uid, '(fallback)');
            break;
          }
        }
      }
    }
    
    // Buscar configuração do master encontrado
    if (masterUserId) {
      const masterConfigSnapshot = await db.ref(`users/data/${masterUserId}/assistant_settings`).once('value');
      const masterConfig = masterConfigSnapshot.val();
      
      if (masterConfig && masterConfig.apiKey) {
        console.log('✅ API Key do master encontrada para áudio (primeiros 10 caracteres):', masterConfig.apiKey.substring(0, 10) + '...');
        return masterConfig.apiKey;
      } else {
        console.log('⚠️ Master encontrado mas sem API Key configurada');
      }
    }
    
    console.log('⚠️ API Key do master não encontrada para áudio');
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar API Key do master:', error.message);
    return null;
  }
}

// Função para transcrever áudio usando OpenAI Whisper (sempre usa API Key do master)
async function transcribeAudio(audioBuffer) {
  try {
    // Sempre buscar API Key do master
    const apiKey = await getMasterApiKeyForAudio();
    
    if (!apiKey) {
      console.log('⚠️ API Key do master não encontrada para transcrição');
      return null;
    }

    // Criar arquivo temporário
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `audio_${Date.now()}.ogg`);
    fs.writeFileSync(tempFile, audioBuffer);

    // Fazer upload e transcrever usando OpenAI Whisper
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFile));
    formData.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      }
    });

    // Limpar arquivo temporário
    fs.unlinkSync(tempFile);

    if (response.data && response.data.text) {
      console.log('✅ Áudio transcrito:', response.data.text);
      return response.data.text;
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error.message);
    return null;
  }
}

// Função para mapear voz selecionada para voz da OpenAI
function mapVoiceToOpenAI(voice, language) {
  // OpenAI TTS suporta apenas estas 6 vozes: alloy, echo, fable, onyx, nova, shimmer
  // As vozes são universais e funcionam com qualquer idioma
  
  if (!voice || voice === '') {
    // Voz padrão: nova (feminina natural)
    return 'nova';
  }
  
  // Se a voz já é uma das vozes da OpenAI, usar diretamente
  const openAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  if (openAIVoices.includes(voice.toLowerCase())) {
    return voice.toLowerCase();
  }
  
  // Compatibilidade com vozes antigas (Google TTS) - mapear para OpenAI
  if (voice.includes('Standard-A') || voice.includes('Wavenet-A') || voice.includes('Wavenet-C')) {
    // Voz feminina antiga -> mapear para nova ou shimmer
    if (voice.includes('Wavenet-C') || voice.includes('Jovem')) {
      return 'shimmer';
    }
    return 'nova';
  } else if (voice.includes('Standard-B') || voice.includes('Wavenet-B') || voice.includes('Wavenet-D')) {
    // Voz masculina antiga -> mapear para onyx ou echo
    if (voice.includes('Wavenet-D') || voice.includes('Jovem')) {
      return 'echo';
    }
    return 'onyx';
  }
  
  // Fallback: usar nova (feminina natural)
  return 'nova';
}

// Função para gerar áudio a partir de texto (TTS) usando OpenAI TTS API
async function generateAudioFromText(text, language = 'pt-BR', voice = null) {
  try {
    // Buscar API Key do master para TTS
    const apiKey = await getMasterApiKeyForAudio();
    
    if (!apiKey) {
      console.log('⚠️ API Key do master não encontrada para TTS');
      return null;
    }
    
    // Mapear voz para voz da OpenAI
    const openAIVoice = mapVoiceToOpenAI(voice, language);
    
    // OpenAI TTS suporta: alloy, echo, fable, onyx, nova, shimmer
    // Modelo: tts-1 (rápido) ou tts-1-hd (alta qualidade)
    const model = 'tts-1-hd'; // Usar HD para melhor qualidade
    
    console.log(`🎤 Gerando áudio com OpenAI TTS (voz: ${openAIVoice}, idioma: ${language})`);
    
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: model,
        input: text,
        voice: openAIVoice,
        response_format: 'mp3' // Formato mp3 para compatibilidade com WhatsApp
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    if (response.data) {
      console.log(`✅ Áudio gerado com sucesso (voz OpenAI: ${openAIVoice}, idioma: ${language})`);
      return Buffer.from(response.data);
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao gerar áudio:', error.message);
    if (error.response) {
      console.error('❌ Detalhes do erro:', error.response.data);
    }
    return null;
  }
}

// Handler de mensagens recebidas
async function handleIncomingMessage(userId, message, client) {
  try {
    console.log(`📨 Mensagem recebida de ${message.from}:`, message.body || `[${message.type}]`);
    
    // Ignorar mensagens de status e grupos
    if (message.isGroupMsg || message.from === 'status@broadcast') {
      return;
    }
    
    // Sanitizar número do WhatsApp para usar como chave no Firebase
    const sanitizedNumber = sanitizePhoneNumber(message.from);
    
    // ============================================
    // PROCESSAR MENSAGENS DE ÁUDIO
    // ============================================
    let messageText = message.body || '';
    let isAudioMessage = false;
    let audioBase64 = null; // Armazenar áudio em Base64 para salvar no Firebase
    
    if (message.type === 'ptt' || message.type === 'audio') {
      console.log('🎤 Mensagem de áudio detectada!');
      isAudioMessage = true;
      
      try {
        // Baixar áudio
        const audioBuffer = await client.decryptFile(message);
        
        if (audioBuffer) {
          // Salvar áudio em Base64 para poder reproduzir depois
          audioBase64 = audioBuffer.toString('base64');
          
          // Transcrever áudio (sempre usa API Key do master)
          messageText = await transcribeAudio(audioBuffer);
          if (messageText && messageText.trim() !== '') {
            console.log('✅ Áudio transcrito com sucesso:', messageText);
          } else {
            console.log('⚠️ Não foi possível transcrever o áudio ou transcrição vazia');
            messageText = null; // Não processar se não conseguir transcrever
          }
        } else {
          console.log('⚠️ Buffer de áudio vazio');
          messageText = null;
        }
      } catch (error) {
        console.error('❌ Erro ao processar áudio:', error.message);
        messageText = null; // Não processar se houver erro
      }
    }
    
    // Se messageText estiver vazio ou for uma mensagem de erro, não processar
    if (!messageText || messageText.trim() === '') {
      if (isAudioMessage) {
        console.log('⚠️ Mensagem de áudio não pôde ser transcrita, não processando');
        await client.sendText(message.from, 'Desculpe, não consegui entender o áudio. Pode repetir ou enviar por texto?');
      } else {
        console.log('⚠️ Mensagem de texto vazia, não processando');
      }
      return;
    }

    await bindWhatsAppLineKey(userId);

    // Salvar mensagem no Realtime Database
    const messageRef = conversationMessagesRef(userId, sanitizedNumber).push();
    await messageRef.set({
      from: message.from || '',
      to: message.to || '',
      body: messageText,
      timestamp: new Date().toISOString(),
      type: message.type || 'chat',
      isFromMe: message.isFromMe || false,
      messageId: message.id || '',
      isAudio: isAudioMessage,
      audioBase64: audioBase64 || null
    });
    
    console.log('💾 Mensagem salva no banco de dados');
    
    // ============================================
    // DETECÇÃO E SALVAMENTO AUTOMÁTICO DE DADOS DO CLIENTE
    // ============================================
    if (!message.isFromMe && messageText) {
      // Obter nome do perfil do WhatsApp (pushName ou notifyName)
      let whatsappProfileName = null;
      try {
        whatsappProfileName = message.pushName || message.notifyName || null;
        if (!whatsappProfileName) {
          // Tentar obter do contato
          const contact = await client.getContactById(message.from);
          whatsappProfileName = contact?.pushname || contact?.name || null;
        }
        if (whatsappProfileName) {
          console.log('👤 Nome do perfil WhatsApp:', whatsappProfileName);
        }
      } catch (error) {
        console.log('⚠️ Não foi possível obter nome do perfil WhatsApp:', error.message);
      }
      
      await detectAndSaveCustomerData(userId, message.from, messageText, sanitizedNumber, whatsappProfileName);
    }
    
    // Se não for mensagem enviada pelo usuário, processar com IA
    if (!message.isFromMe && messageText) {
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
            u.email === 'brayan.italy@gmail.com' || u.isMaster === true
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
        
        // Verificar limites do plano
        const limitCheck = await checkPlanLimits(userId, 'messagesPerMonth');
        
        if (!limitCheck.allowed) {
          console.log('⚠️ [PLANO] Mensagem bloqueada por limite do plano');
          await client.sendText(message.from, limitCheck.message);
          return;
        }
        
        // Gerar resposta com IA usando o texto transcrito (ou texto original)
        console.log(`💬 Processando mensagem para IA: "${messageText}" (${isAudioMessage ? 'transcrita de áudio' : 'texto'})`);
        const aiResult = await generateAIResponse(userId, sanitizedNumber, messageText, aiConfig);
        let aiResponse = aiResult.text;
        
        if (!aiResponse || aiResponse.trim() === '') {
          console.log('⚠️ Resposta da IA vazia, não enviando');
          return;
        }
        
        // Substituir variáveis na resposta da IA antes de enviar
        aiResponse = await replaceTemplateVariables(aiResponse, userId, sanitizedNumber);
        
        // Variável para armazenar o áudio da resposta (se houver)
        let responseAudioBase64 = null;
        
        // Se a mensagem original foi áudio, tentar responder também em áudio
        if (isAudioMessage) {
          try {
            console.log('🎤 Gerando resposta em áudio...');
            
            // Buscar configurações de áudio do usuário
            const audioLanguage = aiConfig.audioLanguage || 'pt-BR';
            const audioVoice = aiConfig.audioVoice || null;
            
            const audioBuffer = await generateAudioFromText(aiResponse, audioLanguage, audioVoice);
            
            if (audioBuffer) {
              // Salvar áudio em Base64 para salvar no Firebase
              responseAudioBase64 = audioBuffer.toString('base64');
              
              // Salvar áudio temporariamente
              const tempDir = os.tmpdir();
              const tempAudioFile = path.join(tempDir, `response_${Date.now()}.mp3`);
              fs.writeFileSync(tempAudioFile, audioBuffer);
              
              // Enviar áudio como PTT (push-to-talk) - formato de áudio do WhatsApp
              // WPPConnect pode ter sendPtt, mas se não tiver, usar sendFile com base64
              try {
                // Tentar usar sendPtt se disponível
                if (client.sendPtt) {
                  const audioBase64 = audioBuffer.toString('base64');
                  await client.sendPtt(message.from, audioBase64);
                  console.log(`✅ Resposta em áudio PTT enviada (idioma: ${audioLanguage}${audioVoice ? `, voz: ${audioVoice}` : ''})`);
                } else {
                  // Fallback: usar sendFile
                  await client.sendFile(message.from, tempAudioFile, 'audio.mp3', aiResponse);
                  console.log(`✅ Resposta em áudio enviada via sendFile (idioma: ${audioLanguage}${audioVoice ? `, voz: ${audioVoice}` : ''})`);
                }
              } catch (sendError) {
                console.error('❌ Erro ao enviar áudio:', sendError.message);
                // Tentar fallback com sendFile
                await client.sendFile(message.from, tempAudioFile, 'audio.mp3', aiResponse);
              }
              
              // Limpar arquivo temporário
              fs.unlinkSync(tempAudioFile);
            } else {
              // Se falhar, enviar como texto
              await client.sendText(message.from, aiResponse);
              console.log('✅ Resposta enviada como texto (fallback)');
            }
          } catch (audioError) {
            console.error('❌ Erro ao enviar áudio, enviando como texto:', audioError.message);
            await client.sendText(message.from, aiResponse);
          }
        } else {
          // Enviar resposta de texto normalmente
          await client.sendText(message.from, aiResponse);
          console.log('✅ Resposta enviada:', aiResponse);
        }
        
        // Incrementar contador de uso
        await incrementMessageUsage(userId);
        
        // Salvar resposta da IA
        const responseRef = conversationMessagesRef(userId, sanitizedNumber).push();
        await responseRef.set({
          from: message.to || '',
          to: message.from || '',
          body: aiResponse || '',
          timestamp: new Date().toISOString(),
          type: isAudioMessage ? 'ptt' : 'chat',
          isFromMe: true,
          aiGenerated: true,
          isAudio: isAudioMessage,
          audioBase64: responseAudioBase64 || null
        });
        
        // ============================================
        // DETECTAR SE O AGENTE FEZ UMA PERGUNTA (nome, cpf, email)
        // ============================================
        await detectAgentQuestion(userId, sanitizedNumber, aiResponse);
        
        // ============================================
        // DETECTAR MENSAGEM DE GATILHO PARA GERAR LINK
        // ============================================
        const paymentProvider = (aiConfig?.paymentProvider || 'stripe').toLowerCase();
        const triggerMessage = 'Perfeito! Vou enviar abaixo seu Link para que efetue o Pagamento.';
        if (aiResponse.includes(triggerMessage)) {
          if (paymentProvider === 'stripe') {
            console.log('🎯 MENSAGEM DE GATILHO DETECTADA! Gerando link de pagamento (Stripe)...');
            await tryAutoGenerateStripeLink(userId, message.from, sanitizedNumber);
          }
        }
        
        // ============================================
        // DETECTAR E SALVAR AGENDAMENTOS AUTOMATICAMENTE
        // ============================================
        await detectAndSaveAppointment(userId, message.from, aiResponse, sanitizedNumber);
        
        // Detectar produtos mencionados e enviar imagens automaticamente
        const mentionedItems = detectMentionedProducts(aiResponse, aiResult.catalogItemsMap);
        const sendProductImages = aiConfig?.showCatalogImagesWhenOffering !== false;
        
        if (mentionedItems.length > 0) {
          console.log(`📸 Detectados ${mentionedItems.length} produto(s) na resposta`);
          
          // Enviar produtos/serviços mencionados
          for (const item of mentionedItems) {
            try {
              // Criar mensagem com informações do produto
              let messageText = `📦 *${item.name}*\n`;
              
              // Adicionar preço se disponível (moeda do catálogo)
              const priceLine = formatCatalogPriceForMessage(item.price, item.currency);
              if (priceLine) {
                messageText += `💰 ${priceLine}\n\n`;
              } else {
                messageText += `\n`;
              }
              
              // Adicionar descrição se disponível
              if (item.description) {
                messageText += `${item.description}\n\n`;
              }
              
              // Adicionar link se disponível
              if (item.link) {
                if (item.price === null || item.price === undefined) {
                  messageText += `🔗 Acesse o link para ver o preço e mais informações:\n${item.link}`;
                } else {
                  messageText += `🔗 Link para adesão: ${item.link}`;
                }
              }
              
              // Se tiver imagem e envio de fotos ativo, enviar imagem com legenda
              if (item.image && sendProductImages) {
                console.log(`📤 Enviando imagem de: ${item.name}`);
                
                // Verificar se é Base64 ou URL
                const isBase64 = item.image.startsWith('data:image/');
                
                if (isBase64) {
                  console.log(`📸 Imagem em Base64 detectada para: ${item.name}`);
                  // Enviar imagem Base64 diretamente
                  await client.sendImageFromBase64(
                    message.from,
                    item.image,
                    item.name,
                    messageText
                  );
                } else {
                  console.log(`🌐 URL de imagem detectada para: ${item.name}`);
                  // Enviar imagem por URL
                  await client.sendImage(
                    message.from,
                    item.image,
                    item.name,
                    messageText
                  );
                }
                
                console.log(`✅ Imagem enviada: ${item.name}`);
                
                // Salvar envio da imagem no histórico
                const imageRef = conversationMessagesRef(userId, sanitizedNumber).push();
                await imageRef.set({
                  from: message.to || '',
                  to: message.from || '',
                  body: messageText,
                  imageUrl: isBase64 ? null : item.image,
                  imageBase64: isBase64 ? item.image : null,
                  timestamp: new Date().toISOString(),
                  type: 'image',
                  isFromMe: true,
                  aiGenerated: true,
                  productName: item.name
                });
                
                // Aguardar um pouco entre imagens para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else if (item.link) {
                // Se não tiver imagem mas tiver link, enviar apenas mensagem de texto
                console.log(`📤 Enviando informações de: ${item.name} (sem imagem, com link)`);
                
                await client.sendText(message.from, messageText);
                
                console.log(`✅ Informações enviadas: ${item.name}`);
                
                // Salvar envio no histórico
                const textRef = conversationMessagesRef(userId, sanitizedNumber).push();
                await textRef.set({
                  from: message.to || '',
                  to: message.from || '',
                  body: messageText,
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  isFromMe: true,
                  aiGenerated: true,
                  productName: item.name,
                  productLink: item.link
                });
                
                // Aguardar um pouco entre mensagens
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else if (item.image && !sendProductImages) {
                console.log(`📤 Enviando só texto (fotos desativadas no assistente): ${item.name}`);
                await client.sendText(message.from, messageText);
                const textRef = conversationMessagesRef(userId, sanitizedNumber).push();
                await textRef.set({
                  from: message.to || '',
                  to: message.from || '',
                  body: messageText,
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  isFromMe: true,
                  aiGenerated: true,
                  productName: item.name
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (itemError) {
              console.error(`❌ Erro ao processar item ${item.name}:`, itemError.message);
              // Continuar mesmo se houver erro
            }
          }
        }
        
        // Detectar intenção de compra e gerar link de pagamento
        const paymentProviderForIntent = (aiConfig?.paymentProvider || 'stripe').toLowerCase();
        const hasPurchaseIntent = detectPurchaseIntent(message.body);
        
        if (paymentProviderForIntent === 'stripe' && hasPurchaseIntent && mentionedItems.length > 0) {
          await tryAutoGenerateStripeLink(userId, message.from, sanitizedNumber);
        } else if (paymentProviderForIntent === 'manual' && hasPurchaseIntent && mentionedItems.length > 0) {
          const integrations = await getIntegrationsConfig(userId);
          const manualMessage = aiConfig?.paymentManualMessage || 'Pagamento manual selecionado. Aguarde o envio do link.';
          const paymentNotice = manualMessage;
          await client.sendText(message.from, paymentNotice);

          const paymentMsgRef = conversationMessagesRef(userId, sanitizedNumber).push();
          await paymentMsgRef.set({
            from: message.to || '',
            to: message.from || '',
            body: paymentNotice,
            timestamp: new Date().toISOString(),
            type: 'payment_notice',
            isFromMe: true
          });
        }
      } else {
        console.log('⚠️ Configuração de IA não encontrada ou incompleta');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
}

// Função para substituir variáveis de template pelos dados do cliente do CRM
async function replaceTemplateVariables(text, userId, contactNumber) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // Verificar se há variáveis no texto
  if (!text.includes('{{')) {
    return text;
  }
  
  try {
    // Buscar dados do cliente no CRM
    const customerDataRef = db.ref(`customerData/${userId}/${contactNumber}`);
    const customerSnapshot = await customerDataRef.once('value');
    const customerData = customerSnapshot.val() || {};
    
    // Mapeamento de variáveis para dados do cliente
    const variables = {
      // Dados básicos
      '{{nome}}': customerData.name || 'Cliente',
      '{{name}}': customerData.name || 'Cliente',
      '{{email}}': customerData.email || 'email não cadastrado',
      '{{telefone}}': (customerData.phone || customerData.mobilePhone || '').replace('@c.us', '') || 'telefone não cadastrado',
      '{{phone}}': (customerData.phone || customerData.mobilePhone || '').replace('@c.us', '') || 'telefone não cadastrado',
      '{{cpf}}': customerData.cpfCnpj || 'CPF não cadastrado',
      '{{cpfCnpj}}': customerData.cpfCnpj || 'CPF/CNPJ não cadastrado',
      '{{cnpj}}': customerData.cpfCnpj || 'CNPJ não cadastrado',
      
      // Endereço
      '{{endereco}}': customerData.address ? 
        `${customerData.address.street || ''}, ${customerData.address.number || ''}`.trim() || 
        'endereço não cadastrado' : 'endereço não cadastrado',
      '{{address}}': customerData.address ? 
        `${customerData.address.street || ''}, ${customerData.address.number || ''}`.trim() || 
        'endereço não cadastrado' : 'endereço não cadastrado',
      '{{rua}}': customerData.address?.street || 'rua não cadastrada',
      '{{street}}': customerData.address?.street || 'rua não cadastrada',
      '{{numero}}': customerData.address?.number || 'número não cadastrado',
      '{{number}}': customerData.address?.number || 'número não cadastrado',
      '{{complemento}}': customerData.address?.complement || 'sem complemento',
      '{{complement}}': customerData.address?.complement || 'sem complemento',
      '{{bairro}}': customerData.address?.neighborhood || 'bairro não cadastrado',
      '{{neighborhood}}': customerData.address?.neighborhood || 'bairro não cadastrado',
      '{{cidade}}': customerData.address?.city || 'cidade não cadastrada',
      '{{city}}': customerData.address?.city || 'cidade não cadastrada',
      '{{estado}}': customerData.address?.state || 'estado não cadastrado',
      '{{state}}': customerData.address?.state || 'estado não cadastrado',
      '{{cep}}': customerData.address?.cep || 'CEP não cadastrado',
      
      // Dados customizados do CRM (ex: {{campo_customizado}})
    };
    
    // Substituir variáveis básicas
    let replacedText = text;
    for (const [variable, value] of Object.entries(variables)) {
      const regex = new RegExp(variable.replace(/[{}]/g, '\\$&'), 'gi');
      replacedText = replacedText.replace(regex, value);
    }
    
    // Processar dados customizados do CRM (campos que o usuário criou)
    if (customerData.customData && typeof customerData.customData === 'object') {
      for (const [key, value] of Object.entries(customerData.customData)) {
        // Permitir {{campo_customizado}} ou {{campoCustomizado}}
        const variableName = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // Converter camelCase para snake_case
        const regex1 = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        const regex2 = new RegExp(`\\{\\{${variableName}\\}\\}`, 'gi');
        replacedText = replacedText.replace(regex1, String(value || 'não cadastrado'));
        replacedText = replacedText.replace(regex2, String(value || 'não cadastrado'));
      }
    }
    
    console.log('🔄 Variáveis substituídas no texto:', text !== replacedText ? 'Sim' : 'Não');
    if (text !== replacedText) {
      console.log('   Original:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      console.log('   Substituído:', replacedText.substring(0, 100) + (replacedText.length > 100 ? '...' : ''));
    }
    
    return replacedText;
  } catch (error) {
    console.error('❌ Erro ao substituir variáveis de template:', error);
    // Em caso de erro, retornar texto original
    return text;
  }
}

// Gerar resposta com IA
function formatCatalogPriceForMessage(price, currencyCode) {
  if (price === null || price === undefined || price === '') return null;
  const num = Number(price);
  if (!Number.isFinite(num)) return null;
  const code = String(currencyCode || 'BRL').toUpperCase();
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code }).format(num);
  } catch {
    return `${code} ${num.toFixed(2)}`;
  }
}

async function generateAIResponse(userId, contactNumber, userMessage, aiConfig) {
  try {
    // Buscar histórico da conversa (últimas 10 mensagens)
    const messagesSnapshot = await conversationMessagesRef(userId, contactNumber)
      .orderByChild('timestamp')
      .limitToLast(10)
      .once('value');
    
    const messages = [];
    messagesSnapshot.forEach((child) => {
      const msg = child.val();
      
      // Ignorar mensagens sem body ou com body null/undefined
      if (msg.body && typeof msg.body === 'string' && msg.body.trim() !== '') {
        messages.push({
          role: msg.isFromMe ? 'assistant' : 'user',
          content: msg.body
        });
      }
    });
    
    // 📄 A pergunta sobre nota fiscal agora é feita automaticamente após o pagamento
    // Esta verificação não é mais necessária
    
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
    
    const catalogProductCategories = (assistantSettings.catalogProductCategories || []).map((c) => String(c).toLowerCase());
    const catalogServiceCategories = (assistantSettings.catalogServiceCategories || []).map((c) => String(c).toLowerCase());

    if (catalogSnapshot.exists()) {
      catalogSnapshot.forEach((child) => {
        const item = child.val();
        if (item.type === 'product' && assistantSettings.includeCatalogProducts) {
          const categoryMatch = !catalogProductCategories.length ||
            (item.category && catalogProductCategories.includes(String(item.category).toLowerCase()));
          if (!categoryMatch) return;
          const productData = {
            name: item.name,
            description: item.description || '',
            price: item.price !== null && item.price !== undefined && item.price !== '' ? item.price : null,
            currency: String(item.currency || 'BRL').toUpperCase() || 'BRL',
            stock: item.stockQuantity || 0,
            image: item.image || null,
            link: item.link || null,
            category: item.category || '',
            tvLoginProduct: !!item.tvLoginProduct,
            tvPlanKey: item.tvPlanKey || ''
          };
          catalogProducts.push(productData);
          catalogItemsMap[item.name.toLowerCase()] = productData;
        } else if (item.type === 'service' && assistantSettings.includeCatalogServices) {
          const categoryMatch = !catalogServiceCategories.length ||
            (item.category && catalogServiceCategories.includes(String(item.category).toLowerCase()));
          if (!categoryMatch) return;
          const serviceData = {
            name: item.name,
            description: item.description || '',
            price: item.price !== null && item.price !== undefined && item.price !== '' ? item.price : null,
            currency: String(item.currency || 'BRL').toUpperCase() || 'BRL',
            capacity: item.stockQuantity || 0,
            image: item.image || null,
            link: item.link || null,
            category: item.category || ''
          };
          catalogServices.push(serviceData);
          catalogItemsMap[item.name.toLowerCase()] = serviceData;
        }
      });
    }
    
    // Acessos TV realmente disponíveis (exclui vendidos e reservas ainda ativas — NUNCA enviar credenciais ao modelo)
    const tvLoginsSnapshot = await db.ref(`users/data/${userId}/tv_logins`).once('value');
    const tvStockByPlan = {};
    if (tvLoginsSnapshot.exists()) {
      const nowTv = Date.now();
      tvLoginsSnapshot.forEach((child) => {
        const item = child.val() || {};
        if (!tvLoginRowIsAvailable(item, nowTv)) return;
        const pk = normalizePlanKey(item.planKey || item.planName || '');
        if (!pk) return;
        tvStockByPlan[pk] = (tvStockByPlan[pk] || 0) + 1;
      });
    }
    const tvReserveMinAi = getTvReservationMinutes();

    // Construir prompt do sistema com contexto
    let systemPrompt = aiConfig.systemPrompt || 'Você é um assistente virtual prestativo.';
    
    // IMPORTANTE: NÃO substituir variáveis no systemPrompt ainda!
    // As variáveis {{nome}}, {{email}}, etc. devem permanecer no prompt
    // para que a IA as inclua na resposta, e depois substituímos na resposta final
    
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
        systemPrompt += `${index + 1}. ${product.name}`;
        const priceLbl = formatCatalogPriceForMessage(product.price, product.currency);
        if (priceLbl) {
          systemPrompt += ` - ${priceLbl}`;
        } else {
          systemPrompt += ` - Preço disponível no link`;
        }
        if (product.description) {
          systemPrompt += ` - ${product.description}`;
        }
        if (product.tvLoginProduct && product.tvPlanKey) {
          const pk = normalizePlanKey(product.tvPlanKey);
          const tvN = tvStockByPlan[pk] || 0;
          systemPrompt += ` [TV/WPLAY — chave do plano: ${pk}`;
          if (tvN < 1) {
            systemPrompt += ` — SEM ACESSOS DISPONÍVEIS (vendidos/reservados); oriente o cliente a tentar de novo em ~${tvReserveMinAi} min]`;
          } else {
            systemPrompt += ` — ${tvN} acesso(s) livre(s) agora]`;
          }
        } else if (typeof product.stock === 'number' && product.stock < 1) {
          systemPrompt += ` [FORA DE ESTOQUE — não finalize venda nem envie link de pagamento]`;
        }
        if (product.image) systemPrompt += ` [TEM FOTO DISPONÍVEL]`;
        if (product.link) systemPrompt += ` [TEM LINK PARA ADESÃO DISPONÍVEL]`;
        systemPrompt += '\n';
      });
    }
    
    // Incluir serviços no contexto se habilitado
    if (catalogServices.length > 0) {
      systemPrompt += `\n\n🛠️ SERVIÇOS DISPONÍVEIS:\n`;
      catalogServices.forEach((service, index) => {
        systemPrompt += `${index + 1}. ${service.name}`;
        const priceLbl = formatCatalogPriceForMessage(service.price, service.currency);
        if (priceLbl) {
          systemPrompt += ` - ${priceLbl}`;
        } else {
          systemPrompt += ` - Preço disponível no link`;
        }
        if (service.description) {
          systemPrompt += ` - ${service.description}`;
        }
        if (typeof service.capacity === 'number' && service.capacity < 1) {
          systemPrompt += ` [SEM CAPACIDADE/VAGAS — não finalize venda nem envie link de pagamento]`;
        }
        if (service.image) systemPrompt += ` [TEM FOTO DISPONÍVEL]`;
        if (service.link) systemPrompt += ` [TEM LINK PARA ADESÃO DISPONÍVEL]`;
        systemPrompt += '\n';
      });
    }
    
    // Instruções adicionais se houver produtos/serviços
    if (catalogProducts.length > 0 || catalogServices.length > 0) {
      const sendCatalogImages = assistantSettings.showCatalogImagesWhenOffering !== false;
      const imageInstruction = sendCatalogImages
        ? '- Os itens do catálogo têm foto cadastrada: ao mencionar o nome completo do produto/serviço, o sistema pode enviar a imagem automaticamente no WhatsApp'
        : '- O envio automático de fotos no WhatsApp está desativado nas configurações do assistente: descreva bem os itens em texto e não prometa envio automático de imagens';
      systemPrompt += `\n⚠️ INSTRUÇÕES IMPORTANTES:
- Você DEVE mencionar e oferecer esses produtos/serviços quando relevante
- Seja proativo e sugira produtos/serviços que possam ajudar o cliente
- Inclua descrição curta de 1 linha quando listar itens
- Itens marcados como FORA DE ESTOQUE, SEM CAPACIDADE ou SEM ACESSOS TV: informe o cliente com clareza; NÃO prometa venda nem link de pagamento para esse item. Para TV indisponível, explique que pode tentar de novo em cerca de ${tvReserveMinAi} minutos (reservas temporárias expiram).
- Para itens disponíveis, não precisa citar números de estoque na conversa
${imageInstruction}

🎯 **CRÍTICO - CONFIRMAÇÃO DE PRODUTO:**
- Quando o cliente escolher/clicar em um produto, você DEVE SEMPRE confirmar explicitamente o nome COMPLETO do produto na sua resposta
- EXEMPLO CORRETO: "Ótimo! Você escolheu TESTE 9. Quantas unidades deseja?"
- EXEMPLO CORRETO: "Perfeito! Vou adicionar Lavagem Externa ao seu pedido. Quantas unidades?"
- Isso é ESSENCIAL para o sistema processar o pedido corretamente
- SEMPRE repita o nome exato do produto na mensagem

📄 **FLUXO DE NOTA FISCAL - PASSO A PASSO (MUITO IMPORTANTE):**

1. **APÓS O SISTEMA PERGUNTAR SOBRE NOTA FISCAL**, se o cliente responder SIM:
   - Informe: "Perfeito! Para emitir a nota fiscal, vou precisar coletar seu endereço completo."
   
2. **COLETE CADA DADO SEPARADAMENTE** (um por vez):
   
   a) Primeiro, pergunte: "Qual é a rua do seu endereço?"
      - Aguarde resposta → sistema salva automaticamente
   
   b) Depois pergunte: "Qual é o número?"
      - Aguarde resposta → sistema salva automaticamente
   
   c) Depois pergunte: "Qual é o complemento? (ex: apartamento, casa, bloco - se não tiver, digite 'sem')"
      - Aguarde resposta → sistema salva automaticamente
   
   d) Depois pergunte: "Qual é o bairro?"
      - Aguarde resposta → sistema salva automaticamente
   
   e) Depois pergunte: "Qual é a cidade?"
      - Aguarde resposta → sistema salva automaticamente
   
   f) Depois pergunte: "Qual é o estado? (ex: SP, RJ, MG)"
      - Aguarde resposta → sistema salva automaticamente
   
   g) Por último pergunte: "Qual é o CEP?"
      - Aguarde resposta → sistema salva automaticamente
   
3. **QUANDO O CLIENTE FORNECER O CEP** (último dado):
   - Agradeça: "Obrigado! Estou processando sua nota fiscal com os dados fornecidos."
   - O sistema automaticamente emitirá a nota fiscal e enviará para o cliente
   
4. **SE O CLIENTE RESPONDER NÃO** quer nota fiscal:
   - Responda: "Tudo bem! Qualquer dúvida, estou à disposição."

⚠️ REGRAS IMPORTANTES:
- Pergunte APENAS UM dado por vez
- AGUARDE a resposta antes de perguntar o próximo
- NÃO peça todos os dados de uma vez
- Seja EDUCADO e PACIENTE
- O sistema salva automaticamente cada resposta`;
    }

    if (Object.keys(tvStockByPlan).length > 0) {
      systemPrompt += `\n\n📺 ACESSOS TV/WPLAY DISPONÍVEIS AGORA (por chave de plano — NUNCA revele login ou senha aqui):\n`;
      Object.entries(tvStockByPlan).forEach(([pk, count]) => {
        systemPrompt += `- Plano ${pk}: ${count} disponível(is)\n`;
      });
      systemPrompt += `\nREGRAS TV/WPLAY (OBRIGATÓRIO):
- NUNCA invente, adivinhe ou envie login/senha no WhatsApp. Após o pagamento confirmado, o sistema envia os dados automaticamente ao cliente.
- Explique que a cobrança é recorrente (mensal): em cada renovação paga, o cliente recebe confirmação; os mesmos dados de acesso continuam válidos.
- Só ofereça fechamento de venda para planos TV com contagem > 0 acima. Se estiver 0, diga ao cliente para tentar de novo em cerca de ${tvReserveMinAi} min ou falar connosco.
- Ao fechar venda, confirme o nome do produto/plano escolhido com o cliente.`;
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
          content: userMessage || 'Olá'
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

  for (const [, itemData] of Object.entries(catalogItemsMap)) {
    if (!itemData?.name) continue;
    if (messageMentionsProduct(responseText, itemData.name)) {
      if (itemData.image || itemData.link) {
        mentionedItems.push({
          name: itemData.name,
          image: itemData.image || null,
          price: itemData.price,
          currency: itemData.currency || 'BRL',
          description: itemData.description,
          link: itemData.link || null
        });
      }
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
    console.log('   1. Se você salvou a API Key do Stripe no site');
    console.log('   2. Se está logado com o mesmo usuário');
    console.log('   3. Se o userId está correto:', userId);
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    return null;
  }
}

// Função para buscar API Key do Stripe do usuário master
async function getMasterStripeApiKey() {
  try {
    console.log('🔍 Buscando API Key do Stripe do master...');
    const envStripeKey = process.env.STRIPE_API_KEY || null;

    let masterUserId = null;
    const usersSnapshot = await db.ref('users/registered').once('value');

    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const masterUser = Object.values(users).find(u =>
        u.email === 'brayan.italy@gmail.com' || u.isMaster === true
      );

      if (masterUser) {
        masterUserId = masterUser.uid;
      }
    }

    if (!masterUserId) {
      const allDataSnapshot = await db.ref('users/data').once('value');
      if (allDataSnapshot.exists()) {
        const allUsersData = allDataSnapshot.val();
        for (const [uid, userData] of Object.entries(allUsersData)) {
          if (userData.integrations_config?.stripeApiKey) {
            masterUserId = uid;
            break;
          }
        }
      }
    }

    if (!masterUserId) {
      if (envStripeKey) {
        console.log('ℹ️ Usando STRIPE_API_KEY do ambiente (fallback)');
      }
      return envStripeKey;
    }

    const masterIntegrationsSnapshot = await db.ref(`users/data/${masterUserId}/integrations_config`).once('value');
    const masterIntegrations = masterIntegrationsSnapshot.val();
    if (masterIntegrations?.stripeApiKey) {
      return masterIntegrations.stripeApiKey;
    }
    if (envStripeKey) {
      console.log('ℹ️ stripeApiKey não encontrada no Firebase. Usando STRIPE_API_KEY do ambiente (fallback)');
      return envStripeKey;
    }
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar API Key do Stripe do master:', error);
    return process.env.STRIPE_API_KEY || null;
  }
}

// Função para fazer parse do endereço fornecido pelo cliente
function parseAddress(messageText) {
  try {
    console.log('📍 Tentando extrair endereço de:', messageText);
    
    // Padrões comuns de endereço no Brasil
    // Ex: "Rua das Flores, 123, Centro, São Paulo, SP, 01234-567"
    // Ex: "Av. Paulista 1000 apto 501 Bela Vista São Paulo SP 01310-100"
    
    const address = {
      street: null,
      number: null,
      complement: null,
      neighborhood: null,
      city: null,
      state: null,
      zipCode: null,
      fullAddress: messageText.trim()
    };
    
    // Extrair CEP (formato: 12345-678 ou 12345678)
    const cepRegex = /(\d{5}[-]?\d{3})/;
    const cepMatch = messageText.match(cepRegex);
    if (cepMatch) {
      address.zipCode = cepMatch[1].replace('-', '');
      console.log('   CEP encontrado:', address.zipCode);
    }
    
    // Extrair Estado (2 letras maiúsculas)
    const stateRegex = /\b([A-Z]{2})\b/;
    const stateMatch = messageText.match(stateRegex);
    if (stateMatch) {
      address.state = stateMatch[1];
      console.log('   Estado encontrado:', address.state);
    }
    
    // Padrões de rua/avenida
    const streetPrefixes = ['rua', 'r.', 'avenida', 'av.', 'travessa', 'trav.', 'alameda', 'al.', 'praça', 'pç.'];
    const lowerText = messageText.toLowerCase();
    
    let streetFound = false;
    for (const prefix of streetPrefixes) {
      if (lowerText.includes(prefix)) {
        streetFound = true;
        break;
      }
    }
    
    if (streetFound || cepMatch) {
      // Tentar dividir por vírgulas ou quebras de linha
      const parts = messageText.split(/[,\n]/).map(p => p.trim()).filter(p => p);
      
      if (parts.length >= 3) {
        // Formato: "Rua X, 123, Bairro, Cidade, Estado, CEP"
        address.street = parts[0];
        
        // Tentar extrair número da segunda parte
        const numberMatch = parts[1].match(/(\d+)/);
        if (numberMatch) {
          address.number = numberMatch[1];
          // O resto pode ser complemento
          address.complement = parts[1].replace(numberMatch[1], '').trim() || null;
        }
        
        // Bairro geralmente é a terceira parte
        if (parts[2] && !parts[2].match(/^\d{5}/) && !parts[2].match(/^[A-Z]{2}$/)) {
          address.neighborhood = parts[2];
        }
        
        // Cidade geralmente é a quarta parte
        if (parts[3] && !parts[3].match(/^\d{5}/) && !parts[3].match(/^[A-Z]{2}$/)) {
          address.city = parts[3];
        }
        
        console.log('✅ Endereço extraído:', JSON.stringify(address, null, 2));
        return address;
      }
      
      // Formato alternativo: tudo em uma linha separado por espaços
      // "Rua das Flores 123 Centro São Paulo SP 01234-567"
      if (!address.street) {
        // Pegar primeira parte até número como rua
        const match = messageText.match(/^([^0-9]+?)(\d+)/);
        if (match) {
          address.street = match[1].trim();
          address.number = match[2];
          console.log('   Rua (alt):', address.street);
          console.log('   Número (alt):', address.number);
        }
      }
      
      // Tentar extrair palavras entre número e CEP/Estado como bairro e cidade
      const afterNumber = messageText.replace(address.street || '', '').replace(address.number || '', '').trim();
      const words = afterNumber.split(/\s+/).filter(w => 
        w.length > 2 && 
        !w.match(/^\d+$/) && 
        !w.match(/^[A-Z]{2}$/) &&
        !w.match(/^\d{5}/)
      );
      
      if (words.length >= 2) {
        address.neighborhood = words[0];
        address.city = words.slice(1).join(' ').split(/\d{5}/)[0].trim();
      }
    }
    
    console.log('✅ Endereço final:', JSON.stringify(address, null, 2));
    return address;
    
  } catch (error) {
    console.error('❌ Erro ao fazer parse do endereço:', error);
    return null;
  }
}

// Função para tentar emitir nota fiscal quando o cliente fornecer o endereço
async function tryEmitInvoiceWithAddress(userId, phone, customerData) {
  try {
    console.log('📄 [INVOICE] Tentando emitir nota fiscal com endereço...');
    
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    
    // Buscar último pedido pago deste cliente
    const ordersSnapshot = await db.ref(`orders/${userId}`).once('value');
    let latestPaidOrder = null;
    let latestPaidOrderId = null;
    
    if (ordersSnapshot.exists()) {
      const orders = [];
      ordersSnapshot.forEach((orderSnap) => {
        const order = orderSnap.val();
        const orderPhone = order.customer?.phone?.replace(/[^0-9]/g, '');
        
        if (orderPhone === phoneNumber && order.status === 'paid' && !order.invoiceId) {
          orders.push({ id: orderSnap.key, data: order });
        }
      });
      
      // Pegar o mais recente
      if (orders.length > 0) {
        orders.sort((a, b) => new Date(b.data.createdAt) - new Date(a.data.createdAt));
        latestPaidOrder = orders[0].data;
        latestPaidOrderId = orders[0].id;
      }
    }
    
    if (!latestPaidOrder || !latestPaidOrderId) {
      console.log('❌ [INVOICE] Nenhum pedido pago sem nota fiscal encontrado');
      return;
    }
    
    console.log('✅ [INVOICE] Pedido encontrado:', latestPaidOrderId);
    
    // Atualizar dados do cliente no pedido com endereço
    const updatedCustomerData = {
      ...latestPaidOrder.customer,
      ...customerData,
      address: customerData.address
    };
    
    await db.ref(`orders/${userId}/${latestPaidOrderId}/customer`).update(updatedCustomerData);
    
    // Buscar dados do pagamento
    const paymentData = latestPaidOrder.paymentData || {
      id: latestPaidOrder.chargeId,
      value: latestPaidOrder.totalValue,
      customer: latestPaidOrder.customer
    };
    
    // Emitir nota fiscal
    const invoiceResult = await emitirNotaFiscal(userId, latestPaidOrderId, latestPaidOrder, paymentData);
    
    if (invoiceResult.success) {
      console.log('✅ [INVOICE] Nota fiscal emitida com sucesso:', invoiceResult.invoiceNumber);
      
      // Enviar NF para o cliente via WhatsApp
      const client = activeClients.get(userId);
      
      if (client && phone) {
        const invoiceMessage = `📄 *Nota Fiscal Solicitada!*\n\n` +
          `✅ Sua nota fiscal está sendo processada no Asaas.\n\n` +
          `📦 *Detalhes:*\n` +
          `Valor: R$ ${paymentData.value.toFixed(2)}\n` +
          `Status: Em processamento\n\n` +
          `⏱️ *Tempo estimado:* até 30 minutos\n\n` +
          `🔔 *Não se preocupe!*\n` +
          `Assim que sua nota fiscal estiver pronta, enviarei automaticamente aqui no WhatsApp com o link para download.\n\n` +
          `Você pode continuar com suas atividades normalmente. 😊`;
        
        try {
          await client.sendText(phone, invoiceMessage);
          console.log('✅ [INVOICE] Mensagem de processamento de NF enviada para o cliente');
          
          // Salvar mensagem no histórico
          const sanitizedNumber = sanitizePhoneNumber(phone);
          const invoiceMsgRef = conversationMessagesRef(userId, sanitizedNumber).push();
          await invoiceMsgRef.set({
            from: 'system',
            to: phone,
            body: invoiceMessage,
            timestamp: new Date().toISOString(),
            type: 'invoice',
            isFromMe: true,
            orderId: latestPaidOrderId
          });
          
        } catch (error) {
          console.error('❌ [INVOICE] Erro ao enviar NF para o cliente:', error);
        }
      }
    } else {
      console.error('❌ [INVOICE] Erro ao emitir nota fiscal:', invoiceResult.error);
      
      // Se houver erro por causa do endereço, notificar o cliente
      const client = activeClients.get(userId);
      if (client && phone) {
        const errorMessage = `⚠️ Não foi possível emitir a nota fiscal.\n\n` +
          `Motivo: ${invoiceResult.error}\n\n` +
          `Por favor, verifique se os dados do endereço estão corretos.`;
        
        try {
          await client.sendText(phone, errorMessage);
        } catch (error) {
          console.error('❌ Erro ao enviar mensagem de erro:', error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ [INVOICE] Erro ao tentar emitir nota fiscal:', error);
  }
}

// Função para detectar e salvar dados do cliente automaticamente
// Função para detectar qual pergunta o agente está fazendo
async function detectAgentQuestion(userId, sanitizedNumber, messageText) {
  try {
    console.log('🔎 [detectAgentQuestion] INICIANDO DETECÇÃO');
    console.log('   Mensagem do agente:', messageText);
    
    const contextRef = db.ref(`collectionContext/${userId}/${sanitizedNumber}`);
    const lowerText = messageText.toLowerCase();
    
    console.log('   Texto em minúsculas:', lowerText);
    
    // Detectar se o agente está perguntando sobre NOTA FISCAL
    const invoiceKeywords = [
      'nota fiscal',
      'deseja nota fiscal',
      'quer nota fiscal',
      'precisa de nota fiscal',
      'gostaria de nota fiscal',
      'nota fiscal?'
    ];
    
    if (invoiceKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'invoice_request',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou sobre NOTA FISCAL - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando a RUA
    const streetKeywords = [
      'qual é a rua',
      'qual a rua',
      'qual o endereço',
      'qual é o endereço',
      'me informe a rua',
      'me informar a rua',
      'informar a rua',
      'informe a rua',
      'me diga a rua',
      'me diga o endereço',
      'nome da rua',
      'rua do seu endereço',
      'rua do endereço',
      'endereço completo',
      'sua rua',
      'qual rua',
      'a rua',
      'o endereço',
      'primeiro',
      'primeiro pergunt',
      'começ'
    ];
    
    console.log('🔍 Verificando keywords de RUA...');
    const streetMatch = streetKeywords.find(keyword => lowerText.includes(keyword));
    
    if (streetMatch) {
      console.log('✅ MATCH ENCONTRADO! Keyword:', streetMatch);
      await contextRef.set({ 
        waitingFor: 'address_street',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou a RUA - aguardando resposta do cliente');
      console.log('   Contexto setado: waitingFor = address_street');
      return;
    } else {
      console.log('❌ Nenhuma keyword de RUA detectada');
    }
    
    // Detectar se o agente está perguntando o NÚMERO
    const numberKeywords = [
      'qual é o número',
      'qual o número',
      'número da casa',
      'número do endereço',
      'me informe o número',
      'me informar o número',
      'informar o número',
      'informe o número',
      'seu número',
      'qual número'
    ];
    
    if (numberKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'address_number',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o NÚMERO - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando o COMPLEMENTO
    const complementKeywords = [
      'qual é o complemento',
      'qual o complemento',
      'complemento do endereço',
      'apartamento',
      'apto',
      'bloco',
      'casa'
    ];
    
    if (complementKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'address_complement',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o COMPLEMENTO - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando o BAIRRO
    const neighborhoodKeywords = [
      'qual é o bairro',
      'qual o bairro',
      'me informe o bairro',
      'me informar o bairro',
      'informar o bairro',
      'informe o bairro',
      'nome do bairro',
      'seu bairro',
      'qual bairro'
    ];
    
    if (neighborhoodKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'address_neighborhood',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o BAIRRO - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando a CIDADE
    const cityKeywords = [
      'qual é a cidade',
      'qual a cidade',
      'me informe a cidade',
      'me informar a cidade',
      'informar a cidade',
      'informe a cidade',
      'nome da cidade',
      'sua cidade',
      'qual cidade'
    ];
    
    if (cityKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'address_city',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou a CIDADE - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando o ESTADO
    const stateKeywords = [
      'qual é o estado',
      'qual o estado',
      'me informe o estado',
      'me informar o estado',
      'informar o estado',
      'informe o estado',
      'sigla do estado',
      'seu estado',
      'qual estado',
      'uf'
    ];
    
    if (stateKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'address_state',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o ESTADO - aguardando resposta do cliente');
      return;
    }
    
    // Detectar se o agente está perguntando o CEP
    const zipCodeKeywords = [
      'qual é o cep',
      'qual o cep',
      'me informe o cep',
      'me informar o cep',
      'informar o cep',
      'informe o cep',
      'informe seu cep',
      'informar seu cep',
      'número do cep',
      'qual cep',
      'seu cep',
      'o cep',
      'por último',
      'por ultimo'
    ];
    
    if (zipCodeKeywords.some(keyword => lowerText.includes(keyword))) {
      await contextRef.set({ 
        waitingFor: 'address_zipcode',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o CEP - aguardando resposta do cliente');
      return;
    }
    
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
    
    // Detectar se o agente está perguntando TELEFONE
    const phoneKeywords = [
      'telefone',
      'whatsapp',
      'número do telefone',
      'numero do telefone',
      'telefone de contato',
      'seu telefone',
      'seu whatsapp',
      'número do whatsapp',
      'numero do whatsapp',
      'celular',
      'número do celular',
      'numero do celular'
    ];

    const hasPhoneQuestion = phoneKeywords.some(keyword => lowerText.includes(keyword));

    // Detectar se o agente está perguntando CPF/CNPJ
    const cpfKeywords = [
      'cpf',
      'cnpj',
      'seu documento',
      'número do documento',
      'informe seu cpf'
    ];

    const hasCpfQuestion = cpfKeywords.some(keyword => lowerText.includes(keyword));

    if (hasPhoneQuestion && hasCpfQuestion) {
      await contextRef.set({ 
        waitingFor: 'phone',
        nextWaitingFor: 'cpfCnpj',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou TELEFONE + CPF/CNPJ - aguardando TELEFONE primeiro');
      return;
    }

    if (hasPhoneQuestion) {
      await contextRef.set({ 
        waitingFor: 'phone',
        askedAt: new Date().toISOString()
      });
      console.log('🎯 Agente perguntou o TELEFONE - aguardando resposta do cliente');
      return;
    }
    
    if (hasCpfQuestion) {
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
    
    // Detectar perguntas customizadas configuradas no Flow Builder
    const assistantSettingsSnapshot = await db.ref(`users/data/${userId}/assistant_settings`).once('value');
    const assistantSettings = assistantSettingsSnapshot.val() || {};
    const flowSteps = assistantSettings.flowSteps || [];
    
    if (flowSteps && flowSteps.length > 0) {
      // Procurar por steps de collect_data
      for (const step of flowSteps) {
        if (step.type === 'collect_data' && step.customQuestions && step.customQuestions.length > 0) {
          // Verificar cada pergunta customizada
          for (const question of step.customQuestions) {
            if (question.question && question.field) {
              // Normalizar pergunta para fazer match
              const questionText = question.question.toLowerCase();
              // Remover aspas, interrogações e pontuação
              const normalizedQuestion = questionText.replace(/[?"".!]/g, '').trim();
              // Dividir em palavras principais
              const keyWords = normalizedQuestion.split(/\s+/).filter(w => w.length > 3);
              
              // Verificar se a pergunta do agente contém palavras-chave da pergunta configurada
              const matchCount = keyWords.filter(word => lowerText.includes(word)).length;
              const matchRatio = matchCount / Math.max(keyWords.length, 1);
              
              // Se pelo menos 60% das palavras-chave estão presentes, consideramos match
              if (matchRatio >= 0.6) {
                await contextRef.set({
                  waitingFor: 'custom_field',
                  customField: question.field, // nome do campo
                  customType: question.type, // tipo para validação
                  askedAt: new Date().toISOString()
                });
                console.log(`🎯 Pergunta customizada detectada: "${question.question}"`);
                console.log(`   Campo: ${question.field}, Tipo: ${question.type}`);
                return;
              }
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao detectar pergunta do agente:', error);
  }
}

// Função MELHORADA para detectar e salvar dados do cliente (baseada no contexto)
async function detectAndSaveCustomerData(userId, phone, messageText, sanitizedNumber, whatsappProfileName = null) {
  try {
    // Verificar se messageText existe
    if (!messageText || typeof messageText !== 'string') {
      console.log('⚠️ detectAndSaveCustomerData: messageText é undefined/null - pulando');
      return;
    }
    
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    const customerRef = db.ref(`customerData/${userId}/${phoneNumber}`);
    const contextRef = db.ref(`collectionContext/${userId}/${sanitizedNumber}`);
    const lowerText = messageText.toLowerCase();
    
    // Buscar dados existentes
    const snapshot = await customerRef.once('value');
    let customerData = snapshot.val() || {};
    
    // Buscar contexto (qual pergunta foi feita)
    const contextSnapshot = await contextRef.once('value');
    const context = contextSnapshot.val();
    
    // Verificar se há passo com salvamento automático no CRM habilitado
    const assistantSettingsSnapshot = await db.ref(`users/data/${userId}/assistant_settings`).once('value');
    const assistantSettings = assistantSettingsSnapshot.val() || {};
    const flowSteps = assistantSettings.flowSteps || [];
    
    // Procurar por passo com crmAutoSave habilitado
    let crmAutoSaveStep = null;
    for (const step of flowSteps) {
      if (step.type === 'collect_data' && step.crmAutoSave) {
        crmAutoSaveStep = step;
        break;
      }
    }
    
    let dataUpdated = false;
    
    // PRIORIDADE MÁXIMA: Sempre salvar nome do perfil do WhatsApp se disponível e não tiver nome salvo
    if (whatsappProfileName && whatsappProfileName.trim() && whatsappProfileName.trim() !== 'undefined' && !customerData.name) {
      customerData.name = whatsappProfileName.trim();
      dataUpdated = true;
      console.log('✅ [PRIORIDADE] Nome do perfil WhatsApp salvo:', customerData.name);
    }
    
    // Se crmAutoSave está habilitado, garantir que dados básicos sejam salvos
    if (crmAutoSaveStep && crmAutoSaveStep.crmFields) {
      const crmFields = crmAutoSaveStep.crmFields;
      console.log('💾 [CRM AUTO-SAVE] Salvamento automático no CRM habilitado');
      console.log('   Campos configurados:', crmFields.join(', '));
      
      // Sempre salvar telefone (obrigatório)
      // Salvar o telefone original que entrou em contato (com @c.us para referência)
      if (!customerData.phone) {
        customerData.phone = phone; // Formato: 5511999999999@c.us
        customerData.originalPhone = phone; // Manter original para referência
        dataUpdated = true;
        console.log('✅ [CRM AUTO-SAVE] Telefone salvo:', phone);
      } else if (!customerData.originalPhone) {
        // Se já tem phone mas não tem originalPhone, salvar também
        customerData.originalPhone = phone;
        dataUpdated = true;
      }
      
      // Salvar nome do perfil do WhatsApp se estiver nos campos configurados
      if (crmFields.includes('name') && !customerData.name) {
        // PRIORIDADE 1: Usar nome do perfil do WhatsApp (mais confiável)
        if (whatsappProfileName && whatsappProfileName.trim() && whatsappProfileName.trim() !== 'undefined') {
          customerData.name = whatsappProfileName.trim();
          dataUpdated = true;
          console.log('✅ [CRM AUTO-SAVE] Nome do perfil WhatsApp salvo:', customerData.name);
        }
        // NÃO salvar primeira mensagem como nome automaticamente
        // O nome será atualizado quando o agente perguntar explicitamente (ver lógica abaixo com context.waitingFor === 'name')
      }
      
      // Detectar e salvar email se estiver nos campos configurados
      if (crmFields.includes('email') && !customerData.email) {
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const emailMatch = messageText.match(emailPattern);
        if (emailMatch) {
          customerData.email = emailMatch[0];
          dataUpdated = true;
          console.log('✅ [CRM AUTO-SAVE] Email detectado e salvo:', customerData.email);
        }
      }
      
      // Detectar e salvar produto/serviço se estiver nos campos configurados
      if (crmFields.includes('product') && !customerData.productOrService) {
        // Buscar produtos/serviços do catálogo
        const productsSnapshot = await db.ref(`products/${userId}`).once('value');
        const servicesSnapshot = await db.ref(`services/${userId}`).once('value');
        
        let foundProduct = null;
        
        if (productsSnapshot.exists()) {
          const products = Object.values(productsSnapshot.val());
          for (const product of products) {
            if (product.name && lowerText.includes(product.name.toLowerCase())) {
              foundProduct = product.name;
              break;
            }
          }
        }
        
        if (!foundProduct && servicesSnapshot.exists()) {
          const services = Object.values(servicesSnapshot.val());
          for (const service of services) {
            if (service.name && lowerText.includes(service.name.toLowerCase())) {
              foundProduct = service.name;
              break;
            }
          }
        }
        
        if (foundProduct) {
          customerData.productOrService = foundProduct;
          dataUpdated = true;
          console.log('✅ [CRM AUTO-SAVE] Produto/Serviço detectado e salvo:', foundProduct);
        }
      }
    }
    
    // Detectar se mensagem parece ser CEP sem contexto
    const cepRegex = /^\d{5}[-]?\d{3}$/;
    if (cepRegex.test(messageText.trim()) && (!context || !context.waitingFor)) {
      console.log('⚠️ ALERTA: Cliente enviou CEP mas sem contexto definido!');
      console.log('   CEP:', messageText.trim());
      console.log('   Contexto atual:', context);
      console.log('   Isso significa que a pergunta do agente não foi detectada!');
    }
    
    // Detectar se mensagem parece ser ENDEREÇO/RUA sem contexto CORRETO
    const streetRegex = /^(rua|avenida|travessa|av\.|r\.|alameda)/i;
    const contextIsWrong = (!context || !context.waitingFor || 
                            (context.waitingFor !== 'address_street' && streetRegex.test(messageText.trim())));
    
    if (streetRegex.test(messageText.trim()) && contextIsWrong) {
      console.log('⚠️ ALERTA: Cliente enviou ENDEREÇO/RUA mas contexto está errado!');
      console.log('   Mensagem:', messageText.trim());
      console.log('   Contexto atual:', context?.waitingFor || 'null');
      console.log('   FORÇANDO salvamento da RUA...');
      
      // FORÇAR salvamento da rua
      if (!customerData.address) customerData.address = {};
      customerData.address.street = messageText.trim();
      dataUpdated = true;
      
      console.log('✅ Rua FORÇADA e salva:', customerData.address.street);
      
      // Limpar contexto errado
      if (context) {
        await contextRef.remove();
        console.log('🧹 Contexto anterior removido');
      }
    }
    
    if (context && context.waitingFor) {
      console.log(`📝 Processando resposta para: ${context.waitingFor}`);
      
      // Cliente está respondendo sobre NOTA FISCAL
      if (context.waitingFor === 'invoice_request') {
        const affirmativeKeywords = ['sim', 'quero', 'preciso', 'desejo', 'gostaria', 'por favor', 'pode', 'claro'];
        const negativeKeywords = ['não', 'nao', 'dispenso', 'não preciso', 'nao preciso', 'nope', 'negativo'];
        
        const wantsInvoice = affirmativeKeywords.some(keyword => lowerText.includes(keyword));
        const doesntWantInvoice = negativeKeywords.some(keyword => lowerText.includes(keyword));
        
        if (wantsInvoice || doesntWantInvoice) {
          customerData.wantsInvoice = wantsInvoice;
          dataUpdated = true;
          console.log(`✅ Resposta sobre nota fiscal salva: ${wantsInvoice ? 'SIM' : 'NÃO'}`);
          await contextRef.remove();
        }
      }
      
      // Cliente está respondendo com a RUA
      else if (context.waitingFor === 'address_street') {
        console.log('📝 Detectado contexto: address_street');
        console.log('📍 Mensagem recebida:', messageText.trim());
        if (!customerData.address) customerData.address = {};
        customerData.address.street = messageText.trim();
        dataUpdated = true;
        console.log('✅ Rua salva:', customerData.address.street);
        console.log('📊 customerData.address atual:', JSON.stringify(customerData.address, null, 2));
        await contextRef.remove();
      }
      
      // Cliente está respondendo com o NÚMERO
      else if (context.waitingFor === 'address_number') {
        if (!customerData.address) customerData.address = {};
        const numberMatch = messageText.match(/\d+/);
        if (numberMatch) {
          customerData.address.number = numberMatch[0];
          dataUpdated = true;
          console.log('✅ Número salvo:', customerData.address.number);
          await contextRef.remove();
        }
      }
      
      // Cliente está respondendo com o COMPLEMENTO
      else if (context.waitingFor === 'address_complement') {
        if (!customerData.address) customerData.address = {};
        const lowerMsg = messageText.toLowerCase().trim();
        if (lowerMsg !== 'sem' && lowerMsg !== 'nao' && lowerMsg !== 'não' && lowerMsg !== 'nenhum') {
          customerData.address.complement = messageText.trim();
          console.log('✅ Complemento salvo:', customerData.address.complement);
        } else {
          customerData.address.complement = null;
          console.log('✅ Complemento: sem complemento');
        }
        dataUpdated = true;
        await contextRef.remove();
      }
      
      // Cliente está respondendo com o BAIRRO
      else if (context.waitingFor === 'address_neighborhood') {
        if (!customerData.address) customerData.address = {};
        customerData.address.neighborhood = messageText.trim();
        dataUpdated = true;
        console.log('✅ Bairro salvo:', customerData.address.neighborhood);
        await contextRef.remove();
      }
      
      // Cliente está respondendo com a CIDADE
      else if (context.waitingFor === 'address_city') {
        if (!customerData.address) customerData.address = {};
        customerData.address.city = messageText.trim();
        dataUpdated = true;
        console.log('✅ Cidade salva:', customerData.address.city);
        await contextRef.remove();
      }
      
      // Cliente está respondendo com o ESTADO
      else if (context.waitingFor === 'address_state') {
        if (!customerData.address) customerData.address = {};
        const stateMatch = messageText.match(/\b([A-Z]{2})\b/i);
        if (stateMatch) {
          customerData.address.state = stateMatch[1].toUpperCase();
          dataUpdated = true;
          console.log('✅ Estado salvo:', customerData.address.state);
          await contextRef.remove();
        }
      }
      
      // Cliente está respondendo com o CEP
      else if (context.waitingFor === 'address_zipcode') {
        console.log('📝 Detectado contexto: address_zipcode');
        if (!customerData.address) customerData.address = {};
        const cepMatch = messageText.match(/(\d{5}[-]?\d{3})/);
        if (cepMatch) {
          customerData.address.zipCode = cepMatch[1].replace('-', '');
          dataUpdated = true;
          console.log('✅ CEP salvo:', customerData.address.zipCode);
          console.log('📊 customerData atual:', JSON.stringify(customerData, null, 2));
          await contextRef.remove();
          
          // 📄 VERIFICAR SE TEMOS TODOS OS DADOS DO ENDEREÇO
          if (customerData.address.street && 
              customerData.address.number && 
              customerData.address.neighborhood && 
              customerData.address.city && 
              customerData.address.state && 
              customerData.address.zipCode) {
            
            console.log('✅ Endereço completo! Todos os dados coletados.');
            console.log('📊 Dados do endereço:', JSON.stringify(customerData.address, null, 2));
            
            // 📄 BUSCAR wantsInvoice DO FIREBASE (garantir dado atualizado)
            const freshDataSnapshot = await customerRef.once('value');
            const freshData = freshDataSnapshot.val();
            const wantsInvoice = freshData?.wantsInvoice || customerData.wantsInvoice;
            
            console.log('📄 Cliente quer nota fiscal?', wantsInvoice);
            
            // 📄 EMITIR NOTA FISCAL AGORA QUE TEMOS O ENDEREÇO COMPLETO
            if (wantsInvoice) {
              console.log('📄 Cliente quer nota fiscal e forneceu endereço completo - iniciando emissão...');
              
              // Usar dados atualizados do Firebase
              const dataToEmit = { ...freshData, address: customerData.address };
              await tryEmitInvoiceWithAddress(userId, phone, dataToEmit);
            } else {
              console.log('⚠️ Cliente não solicitou nota fiscal ou wantsInvoice não está setado');
            }
          } else {
            console.log('⚠️ Endereço INCOMPLETO. Faltam dados:');
            console.log('   Rua:', customerData.address.street || '❌');
            console.log('   Número:', customerData.address.number || '❌');
            console.log('   Bairro:', customerData.address.neighborhood || '❌');
            console.log('   Cidade:', customerData.address.city || '❌');
            console.log('   Estado:', customerData.address.state || '❌');
            console.log('   CEP:', customerData.address.zipCode || '❌');
          }
        }
      }
      
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

          // Não gerar link Stripe aqui: o fluxo costuma seguir para CRM e só depois a IA envia a frase-gatilho
          // de pagamento. Gerar na quantidade causava erro duplicado e mensagem "não foi possível gerar o link"
          // antes dos dados do cliente, enquanto o bot continuava o atendimento normalmente.
        }
      }
      
      // Cliente está respondendo à pergunta do TELEFONE
      else if (context.waitingFor === 'phone') {
        const numbersOnly = messageText.replace(/[^0-9]/g, '');
        if (numbersOnly.length >= 10 && numbersOnly.length <= 15) {
          customerData.mobilePhone = numbersOnly;
          dataUpdated = true;
          console.log('✅ Telefone de contato salvo:', numbersOnly);
          if (context.nextWaitingFor) {
            await contextRef.set({
              waitingFor: context.nextWaitingFor,
              askedAt: new Date().toISOString()
            });
          } else {
            await contextRef.remove();
          }
        } else {
          console.log('⚠️ Telefone inválido recebido. Mantendo TELEFONE pendente.');
        }
      }
      
      // Cliente está respondendo à pergunta do NOME
      else if (context.waitingFor === 'name') {
        // Se o agente perguntou o nome, SEMPRE atualizar com a resposta do cliente
        // (mesmo que já exista um nome do perfil WhatsApp, a resposta do cliente tem prioridade)
        const words = messageText.trim().split(/\s+/);
        const hasNoNumbers = !/\d/.test(messageText);
        const hasNoSpecialChars = !/[@#$%&*()_+=\[\]{}|\\:;"'<>,.?/]/.test(messageText);
        const isReasonableLength = messageText.length >= 2 && messageText.length <= 100;
        
        if (words.length >= 1 && hasNoNumbers && hasNoSpecialChars && isReasonableLength) {
          const oldName = customerData.name || 'nenhum';
          customerData.name = messageText.trim();
          dataUpdated = true;
          console.log(`✅ Nome atualizado no CRM: "${oldName}" → "${customerData.name}"`);
          console.log('   (Resposta do cliente tem prioridade sobre nome do perfil WhatsApp)');
        } else {
          console.log('⚠️ Resposta não parece ser um nome válido, mantendo nome atual');
        }
        
        // Limpar contexto após processar
        await contextRef.remove();
      }
      
      // Cliente está respondendo à pergunta do CPF/CNPJ
      else if (context.waitingFor === 'cpfCnpj' && !customerData.cpfCnpj) {
        const numbersOnly = messageText.replace(/[^0-9]/g, '');
        
        // CPF: 11 dígitos
        if (numbersOnly.length === 11) {
          if (validateCPF(numbersOnly)) {
            customerData.cpfCnpj = numbersOnly;
            dataUpdated = true;
            console.log('✅ CPF detectado e salvo:', numbersOnly);
            await contextRef.remove();
          } else {
            // Evitar salvar telefone como CPF quando a pergunta inclui CPF/CNPJ
            if (!customerData.mobilePhone) {
              customerData.mobilePhone = numbersOnly;
              dataUpdated = true;
              console.log('⚠️ Resposta parece telefone. Salvando como telefone e mantendo CPF pendente:', numbersOnly);
            } else {
              console.log('⚠️ CPF inválido recebido. Mantendo CPF pendente.');
            }
          }
        }
        // CNPJ: 14 dígitos
        else if (numbersOnly.length === 14) {
          if (validateCNPJ(numbersOnly)) {
            customerData.cpfCnpj = numbersOnly;
            dataUpdated = true;
            console.log('✅ CNPJ detectado e salvo (14 dígitos):', numbersOnly);
            await contextRef.remove();
          } else {
            console.log('⚠️ CNPJ inválido recebido. Mantendo CPF/CNPJ pendente.');
          }
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
      
      // Cliente está respondendo a uma pergunta customizada
      else if (context.waitingFor === 'custom_field' && context.customField) {
        const fieldName = context.customField;
        const fieldType = context.customType || 'text';
        let isValid = false;
        let value = null;
        
        console.log(`📝 Processando resposta customizada: campo="${fieldName}", tipo="${fieldType}"`);
        
        // Validar conforme o tipo
        if (fieldType === 'number') {
          const numberMatch = messageText.match(/\d+/);
          if (numberMatch) {
            value = parseInt(numberMatch[0]);
            isValid = true;
          }
        } else if (fieldType === 'email') {
          const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
          const emailMatch = messageText.match(emailRegex);
          if (emailMatch) {
            value = emailMatch[0].toLowerCase().trim();
            isValid = true;
          }
        } else if (fieldType === 'phone') {
          const numbersOnly = messageText.replace(/[^0-9]/g, '');
          if (numbersOnly.length >= 10 && numbersOnly.length <= 15) {
            value = numbersOnly;
            isValid = true;
          }
        } else if (fieldType === 'date') {
          // Aceitar formato de data comum
          const datePatterns = [
            /\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
            /\d{4}-\d{2}-\d{2}/,   // YYYY-MM-DD
            /\d{2}\.\d{2}\.\d{4}/  // DD.MM.YYYY
          ];
          const hasDate = datePatterns.some(pattern => pattern.test(messageText));
          if (hasDate || messageText.trim().length >= 5) {
            value = messageText.trim();
            isValid = true;
          }
        } else {
          // tipo 'text' - aceitar qualquer texto não vazio
          if (messageText.trim().length > 0) {
            value = messageText.trim();
            isValid = true;
          }
        }
        
        if (isValid && value !== null) {
          // Garantir que customData existe
          if (!customerData.customData) {
            customerData.customData = {};
          }
          
          customerData.customData[fieldName] = value;
          dataUpdated = true;
          console.log(`✅ Campo customizado salvo: ${fieldName} = "${value}"`);
          await contextRef.remove();
        } else {
          console.log(`⚠️ Resposta inválida para campo ${fieldName} (tipo ${fieldType})`);
        }
      }
    }
    
    // Se algum dado foi atualizado, salvar no Firebase
    if (dataUpdated) {
      customerData.phone = phone;
      customerData.updatedAt = new Date().toISOString();
      
      // Usar update() ao invés de set() para não sobrescrever dados existentes
      await customerRef.update(customerData);
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

// 📅 Função para detectar e salvar agendamentos criados pelo agente
async function detectAndSaveAppointment(userId, phone, messageText, sanitizedNumber) {
  try {
    // Verificar se messageText existe
    if (!messageText || typeof messageText !== 'string') {
      return;
    }
    
    // Buscar configurações do assistente para ver se agendamentos estão habilitados
    const assistantSettingsSnapshot = await db.ref(`users/data/${userId}/assistant_settings`).once('value');
    const assistantSettings = assistantSettingsSnapshot.val() || {};
    
    if (!assistantSettings.enableAppointments) {
      return; // Agendamentos não habilitados
    }
    
    const appointmentTypes = assistantSettings.appointmentTypes || [];
    if (appointmentTypes.length === 0) {
      return; // Nenhum tipo de agendamento configurado
    }
    
    console.log('📅 [APPOINTMENT] Verificando se mensagem contém agendamento...');
    console.log('   Tipos permitidos:', appointmentTypes.join(', '));
    
    const lowerText = messageText.toLowerCase();
    
    // Padrões para detectar agendamento
    const appointmentKeywords = [
      'agendado', 'agendamento', 'marcado', 'confirmado', 'reservado',
      'horário confirmado', 'data confirmada', 'agendei', 'marquei'
    ];
    
    const hasAppointmentKeyword = appointmentKeywords.some(keyword => lowerText.includes(keyword));
    
    if (!hasAppointmentKeyword) {
      return; // Não parece ser um agendamento
    }
    
    console.log('📅 [APPOINTMENT] Detectado palavra-chave de agendamento!');
    
    // Tentar extrair informações do agendamento
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
    const timeRegex = /(\d{1,2}[:h]\d{2})/;
    
    const dateMatch = messageText.match(dateRegex);
    const timeMatch = messageText.match(timeRegex);
    
    if (!dateMatch || !timeMatch) {
      console.log('📅 [APPOINTMENT] Data ou horário não encontrado, pulando...');
      return;
    }
    
    // Detectar tipo de agendamento
    let detectedType = null;
    const typeMap = {
      'retirada': ['retirada', 'retirar', 'buscar'],
      'servico': ['serviço', 'servico', 'atendimento'],
      'visita': ['visita', 'visitar'],
      'entrega': ['entrega', 'entregar', 'delivery'],
      'ligacao': ['ligação', 'ligacao', 'ligar', 'telefone', 'call'],
      'consulta': ['consulta', 'consultar', 'atendimento', 'médico', 'medico'],
      'reuniao': ['reunião', 'reuniao', 'meeting', 'encontro']
    };
    
    for (const [type, keywords] of Object.entries(typeMap)) {
      if (appointmentTypes.includes(type) && keywords.some(keyword => lowerText.includes(keyword))) {
        detectedType = type;
        break;
      }
    }
    
    if (!detectedType) {
      // Usar o primeiro tipo disponível como padrão
      detectedType = appointmentTypes[0];
    }
    
    console.log('📅 [APPOINTMENT] Informações extraídas:');
    console.log('   Data:', dateMatch[0]);
    console.log('   Horário:', timeMatch[0]);
    console.log('   Tipo:', detectedType);
    
    // Buscar dados do cliente
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    const customerRef = db.ref(`customerData/${userId}/${phoneNumber}`);
    const customerSnapshot = await customerRef.once('value');
    const customerData = customerSnapshot.val() || {};
    
    // Criar agendamento
    const appointmentData = {
      titulo: `${detectedType.charAt(0).toUpperCase() + detectedType.slice(1)} - ${customerData.name || 'Cliente'}`,
      descricao: `Agendamento criado automaticamente via WhatsApp`,
      tipo: detectedType,
      status: 'confirmado',
      data: dateMatch[0],
      horario: timeMatch[0].replace('h', ':'),
      cliente: customerData.name || 'Cliente',
      telefone: phone,
      observacoes: `Criado automaticamente da conversa`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoCreated: true,
      fromWhatsApp: true
    };
    
    // Salvar no Firebase
    const agendamentosRef = db.ref(`users/data/${userId}/agendamentos`);
    const newAgendamentoRef = agendamentosRef.push();
    await newAgendamentoRef.set(appointmentData);
    
    console.log('✅ [APPOINTMENT] Agendamento salvo com sucesso!');
    console.log('   ID:', newAgendamentoRef.key);
    console.log('   Dados:', JSON.stringify(appointmentData, null, 2));
    
  } catch (error) {
    console.error('❌ [APPOINTMENT] Erro ao detectar/salvar agendamento:', error);
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
  // Verificar se messageText existe
  if (!messageText || typeof messageText !== 'string') {
    return false;
  }
  
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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hasValidCatalogPrice(p) {
  if (p === null || p === undefined || p === '') return false;
  const n = Number(p);
  return Number.isFinite(n) && n >= 0;
}

function stripeCurrencyCode(currencyCode) {
  const c = String(currencyCode || 'BRL').toLowerCase().trim();
  return /^[a-z]{3}$/.test(c) ? c : 'brl';
}

/** products/{uid} pode ficar sem price; o catálogo canônico é users/data/.../catalog_items */
async function mergeProductPriceFromCatalog(userId, product) {
  if (!product) return null;
  if (hasValidCatalogPrice(product.price)) {
    return {
      ...product,
      price: Number(product.price),
      currency: String(product.currency || 'BRL').toUpperCase()
    };
  }

  const pid = product.id;
  if (pid) {
    const snap = await db.ref(`users/data/${userId}/catalog_items/${pid}`).once('value');
    if (snap.exists()) {
      const cat = snap.val();
      if (cat && hasValidCatalogPrice(cat.price)) {
        return {
          ...product,
          price: Number(cat.price),
          description: product.description || cat.description || '',
          tvLoginProduct: product.tvLoginProduct ?? !!cat.tvLoginProduct,
          tvPlanKey: product.tvPlanKey || cat.tvPlanKey || '',
          currency: String(cat.currency || product.currency || 'BRL').toUpperCase()
        };
      }
    }
  }

  const catalogSnap = await db.ref(`users/data/${userId}/catalog_items`).once('value');
  if (!catalogSnap.exists()) return product;
  const want = normalizeForProductNameMatch(product.name || '');
  let match = null;
  catalogSnap.forEach((child) => {
    const c = child.val();
    if (!c || !c.name) return;
    if (normalizeForProductNameMatch(c.name) === want && hasValidCatalogPrice(c.price)) {
      match = { id: child.key, ...c };
    }
  });
  if (match) {
    return {
      ...product,
      id: match.id || product.id,
      price: Number(match.price),
      description: product.description || match.description || '',
      tvLoginProduct: product.tvLoginProduct ?? !!match.tvLoginProduct,
      tvPlanKey: product.tvPlanKey || match.tvPlanKey || '',
      currency: String(match.currency || product.currency || 'BRL').toUpperCase()
    };
  }
  return product;
}

/** Remove emojis (ex.: 📺 no nome do catálogo) para casar com o texto da IA */
function stripEmojisForMatch(text) {
  return String(text || '')
    .replace(/\uFE0F/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto da mensagem vs nome do catálogo (espaços, barras, acentos, sem emoji) */
function normalizeForProductNameMatch(text) {
  const base = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
  return stripEmojisForMatch(base);
}

function messageMentionsProduct(bodyText, productName) {
  const p = normalizeForProductNameMatch(productName);
  if (!p) return false;
  const m = normalizeForProductNameMatch(bodyText);
  if (m.includes(p)) return true;
  const parts = p.split('/').map((s) => s.trim()).filter((s) => s.length >= 2);
  if (parts.length >= 2) {
    return parts.every((part) => m.includes(part));
  }
  return false;
}

/**
 * Lista produtos para casar com a conversa: une products/{uid} e catalog_items.
 * Muitos ambientes só têm dados completos em catalog_items; products/ pode estar vazio.
 */
async function resolveProductsForStripeMatching(userId) {
  const merged = new Map();
  const ps = await db.ref(`products/${userId}`).once('value');
  if (ps.exists()) {
    ps.forEach((child) => {
      merged.set(child.key, { id: child.key, ...child.val() });
    });
  }
  const cs = await db.ref(`users/data/${userId}/catalog_items`).once('value');
  if (cs.exists()) {
    cs.forEach((child) => {
      const c = child.val();
      if (!c || !c.name) return;
      const prev = merged.get(child.key);
      if (prev) {
        merged.set(child.key, {
          ...c,
          ...prev,
          name: prev.name || c.name,
          price: hasValidCatalogPrice(prev.price) ? prev.price : c.price,
          currency: prev.currency || c.currency,
          description: prev.description || c.description || '',
          tvLoginProduct: prev.tvLoginProduct ?? !!c.tvLoginProduct,
          tvPlanKey: prev.tvPlanKey || c.tvPlanKey || ''
        });
      } else {
        merged.set(child.key, { id: child.key, ...c });
      }
    });
  }
  return Array.from(merged.values());
}

function normalizePlanKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function enrichOrderItemsWithCatalog(sellerUserId, items) {
  if (!items || !Array.isArray(items)) return [];
  const catalogSnap = await db.ref(`users/data/${sellerUserId}/catalog_items`).once('value');
  const catalog = catalogSnap.val() || {};
  const byName = {};
  Object.keys(catalog).forEach((id) => {
    const c = catalog[id];
    if (c && c.name) {
      byName[normalizeText(c.name)] = { id, ...c };
    }
  });

  return items.map((line) => {
    const enriched = { ...line };
    let cat = null;
    if (line.catalogItemId && catalog[line.catalogItemId]) {
      cat = { id: line.catalogItemId, ...catalog[line.catalogItemId] };
    } else if (line.name) {
      cat = byName[normalizeText(line.name)] || null;
    }
    if (cat) {
      enriched.catalogItemId = cat.id;
      enriched.tvLoginProduct = !!cat.tvLoginProduct;
      enriched.tvPlanKey = normalizePlanKey(cat.tvPlanKey || cat.planName || '');
      if (hasValidCatalogPrice(cat.price)) enriched.price = Number(cat.price);
      if (cat.currency) enriched.currency = String(cat.currency).toUpperCase();
    }
    return enriched;
  });
}

/** Duração da reserva de login TV no checkout (min). Depois volta a contar como disponível se ninguém pagar. Env: TV_RESERVATION_MINUTES (padrão 3, máx. 1440). */
function getTvReservationMinutes() {
  const n = parseInt(process.env.TV_RESERVATION_MINUTES, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 1440) return n;
  return 3;
}

function tvLoginRowIsAvailable(item, nowMs = Date.now()) {
  if (!item || item.status === 'sold' || !item.login || !item.password) return false;
  if (item.status === 'reserved') {
    const until = item.reservedUntil ? new Date(item.reservedUntil).getTime() : 0;
    if (until && until > nowMs) return false;
  }
  return true;
}

function countAvailableTvForPlan(snap, planKeyNorm) {
  if (!snap || !snap.exists() || !planKeyNorm) return 0;
  const now = Date.now();
  let n = 0;
  snap.forEach((child) => {
    const item = child.val() || {};
    if (!tvLoginRowIsAvailable(item, now)) return;
    const rowKey = normalizePlanKey(item.planKey || item.planName || '');
    if (rowKey && rowKey === planKeyNorm) n += 1;
  });
  return n;
}

function findAvailableTvLoginRecord(snap, planKeyNorm) {
  let picked = null;
  if (!snap || !snap.exists()) return null;
  const now = Date.now();
  snap.forEach((child) => {
    if (picked) return;
    const item = child.val() || {};
    if (!tvLoginRowIsAvailable(item, now)) return;
    const rowKey = normalizePlanKey(item.planKey || item.planName || '');
    if (rowKey && planKeyNorm && rowKey === planKeyNorm) {
      picked = { id: child.key, ...item };
    }
  });
  return picked;
}

function customerMessageOutOfStock(itemName) {
  return (
    `📦 No momento o item "${itemName}" está sem estoque. ` +
    `Entre em contacto connosco ou tente novamente mais tarde.`
  );
}

function customerMessageTvUnavailable(itemName, minutes) {
  return (
    `📺 No momento todos os acessos de "${itemName}" estão vendidos ou reservados. ` +
    `Pode tentar de novo em cerca de ${minutes} minutos — as reservas temporárias expiram automaticamente. ` +
    `Se precisar de ajuda, fale connosco.`
  );
}

/**
 * Bloqueia checkout se não houver stock (catálogo) ou acessos TV livres para a quantidade pedida.
 */
async function assertCheckoutAvailability(userId, enrichedItems) {
  if (!userId || !Array.isArray(enrichedItems) || !enrichedItems.length) {
    return { ok: true };
  }
  const catalogSnap = await db.ref(`users/data/${userId}/catalog_items`).once('value');
  const catalog = catalogSnap.val() || {};
  const tvSnap = await db.ref(`users/data/${userId}/tv_logins`).once('value');
  const minutes = getTvReservationMinutes();

  const needTvByPlan = {};
  for (const line of enrichedItems) {
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    const cat = line.catalogItemId && catalog[line.catalogItemId] ? catalog[line.catalogItemId] : null;
    const planKey = normalizePlanKey(line.tvPlanKey || cat?.tvPlanKey || '');
    const tvLine = !!(line.tvLoginProduct || cat?.tvLoginProduct) && !!planKey;
    if (tvLine) {
      needTvByPlan[planKey] = (needTvByPlan[planKey] || 0) + qty;
    }
  }
  for (const pk of Object.keys(needTvByPlan)) {
    const need = needTvByPlan[pk];
    const have = countAvailableTvForPlan(tvSnap, pk);
    if (have < need) {
      const line = enrichedItems.find((l) => {
        const cat = l.catalogItemId && catalog[l.catalogItemId] ? catalog[l.catalogItemId] : null;
        const pkLine = normalizePlanKey(l.tvPlanKey || cat?.tvPlanKey || '');
        return (l.tvLoginProduct || cat?.tvLoginProduct) && pkLine === pk;
      });
      const cat = line?.catalogItemId && catalog[line.catalogItemId] ? catalog[line.catalogItemId] : null;
      const lineName = line?.name || cat?.name || 'este plano';
      return {
        ok: false,
        code: 'tv_unavailable',
        userMessage: customerMessageTvUnavailable(lineName, minutes)
      };
    }
  }

  for (const line of enrichedItems) {
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    const cat = line.catalogItemId && catalog[line.catalogItemId] ? catalog[line.catalogItemId] : null;
    const planKey = normalizePlanKey(line.tvPlanKey || cat?.tvPlanKey || '');
    const tvLine = !!(line.tvLoginProduct || cat?.tvLoginProduct) && !!planKey;
    if (tvLine) continue;

    const lineName = line.name || cat?.name || 'este item';
    if (cat) {
      const sq = parseInt(cat.stockQuantity, 10);
      if (Number.isFinite(sq) && sq < qty) {
        return {
          ok: false,
          code: 'out_of_stock',
          userMessage: customerMessageOutOfStock(lineName)
        };
      }
    }
  }

  return { ok: true };
}

function findTvLoginReservedForOrder(snap, planKeyNorm, orderId) {
  let picked = null;
  if (!snap || !snap.exists() || !orderId) return null;
  snap.forEach((child) => {
    if (picked) return;
    const item = child.val() || {};
    if (item.status !== 'reserved' || item.reservedOrderId !== orderId) return;
    if (!item.login || !item.password) return;
    const rowKey = normalizePlanKey(item.planKey || item.planName || '');
    if (rowKey && planKeyNorm && rowKey === planKeyNorm) {
      picked = { id: child.key, ...item };
    }
  });
  return picked;
}

async function appendTvLoginHistory(masterUserId, tvLoginId, entry) {
  try {
    const ref = db.ref(`users/data/${masterUserId}/tv_logins/${tvLoginId}/history`);
    const snap = await ref.once('value');
    let arr = snap.val();
    if (!Array.isArray(arr)) arr = [];
    arr.push({ ...entry, at: entry.at || new Date().toISOString() });
    await ref.set(arr.slice(-50));
  } catch (e) {
    console.error('❌ [TV LOGIN] appendTvLoginHistory:', e.message);
  }
}

async function releaseTvReservationsForOrder(userId, orderId) {
  if (!userId || !orderId) return;
  const snap = await db.ref(`users/data/${userId}/tv_logins`).once('value');
  if (!snap.exists()) return;
  const tasks = [];
  snap.forEach((child) => {
    const item = child.val() || {};
    if (item.status === 'reserved' && item.reservedOrderId === orderId) {
      const id = child.key;
      tasks.push(
        db.ref(`users/data/${userId}/tv_logins/${id}`).update({
          status: 'available',
          reservedOrderId: null,
          reservedUntil: null,
          updatedAt: new Date().toISOString()
        })
      );
      tasks.push(
        appendTvLoginHistory(userId, id, { event: 'reservation_released', orderId })
      );
    }
  });
  await Promise.all(tasks);
}

async function reserveTvLoginsForCheckoutOrder(userId, orderId, enrichedItems) {
  if (!userId || !orderId || !Array.isArray(enrichedItems)) return;
  for (const line of enrichedItems) {
    if (!line.tvLoginProduct || !line.tvPlanKey) continue;
    const planKeyNorm = normalizePlanKey(line.tvPlanKey);
    if (!planKeyNorm) continue;
    const snap = await db.ref(`users/data/${userId}/tv_logins`).once('value');
    const login = findAvailableTvLoginRecord(snap, planKeyNorm);
    if (!login) {
      console.log('⚠️ [TV] Sem estoque para reservar:', planKeyNorm);
      continue;
    }
    const until = new Date(Date.now() + getTvReservationMinutes() * 60 * 1000).toISOString();
    await db.ref(`users/data/${userId}/tv_logins/${login.id}`).update({
      status: 'reserved',
      reservedOrderId: orderId,
      reservedUntil: until,
      updatedAt: new Date().toISOString()
    });
    await appendTvLoginHistory(userId, login.id, {
      event: 'reserved',
      orderId,
      reservedUntil: until
    });
  }
}

async function markTvLoginAllocated(masterUserId, tvLoginId, patch) {
  const soldAt = new Date().toISOString();
  await db.ref(`users/data/${masterUserId}/tv_logins/${tvLoginId}`).update({
    status: 'sold',
    soldAt,
    reservedOrderId: null,
    reservedUntil: null,
    ...patch,
    updatedAt: soldAt
  });
  await appendTvLoginHistory(masterUserId, tvLoginId, {
    event: 'sold',
    soldOrderId: patch.soldOrderId || null,
    at: soldAt
  });
}

async function sendTvLoginWhatsApp(masterUserId, customerPhone, text) {
  if (!customerPhone || !text) return;
  const client = activeClients.get(masterUserId);
  if (!client) {
    console.log('⚠️ [TV LOGIN] WPP offline — não foi possível enviar credenciais agora.');
    return;
  }
  try {
    await client.sendText(customerPhone, text);
  } catch (e) {
    console.error('❌ [TV LOGIN] Erro ao enviar WhatsApp:', e.message);
  }
}

async function saveTvMessageToConversation(masterUserId, customerPhone, body) {
  try {
    const sanitized = sanitizePhoneNumber(customerPhone);
    const msgRef = conversationMessagesRef(masterUserId, sanitized).push();
    await msgRef.set({
      from: '',
      to: customerPhone,
      body,
      timestamp: new Date().toISOString(),
      type: 'tv_credentials',
      isFromMe: true
    });
  } catch (e) {
    console.error('❌ [TV LOGIN] Erro ao salvar mensagem no histórico:', e.message);
  }
}

async function deliverTvLoginsForPaidOrder(sellerUserId, orderId, orderData) {
  try {
    if (!sellerUserId || !orderId || !orderData?.items || !Array.isArray(orderData.items)) return;
    const phone = orderData.customer?.phone || orderData.customer?.mobilePhone;
    if (!phone) return;

    const { tvAppDownloadUrl } = await getAssistantPaymentExtras(sellerUserId);
    const loginsSnap = await db.ref(`users/data/${sellerUserId}/tv_logins`).once('value');
    for (const line of orderData.items) {
      if (!line.tvLoginProduct || !line.tvPlanKey) continue;
      const planKeyNorm = normalizePlanKey(line.tvPlanKey);
      if (!planKeyNorm) continue;
      const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
      for (let i = 0; i < qty; i++) {
        const freshSnap = await db.ref(`users/data/${sellerUserId}/tv_logins`).once('value');
        let login =
          findTvLoginReservedForOrder(freshSnap, planKeyNorm, orderId) ||
          findAvailableTvLoginRecord(freshSnap, planKeyNorm);
        if (!login) {
          console.error('❌ [TV LOGIN] Sem estoque para plano:', planKeyNorm);
          await sendTvLoginWhatsApp(
            sellerUserId,
            phone,
            `⚠️ Pagamento confirmado, mas não há login disponível no estoque para o plano (${line.name}). Nossa equipe vai te atender em instantes.`
          );
          continue;
        }
        await markTvLoginAllocated(sellerUserId, login.id, {
          soldOrderId: orderId,
          soldToPhone: phone,
          soldItemName: line.name || null,
          deliveryChannel: 'order_paid'
        });
        let msg =
          `✅ *Pagamento confirmado!*\n\n` +
          `📺 *Acesso Wplay*\n` +
          `Plano: ${login.planName || line.name || '—'}\n` +
          `Login: ${login.login}\n` +
          `Senha: ${login.password}\n\n` +
          `_Guarde estes dados com segurança. Em caso de renovação mensal, seu acesso permanece ativo enquanto a assinatura estiver em dia._`;
        msg = appendTvAppDownloadFooter(msg, tvAppDownloadUrl);
        await sendTvLoginWhatsApp(sellerUserId, phone, msg);
        await saveTvMessageToConversation(sellerUserId, phone, msg);
      }
    }
  } catch (error) {
    console.error('❌ [TV LOGIN] Erro na entrega (pedido):', error.message);
  }
}

async function sendTvSubscriptionRenewalMessage(masterUserId, customerPhone, planName) {
  const text =
    `✅ *Mensalidade confirmada!*\n\n` +
    `Seu acesso *${planName || 'Wplay'}* continua ativo.\n` +
    `_Os mesmos login e senha enviados na primeira compra permanecem válidos._`;
  await sendTvLoginWhatsApp(masterUserId, customerPhone, text);
  await saveTvMessageToConversation(masterUserId, customerPhone, text);
}

async function handleTvSubscriptionStripeInvoice({ buyerUserId, subscriptionKey, subData, invoice }) {
  try {
    const planId = subData?.planId;
    if (!planId || !invoice) return;

    const planSnap = await db.ref(`plans/${planId}`).once('value');
    const plan = planSnap.val();
    if (!plan?.tvLoginProduct || !plan.tvPlanKey) return;

    const sellerUid = plan.ownerUid;
    if (!sellerUid) {
      console.error('❌ [TV LOGIN] Plano sem ownerUid (vendedor). Configure o plano no painel.');
      return;
    }

    const phone =
      subData.customer?.phone ||
      subData.customer?.mobilePhone ||
      subData.customer?.originalPhone ||
      '';
    if (!phone) {
      console.error('❌ [TV LOGIN] Assinatura sem telefone do cliente.');
      return;
    }

    const billingReason = invoice.billing_reason || '';
    const planKeyNorm = normalizePlanKey(plan.tvPlanKey);

    if (billingReason === 'subscription_cycle') {
      await sendTvSubscriptionRenewalMessage(sellerUid, phone, plan.name);
      return;
    }

    const subRef = db.ref(`subscriptions/${buyerUserId}/${subscriptionKey}`);
    const subFresh = (await subRef.once('value')).val() || {};
    if (subFresh.tvCredentialsDelivered) {
      return;
    }

    const { tvAppDownloadUrl } = await getAssistantPaymentExtras(sellerUid);
    const loginsSnap = await db.ref(`users/data/${sellerUid}/tv_logins`).once('value');
    const login = findAvailableTvLoginRecord(loginsSnap, planKeyNorm);
    if (!login) {
      console.error('❌ [TV LOGIN] Sem estoque TV para assinatura, plano:', planKeyNorm);
      await sendTvLoginWhatsApp(
        sellerUid,
        phone,
        `⚠️ Pagamento recebido, mas não há login disponível no estoque (${plan.name}). Entraremos em contato.`
      );
      return;
    }

    const stripeSubId = subData.stripeSubscriptionId || invoice.subscription || null;
    await markTvLoginAllocated(sellerUid, login.id, {
      soldToPhone: phone,
      soldItemName: plan.name || null,
      stripeSubscriptionId: stripeSubId,
      buyerUserId,
      deliveryChannel: 'subscription_first_invoice',
      recurring: true
    });

    await subRef.update({
      tvCredentialsDelivered: true,
      tvLoginId: login.id,
      tvCredentialsDeliveredAt: new Date().toISOString()
    });

    let msg =
      `✅ *Assinatura ativa!*\n\n` +
      `📺 *Acesso Wplay — ${plan.name}*\n` +
      `Login: ${login.login}\n` +
      `Senha: ${login.password}\n\n` +
      `_Cobrança recorrente mensal: a cada pagamento confirmado você recebe confirmação; os dados de acesso são os mesmos._`;
    msg = appendTvAppDownloadFooter(msg, tvAppDownloadUrl);
    await sendTvLoginWhatsApp(sellerUid, phone, msg);
    await saveTvMessageToConversation(sellerUid, phone, msg);
  } catch (error) {
    console.error('❌ [TV LOGIN] Erro na entrega (assinatura):', error.message);
  }
}

// Função para criar sessão de checkout no Stripe
async function createStripeCheckoutSession(stripeApiKey, customerData, items, userId, successUrl, cancelUrl, metadata = {}) {
  try {
    const stripe = new Stripe(stripeApiKey, { apiVersion: '2023-10-16' });
    const lineItems = items.map(item => {
      const price = item.price !== null && item.price !== undefined ? parseFloat(item.price) : null;
      if (price === null || Number.isNaN(price)) {
        throw new Error(`Item sem preço: ${item.name}`);
      }
      const currency = stripeCurrencyCode(item.currency);
      return {
        price_data: {
          currency,
          product_data: {
            name: item.name,
            ...(item.description ? { description: item.description } : {})
          },
          unit_amount: Math.round(price * 100)
        },
        quantity: item.quantity || 1
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerData?.email || undefined,
      locale: 'pt-BR',
      metadata: {
        userId: userId || '',
        phone: customerData?.originalPhone || customerData?.phone || '',
        ...metadata
      }
    });

    const totalValue = items.reduce((sum, item) => {
      const price = item.price !== null && item.price !== undefined ? parseFloat(item.price) : 0;
      return sum + (price * (item.quantity || 1));
    }, 0);

    const firstCur = items[0]?.currency ? stripeCurrencyCode(items[0].currency) : 'brl';
    return {
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      value: totalValue,
      currency: firstCur
    };
  } catch (error) {
    console.error('❌ Erro ao criar sessão Stripe:', error.message);
    return { success: false, error: error.message };
  }
}

async function createStripeSubscriptionCheckoutSession(stripeApiKey, customerData, planData, userId, successUrl, cancelUrl) {
  try {
    const stripe = new Stripe(stripeApiKey, { apiVersion: '2023-10-16' });
    const amount = Math.round(parseFloat(planData.price || 0) * 100);
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      throw new Error('Valor do plano inválido para assinatura Stripe');
    }

    const interval = planData.billingCycle === 'yearly' ? 'year' : 'month';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerData?.email || undefined,
      locale: 'pt-BR',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            recurring: { interval },
            product_data: {
              name: planData.name || 'Plano de Assinatura'
            },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      metadata: {
        userId: userId || '',
        planId: planData?.id || '',
        planName: planData?.name || '',
        billingCycle: planData?.billingCycle || 'monthly',
        tvLoginProduct: planData?.tvLoginProduct ? '1' : '0',
        tvPlanKey: planData?.tvPlanKey ? normalizePlanKey(planData.tvPlanKey) : ''
      }
    });

    return {
      success: true,
      subscriptionId: session.subscription || null,
      stripeSessionId: session.id,
      invoiceUrl: session.url,
      value: parseFloat(planData.price || 0),
      cycle: interval === 'year' ? 'YEARLY' : 'MONTHLY',
      nextDueDate: null
    };
  } catch (error) {
    console.error('❌ Erro ao criar assinatura Stripe:', error.message);
    return { success: false, error: error.message };
  }
}

/** Texto antes do link Stripe + URL do app (pós-pagamento TV), em assistant_settings */
async function getAssistantPaymentExtras(userId) {
  try {
    const snap = await db.ref(`users/data/${userId}/assistant_settings`).once('value');
    const s = snap.val() || {};
    const messageBeforePaymentLink = String(
      s.messageBeforePaymentLink || s.paymentStripeMessage || ''
    ).trim();
    const tvAppDownloadUrl = String(s.tvAppDownloadUrl || '').trim();
    return { messageBeforePaymentLink, tvAppDownloadUrl };
  } catch (e) {
    return { messageBeforePaymentLink: '', tvAppDownloadUrl: '' };
  }
}

function appendTvAppDownloadFooter(text, appUrl) {
  if (!text || !String(appUrl || '').trim()) return text;
  const u = String(appUrl).trim();
  return `${text}\n\n📲 *Download do app*\n${u}`;
}

// 🎯 Função para tentar gerar link automático do Stripe quando houver intenção de compra
async function tryAutoGenerateStripeLink(userId, phone, sanitizedNumber) {
  try {
    const client = activeClients.get(userId);
    if (!client) return;

    const integrations = await getIntegrationsConfig(userId);
    const stripeApiKey = integrations?.stripeApiKey || null;
    if (!stripeApiKey) {
      await client.sendText(phone, 'Integração Stripe não configurada. Aguarde contato para envio do link.');
      return;
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!successUrl || !cancelUrl) {
      await client.sendText(phone, 'Configuração do Stripe incompleta. Aguarde contato para envio do link.');
      return;
    }

    const messagesSnapshot = await conversationMessagesRef(userId, sanitizedNumber)
      .orderByChild('timestamp')
      .limitToLast(15)
      .once('value');

    if (!messagesSnapshot.exists()) return;

    const products = await resolveProductsForStripeMatching(userId);
    if (!products.length) {
      console.warn('⚠️ [Stripe] Nenhum item em products/ nem catalog_items para userId:', userId);
      await client.sendText(phone, 'Para finalizar a compra, preciso de um item com preço definido.');
      return;
    }

    // Uma única linha no checkout: última menção ao produto nas mensagens recentes vence.
    let lastMentionedProduct = null;
    messagesSnapshot.forEach((messageSnap) => {
      const msg = messageSnap.val();
      const raw = msg.body ? String(msg.body) : '';
      if (!raw.trim()) return;
      for (const product of products) {
        if (messageMentionsProduct(raw, product.name)) {
          lastMentionedProduct = product;
        }
      }
    });

    if (!lastMentionedProduct) {
      const combined = [];
      messagesSnapshot.forEach((messageSnap) => {
        const b = messageSnap.val()?.body;
        if (b) combined.push(String(b));
      });
      const blob = combined.join('\n');
      for (const product of products) {
        if (messageMentionsProduct(blob, product.name)) {
          lastMentionedProduct = product;
          break;
        }
      }
    }

    if (!lastMentionedProduct) {
      console.warn('⚠️ [Stripe] Nenhum produto do catálogo citado nas últimas mensagens. Produtos:', products.map((p) => p.name));
      await client.sendText(phone, 'Para finalizar a compra, preciso de um item com preço definido.');
      return;
    }

    lastMentionedProduct = await mergeProductPriceFromCatalog(userId, lastMentionedProduct);

    if (!hasValidCatalogPrice(lastMentionedProduct?.price)) {
      console.warn('⚠️ [Stripe] Produto sem preço em products/ e catalog_items:', lastMentionedProduct?.name);
      await client.sendText(phone, 'Para finalizar a compra, preciso de um item com preço definido.');
      return;
    }

    const orderItems = [{
      name: lastMentionedProduct.name,
      price: lastMentionedProduct.price,
      currency: lastMentionedProduct.currency || 'BRL',
      quantity: 1,
      description: lastMentionedProduct.description,
      catalogItemId: lastMentionedProduct.id,
      tvLoginProduct: !!lastMentionedProduct.tvLoginProduct,
      tvPlanKey: normalizePlanKey(lastMentionedProduct.tvPlanKey || lastMentionedProduct.planName || '')
    }];

    const enrichedOrderItems = await enrichOrderItemsWithCatalog(userId, orderItems);

    const stockCheck = await assertCheckoutAvailability(userId, enrichedOrderItems);
    if (!stockCheck.ok) {
      await client.sendText(phone, stockCheck.userMessage);
      return;
    }

    const customerDataRef = db.ref(`customerData/${userId}/${phone.replace(/[^0-9]/g, '')}`);
    const customerSnapshot = await customerDataRef.once('value');
    const savedCustomerData = customerSnapshot.val();

    const customerData = {
      name: savedCustomerData?.name || 'Cliente WhatsApp',
      email: savedCustomerData?.email || undefined,
      originalPhone: phone
    };

    const orderRef = db.ref(`orders/${userId}`).push();
    const orderId = orderRef.key;
    const result = await createStripeCheckoutSession(
      stripeApiKey,
      customerData,
      enrichedOrderItems,
      userId,
      successUrl,
      cancelUrl,
      { orderId }
    );

    if (!result.success) {
      console.error('❌ Stripe checkout (auto):', result.error || 'erro desconhecido');
      await client.sendText(
        phone,
        'Não foi possível gerar o link de pagamento agora. Confirme se o Stripe está configurado no painel e se o servidor tem STRIPE_SUCCESS_URL e STRIPE_CANCEL_URL. Tente novamente em instantes.'
      );
      return;
    }

    await orderRef.set({
      orderId: orderId,
      stripeSessionId: result.sessionId,
      customer: {
        name: customerData.name || 'Cliente',
        phone: customerData.originalPhone || customerData.phone,
        ...(customerData.email && { email: customerData.email })
      },
      items: enrichedOrderItems,
      totalValue: result.value,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paymentUrl: result.checkoutUrl,
      paymentProvider: 'stripe'
    });

    try {
      await reserveTvLoginsForCheckoutOrder(userId, orderId, enrichedOrderItems);
    } catch (e) {
      console.error('❌ [TV] Reserva pós-checkout:', e.message);
    }

    const { messageBeforePaymentLink } = await getAssistantPaymentExtras(userId);
    if (messageBeforePaymentLink) {
      await client.sendText(phone, messageBeforePaymentLink);
      const preRef = conversationMessagesRef(userId, sanitizedNumber).push();
      await preRef.set({
        from: '',
        to: phone,
        body: messageBeforePaymentLink,
        timestamp: new Date().toISOString(),
        type: 'payment_preface',
        isFromMe: true
      });
    }

    const totalCur = enrichedOrderItems[0]?.currency || 'BRL';
    const totalFmt = formatCatalogPriceForMessage(result.value, totalCur) || String(result.value);
    const paymentMessage = `✅ *Pedido Criado!*\n\n` +
      `📦 Itens:\n` +
      enrichedOrderItems.map((item) => {
        const line = formatCatalogPriceForMessage(item.price, item.currency);
        return `• ${item.quantity}x ${item.name} - ${line || parseFloat(item.price).toFixed(2)}`;
      }).join('\n') +
      `\n\n💰 *Total: ${totalFmt}*\n\n` +
      `🔗 *Link de Pagamento (Stripe):*\n${result.checkoutUrl}`;

    await client.sendText(phone, paymentMessage);

    const paymentMsgRef = conversationMessagesRef(userId, sanitizedNumber).push();
    await paymentMsgRef.set({
      from: '',
      to: phone,
      body: paymentMessage,
      timestamp: new Date().toISOString(),
      type: 'payment_link',
      isFromMe: true,
      stripeSessionId: result.sessionId,
      orderId: orderId
    });
  } catch (error) {
    console.error('❌ Erro ao gerar link Stripe:', error);
  }
}

// Função para verificar se usuário tem plano ativo
async function getUserActivePlan(userId) {
  try {
    const activePlanSnapshot = await db.ref(`users/data/${userId}/activePlan`).once('value');
    const activePlan = activePlanSnapshot.val();
    
    if (!activePlan) {
      return null;
    }
    
    // Verificar se o plano ainda está ativo (não expirou)
    const now = new Date();
    const nextDueDate = new Date(activePlan.nextDueDate);
    
    if (nextDueDate < now) {
      console.log('⚠️ [PLANO] Plano expirado para usuário:', userId);
      // Marcar plano como expirado
      await db.ref(`users/data/${userId}/activePlan`).update({ status: 'expired' });
      return null;
    }
    
    return activePlan;
  } catch (error) {
    console.error('❌ Erro ao verificar plano do usuário:', error);
    return null;
  }
}

// Função para verificar limites do plano antes de enviar mensagem
async function checkPlanLimits(userId, limitType = 'messagesPerMonth') {
  try {
    const activePlan = await getUserActivePlan(userId);
    
    // Se não tiver plano ativo, verificar se é master
    if (!activePlan) {
      const userSnapshot = await db.ref(`users/registered`).once('value');
      const users = userSnapshot.val() || {};
      const userEntry = Object.values(users).find(u => u.uid === userId);
      
      // Master não tem limites
      if (userEntry && userEntry.isMaster) {
        return { allowed: true, message: null };
      }
      
      // Usuário sem plano - bloquear tudo
      return {
        allowed: false,
        message: 'Você precisa de um plano ativo para usar esta funcionalidade. Acesse o dashboard para contratar um plano.'
      };
    }
    
    // Verificar limites do plano
    const limits = activePlan.limits || {};
    const limit = limits[limitType];
    
    // Se limit for null ou -1, é ilimitado
    if (limit === null || limit === -1) {
      return { allowed: true, message: null, planInfo: activePlan };
    }
    
    // Verificar uso atual (ajustar conforme necessário)
    const usageKey = `${limitType}Usage`;
    const currentUsageSnapshot = await db.ref(`users/data/${userId}/${usageKey}`).once('value');
    const currentUsage = currentUsageSnapshot.val() || 0;
    
    if (currentUsage >= limit) {
      return {
        allowed: false,
        message: `Limite de ${limitType === 'messagesPerMonth' ? 'mensagens mensais' : 'conversas'} atingido. Contrate um plano superior ou aguarde a renovação.`,
        planInfo: activePlan,
        usage: currentUsage,
        limit: limit
      };
    }
    
    return {
      allowed: true,
      message: null,
      planInfo: activePlan,
      usage: currentUsage,
      limit: limit
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar limites:', error);
    return { allowed: true, message: null }; // Em caso de erro, permitir
  }
}

// Função para incrementar uso de mensagens
async function incrementMessageUsage(userId) {
  try {
    const activePlan = await getUserActivePlan(userId);
    
    if (!activePlan) {
      return; // Usuário sem plano
    }
    
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const usageRef = db.ref(`users/data/${userId}/messagesUsage/${monthKey}`);
    
    const usageSnapshot = await usageRef.once('value');
    const currentCount = usageSnapshot.val() || 0;
    
    await usageRef.set(currentCount + 1);
    
    console.log(`📊 [USAGE] Mensagem incrementada. Total do mês: ${currentCount + 1}`);
  } catch (error) {
    console.error('❌ Erro ao incrementar uso:', error);
  }
}

// ============================================
// FUNÇÕES DE NOTA FISCAL
// ============================================

// Função para emitir Nota Fiscal no Asaas
// Função para atualizar cadastro do cliente no Asaas com endereço
async function updateAsaasCustomerAddress(asaasApiKey, customerId, customerData) {
  try {
    if (!ENABLE_ASAAS_LEGACY) {
      return { success: false, error: 'Asaas legado desabilitado' };
    }
    console.log('📝 [ASAAS] Atualizando cadastro do cliente no Asaas...');
    console.log('   Customer ID:', customerId);
    
    if (!customerData.address) {
      console.log('⚠️ [ASAAS] Cliente não tem endereço para atualizar');
      return { success: false, error: 'Sem endereço' };
    }
    
    // Detectar ambiente
    const isProductionKey = asaasApiKey.includes('_prod_');
    const asaasEnv = isProductionKey ? 'production' : 'sandbox';
    const asaasUrl = asaasEnv === 'production' 
      ? `https://api.asaas.com/v3/customers/${customerId}`
      : `https://sandbox.asaas.com/api/v3/customers/${customerId}`;
    
    // Limpar telefone e remover "55" inicial se presente
    let cleanPhone = customerData.phone?.replace(/[@c.us]/g, '').replace(/\D/g, '') || '';
    
    // REGRA: Se começa com 55, remover esses 2 dígitos
    if (cleanPhone.startsWith('55') && cleanPhone.length > 10) {
      console.log('📞 [ASAAS] Telefone original:', cleanPhone);
      cleanPhone = cleanPhone.substring(2); // Remove "55"
      console.log('📞 [ASAAS] Telefone sem 55:', cleanPhone);
    }
    
    const updateData = {
      name: customerData.name,
      cpfCnpj: customerData.cpfCnpj,
      email: customerData.email,
      phone: cleanPhone,
      mobilePhone: cleanPhone,
      postalCode: customerData.address.zipCode?.replace(/\D/g, ''),
      address: customerData.address.street,
      addressNumber: customerData.address.number,
      complement: customerData.address.complement || '',
      province: customerData.address.neighborhood,
      // O Asaas não aceita cityName, precisa do ID da cidade
      // Por ora vamos enviar os dados principais
    };
    
    console.log('📍 [ASAAS] Dados do endereço que será enviado:');
    console.log('   - CEP:', updateData.postalCode);
    console.log('   - Rua:', updateData.address);
    console.log('   - Número:', updateData.addressNumber);
    console.log('   - Complemento:', updateData.complement);
    console.log('   - Bairro:', updateData.province);
    
    const response = await axios.put(asaasUrl, updateData, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ [ASAAS] Cliente atualizado com sucesso no Asaas!');
    console.log('   ID:', response.data.id);
    console.log('   Nome:', response.data.name);
    console.log('   CEP:', response.data.postalCode);
    
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('❌ [ASAAS] Erro ao atualizar cliente:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

async function emitirNotaFiscal(userId, orderId, orderData, payment) {
  try {
    if (!ENABLE_ASAAS_LEGACY) {
      return { success: false, error: 'Emissão via Asaas desabilitada' };
    }
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
    
    // 2. Verificar se emissão de NF está habilitada
    // Verificar primeiro em integrations (fiscalEnabled)
    let nfEnabled = false;
    
    if (integrations && integrations.fiscalEnabled === true) {
      nfEnabled = true;
      console.log('✅ [NF] Emissão habilitada via integrations.fiscalEnabled');
    } else {
      // Se não encontrar em integrations, tentar fiscal_config (formato antigo)
      const fiscalConfigRef = db.ref(`users/data/${userId}/fiscal_config`);
      const fiscalConfigSnapshot = await fiscalConfigRef.once('value');
      const fiscalConfig = fiscalConfigSnapshot.val();
      
      if (fiscalConfig && fiscalConfig.enabled === true) {
        nfEnabled = true;
        console.log('✅ [NF] Emissão habilitada via fiscal_config.enabled');
      }
    }
    
    if (!nfEnabled) {
      console.log('⚠️ [NF] Emissão de nota fiscal não está habilitada');
      console.log('   Dica: Habilite em Integrações > Nota Fiscal > fiscalEnabled: true');
      return { success: false, error: 'Emissão de NF não habilitada' };
    }
    
    console.log('✅ [NF] Emissão de nota fiscal está HABILITADA!');
    
    // 3. Buscar configurações fiscais completas (taxas, etc)
    const fiscalConfigRef = db.ref(`users/data/${userId}/fiscal_config`);
    const fiscalConfigSnapshot = await fiscalConfigRef.once('value');
    const fiscalConfig = fiscalConfigSnapshot.val() || {
      // Valores padrão se não houver configuração
      retainIss: false,
      issRate: 0,
      cofinsRate: 0,
      csllRate: 0,
      inssRate: 0,
      irRate: 0,
      pisRate: 0,
      deductions: 0,
      observations: 'Nota fiscal emitida automaticamente'
    };
    
    console.log('✅ [NF] Configurações fiscais carregadas');
    
    // 4. BUSCAR DADOS ATUALIZADOS DO CLIENTE DO FIREBASE
    console.log('📊 [NF] Buscando dados atualizados do cliente...');
    console.log('   orderData.customer:', JSON.stringify(orderData.customer, null, 2));
    
    const customerPhone = orderData.customer?.phone || orderData.customer?.mobilePhone;
    console.log('   customerPhone original:', customerPhone);
    
    const sanitizedPhone = customerPhone?.replace(/[@c.us]/g, '').replace(/\D/g, '');
    console.log('   sanitizedPhone:', sanitizedPhone);
    
    let customerData = orderData.customer; // Dados padrão do pedido
    
    if (sanitizedPhone) {
      const customerPath = `customerData/${userId}/${sanitizedPhone}`;
      console.log('   Caminho do Firebase:', customerPath);
      
      const customerRef = db.ref(customerPath);
      const customerSnapshot = await customerRef.once('value');
      const freshCustomerData = customerSnapshot.val();
      
      console.log('   Dados encontrados no Firebase?', !!freshCustomerData);
      
      if (freshCustomerData) {
        console.log('✅ [NF] Dados frescos do cliente encontrados no Firebase');
        console.log('   - Nome:', freshCustomerData.name);
        console.log('   - Email:', freshCustomerData.email);
        console.log('   - CPF/CNPJ:', freshCustomerData.cpfCnpj);
        console.log('   - Endereço existe?', !!freshCustomerData.address);
        
        if (freshCustomerData.address) {
          console.log('📍 [NF] Dados do endereço:');
          console.log('   - Rua:', freshCustomerData.address.street);
          console.log('   - Número:', freshCustomerData.address.number);
          console.log('   - Bairro:', freshCustomerData.address.neighborhood);
          console.log('   - Cidade:', freshCustomerData.address.city);
          console.log('   - Estado:', freshCustomerData.address.state);
          console.log('   - CEP:', freshCustomerData.address.zipCode);
        } else {
          console.log('⚠️ [NF] Endereço NÃO encontrado nos dados frescos do cliente!');
        }
        
        // Usar dados frescos ao invés dos dados antigos do pedido
        customerData = freshCustomerData;
      } else {
        console.log('⚠️ [NF] Dados frescos não encontrados no caminho padrão');
        console.log('   Tentando caminhos alternativos...');
        
        // Tentar sem sanitização
        const altPhone = customerPhone?.replace(/[@c.us]/g, '');
        if (altPhone && altPhone !== sanitizedPhone) {
          console.log('   Tentando com:', altPhone);
          const altRef = db.ref(`customerData/${userId}/${altPhone}`);
          const altSnapshot = await altRef.once('value');
          const altData = altSnapshot.val();
          
          if (altData) {
            console.log('✅ [NF] Dados encontrados no caminho alternativo!');
            customerData = altData;
          }
        }
        
        if (!customerData.address) {
          console.log('⚠️ [NF] NENHUM endereço encontrado - usando dados do pedido sem endereço');
        }
      }
    } else {
      console.log('⚠️ [NF] Telefone não disponível para buscar dados');
    }
    
    console.log('📊 [NF] customerData final (que será usado):');
    console.log('   - Nome:', customerData?.name);
    console.log('   - Email:', customerData?.email);
    console.log('   - CPF:', customerData?.cpfCnpj);
    console.log('   - Telefone:', customerData?.phone);
    console.log('   - Tem endereço?', !!customerData?.address);
    console.log('   - Tipo do endereço:', typeof customerData?.address);
    
    if (customerData?.address) {
      console.log('   - Endereço completo:', JSON.stringify(customerData.address, null, 2));
      
      // VERIFICAR SE ENDEREÇO É STRING (ERRO!)
      if (typeof customerData.address === 'string') {
        console.log('⚠️ [NF] ALERTA CRÍTICO: Endereço é STRING ao invés de OBJETO!');
        console.log('   String atual:', customerData.address);
        console.log('   Isso vai causar falha na verificação de endereço completo!');
        console.log('   ⛔ ENDEREÇO PRECISA SER OBJETO: { street, number, zipCode, ... }');
      }
    }
    
    // 4.5. ATUALIZAR CADASTRO DO CLIENTE NO ASAAS COM ENDEREÇO
    if (customerData?.address && 
        customerData.address.zipCode && 
        customerData.address.street && 
        customerData.address.number) {
      
      console.log('📝 [NF] Cliente tem endereço COMPLETO - atualizando cadastro no Asaas...');
      const updateResult = await updateAsaasCustomerAddress(asaasApiKey, payment.customer, customerData);
      
      if (updateResult.success) {
        console.log('✅ [NF] Cadastro do cliente atualizado no Asaas com sucesso!');
      } else {
        console.log('⚠️ [NF] Não foi possível atualizar cadastro do cliente no Asaas');
        console.log('   Erro:', updateResult.error);
        console.log('   Tentando emitir NF mesmo assim...');
      }
    } else {
      console.log('⚠️ [NF] Cliente NÃO tem endereço completo - pulando atualização no Asaas');
      console.log('   ⛔ A EMISSÃO DA NF VAI FALHAR SEM ENDEREÇO!');
      console.log('   ⛔ Endereço atual:', JSON.stringify(customerData?.address || 'NENHUM', null, 2));
    }
    
    // 5. Preparar dados da nota fiscal
    const serviceDescription = orderData.items.map(item => 
      `${item.quantity}x ${item.name}${item.description ? ` - ${item.description}` : ''}`
    ).join(', ');
    
    const invoiceData = {
      customer: payment.customer, // ID do cliente no Asaas
      
      // ✅ CAMPO OBRIGATÓRIO: Nome do tomador (cliente)
      name: customerData?.name || customerData?.nomeCompleto || payment.customerName || 'Nome não informado',
      
      // ✅ CAMPO OBRIGATÓRIO: Código e descrição do serviço municipal
      municipalServiceCode: '101',
      municipalServiceDescription: 'Analise e desenvolvimento de sistemas',
      
      // Descrição do serviço
      serviceDescription: serviceDescription,
      
      // Valor da nota
      value: payment.value,
      
      // Dados do tomador (cliente) - CPF/CNPJ se houver
      cpfCnpj: customerData?.cpfCnpj || customerData?.cpf || null,
      email: customerData?.email || null,
      phone: customerData?.phone || null,
      
      // 📍 ENDEREÇO DO CLIENTE (obrigatório para emissão de NF)
      ...(customerData?.address && {
        postalCode: customerData.address.zipCode?.replace(/\D/g, ''),
        address: customerData.address.street,
        addressNumber: customerData.address.number,
        complement: customerData.address.complement || null,
        province: customerData.address.neighborhood,
        cityName: customerData.address.city
      }),
      
      // Deduções
      deductions: fiscalConfig.deductions || 0,
      
      // Data de competência (data de hoje)
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
      observations: fiscalConfig.observations || 'Nota fiscal emitida automaticamente via WhatsApp'
    };
    
    console.log('📝 [NF] Dados da nota fiscal preparados:');
    console.log('   - Nome cliente:', invoiceData.name);
    console.log('   - CPF/CNPJ:', invoiceData.cpfCnpj);
    console.log('   - Email:', invoiceData.email);
    console.log('   - Código serviço:', invoiceData.municipalServiceCode);
    console.log('   - Descrição municipal:', invoiceData.municipalServiceDescription);
    console.log('   - Valor:', invoiceData.value);
    
    // Log detalhado do endereço que será enviado
    if (invoiceData.postalCode) {
      console.log('📍 [NF] ENDEREÇO que será enviado para Asaas:');
      console.log('   - CEP (postalCode):', invoiceData.postalCode);
      console.log('   - Rua (address):', invoiceData.address);
      console.log('   - Número (addressNumber):', invoiceData.addressNumber);
      console.log('   - Complemento (complement):', invoiceData.complement);
      console.log('   - Bairro (province):', invoiceData.province);
      console.log('   - Cidade (cityName):', invoiceData.cityName);
    } else {
      console.log('⚠️ [NF] ATENÇÃO: Nenhum endereço será enviado para Asaas!');
      console.log('   Isso pode causar erro: "Endereço do cliente incompleto"');
    }
    
    // 6. Detectar ambiente automaticamente pela chave
    // Chaves de produção começam com $aact_prod_
    // Chaves de sandbox começam com $aact_ (sem prod)
    const isProductionKey = asaasApiKey.includes('_prod_');
    const asaasEnv = process.env.ASAAS_ENV || (isProductionKey ? 'production' : 'sandbox');
    
    const asaasUrl = asaasEnv === 'production' 
      ? 'https://api.asaas.com/v3/invoices'
      : 'https://sandbox.asaas.com/api/v3/invoices';
    
    console.log('🌐 [NF] Ambiente detectado:', asaasEnv, '(chave tipo:', isProductionKey ? 'PRODUÇÃO' : 'SANDBOX', ')');
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
    
    if (!response.data.number) {
      console.log('⚠️ [NF] ATENÇÃO: Número da NF é NULL!');
      console.log('   Isso geralmente indica que a NF não foi emitida completamente.');
      console.log('   Possíveis causas: endereço incompleto, CEP inválido, etc.');
    }
    
    // 7. Salvar dados da nota fiscal no Firebase
    const invoiceRef = db.ref(`invoices/${userId}/${orderId}`);
    await invoiceRef.set({
      invoiceId: response.data.id,
      invoiceNumber: response.data.number,
      orderId: orderId,
      chargeId: payment.id,
      customer: customerData, // Usar customerData com endereço atualizado
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
    
    // 7. Atualizar pedido com ID da nota fiscal
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

// Rota de teste / healthcheck
app.get('/', (req, res) => {
  console.log('🏥 Healthcheck recebido');
  res.json({
    status: 'online',
    service: 'WhatsApp IA Backend',
    version: '1.0.14-clean-sessions', // 🧹 Limpa sessões antigas no deploy
    activeSessions: activeClients.size,
    timestamp: new Date().toISOString()
  });
});

// Criar/Conectar sessão WhatsApp
app.post('/api/sessions/create', async (req, res) => {
  try {
    const { userId, forceReconnect } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }
    
    if (activeClients.has(userId)) {
      if (forceReconnect) {
        console.log(`🔄 [WPP] forceReconnect: fechando sessão existente de ${userId}`);
        await forceCloseWhatsAppSession(userId);
        await sleepMs(2000);
      } else {
        return res.json({ 
          status: 'already_active',
          message: 'Sessão já está ativa' 
        });
      }
    }
    
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
    
    await forceCloseWhatsAppSession(userId);
    await db.ref(`whatsapp_sessions/${userId}`).update({
      status: 'disconnected',
      lastActivity: new Date().toISOString(),
      qrCode: null,
      connectedWid: null,
      connectedLineKey: null
    });
    console.log('✅ Sessão desconectada:', userId);
    
    await sleepMs(500);
    
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
    
    // Verificar limites do plano
    const limitCheck = await checkPlanLimits(userId, 'messagesPerMonth');
    
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: limitCheck.message });
    }
    
    const client = activeClients.get(userId);
    if (!client) {
      return res.status(404).json({ error: 'Sessão não encontrada ou inativa' });
    }
    
    await client.sendText(to, message);
    
    // Incrementar contador de uso
    await incrementMessageUsage(userId);
    
    await bindWhatsAppLineKey(userId);
    // Salvar mensagem enviada (sanitizar número para Firebase)
    const sanitizedNumber = sanitizePhoneNumber(to);
    const messageRef = conversationMessagesRef(userId, sanitizedNumber).push();
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

// Enviar mensagem de áudio manualmente
app.post('/api/messages/send-audio', async (req, res) => {
  try {
    const { userId, to, text, language } = req.body;
    
    if (!userId || !to || !text) {
      return res.status(400).json({ error: 'userId, to e text são obrigatórios' });
    }
    
    // Verificar limites do plano
    const limitCheck = await checkPlanLimits(userId, 'messagesPerMonth');
    
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: limitCheck.message });
    }
    
    const client = activeClients.get(userId);
    if (!client) {
      return res.status(404).json({ error: 'Sessão não encontrada ou inativa' });
    }
    
    // Buscar configurações de áudio do usuário
    const aiConfigSnapshot = await db.ref(`users/data/${userId}/assistant_settings`).once('value');
    const aiConfig = aiConfigSnapshot.val() || {};
    
    const audioLanguage = language || aiConfig.audioLanguage || 'pt-BR';
    const audioVoice = aiConfig.audioVoice || null;
    
    // Gerar áudio a partir do texto
    const audioBuffer = await generateAudioFromText(text, audioLanguage, audioVoice);
    
    if (!audioBuffer) {
      return res.status(500).json({ error: 'Erro ao gerar áudio' });
    }
    
    // Salvar áudio temporariamente
    const tempDir = os.tmpdir();
    const tempAudioFile = path.join(tempDir, `audio_${Date.now()}_${userId}.mp3`);
    fs.writeFileSync(tempAudioFile, audioBuffer);
    
    try {
      // Enviar áudio como PTT (push-to-talk) - formato de áudio do WhatsApp
      try {
        // Tentar usar sendPtt se disponível
        if (client.sendPtt) {
          const audioBase64 = audioBuffer.toString('base64');
          await client.sendPtt(to, audioBase64);
          console.log(`✅ Áudio PTT enviado manualmente`);
        } else {
          // Fallback: usar sendFile
          await client.sendFile(to, tempAudioFile, 'audio.mp3', text);
          console.log(`✅ Áudio enviado via sendFile`);
        }
      } catch (sendError) {
        console.error('❌ Erro ao enviar áudio:', sendError.message);
        // Tentar fallback com sendFile
        await client.sendFile(to, tempAudioFile, 'audio.mp3', text);
      }
      
      // Incrementar contador de uso
      await incrementMessageUsage(userId);
      
      await bindWhatsAppLineKey(userId);
      // Salvar mensagem enviada (sanitizar número para Firebase)
      const sanitizedNumber = sanitizePhoneNumber(to);
      
      // Salvar áudio em Base64 para poder reproduzir depois
      let audioBase64 = null;
      if (audioBuffer) {
        audioBase64 = audioBuffer.toString('base64');
      }
      
      const messageRef = conversationMessagesRef(userId, sanitizedNumber).push();
      await messageRef.set({
        from: 'me',
        to: to,
        body: text,
        timestamp: new Date().toISOString(),
        type: 'ptt',
        isFromMe: true,
        manual: true,
        isAudio: true,
        audioBase64: audioBase64 || null
      });
      
      res.json({ 
        status: 'success',
        message: 'Áudio enviado com sucesso' 
      });
    } finally {
      // Limpar arquivo temporário
      if (fs.existsSync(tempAudioFile)) {
        fs.unlinkSync(tempAudioFile);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao enviar áudio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter conversas (lista alinhada ao WhatsApp conectado — não todo o arquivo em Firebase)
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const client = activeClients.get(userId);

    const buildFromFirebaseArchive = async () => {
      const { threads } = await loadConversationThreadsMap(userId);
      const conversations = [];
      Object.keys(threads).forEach((contactNumber) => {
        const data = threads[contactNumber];
        if (!data || typeof data !== 'object') return;
        let lastMessage = null;
        if (data.messages) {
          const messages = Object.values(data.messages);
          lastMessage = messages[messages.length - 1];
        }
        conversations.push({
          contactNumber,
          jid: null,
          displayName: null,
          lastMessage: lastMessage?.body || '',
          lastMessageTime: lastMessage?.timestamp || null,
          messageCount: data.messages ? Object.keys(data.messages).length : 0
        });
      });
      return conversations;
    };

    if (!client) {
      return res.json({
        conversations: [],
        source: 'no_session',
        message: 'WhatsApp não conectado ao servidor — conecte para ver as conversas desta conta.'
      });
    }

    let connected = false;
    try {
      connected = await client.isConnected();
    } catch (e) {
      console.warn('⚠️ [conversations] isConnected falhou:', e.message);
    }

    if (!connected) {
      return res.json({
        conversations: [],
        source: 'disconnected',
        message: 'Sessão WhatsApp inativa — reconecte no painel.'
      });
    }

    await bindWhatsAppLineKey(userId);

    let chats = [];
    try {
      if (typeof client.listChats === 'function') {
        try {
          chats = await client.listChats({ onlyUsers: true });
        } catch (e1) {
          console.warn('⚠️ listChats(onlyUsers) falhou, tentando listChats completo:', e1.message);
          chats = await client.listChats();
        }
      } else {
        chats = await client.getAllChats(false);
      }
    } catch (e) {
      console.error('❌ Erro listChats/getAllChats:', e.message);
      const fallback = await buildFromFirebaseArchive();
      return res.json({
        conversations: fallback,
        source: 'firebase_fallback',
        message: 'Não foi possível ler a lista do WhatsApp; exibindo histórico salvo no painel.'
      });
    }

    chats = (chats || []).filter((c) => {
      const jid = widSerializedFromChat(c);
      if (!jid || jid === 'status@broadcast') return false;
      if (jid.endsWith('@g.us')) return false;
      return true;
    });

    const { threads: fbData } = await loadConversationThreadsMap(userId);

    const conversations = [];
    for (const chat of chats) {
      const jid = widSerializedFromChat(chat);
      if (!jid) continue;
      const contactNumber = sanitizePhoneNumber(jid);
      const thread = fbData[contactNumber];
      let lastMessage = '';
      let lastMessageTime = null;
      let messageCount = 0;
      if (thread?.messages) {
        const msgs = Object.values(thread.messages);
        messageCount = msgs.length;
        const last = msgs[msgs.length - 1];
        lastMessage = last?.body || '';
        lastMessageTime = last?.timestamp || null;
      }
      const waPrev = previewFromWaLastMessage(chat.lastMessage);
      if (!lastMessage && waPrev.body) {
        lastMessage = waPrev.body;
        lastMessageTime = waPrev.ts || lastMessageTime;
      }
      const displayName =
        chat.name ||
        chat.pushname ||
        chat.formattedTitle ||
        chat.contact?.pushname ||
        chat.contact?.name ||
        null;
      conversations.push({
        contactNumber,
        jid,
        displayName,
        lastMessage,
        lastMessageTime,
        messageCount
      });
    }

    conversations.sort((a, b) => {
      const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return tb - ta;
    });

    res.json({ conversations, source: 'whatsapp' });
  } catch (error) {
    console.error('❌ Erro ao buscar conversas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter informações do plano do usuário
app.get('/api/user/plan/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const activePlan = await getUserActivePlan(userId);
    
    if (!activePlan) {
      // Verificar se é master
      const usersSnapshot = await db.ref('users/registered').once('value');
      const users = usersSnapshot.val() || {};
      const userEntry = Object.values(users).find(u => u.uid === userId);
      
      if (userEntry && userEntry.isMaster) {
        return res.json({
          hasActivePlan: true,
          isMaster: true,
          message: 'Usuário master - sem limites'
        });
      }
      
      return res.json({
        hasActivePlan: false,
        message: 'Nenhum plano ativo'
      });
    }
    
    // Buscar uso atual
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const usageSnapshot = await db.ref(`users/data/${userId}/messagesUsage/${monthKey}`).once('value');
    const currentUsage = usageSnapshot.val() || 0;
    
    res.json({
      hasActivePlan: true,
      plan: activePlan,
      usage: {
        messagesPerMonth: {
          used: currentUsage,
          limit: activePlan.limits?.messagesPerMonth || null,
          unlimited: activePlan.limits?.messagesPerMonth === null || activePlan.limits?.messagesPerMonth === -1
        }
      },
      nextDueDate: activePlan.nextDueDate
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar plano do usuário:', error);
    res.status(500).json({ error: error.message });
  }
});

// Criar cobrança Asaas
// Função para validar dígitos verificadores de CPF
function validateCPF(cpf) {
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // CPF com todos dígitos iguais
  
  let sum = 0;
  let remainder;
  
  // Validar primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;
  
  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
}

// Função para validar dígitos verificadores de CNPJ
function validateCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]/g, '');
  
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // CNPJ com todos dígitos iguais
  
  let length = cnpj.length - 2;
  let numbers = cnpj.substring(0, length);
  const digits = cnpj.substring(length);
  let sum = 0;
  let pos = length - 7;
  
  // Validar primeiro dígito verificador
  for (let i = length; i >= 1; i--) {
    sum += numbers.charAt(length - i) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result !== parseInt(digits.charAt(0))) return false;
  
  // Validar segundo dígito verificador
  length = length + 1;
  numbers = cnpj.substring(0, length);
  sum = 0;
  pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += numbers.charAt(length - i) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result !== parseInt(digits.charAt(1))) return false;
  
  return true;
}

// Endpoint Stripe para criar cliente e validar CPF/CNPJ
async function handleCreateStripeCustomer(req, res) {
  try {
    const { name, email, cpfCnpj, phone, mobilePhone } = req.body;

    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({
        success: false,
        error: 'Nome, email e CPF/CNPJ são obrigatórios'
      });
    }

    const cleanCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
    const isCPF = cleanCpfCnpj.length === 11;
    const isCNPJ = cleanCpfCnpj.length === 14;

    if (!isCPF && !isCNPJ) {
      return res.status(400).json({
        success: false,
        error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos'
      });
    }

    if (isCPF && !validateCPF(cleanCpfCnpj)) {
      return res.json({
        success: false,
        valid: false,
        type: 'CPF',
        error: 'CPF inválido: dígitos verificadores incorretos'
      });
    }

    if (isCNPJ && !validateCNPJ(cleanCpfCnpj)) {
      return res.json({
        success: false,
        valid: false,
        type: 'CNPJ',
        error: 'CNPJ inválido: dígitos verificadores incorretos'
      });
    }

    const stripeApiKey = await getMasterStripeApiKey();
    if (!stripeApiKey) {
      return res.status(400).json({
        success: false,
        error: 'API Key do Stripe não configurada no sistema'
      });
    }

    const stripe = new Stripe(stripeApiKey, { apiVersion: '2023-10-16' });
    const customer = await stripe.customers.create({
      name,
      email,
      phone: (phone || mobilePhone || '').replace(/[^\d+]/g, '') || undefined,
      metadata: { cpfCnpj: cleanCpfCnpj }
    });

    return res.json({
      success: true,
      valid: true,
      customerId: customer.id,
      customer,
      type: isCPF ? 'CPF' : 'CNPJ',
      message: `${isCPF ? 'CPF' : 'CNPJ'} válido e cliente criado no Stripe`
    });
  } catch (error) {
    console.error('❌ Erro ao criar cliente no Stripe:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar cliente no Stripe'
    });
  }
}

app.post('/api/stripe/create-customer', handleCreateStripeCustomer);

// Endpoint Stripe para validar CPF/CNPJ (validação local)
async function handleValidateDocumentStripe(req, res) {
  try {
    const { cpfCnpj } = req.body;
    if (!cpfCnpj) {
      return res.status(400).json({
        success: false,
        error: 'CPF/CNPJ é obrigatório'
      });
    }

    const cleanCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
    const isCPF = cleanCpfCnpj.length === 11;
    const isCNPJ = cleanCpfCnpj.length === 14;

    if (!isCPF && !isCNPJ) {
      return res.status(400).json({
        success: false,
        error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos'
      });
    }

    if (isCPF) {
      const valid = validateCPF(cleanCpfCnpj);
      return res.json({
        success: true,
        valid,
        type: 'CPF',
        ...(valid ? { message: 'CPF válido' } : { error: 'CPF inválido: dígitos verificadores incorretos' })
      });
    }

    const valid = validateCNPJ(cleanCpfCnpj);
    return res.json({
      success: true,
      valid,
      type: 'CNPJ',
      ...(valid ? { message: 'CNPJ válido' } : { error: 'CNPJ inválido: dígitos verificadores incorretos' })
    });
  } catch (error) {
    console.error('❌ Erro ao validar documento (Stripe):', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao validar documento'
    });
  }
}

app.post('/api/stripe/validate-document', handleValidateDocumentStripe);

async function handleCreateStripeCheckout(req, res) {
  try {
    const { userId, customerData, items } = req.body;
    
    if (!userId || !customerData || !items) {
      return res.status(400).json({ error: 'userId, customerData e items são obrigatórios' });
    }
    
    const integrations = await getIntegrationsConfig(userId);
    const stripeApiKey = integrations?.stripeApiKey || process.env.STRIPE_API_KEY || null;

    if (!stripeApiKey) {
      return res.status(400).json({ error: 'API Key do Stripe não configurada' });
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'STRIPE_SUCCESS_URL e STRIPE_CANCEL_URL são obrigatórios' });
    }

    const enrichedItems = await enrichOrderItemsWithCatalog(userId, items);
    const stockCheck = await assertCheckoutAvailability(userId, enrichedItems);
    if (!stockCheck.ok) {
      return res.status(409).json({
        success: false,
        error: stockCheck.userMessage,
        code: stockCheck.code
      });
    }

    const orderRef = db.ref(`orders/${userId}`).push();
    const orderId = orderRef.key;

    const result = await createStripeCheckoutSession(
      stripeApiKey,
      customerData,
      enrichedItems,
      userId,
      successUrl,
      cancelUrl,
      { orderId }
    );
    
    if (result.success) {
      const customerToSave = {
        name: customerData.name || 'Cliente',
        phone: customerData.originalPhone || customerData.phone || customerData.mobilePhone,
        ...(customerData.cpfCnpj && { cpfCnpj: customerData.cpfCnpj }),
        ...(customerData.email && { email: customerData.email }),
        ...(customerData.address && { address: customerData.address })
      };
      
      await orderRef.set({
        orderId: orderId,
        stripeSessionId: result.sessionId,
        customer: customerToSave,
        items: enrichedItems,
        totalValue: result.value,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paymentUrl: result.checkoutUrl,
        paymentProvider: 'stripe'
      });

      try {
        await reserveTvLoginsForCheckoutOrder(userId, orderId, enrichedItems);
      } catch (e) {
        console.error('❌ [TV] Reserva pós-checkout (API):', e.message);
      }
      
      return res.json({
        success: true,
        orderId: orderId,
        ...result
      });
    }

    return res.status(400).json(result);
    
  } catch (error) {
    console.error('❌ Erro ao criar checkout Stripe:', error);
    return res.status(500).json({ error: error.message });
  }
}

app.post('/api/stripe/create-checkout', handleCreateStripeCheckout);

async function handleCreateStripeSubscription(req, res) {
  try {
    const { userId, customerData, planData } = req.body;
    
    if (!userId || !customerData || !planData) {
      return res.status(400).json({ error: 'userId, customerData e planData são obrigatórios' });
    }
    
    const stripeApiKey = await getMasterStripeApiKey();
    if (!stripeApiKey) {
      return res.status(400).json({ error: 'API Key do Stripe não configurada no sistema' });
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'STRIPE_SUCCESS_URL e STRIPE_CANCEL_URL são obrigatórios' });
    }

    const result = await createStripeSubscriptionCheckoutSession(
      stripeApiKey,
      customerData,
      planData,
      userId,
      successUrl,
      cancelUrl
    );
    
    if (result.success) {
      // Salvar assinatura no Firebase
      const subscriptionRef = db.ref(`subscriptions/${userId}`).push();
      
      await subscriptionRef.set({
        subscriptionId: subscriptionRef.key,
        stripeSubscriptionId: result.subscriptionId,
        stripeSessionId: result.stripeSessionId,
        planId: planData.id,
        planName: planData.name,
        customer: customerData,
        value: result.value,
        cycle: result.cycle,
        status: 'pending_payment',
        nextDueDate: result.nextDueDate,
        createdAt: new Date().toISOString(),
        paymentUrl: result.invoiceUrl,
        paymentProvider: 'stripe',
        limits: planData.limits || {}
      });
      
      // NÃO vincular plano ao usuário ainda - só após pagamento confirmado via webhook
      
      return res.json({
        success: true,
        subscriptionId: subscriptionRef.key,
        ...result
      });
    }

    return res.status(400).json(result);
    
  } catch (error) {
    console.error('❌ Erro ao criar assinatura:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Novo endpoint Stripe para assinatura
app.post('/api/stripe/create-subscription', handleCreateStripeSubscription);

app.post('/api/tv/resend-credentials', async (req, res) => {
  try {
    const { userId, tvLoginId, phone } = req.body;
    if (!userId || !tvLoginId) {
      return res.status(400).json({ error: 'userId e tvLoginId são obrigatórios' });
    }
    const snap = await db.ref(`users/data/${userId}/tv_logins/${tvLoginId}`).once('value');
    const login = snap.val();
    if (!login || !login.login || !login.password) {
      return res.status(404).json({ error: 'Login não encontrado' });
    }
    const targetPhone = phone || login.soldToPhone;
    if (!targetPhone) {
      return res.status(400).json({
        error: 'Informe o telefone (phone) ou use um login já vendido com soldToPhone'
      });
    }
    const { tvAppDownloadUrl } = await getAssistantPaymentExtras(userId);
    let msg =
      `✅ *Reenvio de acesso*\n\n` +
      `📺 *${login.planName || 'Plano'}*\n` +
      `Login: ${login.login}\n` +
      `Senha: ${login.password}\n\n` +
      `_Em caso de dúvida, fale com o suporte._`;
    msg = appendTvAppDownloadFooter(msg, tvAppDownloadUrl);
    await sendTvLoginWhatsApp(userId, targetPhone, msg);
    await saveTvMessageToConversation(userId, targetPhone, msg);
    await appendTvLoginHistory(userId, tvLoginId, { event: 'resend', at: new Date().toISOString() });
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro reenvio TV:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/summary', async (req, res) => {
  try {
    const { userId, start, end } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
    const snap = await db.ref(`orders/${userId}`).once('value');
    const startMs = start ? new Date(start).getTime() : 0;
    const endMs = end ? new Date(end).getTime() : Date.now() + 86400000 * 365;
    const rows = [];
    let totalPaid = 0;
    const byStatus = {};
    if (snap.exists()) {
      snap.forEach((child) => {
        const o = child.val() || {};
        const paidAt = o.paidAt || o.createdAt;
        const t = paidAt ? new Date(paidAt).getTime() : 0;
        if (t >= startMs && t <= endMs) {
          rows.push({ id: child.key, ...o });
          const st = o.status || 'unknown';
          byStatus[st] = (byStatus[st] || 0) + 1;
          if (o.status === 'paid' && typeof o.totalValue === 'number') {
            totalPaid += o.totalValue;
          }
        }
      });
    }
    return res.json({
      ok: true,
      count: rows.length,
      totalPaidValue: totalPaid,
      byStatus,
      orders: rows.slice(0, 200)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Webhook Asaas (legado opcional)
if (ENABLE_ASAAS_LEGACY) {
app.post('/api/asaas/webhook', async (req, res) => {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  📥 WEBHOOK RECEBIDO DO ASAAS         ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('📋 Event:', req.body.event);
    console.log('📋 Body completo:', JSON.stringify(req.body, null, 2));
    console.log('');
    
    const { event, payment, invoice } = req.body;
    
    if (payment) {
      console.log('📋 Detalhes do Payment:');
      console.log('   ID:', payment.id);
      console.log('   Status:', payment.status);
      console.log('   Subscription:', payment.subscription);
      console.log('   PaymentDate:', payment.paymentDate);
      console.log('   ConfirmedDate:', payment.confirmedDate);
      console.log('   Value:', payment.value);
      console.log('');
    }
    
    // ============================================
    // EVENTOS DE NOTA FISCAL
    // ============================================
    const invoiceEvents = [
      'INVOICE_CREATED',
      'INVOICE_UPDATED',
      'INVOICE_SYNCHRONIZED',
      'INVOICE_AUTHORIZED',
      'INVOICE_CANCELED',
      'INVOICE_ERROR',
      'INVOICE_PROCESSING_CANCELLATION',
      'INVOICE_CANCELLATION_DENIED'
    ];
    
    if (invoiceEvents.includes(event)) {
      console.log(`📄 Evento de NOTA FISCAL recebido: ${event}`);
      
      if (!invoice) {
        console.log('⚠️ Webhook de NF sem dados da nota fiscal');
        return res.json({ received: true, ignored: true, reason: 'Sem dados de nota fiscal' });
      }
      
      // Quando a nota fiscal for AUTORIZADA, enviar para o cliente
      if (event === 'INVOICE_AUTHORIZED' || event === 'INVOICE_SYNCHRONIZED') {
        console.log('✅ Nota fiscal AUTORIZADA! Enviando para o cliente...');
        
        // Buscar pedido pelo chargeId da nota fiscal
        const ordersSnapshot = await db.ref('orders').once('value');
        let userId, orderId, orderData;
        
        if (ordersSnapshot.exists()) {
          ordersSnapshot.forEach((userOrders) => {
            userOrders.forEach((order) => {
              const orderVal = order.val();
              // Buscar pelo chargeId ou pelo payment.id
              if (orderVal.chargeId === invoice.payment || 
                  orderVal.chargeId === invoice.externalReference) {
                userId = userOrders.key;
                orderId = order.key;
                orderData = orderVal;
              }
            });
          });
        }
        
        if (!userId || !orderId) {
          console.log('⚠️ Pedido não encontrado para NF:', invoice.id);
          return res.json({ received: true, note: 'Pedido não encontrado' });
        }
        
        // Atualizar pedido com informações da NF
        await db.ref(`orders/${userId}/${orderId}`).update({
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          invoiceUrl: invoice.pdfUrl || invoice.xmlUrl,
          invoiceStatus: 'authorized',
          invoiceData: invoice,
          updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ NF ${invoice.number} vinculada ao pedido ${orderId}`);
        
        // Enviar NF para o cliente via WhatsApp
        const client = activeClients.get(userId);
        
        if (client && orderData.customer.phone) {
          const invoiceMessage = `🎉 *Sua Nota Fiscal Está Pronta!*\n\n` +
            `✅ A nota fiscal que você solicitou foi emitida com sucesso!\n\n` +
            `📋 *Informações:*\n` +
            `Número: ${invoice.number || 'N/A'}\n` +
            `Pedido: #${orderId.substring(0, 8)}\n` +
            `Valor: R$ ${invoice.value ? invoice.value.toFixed(2) : orderData.total.toFixed(2)}\n\n` +
            (invoice.pdfUrl ? `📥 *Download PDF:*\n${invoice.pdfUrl}\n\n` : '') +
            (invoice.xmlUrl ? `📋 *Download XML:*\n${invoice.xmlUrl}\n\n` : '') +
            `💚 Obrigado pela sua compra!\n` +
            `Se precisar de algo mais, estou à disposição. 😊`;
          
          try {
            await client.sendText(orderData.customer.phone, invoiceMessage);
            console.log('✅ Nota fiscal enviada para o cliente:', orderData.customer.phone);
          } catch (error) {
            console.error('❌ Erro ao enviar NF para o cliente:', error);
          }
        } else {
          console.log('⚠️ Cliente não conectado ou sem telefone cadastrado');
        }
      }
      
      // Se houver erro na NF, notificar
      if (event === 'INVOICE_ERROR') {
        console.error('❌ Erro na nota fiscal:', invoice);
      }
      
      return res.json({ received: true, processed: true, event });
    }
    
    // ============================================
    // EVENTOS DE ASSINATURA (SUBSCRIPTION)
    // ============================================
    const subscriptionEvents = [
      'SUBSCRIPTION_CREATED',
      'SUBSCRIPTION_UPDATED',
      'SUBSCRIPTION_DELETED',
      'SUBSCRIPTION_ACTIVATED',
      'SUBSCRIPTION_CANCELLED',
      'SUBSCRIPTION_CANCELED',
      'SUBSCRIPTION_DELETED_WITH_PAYMENT',
      'SUBSCRIPTION_PAYMENT'
    ];
    
    if (subscriptionEvents.includes(event)) {
      console.log(`💎 Evento de ASSINATURA recebido: ${event}`);
      
      const subscription = req.body.subscription || req.body;
      
      if (!subscription) {
        console.log('⚠️ Webhook de assinatura sem dados');
        return res.json({ received: true, ignored: true, reason: 'Sem dados de assinatura' });
      }
      
      console.log('📋 Dados da assinatura:', {
        id: subscription.id,
        externalReference: subscription.externalReference,
        status: subscription.status,
        cycle: subscription.cycle
      });
      
      // Extrair userId do externalReference (formato: subscription_userId_planId)
      if (!subscription.externalReference || !subscription.externalReference.startsWith('subscription_')) {
        console.log('⚠️ externalReference inválido:', subscription.externalReference);
        return res.json({ received: true, ignored: true, reason: 'externalReference inválido' });
      }
      
      const externalParts = subscription.externalReference.split('_');
      const userId = externalParts[1];
      const planId = externalParts[2];
      
      if (!userId) {
        console.log('⚠️ Não foi possível extrair userId do externalReference');
        return res.json({ received: true, ignored: true, reason: 'userId não encontrado' });
      }
      
      // Buscar assinatura no Firebase
      const subscriptionsRef = db.ref(`subscriptions/${userId}`);
      const subscriptionsSnapshot = await subscriptionsRef.once('value');
      
      let subscriptionKey = null;
      if (subscriptionsSnapshot.exists()) {
        subscriptionsSnapshot.forEach((sub) => {
          if (sub.val().asaasSubscriptionId === subscription.id) {
            subscriptionKey = sub.key;
          }
        });
      }
      
      if (!subscriptionKey) {
        console.log('⚠️ Assinatura não encontrada no Firebase para:', subscription.id);
        return res.json({ received: true, note: 'Assinatura não encontrada' });
      }
      
      // Atualizar status da assinatura no Firebase
      const updateData = {
        status: subscription.status,
        updatedAt: new Date().toISOString()
      };
      
      if (subscription.nextDueDate) {
        updateData.nextDueDate = subscription.nextDueDate;
      }
      
      await db.ref(`subscriptions/${userId}/${subscriptionKey}`).update(updateData);
      console.log(`✅ Assinatura ${subscriptionKey} atualizada no Firebase`);
      
      // CRÍTICO: NÃO criar/ativar activePlan aqui para eventos de criação/atualização de assinatura
      // O activePlan só deve ser criado quando houver um PAGAMENTO CONFIRMADO (PAYMENT_RECEIVED/CONFIRMED)
      // Eventos SUBSCRIPTION_CREATED ou SUBSCRIPTION_ACTIVATED não significam que houve pagamento
      // O plano só será ativado quando o webhook processar um PAYMENT_RECEIVED/CONFIRMED relacionado à assinatura
      
      console.log(`ℹ️ Assinatura atualizada, mas plano NÃO será ativado até pagamento confirmado`);
      
      return res.json({ received: true, processed: true, event, subscriptionKey });
    }
    
    // ============================================
    // EVENTOS DE PAGAMENTO (código original)
    // ============================================
    const paymentEvents = [
      'PAYMENT_RECEIVED',
      'PAYMENT_CONFIRMED', 
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED'
    ];
    
    if (!paymentEvents.includes(event)) {
      console.log(`⚠️ Evento ignorado (não é de pagamento nem NF nem assinatura): ${event}`);
      return res.json({ received: true, ignored: true, reason: 'Evento não reconhecido' });
    }
    
    if (!payment) {
      console.log('⚠️ Webhook sem dados de pagamento');
      return res.json({ received: true, ignored: true, reason: 'Sem dados de pagamento' });
    }
    
    // 🔥 NOVO: Verificar se é pagamento de assinatura PRIMEIRO
    // CRÍTICO: Só processar se o pagamento foi REALMENTE confirmado/recebido
    // NÃO processar eventos PAYMENT_CREATED ou PAYMENT_UPDATED que ainda não foram pagos
    
    // IMPORTANTE: O payment.subscription pode não estar presente no webhook
    // Se não estiver, tentar buscar de múltiplas formas
    let subscriptionIdFromPayment = payment.subscription;
      
    // Log detalhado do payload recebido
    console.log('🔍 Analisando pagamento para encontrar assinatura:');
    console.log('   payment.id:', payment.id);
    console.log('   payment.subscription:', payment.subscription);
    console.log('   payment.externalReference:', payment.externalReference);
    console.log('   payment.invoiceUrl:', payment.invoiceUrl);
    
    if (!subscriptionIdFromPayment) {
        console.log('⚠️ payment.subscription não encontrado, buscando por outras formas...');
        
        // Buscar TODAS as subscriptions e verificar múltiplos critérios
        const allSubsSnapshot = await db.ref('subscriptions').once('value');
        if (allSubsSnapshot.exists()) {
          const allSubs = allSubsSnapshot.val();
          
          // Iterar sobre todas as subscriptions
          for (const userId in allSubs) {
            if (!subscriptionIdFromPayment) { // Só continuar se ainda não encontrou
              const userSubs = allSubs[userId];
              
              for (const subKey in userSubs) {
                if (!subscriptionIdFromPayment) { // Só continuar se ainda não encontrou
                  const subVal = userSubs[subKey];
                  
                  // MÉTODO 1: Verificar se payment.id está no paymentUrl ou invoiceUrl da subscription
                  if (subVal.paymentUrl && payment.id) {
                    // paymentUrl pode ser uma URL completa ou conter o payment ID
                    if (subVal.paymentUrl.includes(payment.id) || subVal.paymentUrl.includes(payment.id.replace('pay_', ''))) {
                      subscriptionIdFromPayment = subVal.asaasSubscriptionId;
                      console.log('✅ Assinatura encontrada pelo paymentUrl (payment.id):', subscriptionIdFromPayment);
                      break; // Sair do loop interno
                    }
                  }
                  
                  // MÉTODO 2: Verificar se invoiceUrl contém payment.id
                  if (!subscriptionIdFromPayment && payment.invoiceUrl && subVal.paymentUrl && payment.invoiceUrl.includes(subVal.paymentUrl.split('?')[0])) {
                    subscriptionIdFromPayment = subVal.asaasSubscriptionId;
                    console.log('✅ Assinatura encontrada pela invoiceUrl:', subscriptionIdFromPayment);
                    break; // Sair do loop interno
                  }
                  
                  // MÉTODO 3: Verificar pelo externalReference do payment (formato: subscription_{userId}_{planId})
                  if (!subscriptionIdFromPayment && payment.externalReference && payment.externalReference.startsWith('subscription_')) {
                    const refParts = payment.externalReference.split('_');
                    if (refParts.length >= 3) {
                      const refUserId = refParts[1];
                      const refPlanId = refParts[2];
                      // Verificar se userId e planId correspondem
                      if (userId === refUserId && subVal.planId === refPlanId) {
                        subscriptionIdFromPayment = subVal.asaasSubscriptionId;
                        console.log('✅ Assinatura encontrada pelo externalReference:', subscriptionIdFromPayment);
                        break; // Sair do loop interno
                      }
                    }
                  }
                  
                  // MÉTODO 4: Se subscription tem lastPayment ou invoiceUrl relacionada, verificar se corresponde
                  if (!subscriptionIdFromPayment && subVal.lastPayment === payment.id) {
                    subscriptionIdFromPayment = subVal.asaasSubscriptionId;
                    console.log('✅ Assinatura encontrada pelo lastPayment:', subscriptionIdFromPayment);
                    break; // Sair do loop interno
                  }
                }
              }
              
              if (subscriptionIdFromPayment) {
                break; // Sair do loop externo se encontrou
              }
            }
          }
      }
      
      if (!subscriptionIdFromPayment) {
        console.log('❌ Não foi possível encontrar a assinatura relacionada ao pagamento');
        console.log('   Tentando busca alternativa por payment ID em todas as subscriptions...');
      }
    }
    
    if (subscriptionIdFromPayment) {
        try {
          console.log('💎 Pagamento relacionado a assinatura detectado!');
          console.log('   Subscription ID:', subscriptionIdFromPayment);
          console.log('   Event:', event);
          console.log('   Payment Status:', payment.status);
          console.log('   Payment Date:', payment.paymentDate);
          console.log('   Confirmed Date:', payment.confirmedDate);
          
          // CRÍTICO: Verificar se o pagamento foi REALMENTE confirmado
          // Só aceitar PAYMENT_RECEIVED ou PAYMENT_CONFIRMED
          // NÃO aceitar PAYMENT_CREATED ou PAYMENT_UPDATED sem confirmação
          const isPaymentConfirmed = 
            (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') &&
            (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED' || payment.status === 'RECEIVED_IN_CASH' || payment.paymentDate || payment.confirmedDate);
          
          if (!isPaymentConfirmed) {
            console.log('⏳ Pagamento ainda não confirmado. Status:', payment.status, 'Event:', event);
            console.log('   Aguardando confirmação real do pagamento...');
            return res.json({ received: true, processed: false, reason: 'Pagamento ainda não confirmado' });
          }
          
          console.log('✅ Pagamento CONFIRMADO! Processando ativação do plano...');
          
          // Buscar assinatura pelo ID do Asaas
          const subscriptionsSnapshot = await db.ref('subscriptions').once('value');
          let subUserId = null;
          let subKey = null;
          
          if (subscriptionsSnapshot.exists()) {
            subscriptionsSnapshot.forEach((userSubs) => {
              userSubs.forEach((sub) => {
                if (sub.val().asaasSubscriptionId === subscriptionIdFromPayment) {
                  subUserId = userSubs.key;
                  subKey = sub.key;
                }
              });
            });
          }
          
          if (subUserId && subKey) {
            console.log(`✅ Assinatura encontrada para usuário: ${subUserId}`);
            console.log(`   Subscription Key: ${subKey}`);
            console.log(`   Asaas Subscription ID: ${subscriptionIdFromPayment}`);
            
            // Buscar dados da assinatura e do plano
            const subDataRef = db.ref(`subscriptions/${subUserId}/${subKey}`);
            const subDataSnapshot = await subDataRef.once('value');
            
            if (!subDataSnapshot.exists()) {
              console.log('⚠️ Dados da assinatura não encontrados no Firebase');
              console.log(`   Caminho: subscriptions/${subUserId}/${subKey}`);
              return res.json({ received: true, processed: true, type: 'subscription_payment', note: 'Assinatura não encontrada' });
            }
            
            const subData = subDataSnapshot.val();
            console.log('📋 Dados da assinatura encontrados:');
            console.log('   PlanId:', subData.planId);
            console.log('   PlanName:', subData.planName);
            console.log('   Status atual:', subData.status);
            const cycle = subData.cycle || 'MONTHLY';
          
          // Buscar dados completos do plano para verificar se é trial
          const planRef = db.ref(`plans/${subData.planId}`);
          const planSnapshot = await planRef.once('value');
          const planData = planSnapshot.exists() ? planSnapshot.val() : null;
          
            // Calcular nextDueDate baseado no tipo de plano
            let nextDueDate;
            if (planData?.isTrialPlan) {
              // Para planos de teste, calcular baseado em horas e minutos
              const hours = planData.trialDurationHours || 0;
              const minutes = planData.trialDurationMinutes || 30;
              const totalMilliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
              const expirationDate = new Date(Date.now() + totalMilliseconds);
              nextDueDate = expirationDate.toISOString();
            } else {
              // Para planos normais, usar cálculo mensal/anual
              const days = cycle === 'YEARLY' ? 365 : 30;
              nextDueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            
            // Atualizar assinatura
            // Usar paymentDate do Asaas se disponível, caso contrário usar a data/hora atual
            // O paymentDate do Asaas é mais confiável pois representa quando o pagamento foi realmente processado
            const paymentDate = payment.paymentDate || payment.confirmedDate || payment.dateCreated || new Date().toISOString();
            
            console.log('📅 Datas de pagamento disponíveis:');
            console.log('   payment.paymentDate:', payment.paymentDate);
            console.log('   payment.confirmedDate:', payment.confirmedDate);
            console.log('   payment.dateCreated:', payment.dateCreated);
            console.log('   Usando:', paymentDate);
            
            console.log('📝 Atualizando assinatura no Firebase...');
            await subDataRef.update({
              lastPayment: payment.id,
              lastPaymentDate: paymentDate,
              nextDueDate: nextDueDate,
              status: 'ACTIVE',
              updatedAt: new Date().toISOString()
            });
            console.log('✅ Assinatura atualizada no Firebase');
            
            // Buscar plano para ativar o usuário
            console.log(`🔍 Verificando activePlan para usuário: ${subUserId}`);
            const activePlanRef = db.ref(`users/data/${subUserId}/activePlan`);
            const activePlanSnapshot = await activePlanRef.once('value');
            
            if (activePlanSnapshot.exists()) {
              // Atualizar plano existente - IMPORTANTE: sempre atualizar com dados do novo plano pago
              const existingPlan = activePlanSnapshot.val();
              console.log('📋 ActivePlan existente encontrado:');
              console.log('   PlanId atual:', existingPlan.planId);
              console.log('   PlanName atual:', existingPlan.planName);
              console.log('   Novo PlanId:', subData.planId);
              console.log('   Novo PlanName:', planData?.name || subData.planName);
              
              const updateData = {
                planId: subData.planId, // Garantir que o planId corresponde ao plano pago
                planName: planData?.name || subData.planName,
                subscriptionId: subKey,
                asaasSubscriptionId: subData.asaasSubscriptionId,
                nextDueDate: nextDueDate,
                isTrialPlan: planData?.isTrialPlan || false,
                trialDurationHours: planData?.trialDurationHours || null,
                trialDurationMinutes: planData?.trialDurationMinutes || null,
                allowedFeatures: planData?.allowedFeatures || [],
                limits: subData.limits || {},
                updatedAt: new Date().toISOString()
              };
              
              console.log('📝 Atualizando activePlan existente...');
              await activePlanRef.update(updateData);
              console.log(`✅ Plano existente atualizado com novo plano pago! Plano: ${planData?.name || subData.planName}, Próxima cobrança: ${nextDueDate}`);
            } else {
              // Criar activePlan pela primeira vez (primeira cobrança confirmada)
              console.log('📝 Criando activePlan pela primeira vez...');
              const newPlanData = {
                planId: subData.planId,
                planName: planData?.name || subData.planName,
                subscriptionId: subKey,
                asaasSubscriptionId: subData.asaasSubscriptionId,
                startedAt: new Date().toISOString(),
                nextDueDate: nextDueDate,
                isTrialPlan: planData?.isTrialPlan || false,
                trialDurationHours: planData?.trialDurationHours || null,
                trialDurationMinutes: planData?.trialDurationMinutes || null,
                allowedFeatures: planData?.allowedFeatures || [],
                limits: subData.limits || {},
                updatedAt: new Date().toISOString()
              };
              
              console.log('📋 Dados do activePlan que serão criados:');
              console.log(JSON.stringify(newPlanData, null, 2));
              
              await activePlanRef.set(newPlanData);
              console.log(`✅ Plano ativado pela primeira vez! Próxima cobrança: ${nextDueDate}`);
            }
            
            console.log(`✅ Assinatura renovada! Status: ACTIVE`);
            console.log(`✅ ActivePlan criado/atualizado com sucesso para usuário: ${subUserId}`);
            
            return res.json({ received: true, processed: true, type: 'subscription_payment' });
          } else {
            console.log('⚠️ Assinatura não encontrada no Firebase após encontrar subscriptionId');
            console.log(`   Procurando subscriptionId: ${subscriptionIdFromPayment}`);
            console.log(`   Verificando todas as subscriptions...`);
            
            // Listar todas as subscriptions para debug
            if (subscriptionsSnapshot.exists()) {
              subscriptionsSnapshot.forEach((userSubs) => {
                userSubs.forEach((sub) => {
                  const subVal = sub.val();
                  console.log(`   - User: ${userSubs.key}, Key: ${sub.key}, AsaasId: ${subVal.asaasSubscriptionId}`);
                });
              });
            }
            
            return res.json({ received: true, processed: false, type: 'subscription_payment', reason: 'Subscription não encontrada no Firebase' });
          }
        } catch (error) {
          console.error('❌ ERRO ao processar pagamento de assinatura:', error);
          console.error('   Stack:', error.stack);
          console.error('   Payment ID:', payment.id);
          console.error('   Subscription ID:', subscriptionIdFromPayment);
          return res.json({ received: true, processed: false, type: 'subscription_payment', error: error.message });
        }
      } else {
        console.log('⚠️ Pagamento não relacionado a assinatura ou subscriptionId não encontrado');
      console.log('   payment.subscription:', payment.subscription);
      console.log('   payment.externalReference:', payment.externalReference);
      console.log('   Continuando processamento como pagamento normal de pedido...');
    }
    
    // Buscar pedido pelo externalReference (código original)
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

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const paidSnap = await db.ref(`orders/${userId}/${orderId}`).once('value');
      await deliverTvLoginsForPaidOrder(userId, orderId, paidSnap.val() || orderData);
    }
    
    console.log(`✅ Pedido ${orderId} atualizado para status: ${newStatus}`);
    
    // Se pagamento foi confirmado, enviar mensagem no WhatsApp
    // NOTA: A emissão de nota fiscal agora só acontece quando o cliente solicitar e fornecer o endereço
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const client = activeClients.get(userId);
      
      console.log('📱 Verificando envio de confirmação:');
      console.log('   - Cliente WPPConnect existe?', !!client);
      console.log('   - Telefone do cliente:', orderData.customer?.phone);
      console.log('   - UserID:', userId);
      
      if (client && orderData.customer.phone) {
        const successMessage = `✅ *Pagamento Confirmado!*\n\n` +
          `Pedido #${orderId.substring(0, 8)}\n` +
          `Valor: R$ ${payment.value.toFixed(2)}\n\n` +
          `Obrigado pela sua compra! 🎉\n` +
          `Em breve você receberá mais informações sobre a entrega.`;
        
        console.log('📤 Tentando enviar mensagem de confirmação...');
        console.log('   Para:', orderData.customer.phone);
        console.log('   Tamanho da mensagem:', successMessage.length, 'caracteres');
        
        try {
          const sendResult = await client.sendText(orderData.customer.phone, successMessage);
          console.log('✅ Mensagem de confirmação enviada');
          console.log('   Resultado:', sendResult);
          
          const sanitizedNumber = sanitizePhoneNumber(orderData.customer.phone);
          
          // Salvar mensagem no histórico
          const confirmMsgRef = conversationMessagesRef(userId, sanitizedNumber).push();
          await confirmMsgRef.set({
            from: 'system',
            to: orderData.customer.phone,
            body: successMessage,
            timestamp: new Date().toISOString(),
            type: 'payment_confirmation',
            isFromMe: true,
            orderId: orderId
          });
          
          // Marcar que o pagamento foi confirmado
          await db.ref(`orders/${userId}/${orderId}`).update({
            paymentConfirmedAt: new Date().toISOString()
          });
          
          // 📄 PERGUNTAR SOBRE NOTA FISCAL IMEDIATAMENTE
          console.log('📄 Enviando pergunta sobre nota fiscal automaticamente...');
          
          // Aguardar 2 segundos para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const invoiceQuestion = '📄 Você deseja nota fiscal?';
          
          console.log('📤 Tentando enviar pergunta de nota fiscal...');
          console.log('   Para:', orderData.customer.phone);
          
          try {
            const invoiceSendResult = await client.sendText(orderData.customer.phone, invoiceQuestion);
            console.log('✅ Pergunta sobre nota fiscal enviada automaticamente');
            console.log('   Resultado:', invoiceSendResult);
            
            // Salvar pergunta no histórico
            const invoiceQuestionRef = conversationMessagesRef(userId, sanitizedNumber).push();
            await invoiceQuestionRef.set({
              from: 'system',
              to: orderData.customer.phone,
              body: invoiceQuestion,
              timestamp: new Date().toISOString(),
              type: 'invoice_question',
              isFromMe: true,
              orderId: orderId
            });
            
            // Definir contexto para aguardar resposta sobre nota fiscal
            const contextRef = db.ref(`collectionContext/${userId}/${sanitizedNumber}`);
            await contextRef.set({
              waitingFor: 'invoice_request',
              askedAt: new Date().toISOString(),
              orderId: orderId
            });
            console.log('📝 Contexto definido: aguardando resposta sobre nota fiscal');
            
            // Marcar no pedido que a pergunta foi feita
            await db.ref(`orders/${userId}/${orderId}`).update({
              invoiceQuestionAsked: true,
              invoiceQuestionAskedAt: new Date().toISOString()
            });
            
          } catch (invoiceError) {
            console.error('❌ Erro ao enviar pergunta sobre nota fiscal:', invoiceError);
            console.error('   Tipo:', invoiceError.constructor.name);
            console.error('   Mensagem:', invoiceError.message);
            console.error('   Stack:', invoiceError.stack);
          }
          
        } catch (error) {
          console.error('❌ Erro ao enviar mensagem de confirmação:', error);
          console.error('   Tipo:', error.constructor.name);
          console.error('   Mensagem:', error.message);
          console.error('   Stack:', error.stack);
        }
      } else {
        console.log('⚠️ Não foi possível enviar mensagens:');
        console.log('   - Cliente existe?', !!client);
        console.log('   - Telefone existe?', !!orderData.customer?.phone);
      }
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('❌ Erro no webhook Asaas:', error);
    res.status(500).json({ error: error.message });
  }
});
} else {
  app.post('/api/asaas/webhook', async (req, res) => {
    return res.status(410).json({
      success: false,
      error: 'Webhook Asaas desabilitado. Use apenas Stripe.'
    });
  });
}

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
// FLOW BUILDER - Configuração Visual de Fluxo
// ============================================

/**
 * GET /api/ai-config/:userId
 * Buscar configuração de IA (incluindo flow steps)
 */
app.get('/api/ai-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('📖 [FlowBuilder] Buscando configuração para userId:', userId);
    
    const configRef = db.ref(`users/data/${userId}/ai_config`);
    const snapshot = await configRef.once('value');
    const config = snapshot.val();

    if (!config) {
      console.log('⚠️ [FlowBuilder] Configuração não encontrada, retornando padrão');
      return res.json({
        success: true,
        config: {
          flowSteps: [],
          systemPrompt: 'Você é um assistente virtual prestativo.',
          model: 'gpt-4',
          welcomeMessage: 'Olá! Como posso ajudar?',
          enabledFeatures: []
        }
      });
    }

    console.log('✅ [FlowBuilder] Configuração encontrada');

    res.json({
      success: true,
      config: {
        flowSteps: config.flowSteps || [],
        systemPrompt: config.systemPrompt || '',
        model: config.model || 'gpt-4',
        welcomeMessage: config.welcomeMessage || '',
        enabledFeatures: config.enabledFeatures || []
      }
    });

  } catch (error) {
    console.error('❌ [FlowBuilder] Erro ao buscar configuração:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/ai-config/:userId
 * Salvar configuração de IA (incluindo flow steps)
 */
app.put('/api/ai-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { flowSteps, systemPrompt } = req.body;

    console.log('💾 [FlowBuilder] Salvando configuração para userId:', userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    const configData = {
      updatedAt: new Date().toISOString()
    };

    if (flowSteps !== undefined) {
      configData.flowSteps = flowSteps;
    }

    if (systemPrompt !== undefined) {
      configData.systemPrompt = systemPrompt;
    }

    const configRef = db.ref(`users/data/${userId}/ai_config`);
    await configRef.update(configData);

    console.log('✅ [FlowBuilder] Configuração salva com sucesso');

    res.json({
      success: true,
      message: 'Configuração salva com sucesso'
    });

  } catch (error) {
    console.error('❌ [FlowBuilder] Erro ao salvar configuração:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate-flow
 * Gerar template de fluxo usando IA
 */
app.post('/api/generate-flow', async (req, res) => {
  try {
    const { description } = req.body;

    console.log('🤖 [AI Generator] Recebida solicitação para gerar fluxo');
    console.log('📝 [AI Generator] Descrição:', description);

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Descrição é obrigatória'
      });
    }

    // Prompt para a IA gerar o template
    const systemPrompt = `Você é um especialista em criar fluxos de atendimento para agentes de IA.

Sua tarefa é analisar a descrição do usuário e gerar um fluxo de atendimento estruturado em passos.

TIPOS DE AÇÃO DISPONÍVEIS:
- greeting: Cumprimentar o cliente
- ask_info: Perguntar informações ao cliente
- collect_data: Coletar dados e salvar no CRM (use quando a descrição mencionar salvar clientes no CRM)
- show_catalog: Mostrar produtos ou serviços
- process_order: Processar pedido do cliente
- request_payment: Solicitar pagamento
- send_confirmation: Enviar confirmação
- ask_invoice: Perguntar sobre nota fiscal
- collect_address: Coletar endereço
- free_text: Texto livre personalizado
- custom: Ação personalizada

Você DEVE retornar APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):

{
  "name": "Nome do Template",
  "description": "Breve descrição",
  "steps": [
    {
      "type": "greeting",
      "title": "Título do Passo",
      "description": "Descrição detalhada do que fazer",
      "condition": ""
    }
  ]
}

IMPORTANTE:
- Crie entre 4 e 8 passos
- Sempre inclua o passo "greeting" como o PRIMEIRO
- No passo "greeting", escreva uma saudação clara e objetiva
- Se houver pagamento, o link deve ser enviado no WhatsApp, nunca por email
- Seja específico nas descrições
- Use os tipos corretos de ação
- Retorne APENAS o JSON, sem texto adicional`;

    const userPrompt = `Crie um fluxo de atendimento para: ${description}`;

    // Chamar a IA (OpenAI)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.error('❌ [AI Generator] OPENAI_API_KEY não configurada');
      return res.status(500).json({
        success: false,
        error: 'Chave da OpenAI não configurada. Configure OPENAI_API_KEY nas variáveis de ambiente.'
      });
    }

    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = openaiResponse.data.choices[0].message.content;
    console.log('🤖 [AI Generator] Resposta da IA:', aiResponse);

    // Parse do JSON
    let template;
    try {
      template = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ [AI Generator] Erro ao fazer parse do JSON:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar resposta da IA'
      });
    }

    // Garantir que os steps tenham IDs únicos
    if (template.steps) {
      template.steps = template.steps.map((step, index) => ({
        ...step,
        id: Date.now() + index,
        condition: step.condition || ''
      }));
      
      // Se a descrição mencionar salvamento no CRM, adicionar ou atualizar passo collect_data
      const descriptionLower = description.toLowerCase();
      if (descriptionLower.includes('salvar') && (descriptionLower.includes('crm') || descriptionLower.includes('cliente'))) {
        // Verificar se já existe um passo collect_data
        const hasCollectData = template.steps.some(step => step.type === 'collect_data');
        
        if (!hasCollectData) {
          // Adicionar passo de coleta de dados com salvamento no CRM
          const crmStep = {
            id: Date.now() + template.steps.length,
            type: 'collect_data',
            title: 'Salvar Cliente no CRM',
            description: 'Coletar e salvar automaticamente os dados do cliente no CRM (Nome, Telefone, Produto/Serviço de interesse)',
            condition: '',
            crmAutoSave: true,
            crmFields: ['name', 'phone', 'product']
          };
          
          // Inserir após o passo de cumprimento (se houver) ou no início
          const greetingIndex = template.steps.findIndex(step => step.type === 'greeting');
          if (greetingIndex >= 0) {
            template.steps.splice(greetingIndex + 1, 0, crmStep);
          } else {
            template.steps.unshift(crmStep);
          }
        } else {
          // Atualizar passo existente para incluir salvamento no CRM
          const collectDataStep = template.steps.find(step => step.type === 'collect_data');
          if (collectDataStep) {
            collectDataStep.crmAutoSave = true;
            collectDataStep.crmFields = collectDataStep.crmFields || ['name', 'phone', 'product'];
            collectDataStep.title = collectDataStep.title || 'Salvar Cliente no CRM';
            collectDataStep.description = collectDataStep.description || 'Coletar e salvar automaticamente os dados do cliente no CRM';
          }
        }
      }
    }

    console.log('✅ [AI Generator] Template gerado com sucesso');
    console.log('📊 [AI Generator] Steps:', template.steps?.length || 0);

    res.json({
      success: true,
      template: template
    });

  } catch (error) {
    console.error('❌ [AI Generator] Erro:', error.message);
    
    // Tratamento específico para erros da OpenAI
    if (error.response?.data) {
      console.error('📄 [AI Generator] Detalhes:', error.response.data);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar template com IA'
    });
  }
});

/**
 * POST /api/test-prompt
 * Testar prompt rapidamente com uma mensagem
 */
app.post('/api/test-prompt', async (req, res) => {
  try {
    const { systemPrompt, userMessage } = req.body;

    console.log('🧪 [Teste Rápido] Recebida solicitação de teste');
    console.log('   - Prompt length:', systemPrompt?.length || 0);
    console.log('   - Message length:', userMessage?.length || 0);

    if (!systemPrompt || !userMessage) {
      return res.status(400).json({
        error: 'systemPrompt e userMessage são obrigatórios'
      });
    }

    // Buscar API Key do ambiente ou usar a padrão
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'OPENAI_API_KEY não configurada no servidor'
      });
    }

    // Chamar OpenAI API
    const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = openaiResponse.data.choices[0].message.content;

    console.log('✅ [Teste Rápido] Resposta gerada com sucesso');

    res.json({
      response: aiResponse
    });

  } catch (error) {
    console.error('❌ [Teste Rápido] Erro:', error.message);
    
    res.status(500).json({
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * POST /api/improve-prompt
 * Melhorar prompt usando IA baseado em feedback do usuário
 */
app.post('/api/improve-prompt', async (req, res) => {
  try {
    const { currentPrompt, improvements } = req.body;

    console.log('✨ [Melhorador] Recebida solicitação de melhoria');
    console.log('   - Prompt length:', currentPrompt?.length || 0);
    console.log('   - Improvements length:', improvements?.length || 0);

    if (!currentPrompt || !improvements) {
      return res.status(400).json({
        error: 'currentPrompt e improvements são obrigatórios'
      });
    }

    // Buscar API Key do ambiente
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'OPENAI_API_KEY não configurada no servidor'
      });
    }

    // Prompt para a IA melhorar o prompt
    const improvementSystemPrompt = `Você é um especialista em criar e melhorar prompts para agentes de IA conversacionais.

Sua tarefa é analisar o prompt atual e as melhorias solicitadas pelo usuário, e retornar um prompt aprimorado que integre perfeitamente todas as melhorias desejadas.

IMPORTANTE:
- Mantenha toda a estrutura e conteúdo original do prompt
- Adicione as melhorias de forma natural e integrada
- Não remova nenhuma funcionalidade existente
- Seja específico e claro nas adições
- Retorne APENAS o prompt melhorado, sem explicações adicionais`;

    // Chamar OpenAI API
    const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: improvementSystemPrompt
        },
        {
          role: 'user',
          content: `PROMPT ATUAL:\n\n${currentPrompt}\n\n\nMELHORIAS SOLICITADAS PELO USUÁRIO:\n${improvements}\n\n\nPor favor, retorne o prompt melhorado abaixo:`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const improvedPrompt = openaiResponse.data.choices[0].message.content;

    console.log('✅ [Melhorador] Prompt melhorado com sucesso');

    res.json({
      improvedPrompt: improvedPrompt
    });

  } catch (error) {
    console.error('❌ [Melhorador] Erro:', error.message);
    
    res.status(500).json({
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * POST /api/generate-demo-conversation
 * Gerar conversa demonstração completa baseada no prompt configurado
 */
app.post('/api/generate-demo-conversation', async (req, res) => {
  try {
    const { systemPrompt } = req.body;

    console.log('💬 [Demo] Gerando conversa demonstração');
    console.log('   - Prompt length:', systemPrompt?.length || 0);

    if (!systemPrompt) {
      return res.status(400).json({
        error: 'systemPrompt é obrigatório'
      });
    }

    // Buscar API Key do ambiente
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'OPENAI_API_KEY não configurada no servidor'
      });
    }

    // Prompt para a IA gerar uma conversa demonstração completa
    const demoSystemPrompt = `Você é um especialista em criar conversas de demonstração para agentes de IA.

Sua tarefa é gerar uma conversa completa e realista entre um CLIENTE e um AGENTE DE IA, seguindo exatamente as instruções do prompt do agente.

REQUISITOS:
- Gere uma conversa natural e fluida
- Demonstre pelo menos 3-5 trocas de mensagens
- Comece com uma saudação do cliente
- Mostre diferentes aspectos do agente funcionando (ex: apresentação, atendimento, sugestões, etc)
- Termine de forma positiva (finalização de pedido, agendamento, ou esclarecimento)
- Retorne APENAS um JSON no formato:
{
  "conversation": [
    {"sender": "user", "text": "mensagem do cliente"},
    {"sender": "assistant", "text": "resposta do agente"},
    ...
  ]
}`;

    // Chamar OpenAI API para gerar a conversa
    const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: demoSystemPrompt
        },
        {
          role: 'user',
          content: `PROMPT DO AGENTE:\n\n${systemPrompt}\n\n\nGere uma conversa de demonstração que mostre este agente em ação. Retorne APENAS o JSON no formato especificado.`
        }
      ],
      temperature: 0.8,
      max_tokens: 1500
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const responseContent = openaiResponse.data.choices[0].message.content;
    let demoData;
    
    try {
      // Tentar extrair JSON se vier com texto adicional
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const jsonToParse = jsonMatch ? jsonMatch[0] : responseContent;
      demoData = JSON.parse(jsonToParse);
      
      // Validar estrutura
      if (!demoData.conversation || !Array.isArray(demoData.conversation)) {
        throw new Error('Estrutura de conversa inválida');
      }
    } catch (parseError) {
      console.error('❌ [Demo] Erro ao fazer parse do JSON:', parseError);
      console.error('   - Resposta recebida:', responseContent);
      return res.status(500).json({
        error: 'Erro ao processar resposta da IA: ' + parseError.message
      });
    }

    console.log('✅ [Demo] Conversa gerada com sucesso');
    console.log('   - Mensagens:', demoData.conversation?.length || 0);

    res.json({
      conversation: demoData.conversation || []
    });

  } catch (error) {
    console.error('❌ [Demo] Erro:', error.message);
    
    res.status(500).json({
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', async () => {
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
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME) {
    console.log(
      'ℹ️  [WHATSAPP] Hosting tipo Railway: mantenha 1 réplica no serviço que corre WPPConnect. ' +
        'Várias instâncias com o mesmo volume montado em WPP_TOKENS_BASE geram erro de perfil Chrome bloqueado.'
    );
    console.log('');
  }

  // Limpeza agressiva no deploy (desligada por padrão — evita QR a cada push)
  if (process.env.WHATSAPP_CLEANUP_SESSIONS_ON_DEPLOY === 'true') {
    console.log('');
    console.log('='.repeat(50));
    console.log('🧹 [CLEANUP] WHATSAPP_CLEANUP_SESSIONS_ON_DEPLOY=true — desconectando todas as sessões...');
    console.log('='.repeat(50));
    try {
      const sessionsSnapshot = await db.ref('whatsapp_sessions').once('value');
      const sessions = sessionsSnapshot.val();
      if (sessions) {
        for (const userId of Object.keys(sessions)) {
          console.log(`🔄 Desconectando: ${userId}`);
          await db.ref(`whatsapp_sessions/${userId}`).update({
            status: 'disconnected',
            qrCode: null,
            sessionToken: null,
            lastActivity: new Date().toISOString(),
            disconnectedAt: new Date().toISOString(),
            disconnectReason: 'deploy_cleanup'
          });
        }
        console.log(`✅ ${Object.keys(sessions).length} sessão(ões) marcadas como desconectadas`);
      }
    } catch (error) {
      console.error('❌ Erro ao limpar sessões:', error.message);
    }
    console.log('='.repeat(50));
  } else {
    console.log('');
    console.log('ℹ️  [WHATSAPP] Limpeza no deploy está DESLIGADA (padrão). Sessões não são resetadas ao reiniciar.');
    console.log('   Só desconecte pelo painel ou pelo telefone; para forçar limpeza em deploy, use WHATSAPP_CLEANUP_SESSIONS_ON_DEPLOY=true');
    console.log(`   📂 WPP_TOKENS_BASE=${getWppTokensBase()} (monte um volume Railway neste caminho para manter login entre deploys)`);
  }

  console.log(`📂 [WHATSAPP] Pasta de tokens: ${getWppTokensBase()}`);

  // Recriar clientes em memória para quem estava conectado (tokens em WPP_TOKENS_BASE no disco)
  if (process.env.WHATSAPP_AUTO_RESTORE_ON_STARTUP !== 'false') {
    try {
      const sessionsSnapshot = await db.ref('whatsapp_sessions').once('value');
      const sessions = sessionsSnapshot.val();
      if (sessions) {
        const stagger = Math.max(2000, parseInt(process.env.WHATSAPP_RESTORE_STAGGER_MS || '5000', 10) || 5000);
        const toRestore = Object.keys(sessions).filter((uid) => {
          const s = sessions[uid];
          return s && s.status === 'connected';
        });
        if (toRestore.length > 0) {
          console.log('');
          console.log('='.repeat(50));
          console.log(`🔄 [WHATSAPP] Restaurando ${toRestore.length} sessão(ões) em background (intervalo ${stagger}ms)...`);
          console.log(`   📂 Tokens: ${getWppTokensBase()} — sem volume persistente aqui, QR de novo após cada deploy.`);
          console.log('='.repeat(50));
          toRestore.forEach((userId, idx) => {
            setTimeout(() => {
              console.log(`🚀 [WHATSAPP] Restaurando sessão: ${userId}`);
              createSession(userId).catch((err) => {
                console.error(`❌ [WHATSAPP] Falha ao restaurar ${userId}:`, err.message);
              });
            }, idx * stagger);
          });
        } else {
          console.log('ℹ️  [WHATSAPP] Nenhuma sessão com status "connected" para restaurar no startup.');
        }
      }
    } catch (e) {
      console.error('❌ [WHATSAPP] Erro ao agendar restauração:', e.message);
    }
  } else {
    console.log('ℹ️  [WHATSAPP] Auto-restore desligado (WHATSAPP_AUTO_RESTORE_ON_STARTUP=false)');
  }

  console.log('');
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [ERRO CRÍTICO] Unhandled Rejection:', reason);
  console.error('   Promise:', promise);
  console.error('   Stack:', reason?.stack);
  // NÃO CRASHAR - apenas logar
});

process.on('uncaughtException', (error) => {
  console.error('❌ [ERRO CRÍTICO] Uncaught Exception:', error);
  console.error('   Message:', error.message);
  console.error('   Stack:', error.stack);
  // NÃO CRASHAR - apenas logar
  // Em produção, idealmente deveríamos reiniciar o processo de forma controlada
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  for (const uid of [...wppHealthCheckIntervals.keys()]) {
    clearWppHealthCheck(uid);
  }
  for (const userId of [...activeClients.keys()]) {
    try {
      await forceCloseWhatsAppSession(userId);
      console.log(`✅ Sessão fechada: ${userId}`);
    } catch (error) {
      console.error(`❌ Erro ao fechar sessão ${userId}:`, error);
    }
  }
  
  process.exit(0);
});

// ============================================
// ENDPOINT: Enviar Email via AWS SES
// ============================================
app.post('/api/email/send', async (req, res) => {
  try {
    const { templateId, template, recipients, userId } = req.body;

    if (!template || !recipients || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Template, recipients e userId são obrigatórios' 
      });
    }

    if (!sesClient) {
      return res.status(500).json({ 
        success: false, 
        error: 'AWS SES não configurado. Configure AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no backend.' 
      });
    }

    // Buscar lista de destinatários
    let recipientList = [];
    
    if (recipients === 'all') {
      // Buscar todos os usuários do Firebase
      const usersSnapshot = await db.ref('users/registered').once('value');
      if (usersSnapshot.exists()) {
        const usersData = usersSnapshot.val();
        recipientList = Object.values(usersData).map(u => ({
          email: u.email,
          name: u.name || u.email,
          uid: u.uid
        }));
      }
    } else if (Array.isArray(recipients)) {
      // Buscar usuários específicos
      for (const uid of recipients) {
        const userSnapshot = await db.ref(`users/registered/${uid}`).once('value');
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          recipientList.push({
            email: userData.email,
            name: userData.name || userData.email,
            uid: uid
          });
        }
      }
    }

    if (recipientList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhum destinatário encontrado' 
      });
    }

    // Buscar dados da empresa do master para variáveis
    let companyData = {};
    try {
      const companySnapshot = await db.ref(`users/data/${userId}/company_profile`).once('value');
      if (companySnapshot.exists()) {
        companyData = companySnapshot.val();
      }
    } catch (error) {
      console.error('Erro ao buscar dados da empresa:', error);
    }

    // Enviar emails
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const recipient of recipientList) {
      try {
        // Substituir variáveis no assunto e HTML
        let subject = template.subject || 'Sem assunto';
        let html = template.html || '';

        // Variáveis disponíveis
        const variables = {
          clientName: recipient.name || recipient.email.split('@')[0],
          clientEmail: recipient.email,
          companyName: companyData.companyName || 'Nossa Empresa'
        };

        // Substituir variáveis no assunto
        Object.keys(variables).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          subject = subject.replace(regex, variables[key]);
        });

        // Substituir variáveis no HTML
        Object.keys(variables).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          html = html.replace(regex, variables[key]);
        });

        // Enviar via AWS SES
        const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@ia-agente.com';
        
        const command = new SendEmailCommand({
          Source: fromEmail,
          Destination: {
            ToAddresses: [recipient.email]
          },
          Message: {
            Subject: {
              Data: subject,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: html,
                Charset: 'UTF-8'
              }
            }
          }
        });

        await sesClient.send(command);
        sentCount++;

        // Salvar histórico no Firebase
        const sendRef = db.ref(`email_sends`).push();
        await sendRef.set({
          templateId: templateId,
          templateName: template.name,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientUid: recipient.uid,
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentBy: userId
        });

        console.log(`✅ Email enviado para: ${recipient.email}`);
      } catch (error) {
        console.error(`❌ Erro ao enviar para ${recipient.email}:`, error);
        failedCount++;
        errors.push({
          email: recipient.email,
          error: error.message
        });

        // Salvar histórico de falha
        const sendRef = db.ref(`email_sends`).push();
        await sendRef.set({
          templateId: templateId,
          templateName: template.name,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientUid: recipient.uid,
          status: 'failed',
          error: error.message,
          sentAt: new Date().toISOString(),
          sentBy: userId
        });
      }
    }

    res.json({
      success: true,
      sentCount: sentCount,
      failedCount: failedCount,
      total: recipientList.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Erro ao processar envio de email:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

