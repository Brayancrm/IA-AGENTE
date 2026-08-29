'use client';

import Win2kLanding from './Win2kLanding';
export default function SimpleLanding({ onLoginSuccess }) {
  return <Win2kLanding onLoginSuccess={onLoginSuccess} />;
}

// ─── Legacy code kept below (unused) ────────────────────────────────────────

import React_legacy, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getDatabase, ref, push, set, onValue, off } from 'firebase/database';
import { useI18n } from '../contexts/I18nContext';

const trimEnv = (v) => (typeof v === 'string' ? v.trim() : v);

const firebaseConfig = {
  apiKey: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  databaseURL: 'https://ia-agente-b2f46.firebaseio.com'
};

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsappsalesagent';
const PLAN_CURRENCY_OPTIONS = ['R$', '$', '€'];

const normalizePlanCurrency = (currency) => (
  PLAN_CURRENCY_OPTIONS.includes(currency) ? currency : 'R$'
);

const isTvWplayPlan = (planId, planData) => {
  const raw = `${String(planId || '')} ${String(planData?.name || '')}`.toLowerCase();
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return (
    normalized.includes('tv/wplay') ||
    normalized.includes('tv / wplay') ||
    (normalized.includes('tv') && normalized.includes('wplay'))
  );
};

let app, db, auth, database;
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  database = getDatabase(app);
}

const SimpleLanding = ({ onLoginSuccess }) => {
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [mode, setMode] = useState('login'); // 'login' ou 'register'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    cnpj: '',
    whatsappNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        // Validar CPF/CNPJ antes de criar a conta - OBRIGATÓRIO
        if (!formData.cnpj || formData.cnpj.trim() === '') {
          setError('CPF/CNPJ é obrigatório.');
          setLoading(false);
          return;
        }

        // Validar formato antes de chamar API
        const cleanCpfCnpj = formData.cnpj.replace(/[^\d]/g, '');
        if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
          setError('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.');
          setLoading(false);
          return;
        }

        // Criar cliente no Stripe ANTES de criar conta no Firebase
        // Se não conseguir criar no Stripe, não permitir criar a conta
        let stripeCustomerId = null;
        console.log('🔍 [REGISTRO] Iniciando validação e criação de cliente no Stripe...');
        
        try {
          const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
          console.log('🔍 [REGISTRO] BACKEND_URL:', BACKEND_URL);
          
          const createCustomerResponse = await fetch(`${BACKEND_URL}/api/stripe/create-customer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: formData.companyName || formData.email,
              email: formData.email,
              cpfCnpj: formData.cnpj,
              phone: formData.whatsappNumber,
              mobilePhone: formData.whatsappNumber
            })
          });
          
          console.log('🔍 [REGISTRO] Resposta do servidor:', createCustomerResponse.status, createCustomerResponse.statusText);
          
          const customerData = await createCustomerResponse.json();
          console.log('🔍 [REGISTRO] Dados retornados:', customerData);
          
          if (!customerData.success || !customerData.valid) {
            const errorMsg = `CPF/CNPJ inválido: ${customerData.error || 'Não foi possível criar cliente no Stripe. Verifique se o documento é válido.'}`;
            console.error('❌ [REGISTRO] Falha na validação:', errorMsg);
            setError(errorMsg);
            setLoading(false);
            return;
          }
          
          if (!customerData.customerId) {
            const errorMsg = 'Erro: Cliente criado no Stripe mas ID não foi retornado. Tente novamente.';
            console.error('❌ [REGISTRO]', errorMsg);
            setError(errorMsg);
            setLoading(false);
            return;
          }
          
          stripeCustomerId = customerData.customerId;
          console.log('✅ [REGISTRO] Cliente criado no Stripe com sucesso! ID:', stripeCustomerId);
          
        } catch (error) {
          console.error('❌ [REGISTRO] Erro ao criar cliente no Stripe:', error);
          const errorMsg = `Erro ao validar CPF/CNPJ com o Stripe: ${error.message || 'Erro de conexão. Verifique se o documento é válido e tente novamente.'}`;
          setError(errorMsg);
          setLoading(false);
          return;
        }

        // Se chegou aqui, o cliente foi criado no Stripe com sucesso
        // Agora pode criar a conta no Firebase
        console.log('✅ [REGISTRO] Validação concluída. Criando conta no Firebase...');
        console.log('🔍 [REGISTRO] Firebase Auth inicializado:', auth ? 'OK' : 'ERRO');
        console.log('🔍 [REGISTRO] Criando usuário no Firebase Authentication...');
        console.log('🔍 [REGISTRO] Email:', formData.email);
        
        // Registrar usuário
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        console.log('✅ [REGISTRO] Usuário criado no Firebase Authentication com sucesso!');
        console.log('✅ [REGISTRO] User UID:', userCredential.user.uid);
        console.log('✅ [REGISTRO] User Email:', userCredential.user.email);
        
        // Salvar dados no Realtime Database
        if (database) {
          const userId = userCredential.user.uid;
          
          // Salvar em users/registered (nome e email para login)
          const usersRef = ref(database, 'users/registered');
          const newUserRef = push(usersRef);
          const userData = {
            name: formData.companyName || formData.email, // Usar companyName se não tiver name
            email: formData.email,
            uid: userId,
            isActive: true,
            isMaster: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            registeredVia: 'landing_page'
          };
          await set(newUserRef, userData);
          
          // Salvar em users/data/{userId}/company_profile (dados completos)
          const companyProfileRef = ref(database, `users/data/${userId}/company_profile`);
          await set(companyProfileRef, {
            companyName: formData.companyName,
            cnpj: formData.cnpj,
            whatsappNumber: formData.whatsappNumber,
            stripeCustomerId: stripeCustomerId, // Salvar ID do cliente no Stripe
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          console.log('✅ Dados salvos no Realtime Database:', { userId, userData });
        }
        
        onLoginSuccess();
      } else {
        // Login
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        onLoginSuccess();
      }
    } catch (error) {
      console.error('❌ [REGISTRO] Erro:', error);
      console.error('❌ [REGISTRO] Error code:', error.code);
      console.error('❌ [REGISTRO] Error message:', error.message);
      
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setError('Este email já está em uso. Se você já tem conta, faça login.');
            break;
          case 'auth/invalid-email':
            setError('Email inválido. Verifique o email digitado.');
            break;
          case 'auth/weak-password':
            setError('Senha muito fraca. Use uma senha com pelo menos 6 caracteres.');
            break;
          case 'auth/user-not-found':
            setError('Usuário não encontrado. Verifique o email.');
            break;
          case 'auth/wrong-password':
            setError('Senha incorreta.');
            break;
          case 'auth/invalid-credential':
            setError('Credenciais inválidas. Verifique email e senha.');
            break;
          default:
            setError(`Erro: ${error.message || 'Erro desconhecido. Tente novamente.'}`);
        }
      } else {
        setError(error.message || 'Erro desconhecido. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPasswordEmail || !forgotPasswordEmail.trim()) {
      setForgotPasswordError('Por favor, digite seu email.');
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordError('');

    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail.trim());
      setForgotPasswordSuccess(true);
      setForgotPasswordError('');
    } catch (error) {
      console.error('Erro ao enviar email de redefinição:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          setForgotPasswordError('Email não encontrado. Verifique se o email está correto.');
          break;
        case 'auth/invalid-email':
          setForgotPasswordError('Email inválido. Verifique o formato do email.');
          break;
        case 'auth/too-many-requests':
          setForgotPasswordError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
          break;
        default:
          setForgotPasswordError('Erro ao enviar email de recuperação. Tente novamente.');
      }
      setForgotPasswordSuccess(false);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const openModal = (authMode) => {
    setMode(authMode);
    setShowModal(true);
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowPlanModal(false);
    setMode('register');
    setShowModal(true);
  };

  // Buscar planos do Firebase
  useEffect(() => {
    if (!database) {
      console.log('⚠️ [LANDING] Database não disponível ainda');
      return;
    }

    console.log('🔍 [LANDING] Iniciando busca de planos...');
    const plansRef = ref(database, 'plans');
    
    const unsubscribe = onValue(plansRef, (snapshot) => {
      console.log('📥 [LANDING] Snapshot recebido do Firebase');
      const plansList = [];
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📋 [LANDING] Dados brutos recebidos:', Object.keys(data).length, 'planos');
        
        Object.keys(data).forEach((key) => {
          const planData = data[key];
          if (isTvWplayPlan(key, planData)) {
            return;
          }
          // Apenas planos ativos devem aparecer na landing page
          if (planData.active !== false) {
            plansList.push({ 
              id: key, 
              ...planData,
              currency: normalizePlanCurrency(planData.currency),
              limits: planData.limits || {
                messagesPerMonth: null,
                conversations: null,
                catalogItems: null,
                integrations: []
              }
            });
          }
        });
        // Ordenar por preço (menor primeiro), planos gratuitos primeiro
        plansList.sort((a, b) => {
          const priceA = parseFloat(a.price) || 0;
          const priceB = parseFloat(b.price) || 0;
          return priceA - priceB;
        });
      } else {
        console.log('⚠️ [LANDING] Nenhum plano encontrado no Firebase');
      }
      
      console.log('💎 [LANDING] Planos carregados:', plansList.length);
      setPlans(plansList);
    }, (error) => {
      console.error('❌ [LANDING] Erro ao buscar planos:', error);
      console.error('❌ [LANDING] Código do erro:', error.code);
      console.error('❌ [LANDING] Mensagem:', error.message);
      // Manter array vazio em caso de erro para não mostrar "Carregando..." indefinidamente
      setPlans([]);
    });

    return () => {
      off(plansRef);
    };
  }, [database]);

  // Função auxiliar para formatar preço
  const formatPrice = (price, isTrialPlan = false, currency = 'R$') => {
    // Planos trial são sempre gratuitos, independente do preço
    if (isTrialPlan || !price || price === 0) return { main: t('plans.free'), decimal: '' };
    const numPrice = parseFloat(price);
    const parts = numPrice.toFixed(2).split('.');
    return { main: `${normalizePlanCurrency(currency)} ${parts[0]}`, decimal: `,${parts[1]}` };
  };

  // Mapeamento de IDs de funcionalidades para labels
  const featureLabels = {
    'dashboard': 'Dashboard',
    'company': 'Cadastro do Usuário',
    'catalog': 'Catálogo',
    'agendamentos': 'Agendamentos',
    'conversas': 'Conversas WhatsApp',
    'crm': 'CRM',
    'integrations': 'Integrações',
    'whatsapp': 'Conexão WhatsApp',
    'assistant': 'Configuração do Assistente',
    'tutorials': 'Tutoriais'
  };

  // Função auxiliar para gerar features do plano baseado nas funcionalidades selecionadas
  const getPlanFeatures = (plan) => {
    // Prioridade 1: Se o plano tem allowedFeatures (funcionalidades selecionadas), usar elas
    if (plan.allowedFeatures && Array.isArray(plan.allowedFeatures) && plan.allowedFeatures.length > 0) {
      return plan.allowedFeatures.map(featureId => featureLabels[featureId] || featureId);
    }
    
    // Prioridade 2: Se o plano tem features definidas manualmente, usar elas
    if (plan.features && Array.isArray(plan.features) && plan.features.length > 0) {
      return plan.features;
    }
    
    // Prioridade 3: Caso contrário, gerar features baseadas nos limites (fallback)
    const features = [];
    const limits = plan.limits || {};
    
    // Adicionar features baseadas nos limites
    if (limits.messagesPerMonth) {
      features.push(`Até ${limits.messagesPerMonth.toLocaleString('pt-BR')} conversas/mês`);
    } else if (limits.messagesPerMonth === null) {
      features.push('Conversas ilimitadas');
    }
    
    if (limits.conversations) {
      features.push(`${limits.conversations} atendente${limits.conversations > 1 ? 's' : ''} simultâneo${limits.conversations > 1 ? 's' : ''}`);
    } else if (limits.conversations === null) {
      features.push('Atendentes ilimitados');
    }
    
    if (limits.catalogItems) {
      features.push(`Até ${limits.catalogItems} produtos no catálogo`);
    } else if (limits.catalogItems === null) {
      features.push('Catálogo ilimitado');
    }
    
    // Features padrão apenas se não houver nenhuma funcionalidade selecionada
    if (features.length === 0) {
      features.push('Catálogo de produtos');
      features.push('Respostas automáticas');
      features.push('Relatórios básicos');
      features.push('Suporte por email');
    }
    
    return features.slice(0, 6); // Limitar a 6 features para manter o layout
  };

  return (
    <>
      <style jsx>{`
        /* Reset e garantir que nada ultrapasse a tela */
        * {
          box-sizing: border-box;
        }
        
        body {
          overflow-x: hidden;
          margin: 0;
          padding: 0;
        }
        
        /* Estilos responsivos para mobile */
        @media (max-width: 768px) {
          .landing-header {
            padding: 15px 20px !important;
          }
          
          .landing-logo-header {
            width: 50px !important;
            height: 50px !important;
          }
          
          .landing-btn-header {
            padding: 8px 16px !important;
            font-size: 0.875rem !important;
          }
          
          .hero-section {
            padding: 100px 20px 60px !important;
          }
          
          .hero-logo {
            width: 120px !important;
            height: 120px !important;
          }
          
          .hero-title {
            font-size: 2rem !important;
            padding: 0 10px;
          }
          
          .hero-description {
            font-size: 1rem !important;
            padding: 0 10px;
          }
          
          .hero-buttons {
            flex-direction: column !important;
            width: 100% !important;
            padding: 0 20px;
          }
          
          .hero-btn {
            width: 100% !important;
          }
          
          .features-section,
          .how-it-works-section,
          .stats-section,
          .pricing-section,
          .cta-section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          
          .pricing-grid {
            grid-template-columns: 1fr !important;
            max-width: 100% !important;
            gap: 20px !important;
          }
          
          .modal-plan-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            max-width: 100% !important;
          }
          
          .modal-plan-container {
            max-width: 95vw !important;
            max-height: 85vh !important;
            overflow-y: auto !important;
            padding: 24px !important;
          }
        }
      `}</style>
      
    <div style={{
      minHeight: '100vh',
        backgroundColor: '#0f1419',
      color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        overflowX: 'hidden',
        width: '100%'
      }}>
      {/* Header */}
      <header 
        className="landing-header"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(26, 31, 54, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '20px 40px',
      display: 'flex',
          justifyContent: 'space-between',
      alignItems: 'center',
          zIndex: 1000
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/logo.png" 
            alt="dadosIA Logo"
            className="landing-logo-header"
            style={{ 
              width: '96px', 
              height: '96px',
              objectFit: 'contain'
            }} 
          />
        </div>
        <button
          onClick={() => openModal('login')}
          className="landing-btn-header"
          style={{
            backgroundColor: 'transparent',
            border: '2px solid #10b981',
            color: '#10b981',
            padding: '10px 24px',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#10b981';
            e.target.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.color = '#10b981';
          }}
        >
          Entrar
        </button>
      </header>

      {/* Hero Section */}
      <section 
        className="hero-section"
        style={{
          paddingTop: '140px',
          paddingBottom: '80px',
          textAlign: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '140px 40px 80px'
        }}
      >
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <img 
            src="/logo.png" 
            alt="dadosIA Logo"
            className="hero-logo"
            style={{ 
              width: '240px', 
              height: '240px',
              objectFit: 'contain'
            }} 
          />
        </div>
        <h1 
          className="hero-title"
          style={{
            fontSize: '3.5rem',
            fontWeight: '800',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #ffffff 0%, #10b981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: '1.2'
          }}
        >
          Transforme seu WhatsApp em<br />uma Máquina de Vendas
        </h1>
        <p 
          className="hero-description"
          style={{
            fontSize: '1.25rem',
            color: '#9ca3af',
            marginBottom: '40px',
            maxWidth: '700px',
            margin: '0 auto 40px',
            lineHeight: '1.6'
          }}>
          Automatize atendimentos, gerencie conversas e venda mais com inteligência artificial integrada ao seu WhatsApp
          </p>
        <div 
          className="hero-buttons"
          style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <button
            onClick={() => setShowPlanModal(true)}
            className="hero-btn"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '16px 40px',
              borderRadius: '12px',
              fontSize: '1.125rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 24px rgba(16, 185, 129, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
            }}
          >
            🚀 Começar Grátis
          </button>
          <button
            onClick={() => setShowInfoModal(true)}
            className="hero-btn"
            style={{
              backgroundColor: 'transparent',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: '16px 40px',
              borderRadius: '12px',
              fontSize: '1.125rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#10b981';
              e.target.style.color = '#10b981';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.target.style.color = '#ffffff';
            }}
          >
            📖 Saiba Mais
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section 
        className="features-section"
        style={{
        padding: '80px 40px',
        backgroundColor: '#1a1f36',
        borderTop: '1px solid rgba(16, 185, 129, 0.2)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: '16px',
            color: '#ffffff'
          }}>
            Tudo que você precisa em um só lugar
          </h2>
          <p style={{
            fontSize: '1.125rem',
            color: '#9ca3af',
            textAlign: 'center',
            marginBottom: '60px'
          }}>
            Recursos poderosos para automatizar e escalar suas vendas
          </p>

      <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px'
          }}>
            {[
              { icon: '🤖', title: 'IA Conversacional', desc: 'Assistente inteligente que conversa naturalmente com seus clientes 24/7' },
              { icon: '📦', title: 'Catálogo Digital', desc: 'Gerencie produtos e serviços de forma simples e envie para clientes' },
              { icon: '💬', title: 'Multi-Atendimento', desc: 'Gerencie múltiplas conversas simultaneamente em um dashboard' },
              { icon: '📅', title: 'Agendamentos', desc: 'Sistema completo de agendamentos com confirmações automáticas' },
              { icon: '💳', title: 'Pagamentos', desc: 'Integração com sistemas de pagamento para vendas online' },
              { icon: '📊', title: 'Relatórios', desc: 'Dashboard com métricas e insights sobre suas vendas e atendimentos' }
            ].map((feature, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#0f1419',
                  padding: '32px',
                  borderRadius: '16px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{feature.icon}</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '12px', color: '#ffffff' }}>
                  {feature.title}
                </h3>
                <p style={{ color: '#9ca3af', lineHeight: '1.6' }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section 
        className="how-it-works-section"
        style={{
        padding: '80px 40px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h2 style={{
            fontSize: '2.5rem',
          fontWeight: '700',
          textAlign: 'center',
            marginBottom: '16px',
          color: '#ffffff'
          }}>
          Como Funciona?
        </h2>
          <p style={{
            fontSize: '1.125rem',
          color: '#9ca3af',
          textAlign: 'center',
          marginBottom: '60px'
        }}>
          Comece em 3 passos simples
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '40px',
          position: 'relative'
        }}>
          {[
            { number: '1', title: 'Conecte seu WhatsApp', desc: 'Escaneie o QR Code e conecte sua conta em segundos' },
            { number: '2', title: 'Configure a IA', desc: 'Personalize respostas e defina seu catálogo de produtos' },
            { number: '3', title: 'Comece a Vender', desc: 'A IA atende clientes e você acompanha tudo pelo dashboard' }
          ].map((step, index) => (
            <div key={index} style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                margin: '0 auto 24px',
          display: 'flex',
          alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: '800',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
              }}>
                {step.number}
        </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px', color: '#ffffff' }}>
                {step.title}
              </h3>
              <p style={{ color: '#9ca3af', lineHeight: '1.6' }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Methods Section */}
      <section style={{
        padding: '80px 40px',
        backgroundColor: '#1a1f36',
        borderTop: '1px solid rgba(16, 185, 129, 0.2)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '16px'
          }}>
            Formas de Pagamento Aceitas
          </h3>
          <p style={{
            fontSize: '1rem',
            color: '#9ca3af',
            marginBottom: '48px'
          }}>
            Escolha a forma que preferir para pagar
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '32px',
            maxWidth: '900px',
            margin: '0 auto'
          }}>
            {[
              { icon: '💳', name: 'Cartão de Crédito', desc: 'Parcelamento em até 12x' },
              { icon: '🔷', name: 'PIX', desc: 'Aprovação instantânea' },
              { icon: '📄', name: 'Boleto', desc: 'Vencimento em 3 dias' },
              { icon: '₿', name: 'Criptomoeda', desc: 'Bitcoin e outras' }
            ].map((payment, index) => (
              <div key={index} style={{
                backgroundColor: '#0f1419',
                padding: '32px 24px',
                borderRadius: '16px',
                border: '2px solid rgba(16, 185, 129, 0.2)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{
                  fontSize: '3.5rem',
                  marginBottom: '16px',
                  filter: 'grayscale(0%)'
                }}>
                  {payment.icon}
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#ffffff',
                  marginBottom: '8px'
                }}>
                  {payment.name}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#9ca3af'
                }}>
                  {payment.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Badge de Segurança */}
          <div style={{
            marginTop: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '0.9375rem',
            color: '#9ca3af'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <span>Pagamentos 100% seguros e criptografados</span>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section 
        className="pricing-section"
        style={{
        padding: '100px 40px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: '16px',
          color: '#ffffff'
        }}>
          {t('plans.choosePlan')}
        </h2>
        <p style={{
          fontSize: '1.125rem',
          color: '#9ca3af',
          textAlign: 'center',
          marginBottom: '60px'
        }}>
          {t('plans.choosePlanSubtitle')}
        </p>

        <div 
          className="pricing-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: plans.length > 0 ? `repeat(${Math.min(plans.length, 4)}, 1fr)` : 'repeat(4, 1fr)',
            gap: '24px',
            maxWidth: '1600px',
            margin: '0 auto',
            padding: '0 20px'
          }}
        >
          {plans.length === 0 ? (
            <div style={{ 
              gridColumn: '1 / -1', 
              textAlign: 'center', 
              padding: '40px',
              color: '#9ca3af'
            }}>
              {t('plans.loadingPlans')}
            </div>
          ) : (
            plans.map((plan, index) => {
              // Planos trial são sempre gratuitos, independente do preço
              const isTrialPlan = plan.isTrialPlan === true;
              const price = formatPrice(plan.price, isTrialPlan, plan.currency);
              const features = getPlanFeatures(plan);
              const isFree = isTrialPlan || !plan.price || plan.price === 0;
              const isPopular = index === Math.floor(plans.length / 2); // Plano do meio como popular
              const isHighlighted = isFree || isPopular;
              
              return (
                <div
                  key={plan.id}
                  style={{
                    backgroundColor: '#1a1f36',
                    padding: '40px',
                    borderRadius: '20px',
                    border: isHighlighted ? '3px solid #10b981' : '2px solid rgba(16, 185, 129, 0.2)',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    boxShadow: isHighlighted ? '0 8px 24px rgba(16, 185, 129, 0.3)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.boxShadow = '0 16px 40px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = isHighlighted ? '#10b981' : 'rgba(16, 185, 129, 0.2)';
                    e.currentTarget.style.boxShadow = isHighlighted ? '0 8px 24px rgba(16, 185, 129, 0.3)' : 'none';
                  }}
                >
                  {/* Badge GRÁTIS ou POPULAR */}
                  {(isFree || isPopular) && (
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '6px 20px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      letterSpacing: '0.5px'
                    }}>
                      {isFree ? t('plans.free') : t('plans.mostPopular')}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                      {plan.name || 'Plano'}
                    </h3>
                    <div style={{ marginBottom: '8px' }}>
                      {isFree ? (
                        <span style={{ fontSize: '3rem', fontWeight: '800', color: '#10b981' }}>{t('plans.free')}</span>
                      ) : (
                        <>
                          <span style={{ fontSize: '3rem', fontWeight: '800', color: '#10b981' }}>{price.main}</span>
                          {price.decimal && <span style={{ fontSize: '1.25rem', color: '#9ca3af' }}>{price.decimal}</span>}
                        </>
                      )}
                    </div>
                    {!isFree && <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('plans.perMonth')}</div>}
                  </div>
                  
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px' }}>
                    {features.map((feature, idx) => (
                      <li key={idx} style={{ 
                        padding: '12px 0', 
                        color: isHighlighted ? '#ffffff' : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderBottom: idx < features.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}>
                        <span style={{ color: '#10b981', fontSize: '1.25rem' }}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      background: isHighlighted 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'transparent',
                      border: isHighlighted ? 'none' : '2px solid #10b981',
                      backgroundColor: isHighlighted ? undefined : 'transparent',
                      color: isHighlighted ? '#ffffff' : '#10b981',
                      fontSize: '1rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: isHighlighted ? '0 4px 16px rgba(16, 185, 129, 0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isHighlighted) {
                        e.target.style.backgroundColor = '#10b981';
                        e.target.style.color = '#ffffff';
                      } else {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isHighlighted) {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#10b981';
                      } else {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                      }
                    }}
                  >
                    {isFree ? `🚀 ${t('plans.startTrial')}` : t('plans.startNow')}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Garantia */}
        <div style={{
          textAlign: 'center',
          marginTop: '60px',
          padding: '32px',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🛡️</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
            Garantia de 7 dias
          </h3>
          <p style={{ fontSize: '1rem', color: '#9ca3af', maxWidth: '600px', margin: '0 auto' }}>
            Experimente sem riscos. Se não ficar satisfeito, devolvemos 100% do seu investimento.
          </p>
        </div>
      </section>

      {/* CTA Final Section */}
      <section 
        className="cta-section"
        style={{
        padding: '100px 40px',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          marginBottom: '24px',
          color: '#ffffff'
        }}>
          Pronto para vender mais?
        </h2>
        <p style={{
          fontSize: '1.25rem',
          color: '#9ca3af',
          marginBottom: '40px',
          lineHeight: '1.6'
        }}>
          Junte-se a centenas de empresas que já automatizaram suas vendas via WhatsApp
        </p>
        <button
          onClick={() => setShowPlanModal(true)}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '18px 48px',
            borderRadius: '12px',
            fontSize: '1.25rem',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 24px rgba(16, 185, 129, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
          }}
        >
          🚀 Começar Agora Grátis
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px',
        textAlign: 'center',
        borderTop: '1px solid rgba(16, 185, 129, 0.2)',
        color: '#9ca3af'
      }}>
        <p>© 2025 dadosIA. Todos os direitos reservados.</p>
      </footer>

      {/* Modal de Login/Registro */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1f36',
              borderRadius: '24px',
              padding: '48px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '1.5rem',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#9ca3af';
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ 
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <img 
                  src="/logo.png" 
                  alt="dadosIA Logo" 
                  style={{ 
                    width: '120px', 
                    height: '120px',
                    objectFit: 'contain'
                  }} 
                />
              </div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '700',
                marginBottom: '8px',
                color: '#ffffff'
              }}>
                {mode === 'login' ? 'Bem-vindo de volta!' : 'Criar sua conta'}
              </h2>
              <p style={{
                fontSize: '0.9375rem',
                color: '#9ca3af'
              }}>
                {mode === 'login' 
                  ? 'Entre para acessar seu dashboard' 
                  : 'Comece gratuitamente agora'
                }
              </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              style={{
                width: '100%',
                    padding: '14px 16px',
                borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#0f1419',
                    color: '#ffffff',
                fontSize: '1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
              }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

              <div style={{ marginBottom: '20px' }}>
            <input
              type="password"
              placeholder="Senha"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              required
              style={{
                width: '100%',
                    padding: '14px 16px',
                borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#0f1419',
                    color: '#ffffff',
                fontSize: '1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
              }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordEmail(formData.email || '');
                  setShowForgotPasswordModal(true);
                  setForgotPasswordSuccess(false);
                  setForgotPasswordError('');
                }}
                style={{
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                  padding: '4px 0'
                }}
                onMouseEnter={(e) => e.target.style.color = '#10b981'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >
                Esqueceu sua senha?
              </button>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Nome do Cliente/Razão Social"
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#0f1419',
                    color: '#ffffff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="CPF/CNPJ (000.000.000-00 ou 00.000.000/0000-00)"
                  value={formData.cnpj}
                  onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#0f1419',
                    color: '#ffffff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Número do WhatsApp (+55 11 99999-9999)"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#0f1419',
                    color: '#ffffff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </>
          )}

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#fecaca',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
                  background: loading ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
                  fontWeight: '700',
              fontSize: '1.125rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                  }
                }}
              >
                {loading ? 'Carregando...' : (mode === 'login' ? '🚀 Entrar' : '✨ Criar Conta Grátis')}
          </button>
        </form>

        {/* Toggle entre Login/Register */}
            <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{
              backgroundColor: 'transparent',
                  color: '#9ca3af',
              border: 'none',
              cursor: 'pointer',
                  fontSize: '0.9375rem',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease'
            }}
                onMouseEnter={(e) => e.target.style.color = '#10b981'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
          >
            {mode === 'login' 
                  ? 'Não tem conta? Criar conta →' 
                  : '← Já tem conta? Fazer login'
            }
          </button>
        </div>
      </div>
        </div>
      )}

      {/* Modal de Redefinição de Senha */}
      {showForgotPasswordModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2001,
            padding: '20px'
          }}
          onClick={() => {
            setShowForgotPasswordModal(false);
            setForgotPasswordEmail('');
            setForgotPasswordSuccess(false);
            setForgotPasswordError('');
          }}
        >
          <div
            style={{
              backgroundColor: '#1a1f36',
              borderRadius: '24px',
              padding: '48px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              onClick={() => {
                setShowForgotPasswordModal(false);
                setForgotPasswordEmail('');
                setForgotPasswordSuccess(false);
                setError('');
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '1.5rem',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#9ca3af';
              }}
            >
              ×
            </button>

            {/* Conteúdo do Modal */}
            {!forgotPasswordSuccess ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    fontSize: '2rem'
                  }}>
                    🔐
                  </div>
                  <h2 style={{
                    fontSize: '1.875rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '12px'
                  }}>
                    Esqueceu sua senha?
                  </h2>
                  <p style={{
                    fontSize: '0.9375rem',
                    color: '#9ca3af',
                    lineHeight: '1.6'
                  }}>
                    Digite seu email e enviaremos um link para redefinir sua senha
                  </p>
                </div>

                <form onSubmit={handleForgotPassword}>
                  <div style={{ marginBottom: '20px' }}>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                      disabled={forgotPasswordLoading}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid rgba(255,255,255,0.1)',
                        backgroundColor: '#0f1419',
                        color: '#ffffff',
                        fontSize: '1rem',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                        opacity: forgotPasswordLoading ? 0.6 : 1
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#10b981'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  {forgotPasswordError && (
                    <div style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#fecaca',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      fontSize: '0.875rem'
                    }}>
                      {forgotPasswordError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotPasswordLoading}
                    style={{
                      width: '100%',
                      background: forgotPasswordLoading ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '1.125rem',
                      border: 'none',
                      cursor: forgotPasswordLoading ? 'not-allowed' : 'pointer',
                      boxShadow: forgotPasswordLoading ? 'none' : '0 4px 16px rgba(16, 185, 129, 0.4)',
                      transition: 'all 0.2s ease',
                      marginBottom: '16px'
                    }}
                    onMouseEnter={(e) => {
                      if (!forgotPasswordLoading) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!forgotPasswordLoading) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                      }
                    }}
                  >
                    {forgotPasswordLoading ? 'Enviando...' : '📧 Enviar Link de Recuperação'}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontSize: '2rem'
                }}>
                  ✅
                </div>
                <h2 style={{
                  fontSize: '1.875rem',
                  fontWeight: '700',
                  color: '#ffffff',
                  marginBottom: '12px'
                }}>
                  Email enviado!
                </h2>
                <p style={{
                  fontSize: '0.9375rem',
                  color: '#9ca3af',
                  lineHeight: '1.6',
                  marginBottom: '32px'
                }}>
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                  <br />
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '8px', display: 'block' }}>
                    Não recebeu? Verifique a pasta de spam.
                  </span>
                </p>
                <button
                  onClick={() => {
                    setShowForgotPasswordModal(false);
                    setForgotPasswordEmail('');
                    setForgotPasswordSuccess(false);
                    setError('');
                  }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '16px',
                    borderRadius: '12px',
                    fontWeight: '700',
                    fontSize: '1.125rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                  }}
                >
                  Entendi
                </button>
              </div>
            )}
      </div>
        </div>
      )}

      {/* Modal "Saiba Mais" */}
      {showInfoModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
            overflowY: 'auto'
          }}
          onClick={() => setShowInfoModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1f36',
              borderRadius: '24px',
              padding: '48px',
              maxWidth: '800px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              onClick={() => setShowInfoModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '1.5rem',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#9ca3af';
              }}
            >
              ✕
            </button>

            {/* Conteúdo do Modal */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src="/logo.png" 
                  alt="dadosIA Logo" 
                  style={{ 
                    width: '300px', 
                    height: '300px',
                    objectFit: 'contain'
                  }} 
                />
              </div>
              <p style={{
                fontSize: '1.125rem',
                color: '#10b981',
                fontWeight: '600'
              }}>
                A Solução Completa para Automatizar suas Vendas
              </p>
            </div>

            {/* Descrição */}
            <div style={{ marginBottom: '40px' }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '16px'
              }}>
                🎯 O Que É?
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#9ca3af',
                lineHeight: '1.8',
                marginBottom: '20px'
              }}>
                O <strong style={{ color: '#10b981' }}>dadosIA</strong> é uma plataforma completa de automação de vendas via WhatsApp que integra inteligência artificial, gestão de conversas, catálogo de produtos e muito mais em um único sistema.
              </p>
              <p style={{
                fontSize: '1rem',
                color: '#9ca3af',
                lineHeight: '1.8'
              }}>
                Nossa solução permite que você atenda seus clientes 24/7, processe pedidos automaticamente e aumente suas vendas sem aumentar sua equipe.
              </p>
            </div>

            {/* Principais Benefícios */}
            <div style={{ marginBottom: '40px' }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '24px'
              }}>
                ✨ Principais Benefícios
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px'
              }}>
                {[
                  { icon: '🤖', title: 'Atendimento Automatizado', desc: 'IA responde perguntas e processa pedidos automaticamente' },
                  { icon: '⚡', title: 'Resposta Instantânea', desc: 'Seus clientes nunca mais ficarão esperando' },
                  { icon: '📈', title: 'Aumente suas Vendas', desc: 'Converta mais conversas em vendas reais' },
                  { icon: '💰', title: 'Reduza Custos', desc: 'Menos necessidade de equipe de atendimento' },
                  { icon: '📊', title: 'Dashboard Completo', desc: 'Veja todas as métricas e conversas em tempo real' },
                  { icon: '🔒', title: '100% Seguro', desc: 'Seus dados e dos clientes totalmente protegidos' }
                ].map((benefit, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#0f1419',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{benefit.icon}</div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                      {benefit.title}
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: '1.6' }}>
                      {benefit.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Como Funciona */}
            <div style={{ marginBottom: '40px' }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '24px'
              }}>
                🚀 Como Funciona
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { step: '1', title: 'Conecte seu WhatsApp', desc: 'Escaneie o QR Code em segundos e conecte sua conta' },
                  { step: '2', title: 'Configure seu Catálogo', desc: 'Adicione produtos, serviços e preços' },
                  { step: '3', title: 'Personalize a IA', desc: 'Ensine o assistente como responder seus clientes' },
                  { step: '4', title: 'Comece a Vender', desc: 'A IA cuida do atendimento, você acompanha tudo' }
                ].map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                    padding: '20px',
                    backgroundColor: '#0f1419',
                    borderRadius: '12px',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      color: '#ffffff',
                      flexShrink: 0
                    }}>
                      {item.step}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>
                        {item.title}
                      </h4>
                      <p style={{ fontSize: '0.9375rem', color: '#9ca3af', lineHeight: '1.6' }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <button
                onClick={() => {
                  setShowInfoModal(false);
                  setShowPlanModal(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '18px 48px',
                  borderRadius: '12px',
                  fontSize: '1.125rem',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 24px rgba(16, 185, 129, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
                }}
              >
                🚀 Começar Gratuitamente
              </button>
              <p style={{ marginTop: '16px', fontSize: '0.875rem', color: '#9ca3af' }}>
                Sem necessidade de cartão de crédito
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Plano */}
      {showPlanModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
            overflowY: 'auto'
          }}
          onClick={() => setShowPlanModal(false)}
        >
          <div
            className="modal-plan-container"
            style={{
              backgroundColor: '#1a1f36',
              borderRadius: '24px',
              padding: '48px',
              maxWidth: '1600px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              onClick={() => setShowPlanModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '1.5rem',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#9ca3af';
              }}
            >
              ✕
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <h2 style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                marginBottom: '16px',
                color: '#ffffff'
              }}>
                {t('plans.choosePlan')}
              </h2>
              <p style={{
                fontSize: '1.125rem',
                color: '#9ca3af'
              }}>
                {t('plans.choosePlanSubtitle')}
              </p>
            </div>

            {/* Cards de Planos */}
            <div 
              className="modal-plan-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: plans.length > 0 ? `repeat(${Math.min(plans.length, 4)}, 1fr)` : 'repeat(4, 1fr)',
                gap: '20px'
              }}
            >
              {plans.length === 0 ? (
                <div style={{ 
                  gridColumn: '1 / -1', 
                  textAlign: 'center', 
                  padding: '40px',
                  color: '#9ca3af'
                }}>
                  {t('plans.loadingPlans')}
                </div>
              ) : (
                plans.map((plan, index) => {
                  // Planos trial são sempre gratuitos, independente do preço
                  const isTrialPlan = plan.isTrialPlan === true;
                  const price = formatPrice(plan.price, isTrialPlan, plan.currency);
                  const features = getPlanFeatures(plan);
                  const isFree = isTrialPlan || !plan.price || plan.price === 0;
                  const isPopular = index === Math.floor(plans.length / 2);
                  const isHighlighted = isFree || isPopular;
                  
                  return (
                    <div
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan.id)}
                      style={{
                        backgroundColor: '#0f1419',
                        padding: '32px',
                        borderRadius: '16px',
                        border: isHighlighted ? '3px solid #10b981' : '2px solid rgba(16, 185, 129, 0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        boxShadow: isHighlighted ? '0 8px 24px rgba(16, 185, 129, 0.3)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 16px 40px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = isHighlighted ? '#10b981' : 'rgba(16, 185, 129, 0.2)';
                        e.currentTarget.style.boxShadow = isHighlighted ? '0 8px 24px rgba(16, 185, 129, 0.3)' : 'none';
                      }}
                    >
                      {(isFree || isPopular) && (
                        <div style={{
                          position: 'absolute',
                          top: '-12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          padding: '4px 16px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}>
                          {isFree ? t('plans.free') : t('plans.popular')}
                        </div>
                      )}
                      <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px', textAlign: 'center' }}>
                        {plan.name || 'Plano'}
                      </h3>
                      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div>
                          {isFree ? (
                            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>{t('plans.free')}</span>
                          ) : (
                            <>
                              <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>{price.main}</span>
                              <span style={{ fontSize: '1rem', color: '#9ca3af' }}>{price.decimal}/{t('plans.perMonth')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
                        {features.slice(0, 5).map((item, idx) => (
                          <li key={idx} style={{ 
                            padding: '8px 0', 
                            color: isHighlighted ? '#ffffff' : '#9ca3af', 
                            fontSize: '0.9375rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px' 
                          }}>
                            <span style={{ color: '#10b981' }}>✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div style={{
                        textAlign: 'center',
                        padding: '12px',
                        background: isHighlighted 
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '8px',
                        color: isHighlighted ? '#ffffff' : '#10b981',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {isFree ? `🚀 ${t('plans.startTrial')}` : t('plans.clickToSelect')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default SimpleLanding;
