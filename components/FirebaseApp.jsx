'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirebase } from '../hooks/useFirebase';

// Suprimir erros não críticos de scripts externos (Firebase/Vercel feedback)
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    const errorMessage = args[0]?.toString() || '';
    // Suprimir erros de feedback.html (Firebase/Vercel analytics)
    if (
      errorMessage.includes('Could not fetch session') ||
      errorMessage.includes('Failed to fetch Flags Explorer state') ||
      errorMessage.includes('feedback.html')
    ) {
      // Silenciar esses erros não críticos
      return;
    }
    // Manter outros erros
    originalError.apply(console, args);
  };
}
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, push, set, remove, onValue, off, get, update } from 'firebase/database';
import SimpleLanding from './SimpleLanding';
import dynamic from 'next/dynamic';
import { convertStepsToPrompt } from '../hooks/useFlowBuilder';
import { mergeFlowStepsIntoAssistantForm, applyFixedApproachesToSteps } from '../utils/assistantWizardHelpers';
import { useI18n } from '../contexts/I18nContext';
import BeefreeEditor from './BeefreeEditor';

// Unlayer Editor será carregado via script tag (embed)

// Import dinâmico para evitar problemas de SSR
const FlowBuilder = dynamic(() => import('./FlowBuilder'), { ssr: false });
const AssistantSetupWizard = dynamic(() => import('./AssistantSetupWizard'), { ssr: false });
const AgendamentoModal = dynamic(() => import('./AgendamentoModal'), { ssr: false });
const ConversasSimples = dynamic(() => import('./ConversasSimples'), { ssr: false });
const CRMDashboard = dynamic(() => import('./CRMDashboard'), { ssr: false });
import {
  Package,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Search,
  Filter,
  Star,
  Grid,
  List,
  Upload,
  Download,
  Tag,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  DollarSign,
  Target
} from 'lucide-react';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsappsalesagent';

const AGENDAMENTO_STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#eab308' },
  confirmado: { label: 'Confirmado', color: '#3b82f6' },
  em_andamento: { label: 'Em Andamento', color: '#8b5cf6' },
  concluido: { label: 'Concluído', color: '#10b981' },
  cancelado: { label: 'Cancelado', color: '#ef4444' }
};

const AGENDAMENTO_TIPO_ICON = {
  retirada: '📦',
  servico: '🔧',
  visita: '🏢',
  entrega: '🚚',
  ligacao: '📞'
};

const PLAN_CURRENCY_OPTIONS = ['R$', '$', '€'];

const normalizePlanCurrency = (currency) => (
  PLAN_CURRENCY_OPTIONS.includes(currency) ? currency : 'R$'
);

const formatPlanPrice = (plan) => (
  `${normalizePlanCurrency(plan?.currency)} ${parseFloat(plan?.price || 0).toFixed(2)}`
);

const FirebaseApp = () => {
  const { app, db, auth, database, isReady, error } = useFirebase();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [toast, setToast] = useState(null);

  // Estado para página de pagamento removido - agora redirecionamos diretamente

  // Estados dos dados
  const [companyProfile, setCompanyProfile] = useState({});
  const [integrationsConfig, setIntegrationsConfig] = useState({});
  const [assistantSettings, setAssistantSettings] = useState({});
  const [catalogItems, setCatalogItems] = useState([]);
  const [savedCategories, setSavedCategories] = useState([]); // Categorias salvas
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPlanSelectionModal, setShowPlanSelectionModal] = useState(false);
  const [showRequiredPlanModal, setShowRequiredPlanModal] = useState(false); // Modal obrigatório para novos usuários
  const [selectedUserForPlan, setSelectedUserForPlan] = useState(null);
  const [companyPhotoPreview, setCompanyPhotoPreview] = useState(null);
  const [uploadingCompanyPhoto, setUploadingCompanyPhoto] = useState(false);
  
  // Estados do WhatsApp
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');
  const [whatsappQRCode, setWhatsappQRCode] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Estados da seção Conversas
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [realConversations, setRealConversations] = useState([]);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  
  // Estados de Agendamentos
  const [agendamentos, setAgendamentos] = useState([]);
  const [loadingAgendamentos, setLoadingAgendamentos] = useState(false);
  const [showAgendamentoModal, setShowAgendamentoModal] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState(null);
  const [agendamentoFilter, setAgendamentoFilter] = useState('todos'); // todos, pendente, confirmado, concluido, cancelado
  const [agendamentoTypeFilter, setAgendamentoTypeFilter] = useState('todos'); // todos, retirada, servico, visita, etc
  const [agendamentoViewMode, setAgendamentoViewMode] = useState('lista'); // lista ou calendario
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null); // Data selecionada no calendário
  const [selectedDateAgendamentos, setSelectedDateAgendamentos] = useState([]); // Agendamentos da data selecionada
  
  // Estados de Planos
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  
  // Estados do plano do usuário logado
  const [userActivePlan, setUserActivePlan] = useState(null);
  const [userPlanUsage, setUserPlanUsage] = useState(null);
  const [usedTrials, setUsedTrials] = useState({}); // Planos de teste que o usuário já usou
  
  // CRM temporariamente desativado - será reconstruído depois
  
  // Estado do menu mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Inicializar isMobile verificando se window existe (SSR-safe)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  // Definir título da página
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'dadosIA';
    }
  }, []);

  // Detectar se está em mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Em mobile, fechar sidebar por padrão
      if (mobile) {
        setIsMobileMenuOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevenir zoom do usuário - Bloquear todos os métodos de zoom
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Prevenir zoom com teclado (Ctrl +, Ctrl -, Ctrl 0)
    const preventZoomKeyboard = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
        return false;
      }
      // Prevenir Ctrl + Scroll
      if ((e.ctrlKey || e.metaKey) && e.deltaY !== undefined) {
        e.preventDefault();
        return false;
      }
    };

    // Prevenir zoom com scroll + Ctrl
    const preventZoomScroll = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return false;
      }
    };

    // Prevenir pinch zoom (mobile)
    const preventPinchZoom = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
        return false;
      }
    };

    // Prevenir zoom com gestos (double tap)
    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
        return false;
      }
      lastTouchEnd = now;
    };

    // Prevenir zoom com wheel + Ctrl
    const preventWheelZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return false;
      }
    };

    // Adicionar event listeners
    document.addEventListener('keydown', preventZoomKeyboard, { passive: false });
    document.addEventListener('keyup', preventZoomKeyboard, { passive: false });
    document.addEventListener('wheel', preventZoomScroll, { passive: false });
    document.addEventListener('wheel', preventWheelZoom, { passive: false });
    document.addEventListener('touchstart', preventPinchZoom, { passive: false });
    document.addEventListener('touchmove', preventPinchZoom, { passive: false });
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

    // Forçar zoom inicial
    const setInitialZoom = () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }
    };
    setInitialZoom();

    // Limpar event listeners
    return () => {
      document.removeEventListener('keydown', preventZoomKeyboard);
      document.removeEventListener('keyup', preventZoomKeyboard);
      document.removeEventListener('wheel', preventZoomScroll);
      document.removeEventListener('wheel', preventWheelZoom);
      document.removeEventListener('touchstart', preventPinchZoom);
      document.removeEventListener('touchmove', preventPinchZoom);
      document.removeEventListener('touchend', preventDoubleTapZoom);
      document.removeEventListener('gesturestart', (e) => e.preventDefault());
      document.removeEventListener('gesturechange', (e) => e.preventDefault());
      document.removeEventListener('gestureend', (e) => e.preventDefault());
    };
  }, []);
  
  // URL do backend
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  // Função para mostrar toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Função auxiliar para formatar duração do trial (formato curto)
  const formatTrialDuration = (hours, minutes) => {
    const h = hours || 0;
    const m = minutes || 0;
    
    if (h === 0 && m === 0) {
      return '30min'; // Padrão
    }
    if (h === 0) {
      return `${m}min`;
    }
    if (m === 0) {
      return `${h}h`;
    }
    return `${h}h ${m}min`;
  };

  // Função auxiliar para formatar duração completa do trial
  const formatTrialDurationFull = (hours, minutes) => {
    const h = hours || 0;
    const m = minutes || 0;
    
    if (h === 0 && m === 0) {
      return '30 minutos (padrão)';
    }
    if (h === 0) {
      return `${m} minuto${m !== 1 ? 's' : ''}`;
    }
    if (m === 0) {
      return `${h} hora${h !== 1 ? 's' : ''}`;
    }
    return `${h}h ${m}min`;
  };

  // Componente SendEmailModal
  const SendEmailModal = ({ isOpen, onClose, template, users, database, user, showToast }) => {
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [sending, setSending] = useState(false);
    const [sendAll, setSendAll] = useState(false);

    if (!isOpen || !template) return null;

    const handleSend = async () => {
      if (!sendAll && selectedUsers.length === 0) {
        showToast(t('toast.selectAtLeastOneRecipient'), 'error');
        return;
      }

      setSending(true);
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const recipients = sendAll ? 'all' : selectedUsers;

        const response = await fetch(`${BACKEND_URL}/api/email/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateId: template.id,
            template: template,
            recipients: recipients,
            userId: user.uid
          })
        });

        const data = await response.json();

        if (data.success) {
          showToast(t('toast.emailSentCount', { count: data.sentCount }), 'success');
          onClose();
        } else {
          showToast(`${t('toast.emailSendError')}: ${data.error || t('toast.unknownError')}`, 'error');
        }
      } catch (error) {
        console.error('Erro ao enviar email:', error);
        showToast(`${t('toast.emailSendError')}: ${error.message}`, 'error');
      } finally {
        setSending(false);
      }
    };

    return (
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
          zIndex: 10001,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#1a1f36',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
              Enviar Email
            </h2>
            <button
              onClick={onClose}
              style={{
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
                borderRadius: '8px'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#ffffff', marginBottom: '12px', fontWeight: '600' }}>
              Template: {template.name}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '20px' }}>
              Assunto: {template.subject}
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#ffffff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sendAll}
                onChange={(e) => {
                  setSendAll(e.target.checked);
                  if (e.target.checked) setSelectedUsers([]);
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Enviar para todos os usuários</span>
            </label>

            {!sendAll && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px' }}>
                {users && users.length > 0 ? (
                  users.map((u) => (
                    <label key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#ffffff', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.uid)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, u.uid]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== u.uid));
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>{u.name || u.email} ({u.email})</span>
                    </label>
                  ))
                ) : (
                  <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Nenhum usuário encontrado</p>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              disabled={sending}
              style={{
                flex: 1,
                backgroundColor: '#6b7280',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                opacity: sending ? 0.5 : 1
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                flex: 1,
                background: sending ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
                boxShadow: sending ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              {sending ? 'Enviando...' : 'Enviar Email'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Componente Toast
  const Toast = ({ message, type, onClose }) => (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <span>{type === 'success' ? '✅' : '❌'}</span>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
        ✕
      </button>
    </div>
  );

  // Verificar se retornou do pagamento (Stripe/legado)
  useEffect(() => {
    if (!user || !database || !isReady) return;
    
    // Verificar se há parâmetro na URL indicando retorno do pagamento
    const urlParams = new URLSearchParams(window.location.search);
    const paymentReturn = urlParams.get('payment_return');
    const subscriptionIdFromUrl = urlParams.get('subscriptionId');
    
    // Verificar se há pagamento pendente no localStorage OU se veio da URL
    const pendingPaymentStr = localStorage.getItem('pendingPayment');
    
    // Se veio da URL mas não tem no localStorage, criar entrada
    if (paymentReturn && subscriptionIdFromUrl && !pendingPaymentStr) {
      console.log('📥 Retorno do pagamento detectado na URL');
      // Buscar planId da assinatura no Firebase
      const checkAndSave = async () => {
        try {
          const subscriptionsRef = ref(database, `subscriptions/${user.uid}`);
          const snapshot = await get(subscriptionsRef);
          if (snapshot.exists()) {
            const subscriptions = snapshot.val();
            const subscription = Object.values(subscriptions).find(
              sub => sub.stripeSubscriptionId === subscriptionIdFromUrl
            );
            if (subscription) {
              localStorage.setItem('pendingPayment', JSON.stringify({
                planId: subscription.planId,
                subscriptionId: subscriptionIdFromUrl,
                createdAt: Date.now()
              }));
            }
          }
        } catch (error) {
          console.error('Erro ao buscar assinatura:', error);
        }
      };
      checkAndSave();
      return; // Aguardar próxima execução do useEffect
    }
    
    if (!pendingPaymentStr) return;
    
    const pendingPayment = JSON.parse(pendingPaymentStr);
    
    // Verificar se o pagamento foi processado
    const checkPaymentStatus = async () => {
      try {
        // Buscar assinatura no Firebase
        const subscriptionsRef = ref(database, `subscriptions/${user.uid}`);
        const snapshot = await get(subscriptionsRef);
        
        if (!snapshot.exists()) {
          console.log('⏳ Aguardando processamento da assinatura...');
          return;
        }
        
      const subscriptions = snapshot.val();
      
      // Buscar a assinatura que corresponde ao subscriptionId do pendingPayment
      let foundSubscription = null;
      let subscriptionKey = null;
      
      Object.keys(subscriptions).forEach((key) => {
        const subData = subscriptions[key];
        if (subData.stripeSubscriptionId === pendingPayment.subscriptionId) {
          foundSubscription = subData;
          subscriptionKey = key;
        }
      });
      
      if (!foundSubscription) {
        console.log('⏳ Assinatura ainda não encontrada...');
        console.log('   Esperado subscriptionId:', pendingPayment.subscriptionId);
        console.log('   Assinaturas disponíveis:', Object.keys(subscriptions).map(key => ({
          key,
          stripeSubscriptionId: subscriptions[key].stripeSubscriptionId,
          status: subscriptions[key].status
        })));
        return;
      }
      
      // 🔍 LOGS DETALHADOS PARA DEBUG
      console.log('🔍 ========== VERIFICAÇÃO DE PAGAMENTO ==========');
      console.log('📋 Dados da Assinatura no Firebase:');
      console.log('   Subscription Key:', subscriptionKey);
      console.log('   Stripe Subscription ID:', foundSubscription.stripeSubscriptionId);
      console.log('   Status:', foundSubscription.status);
      console.log('   LastPayment ID:', foundSubscription.lastPayment);
      console.log('   LastPaymentDate:', foundSubscription.lastPaymentDate);
      console.log('   UpdatedAt:', foundSubscription.updatedAt);
      console.log('   PlanId:', foundSubscription.planId);
      console.log('   PlanName:', foundSubscription.planName);
      console.log('📋 Dados do PendingPayment (localStorage):');
      console.log('   SubscriptionId:', pendingPayment.subscriptionId);
      console.log('   PlanId:', pendingPayment.planId);
      console.log('   CreatedAt:', new Date(pendingPayment.createdAt).toISOString());
      console.log('==========================================');
      
      // Verificar se há confirmação de pagamento
      const hasPayment = foundSubscription.lastPayment || foundSubscription.lastPaymentDate;
      const isActive = foundSubscription.status === 'active' || foundSubscription.status === 'ACTIVE';
      
      console.log('🔍 Verificações:');
      console.log('   hasPayment (lastPayment OU lastPaymentDate):', hasPayment);
      console.log('   isActive (status ACTIVE):', isActive);
      
      if (hasPayment && isActive) {
        // Pagamento confirmado!
        console.log('✅ ========== PAGAMENTO CONFIRMADO! ==========');
        console.log('   LastPayment ID:', foundSubscription.lastPayment);
        console.log('   LastPaymentDate:', foundSubscription.lastPaymentDate);
        console.log('   Status:', foundSubscription.status);
        console.log('   Ativando plano...');
        console.log('==========================================');
        
        // Remover pagamento pendente do localStorage
        localStorage.removeItem('pendingPayment');
        
        // Limpar parâmetros da URL se houver
        if (window.location.search.includes('payment_return')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        
        // Atualizar página de planos
        setCurrentPage('plans');
        
        // Mostrar mensagem de sucesso
        showToast(t('toast.paymentConfirmed'), 'success');
        
        // Forçar recarregamento para garantir que os listeners do Firebase atualizem tudo
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
        return;
      } else {
        console.log('⏳ Aguardando confirmação do pagamento...');
        console.log('   Status:', foundSubscription.status);
        console.log('   LastPayment:', foundSubscription.lastPayment);
        console.log('   LastPaymentDate:', foundSubscription.lastPaymentDate);
        console.log('   ⚠️ Um dos campos necessários ainda não está presente.');
        console.log('   Aguardando webhook processar pagamento...');
        
        // Verificar também o activePlan diretamente
        const activePlanRef = ref(database, `users/data/${user.uid}/activePlan`);
        const activePlanSnapshot = await get(activePlanRef);
        
        if (activePlanSnapshot.exists()) {
          const activePlan = activePlanSnapshot.val();
          console.log('📋 ActivePlan encontrado:');
          console.log('   PlanId:', activePlan.planId);
          console.log('   PlanName:', activePlan.planName);
          console.log('   UpdatedAt:', activePlan.updatedAt);
          console.log('   SubscriptionId:', activePlan.stripeSubscriptionId);
          
          // Se o activePlan já existe e corresponde à assinatura sendo paga, o pagamento já foi processado
          // IMPORTANTE: Verificar pela assinatura (stripeSubscriptionId) pois em upgrades o planId pode ser diferente
          if (activePlan.stripeSubscriptionId === pendingPayment.subscriptionId) {
            // Verificar se é upgrade ou se corresponde ao mesmo plano
            const isUpgrade = activePlan.planId !== pendingPayment.planId;
            
            if (isUpgrade) {
              console.log('✅ Upgrade detectado! ActivePlan foi atualizado com novo plano.');
              console.log(`   Plano anterior: ${activePlan.planId} -> Novo plano: ${pendingPayment.planId}`);
            } else {
              console.log('✅ ActivePlan já corresponde ao plano pago! Pagamento foi processado.');
            }
            
            console.log('   Removendo pendingPayment e recarregando...');
            localStorage.removeItem('pendingPayment');
            if (window.location.search.includes('payment_return')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
            setCurrentPage('plans');
            showToast(isUpgrade ? t('toast.upgradeCompleted') : t('toast.planAlreadyActiveToast'), 'success');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
            return;
          }
        } else {
          console.log('📋 ActivePlan ainda não existe. Aguardando webhook criar...');
        }
      }
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
      }
    };
    
    // Verificar imediatamente e depois a cada 5 segundos
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 5000);
    
    return () => clearInterval(interval);
  }, [user, database, isReady, t]);

  // Verificar autenticação
  useEffect(() => {
    if (!auth || !isReady) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Verificar se é master apenas pelo email específico
        let isMaster = currentUser.email === 'brayan.italy@gmail.com';
        
        // Se não for o email master padrão, buscar no Realtime Database
        if (!isMaster && database) {
          try {
            const usersRef = ref(database, 'users/registered');
            const snapshot = await new Promise((resolve) => {
              onValue(usersRef, resolve, { onlyOnce: true });
            });
            
            if (snapshot.exists()) {
              const users = snapshot.val();
              // Procurar o usuário pelo UID
              const userEntry = Object.values(users).find(u => u.uid === currentUser.uid);
              if (userEntry && userEntry.isMaster === true) {
                isMaster = true;
              }
            }
          } catch (error) {
            console.error('Erro ao verificar status de master:', error);
          }
        }
        
        console.log('Usuário autenticado:', {
          email: currentUser.email,
          isMaster: isMaster,
          uid: currentUser.uid
        });
        
        setUser({ ...currentUser, isMaster });
        setIsAuthenticated(true);
      } else {
        console.log('Usuário não autenticado');
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, isReady]);

  // Listener separado para dados do Firestore e Realtime Database
  useEffect(() => {
    if (user && db && database) {
      console.log('Configurando listeners com:', { 
        hasUser: !!user, 
        hasDb: !!db, 
        hasDatabase: !!database,
        isMaster: user.isMaster 
      });
      const cleanup = setupFirestoreListeners();
      
      // Retornar função de limpeza se existir
      if (cleanup) {
        return cleanup;
      }
    }
  }, [user, db, database]);

  // Listener para carregar categorias salvas
  useEffect(() => {
    if (!user || !database) return;
    
    const categoriesRef = ref(database, `users/data/${user.uid}/categories`);
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      if (snapshot.exists()) {
        const categoriesData = snapshot.val();
        const categoriesList = Object.values(categoriesData).map(cat => cat.name).filter(Boolean);
        setSavedCategories(categoriesList.sort());
        console.log('✅ Categorias carregadas:', categoriesList);
      } else {
        setSavedCategories([]);
      }
    }, (error) => {
      console.error('Erro ao carregar categorias:', error);
    });
    
    return () => off(categoriesRef);
  }, [user, database]);


  // Listener para status do WhatsApp
  useEffect(() => {
    if (!user || !database) {
      console.log('⚠️ [WhatsApp Listener] Aguardando user ou database...');
      return;
    }

    console.log('🔄 [WhatsApp Listener] INICIANDO monitoramento em tempo real');
    console.log('📍 [WhatsApp Listener] Path:', `whatsapp_sessions/${user.uid}`);

    const sessionRef = ref(database, `whatsapp_sessions/${user.uid}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      console.log('📡 [WhatsApp Listener] Evento recebido do Firebase!');
      
      if (snapshot.exists()) {
        const session = snapshot.val();
        const newStatus = session.status || 'disconnected';
        
        console.log('✅ [WhatsApp Status] Dados encontrados no Firebase:');
        console.log('   Status:', newStatus);
        console.log('   Tem QR Code?', !!session.qrCode);
        console.log('   Timestamp:', new Date().toLocaleTimeString());
        
        setWhatsappStatus(newStatus);
        setWhatsappQRCode(session.qrCode || null);
        
        // Log visual diferente para cada status
        if (newStatus === 'connected') {
          console.log('🟢 WhatsApp CONECTADO!');
        } else if (newStatus === 'disconnected') {
          console.log('🔴 WhatsApp DESCONECTADO!');
        } else if (newStatus === 'qrcode') {
          console.log('📱 Aguardando QR Code...');
        } else if (newStatus === 'connecting') {
          console.log('🔄 Conectando...');
        }
      } else {
        console.log('⚠️ [WhatsApp Status] Nenhum dado encontrado no Firebase');
        console.log('   Path:', `whatsapp_sessions/${user.uid}`);
        console.log('   Definindo status como: disconnected');
        
        setWhatsappStatus('disconnected');
        setWhatsappQRCode(null);
      }
    }, (error) => {
      console.error('❌ [WhatsApp Listener] Erro ao monitorar status:', error);
      console.error('   Código:', error.code);
      console.error('   Mensagem:', error.message);
    });

    console.log('✅ [WhatsApp Listener] Listener configurado com sucesso!');
    console.log('   Atualizações em tempo real ATIVAS');

    return () => {
      console.log('🔌 [WhatsApp Listener] Desconectando listener...');
      off(sessionRef);
    };
  }, [user, database]);

  // 📅 Agendamentos serão carregados automaticamente pelo listener do Firebase (setupFirestoreListeners)

  // Monitorar mudanças no estado agendamentos
  useEffect(() => {
    if (agendamentos && Array.isArray(agendamentos)) {
      console.log('📅 [STATE CHANGED] agendamentos atualizado:', agendamentos.length);
    }
  }, [agendamentos]);

  // Monitorar mudanças no estado showAgendamentoModal
  useEffect(() => {
    if (typeof showAgendamentoModal !== 'undefined') {
      console.log('🔔 [STATE CHANGED] showAgendamentoModal:', showAgendamentoModal);
    }
  }, [showAgendamentoModal]);

  // Mostrar modal obrigatório de seleção de plano quando usuário não tem plano ativo
  useEffect(() => {
    // Não mostrar para usuários master
    if (user?.isMaster) {
      setShowRequiredPlanModal(false);
      return;
    }

    // IMPORTANTE: Não mostrar modal obrigatório se estiver na página de pagamento
    // Removido: paymentPage não é mais usado - redirecionamos diretamente
    if (false) {
      setShowRequiredPlanModal(false);
      return;
    }

    // Aguardar um pouco para garantir que os listeners foram configurados
    if (user && database && !userActivePlan && !loading) {
      const timer = setTimeout(() => {
        // Verificar novamente se ainda não tem plano
        if (!userActivePlan && !user?.isMaster) {
          setShowRequiredPlanModal(true);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [user, database, userActivePlan, loading]);

  // Configurar listeners do Realtime Database
  const setupFirestoreListeners = () => {
    if (!user || !database) return;

    const userId = user.uid;

    // Array para armazenar referências aos listeners
    const cleanupFunctions = [];

    // Listener para perfil da empresa no Realtime Database
    const companyRef = ref(database, `users/data/${userId}/company_profile`);
    onValue(companyRef, (snapshot) => {
      if (snapshot.exists()) {
        const profileData = snapshot.val();
        setCompanyProfile(profileData);
        // Atualizar preview da foto se existir
        if (profileData.photoURL) {
          setCompanyPhotoPreview(profileData.photoURL);
        } else {
          setCompanyPhotoPreview(null);
        }
      } else {
        setCompanyProfile({});
        setCompanyPhotoPreview(null);
      }
    });
    cleanupFunctions.push(() => off(companyRef));

    // Listener para configurações de integração no Realtime Database
    const integrationsRef = ref(database, `users/data/${userId}/integrations_config`);
    onValue(integrationsRef, (snapshot) => {
      if (snapshot.exists()) {
        setIntegrationsConfig(snapshot.val());
      } else {
        setIntegrationsConfig({});
      }
    });
    cleanupFunctions.push(() => off(integrationsRef));

    // Listener para configurações do assistente no Realtime Database
    const assistantRef = ref(database, `users/data/${userId}/assistant_settings`);
    onValue(assistantRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📖 [LOAD] Configurações do assistente carregadas:', {
          flowMode: data.flowMode,
          flowSteps: data.flowSteps?.length || 0,
          systemPromptLength: data.systemPrompt?.length || 0
        });
        setAssistantSettings(data);
      } else {
        console.log('⚠️ [LOAD] Nenhuma configuração do assistente encontrada');
        setAssistantSettings({});
      }
    });
    cleanupFunctions.push(() => off(assistantRef));

    // Listener para itens do catálogo no Realtime Database
    const catalogRef = ref(database, `users/data/${userId}/catalog_items`);
    onValue(catalogRef, (snapshot) => {
      const items = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach((key) => {
          const item = data[key];
          // Validar: ignorar itens null ou sem name (resquícios de deleção)
          if (item && item.name) {
            items.push({ id: key, ...item });
          }
        });
        // Ordenar por data de criação (mais recente primeiro)
        items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }
      setCatalogItems(items);
    });
    cleanupFunctions.push(() => off(catalogRef));

    // 📅 Listener para agendamentos no Realtime Database
    const agendamentosRef = ref(database, `users/data/${userId}/agendamentos`);
    onValue(agendamentosRef, (snapshot) => {
      const agendamentosList = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach((key) => {
          agendamentosList.push({ id: key, ...data[key] });
        });
        // Ordenar por data (mais recente primeiro)
        agendamentosList.sort((a, b) => {
          const dateA = new Date(a.data + ' ' + a.horario);
          const dateB = new Date(b.data + ' ' + b.horario);
          return dateB - dateA;
        });
      }
      console.log('📅 [FIREBASE] Agendamentos carregados:', agendamentosList.length);
      setAgendamentos(agendamentosList);
    });
    cleanupFunctions.push(() => off(agendamentosRef));

    // 💎 Listener para planos (todos os usuários precisam ver os planos)
    const plansRef = ref(database, 'plans');
    onValue(plansRef, (snapshot) => {
      const plansList = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach((key) => {
          const planData = data[key];
          // Garantir que limits existe com valores padrão
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
        });
        // Ordenar por preço (menor primeiro)
        plansList.sort((a, b) => (a.price || 0) - (b.price || 0));
      }
      console.log('💎 [FIREBASE] Planos carregados:', plansList.length);
      setPlans(plansList);
    });
    cleanupFunctions.push(() => off(plansRef));

    // 👤 Listener para plano ativo do usuário
    const activePlanRef = ref(database, `users/data/${userId}/activePlan`);
    onValue(activePlanRef, async (snapshot) => {
      if (snapshot.exists()) {
        const plan = snapshot.val();
        
        // Proteção: garantir que plan não seja null
        if (!plan) {
          console.log('👤 [FIREBASE] Plano existe mas dados são null');
          setUserActivePlan(null);
          setUserPlanUsage(null);
          return;
        }
        
        console.log('👤 [FIREBASE] Plano ativo carregado:', plan.planName);
        
        // Verificar se plano de teste expirou
        // IMPORTANTE: NÃO remover plano se estiver na página de pagamento (aguardando confirmação)
        if (plan.isTrialPlan && plan.nextDueDate) {
          const expirationDate = new Date(plan.nextDueDate);
          const now = new Date();
          
          if (now > expirationDate) {
            console.log('⏰ Plano de teste expirado! Desativando...');
            // Remover plano expirado
            await remove(activePlanRef);
            setUserActivePlan(null);
            setUserPlanUsage(null);
            showToast(t('toast.trialExpiredSubscribe'), 'error');
            return;
          }
        }
        
        setUserActivePlan(plan);
        // Se usuário não for master e tiver plano ativo, fechar modal obrigatório se estiver aberto
        if (!user?.isMaster && plan) {
          setShowRequiredPlanModal(false);
        }
        
        // Buscar uso atual
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const usageRef = ref(database, `users/data/${userId}/messagesUsage/${monthKey}`);
        onValue(usageRef, (usageSnapshot) => {
          const usage = usageSnapshot.val() || 0;
          setUserPlanUsage({
            messagesPerMonth: {
              used: usage,
              limit: plan.limits?.messagesPerMonth || null
            }
          });
        });
        cleanupFunctions.push(() => off(usageRef));
      } else {
        console.log('👤 [FIREBASE] Usuário sem plano ativo');
        
        // Limpar plano ativo
        setUserActivePlan(null);
        setUserPlanUsage(null);
      }
    });
    cleanupFunctions.push(() => off(activePlanRef));

    // Listener para planos de teste já usados pelo usuário
    const usedTrialsRef = ref(database, `users/data/${userId}/usedTrials`);
    onValue(usedTrialsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const trials = snapshot.val();
          setUsedTrials(trials || {});
        } else {
          setUsedTrials({});
        }
      } catch (error) {
        console.error('Erro ao carregar usedTrials:', error);
        setUsedTrials({}); // Garantir que sempre tenha um valor padrão
      }
    });
    cleanupFunctions.push(() => off(usedTrialsRef));

    // Se for usuário master, ouvir usuários registrados no Realtime Database
    if (user.isMaster && database) {
      console.log('Configurando listener para usuários registrados no Realtime Database');
      
      const usersRef = ref(database, 'users/registered');
      
      const unsubscribe = onValue(usersRef, async (snapshot) => {
        console.log('Snapshot de usuários recebido do Realtime Database');
        const usersList = [];
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log('Dados recebidos:', data);
          
          // Processar cada usuário e buscar plano ativo
          for (const key of Object.keys(data)) {
            const userData = { id: key, ...data[key] };
            
            // Buscar plano ativo e dados de company_profile se tiver uid
            // IMPORTANTE: Só tentar acessar se o usuário atual for master e estiver autenticado
            if (userData.uid && database && user?.isMaster && user?.uid) {
              try {
                // Buscar plano ativo
                const activePlanRef = ref(database, `users/data/${userData.uid}/activePlan`);
                const planSnapshot = await get(activePlanRef);
                if (planSnapshot.exists()) {
                  const planData = planSnapshot.val();
                  userData.activePlan = planData.planName || planData.planId || 'Plano Ativo';
                  userData.hasActivePlan = true;
                } else {
                  userData.activePlan = undefined;
                  userData.hasActivePlan = false;
                }
                
                // Buscar dados de company_profile
                const companyProfileRef = ref(database, `users/data/${userData.uid}/company_profile`);
                const companySnapshot = await get(companyProfileRef);
                if (companySnapshot.exists()) {
                  const companyData = companySnapshot.val();
                  userData.companyName = companyData.companyName || '';
                  userData.cnpj = companyData.cnpj || '';
                  userData.whatsappNumber = companyData.whatsappNumber || '';
                }
              } catch (error) {
                // Ignorar erros de permissão silenciosamente (são esperados quando não é master)
                if (error.code !== 'PERMISSION_DENIED') {
                console.error('Erro ao buscar dados do usuário:', userData.uid, error);
                }
              }
            }
            
            usersList.push(userData);
          }
        } else {
          console.log('Nenhum usuário encontrado no Realtime Database');
        }
        
        // Ordenar por data de criação (mais recente primeiro)
        usersList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        console.log('Lista de usuários atualizada:', usersList.length, 'usuários');
        setUsers(usersList);
      }, (error) => {
        console.error('Erro no listener de usuários do Realtime Database:', error);
      });
      
      cleanupFunctions.push(() => off(usersRef));
    } else {
      console.log('Usuário não é master ou database não disponível');
    }

    // Retornar função de limpeza que remove todos os listeners
    return () => {
      console.log('🧹 Limpando todos os listeners do Realtime Database');
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  };

  // Funções de salvamento no Realtime Database
  const saveCompanyProfile = async (data) => {
    if (!user || !database) return;
    
    try {
      const companyRef = ref(database, `users/data/${user.uid}/company_profile`);
      await set(companyRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
      
      // NOTA: Não atualizamos photoURL no Auth porque Base64 é muito longo para o Auth
      // A foto fica apenas no Realtime Database (company_profile.photoURL)
      
      showToast(t('toast.companyProfileSaved'));
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      showToast(t('toast.companyProfileSaveError'), 'error');
    }
  };
  
  // Função para fazer upload de foto de perfil no companyForm
  // Agora salva como Base64 no Realtime Database (sem usar Storage)
  const handleCompanyPhotoUpload = async (file) => {
    if (!file || !user || !user.uid || !database) {
      showToast(t('toast.unauthenticatedOrDb'), 'error');
      return;
    }
    
    setUploadingCompanyPhoto(true);
    try {
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        showToast(t('toast.invalidImageFormat'), 'error');
        setUploadingCompanyPhoto(false);
        return;
      }
      
      // Validar tamanho (máximo 2MB para Base64 - menor que Storage para evitar problemas)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        showToast(t('toast.imageMax2mbForDb'), 'error');
        setUploadingCompanyPhoto(false);
        return;
      }
      
      // Converter arquivo para Base64
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // reader.result contém "data:image/jpeg;base64,..."
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      // Atualizar preview (setCompanyForm está no DashboardWithFirebase, não aqui)
      setCompanyPhotoPreview(base64String);
      
      // Salvar automaticamente no perfil no Realtime Database
      await saveCompanyProfile({
        ...companyProfile,
        photoURL: base64String
      });
      
      showToast(t('toast.photoSavedSuccess'), 'success');
    } catch (error) {
      console.error('Erro ao processar a foto:', error);
      showToast(`${t('toast.photoProcessErrorWithMessage')}: ${error.message || t('toast.unknownError')}`, 'error');
    } finally {
      setUploadingCompanyPhoto(false);
    }
  };

  const saveIntegrationsConfig = async (data) => {
    if (!user || !database) return;
    
    try {
      const integrationsRef = ref(database, `users/data/${user.uid}/integrations_config`);
      await set(integrationsRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
      showToast(t('toast.integrationSettingsSaved'));
    } catch (error) {
      console.error('Erro ao salvar integrações:', error);
      showToast(t('toast.settingsSaveError'), 'error');
    }
  };

  const saveAssistantSettings = async (data) => {
    if (!user || !database) return;
    
    try {
      const dataToSave = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      console.log('💾 [SAVE] Salvando configurações do assistente:', {
        flowMode: dataToSave.flowMode,
        flowSteps: dataToSave.flowSteps?.length || 0,
        systemPromptLength: dataToSave.systemPrompt?.length || 0
      });
      
      const assistantRef = ref(database, `users/data/${user.uid}/assistant_settings`);
      await set(assistantRef, dataToSave);
      
      console.log('✅ [SAVE] Configurações salvas com sucesso!');
      showToast(t('toast.assistantSettingsSaved'));
    } catch (error) {
      console.error('❌ [SAVE] Erro ao salvar assistente:', error);
      showToast(t('toast.settingsSaveError'), 'error');
    }
  };

  // Funções de gerenciamento de planos (apenas master)
  const savePlan = async (planData) => {
    if (!user?.isMaster || !database) {
      showToast(t('toast.masterOnlyPlans'), 'error');
      return;
    }
    
    try {
      const data = {
        ...planData,
        price: parseFloat(planData.price) || 0,
        currency: normalizePlanCurrency(planData.currency),
        createdAt: planData.id ? null : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (editingPlan) {
        // Atualizar plano existente
        const planRef = ref(database, `plans/${editingPlan.id}`);
        await set(planRef, data);
        
        // Atualizar planos ativos de todos os usuários que têm este plano
        try {
          console.log(`🔄 Atualizando planos ativos para plano editado: ${editingPlan.id} (${editingPlan.name})`);
          const usersRef = ref(database, 'users/registered');
          const usersSnapshot = await get(usersRef);
          
          if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            const updatePromises = [];
            let foundCount = 0;
            
            for (const userId of Object.keys(usersData)) {
              const userData = usersData[userId];
              if (userData.uid) {
                const activePlanRef = ref(database, `users/data/${userData.uid}/activePlan`);
                const activePlanSnapshot = await get(activePlanRef);
                
                if (activePlanSnapshot.exists()) {
                  const activePlan = activePlanSnapshot.val();
                  // Verificar se o plano ativo do usuário corresponde ao plano editado
                  // Comparando pelo ID do plano (mais confiável)
                  const matchesById = activePlan.planId === editingPlan.id;
                  const matchesByName = activePlan.planName === editingPlan.name;
                  
                  if (matchesById || matchesByName) {
                    foundCount++;
                    console.log(`  ✓ Encontrado plano ativo para usuário ${userData.uid}: ${activePlan.planName} (planId: ${activePlan.planId})`);
                    // Atualizar allowedFeatures e limits do plano ativo do usuário
                    const updatedActivePlan = {
                      ...activePlan,
                      currency: data.currency,
                      allowedFeatures: data.allowedFeatures || [],
                      limits: data.limits || activePlan.limits,
                      updatedAt: new Date().toISOString()
                    };
                    updatePromises.push(set(activePlanRef, updatedActivePlan));
                    console.log(`  ✓ Atualizando allowedFeatures:`, updatedActivePlan.allowedFeatures);
                  }
                }
              }
            }
            
            if (updatePromises.length > 0) {
              await Promise.all(updatePromises);
              console.log(`✅ Planos ativos atualizados para ${updatePromises.length} usuário(s)`);
              showToast(t('toast.planUpdatedWithUsersCount', { count: updatePromises.length }), 'success');
            } else {
              console.log(`ℹ️ Nenhum plano ativo encontrado para atualizar`);
              showToast(t('toast.planUpdated'));
            }
          } else {
            showToast(t('toast.planUpdated'));
          }
        } catch (updateError) {
          console.error('❌ Erro ao atualizar planos ativos dos usuários:', updateError);
          // Não bloquear o salvamento do plano se houver erro ao atualizar planos ativos
          showToast(t('toast.planUpdatedPartialWarning'));
        }
      } else {
        // Criar novo plano
        const plansRef = ref(database, 'plans');
        const newPlanRef = push(plansRef);
        await set(newPlanRef, data);
        showToast(t('toast.planCreated'));
      }
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      showToast(`${t('toast.planSaveErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const deletePlan = async (planId) => {
    if (!user?.isMaster || !database) {
      showToast(t('toast.masterOnlyPlans'), 'error');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      const planRef = ref(database, `plans/${planId}`);
      await remove(planRef);
      showToast(t('toast.planDeleted'));
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      showToast(`${t('toast.planDeleteErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const openPlanModal = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
    } else {
      setEditingPlan(null);
    }
    setShowPlanModal(true);
  };

  // Função para assinar um plano
  const subscribeToPlan = async (plan) => {
    if (!user || !database) {
      showToast(t('toast.unauthenticated'), 'error');
      return;
    }

    try {
      // Se for plano de teste com uso único, verificar se usuário já usou
      if (plan.isTrialPlan && plan.oneTimeUse) {
        const usedTrialsRef = ref(database, `users/data/${user.uid}/usedTrials`);
        const usedTrialsSnapshot = await get(usedTrialsRef);
        const usedTrials = usedTrialsSnapshot.exists() ? usedTrialsSnapshot.val() : {};
        
        if (usedTrials[plan.id]) {
          showToast(t('toast.trialAlreadyUsed'), 'error');
          return;
        }
      }
      
      // Se for plano de teste, ativar diretamente sem passar por gateway (independente do preço)
      if (plan.isTrialPlan) {
        // Calcular data de expiração considerando horas e minutos
        const hours = plan.trialDurationHours || 0;
        const minutes = plan.trialDurationMinutes || 30;
        const totalMilliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
        const expirationDate = new Date(Date.now() + totalMilliseconds);
        const nextDueDate = expirationDate.toISOString();
        
        // Ativar plano diretamente
        const activePlanRef = ref(database, `users/data/${user.uid}/activePlan`);
        await set(activePlanRef, {
          planId: plan.id,
          planName: plan.name,
          currency: normalizePlanCurrency(plan.currency),
          startedAt: new Date().toISOString(),
          nextDueDate: nextDueDate,
          isTrialPlan: true,
          trialDurationHours: plan.trialDurationHours || 0,
          trialDurationMinutes: plan.trialDurationMinutes || 30,
          allowedFeatures: plan.allowedFeatures || [],
          limits: plan.limits || {
            messagesPerMonth: null,
            conversations: null,
            catalogItems: null,
            integrations: []
          }
        });
        
        // Se for uso único, marcar como usado
        if (plan.oneTimeUse) {
          const usedTrialsRef = ref(database, `users/data/${user.uid}/usedTrials/${plan.id}`);
          await set(usedTrialsRef, {
            usedAt: new Date().toISOString(),
            planName: plan.name
          });
        }
        
        const durationText = hours === 0 
          ? `${minutes} minuto${minutes !== 1 ? 's' : ''}`
          : minutes === 0
          ? `${hours} hora${hours !== 1 ? 's' : ''}`
          : `${hours}h ${minutes}min`;
        
        showToast(t('toast.trialPlanActivatedWithDuration', { name: plan.name, duration: durationText }));
        // Fechar modal obrigatório se estiver aberto
        setShowRequiredPlanModal(false);
        return;
      }
      
      // Buscar dados do usuário
      const usersRef = ref(database, `users/registered`);
      const userSnapshot = await get(usersRef);
      const users = userSnapshot.val() || {};
      const userEntry = Object.values(users).find(u => u.uid === user.uid);
      
      if (!userEntry) {
        showToast(t('toast.userDataNotFound'), 'error');
        return;
      }

      // Buscar CPF/CNPJ do company_profile
      const companyProfileRef = ref(database, `users/data/${user.uid}/company_profile`);
      const companyProfileSnapshot = await get(companyProfileRef);
      const companyProfile = companyProfileSnapshot.val() || {};

      // Preparar dados do cliente
      const customerData = {
        name: companyProfile.companyName || userEntry.name || userEntry.email,
        email: userEntry.email,
        phone: companyProfile.whatsappNumber || user.phoneNumber || '',
        mobilePhone: companyProfile.whatsappNumber || user.phoneNumber || ''
      };

      // Adicionar CPF/CNPJ se existir
      if (companyProfile.cnpj) {
        customerData.cpfCnpj = companyProfile.cnpj.replace(/[^\d]/g, '');
      }

      // Chamar API do backend para criar assinatura
      console.log('💳 Iniciando criação de assinatura...');
      console.log('   BACKEND_URL:', BACKEND_URL);
      console.log('   URL completa:', `${BACKEND_URL}/api/stripe/create-subscription`);
      console.log('   Plan:', plan.name);
      console.log('   User ID:', user.uid);
      
      let response;
      try {
        response = await fetch(`${BACKEND_URL}/api/stripe/create-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.uid,
            customerData: customerData,
            planData: plan
          })
        });
      } catch (fetchError) {
        console.error('❌ Erro ao fazer requisição ao backend:', fetchError);
        console.error('   Tipo:', fetchError.name);
        console.error('   Mensagem:', fetchError.message);
        console.error('   BACKEND_URL usado:', BACKEND_URL);
        showToast(t('toast.backendConnectionError'), 'error');
        return;
      }

      console.log('📥 Resposta do servidor recebida:', response.status, response.statusText);
      console.log('   Headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.error('❌ Erro na resposta do servidor:', response.status);
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          const text = await response.text();
          errorData = { error: text || 'Erro desconhecido' };
        }
        console.error('   Erro:', errorData);
        showToast(`${t('toast.subscriptionCreateErrorWithMessage')}: ${errorData.error || t('toast.unknownError')}`, 'error');
        return;
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse da resposta JSON:', parseError);
        const text = await response.text();
        console.error('   Resposta (texto):', text);
        showToast(t('toast.serverResponseParseError'), 'error');
        return;
      }
      console.log('📋 Resultado da criação de assinatura:');
      console.log('   Success:', result.success);
      console.log('   Subscription ID:', result.subscriptionId);
      console.log('   Invoice URL:', result.invoiceUrl);
      console.log('   Result completo:', result);

      if (result.success) {
        // Se tiver invoiceUrl, redirecionar DIRETAMENTE para o Stripe Checkout
        if (result.invoiceUrl) {
          console.log('✅ Invoice URL encontrada, preparando redirecionamento...');
          // Salvar informações da assinatura no localStorage para verificar ao retornar
          const paymentInfo = {
            planId: plan.id,
            subscriptionId: result.subscriptionId,
            createdAt: Date.now()
          };
          localStorage.setItem('pendingPayment', JSON.stringify(paymentInfo));
          
          // Redirecionar diretamente para o Stripe Checkout
          console.log('✅ Assinatura criada, redirecionando para pagamento:', result.invoiceUrl);
          console.log('   Tentando redirecionar para:', result.invoiceUrl);
          
          // Tentar múltiplas formas de redirecionamento para garantir compatibilidade
          try {
            window.location.href = result.invoiceUrl;
          } catch (redirectError) {
            console.error('❌ Erro ao redirecionar:', redirectError);
            // Tentar alternativa
            window.location.assign(result.invoiceUrl);
          }
          return; // Não renderizar mais nada, vai redirecionar
        } else {
          // Se não tiver invoiceUrl, tentar buscar do Firebase ou mostrar instruções
          console.warn('⚠️ Assinatura criada mas invoiceUrl não foi retornada');
          console.warn('   Result:', result);
          
          // Tentar buscar o link do Firebase imediatamente
          try {
            const subscriptionsRef = ref(database, `subscriptions/${user.uid}`);
            const snapshot = await get(subscriptionsRef);
            if (snapshot.exists()) {
              const subscriptions = snapshot.val();
              // Buscar pela subscriptionId retornada ou pelos IDs salvos no Stripe
              const subscription = Object.values(subscriptions).find(
                sub => sub.subscriptionId === result.subscriptionId || 
                       sub.stripeSubscriptionId === result.subscriptionId ||
                       sub.stripeSubscriptionId === result.stripeSubscriptionId
              );
              
              if (subscription && subscription.paymentUrl) {
                console.log('✅ Link de pagamento encontrado no Firebase:', subscription.paymentUrl);
                
                // Salvar informações da assinatura no localStorage para verificar ao retornar
                const paymentInfo = {
                  planId: plan.id,
                  subscriptionId: subscription.stripeSubscriptionId || result.subscriptionId,
                  createdAt: Date.now()
                };
                localStorage.setItem('pendingPayment', JSON.stringify(paymentInfo));
                
                // Redirecionar para o link de pagamento
                console.log('🔄 Redirecionando para link de pagamento do Firebase...');
                window.location.href = subscription.paymentUrl;
                return;
              }
            }
          } catch (fetchError) {
            console.error('Erro ao buscar link do Firebase:', fetchError);
          }
          
          // Se ainda não encontrou, mostrar mensagem e tentar novamente após alguns segundos
          showToast(t('toast.subscriptionCreatedFetchingPaymentLink'), 'success');
          
          // Tentar buscar novamente após 3 segundos
          setTimeout(async () => {
            try {
              const subscriptionsRef = ref(database, `subscriptions/${user.uid}`);
              const snapshot = await get(subscriptionsRef);
              if (snapshot.exists()) {
                const subscriptions = snapshot.val();
                const subscription = Object.values(subscriptions).find(
                  sub => sub.subscriptionId === result.subscriptionId || 
                         sub.stripeSubscriptionId === result.subscriptionId ||
                         sub.stripeSubscriptionId === result.stripeSubscriptionId
                );
                if (subscription && subscription.paymentUrl) {
                  const paymentInfo = {
                    planId: plan.id,
                    subscriptionId: subscription.stripeSubscriptionId || result.subscriptionId,
                    createdAt: Date.now()
                  };
                  localStorage.setItem('pendingPayment', JSON.stringify(paymentInfo));
                  window.location.href = subscription.paymentUrl;
                  return;
                }
              }
              
              // Se ainda não tiver link, mostrar instruções
              showToast(t('toast.paymentLinkNotReadyYet'), 'error');
              console.warn('⚠️ Link de pagamento não encontrado no Firebase após tentativas');
            } catch (error) {
              console.error('Erro ao buscar link de pagamento:', error);
              showToast(t('toast.paymentLinkFetchErrorManual'), 'error');
            }
          }, 3000);
        }
      } else {
        showToast(`${t('toast.subscriptionErrorWithMessage')}: ${result.error || t('toast.unknownError')}`, 'error');
        console.error('❌ Erro:', result);
      }
    } catch (error) {
      console.error('Erro ao assinar plano:', error);
      showToast(`${t('toast.subscribePlanErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const saveCatalogItem = async (itemData, editingItemId = null) => {
    if (!user || !database) return;
    
    console.log('🔄 [SYNC] Iniciando salvamento de item...');
    console.log('🔄 [SYNC] Dados recebidos:', itemData);
    console.log('🔄 [SYNC] Editando item ID:', editingItemId);
    
    try {
      const isEditing = !!editingItemId;
      const now = new Date().toISOString();
      
      const data = {
        ...itemData,
        name: String(itemData.name || '').trim(),
        description: String(itemData.description || '').trim(),
        price: String(itemData.price ?? '').trim() !== '' ? Number(String(itemData.price).replace(',', '.')) : null,
        stockQuantity: Number.parseInt(itemData.stockQuantity, 10) || 0,
        minStock: Number.parseInt(itemData.minStock, 10) || 0,
        category: String(itemData.category || '').trim(),
        sku: String(itemData.sku || '').trim(),
        image: String(itemData.image || '').trim(),
        link: String(itemData.link || '').trim(),
        updatedAt: now
      };
      
      // Se estiver editando, preservar a data de criação original
      if (!isEditing) {
        data.createdAt = now;
      }
      
      let itemId;
      
      if (isEditing) {
        // ATUALIZAR item existente
        itemId = editingItemId;
        
        // Buscar data de criação original do item
        const catalogRef = ref(database, `users/data/${user.uid}/catalog_items/${itemId}`);
        const snapshot = await get(catalogRef);
        const existingData = snapshot.val();
        const originalCreatedAt = existingData?.createdAt || now;
        
        // Preservar data de criação original
        data.createdAt = originalCreatedAt;
        
        const productData = {
          id: itemId,
          name: data.name,
          description: data.description || '',
          price: data.price !== null && data.price !== undefined ? data.price : null,
          stock: data.stockQuantity,
          category: data.category || '',
          image: data.image || '',
          link: data.link || '',
          type: data.type || 'product',
          active: true,
          createdAt: originalCreatedAt,
          updatedAt: data.updatedAt
        };

        const updates = {};
        updates[`users/data/${user.uid}/catalog_items/${itemId}`] = data;
        updates[`products/${user.uid}/${itemId}`] = productData;
        await update(ref(database), updates);
        console.log('✅ [SYNC] Item atualizado atomicamente em catalog_items e products:', itemId);
        
        const itemType = data.type === 'service' ? t('toast.catalogItemTypeService') : t('toast.catalogItemTypeProduct');
        showToast(t('toast.catalogItemUpdated', { type: itemType }));
      } else {
        // CRIAR novo item
        const catalogRef = ref(database, `users/data/${user.uid}/catalog_items`);
        const newItemRef = push(catalogRef);
        itemId = newItemRef.key;
        const productData = {
          id: itemId,
          name: data.name,
          description: data.description || '',
          price: data.price !== null && data.price !== undefined ? data.price : null,
          stock: data.stockQuantity,
          category: data.category || '',
          image: data.image || '',
          link: data.link || '',
          type: data.type || 'product',
          active: true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };

        const updates = {};
        updates[`users/data/${user.uid}/catalog_items/${itemId}`] = data;
        updates[`products/${user.uid}/${itemId}`] = productData;
        await update(ref(database), updates);
        console.log('✅ [SYNC] Item criado atomicamente em catalog_items e products:', itemId);
        
        // 3️⃣ Salvar categoria se fornecida
        if (data.category && data.category.trim()) {
          const categoriesRef = ref(database, `users/data/${user.uid}/categories`);
          const categorySnapshot = await get(categoriesRef);
          const existingCategories = categorySnapshot.val() || {};
          
          // Verificar se a categoria já existe
          const categoryKey = data.category.trim().toLowerCase().replace(/\s+/g, '_');
          if (!existingCategories[categoryKey]) {
            existingCategories[categoryKey] = {
              name: data.category.trim(),
              createdAt: now,
              updatedAt: now
            };
            await set(categoriesRef, existingCategories);
            console.log('✅ [SYNC] Categoria salva:', data.category);
          }
        }
        
        const itemType = data.type === 'service' ? t('toast.catalogItemTypeService') : t('toast.catalogItemTypeProduct');
        showToast(t('toast.catalogItemAdded', { type: itemType }));
      }
    } catch (error) {
      console.error('❌ [SYNC] Erro ao salvar item:', error);
      showToast(`${t('toast.catalogItemSaveErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const deleteCatalogItem = async (itemId) => {
    if (!user || !database) {
      showToast(t('toast.unauthenticated'), 'error');
      return;
    }

    if (!itemId) {
      showToast(t('toast.invalidItemId'), 'error');
      return;
    }

    // Confirmação antes de deletar
    if (!window.confirm('Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    console.log('🗑️ [DELETE] Excluindo item ID:', itemId);
    
    try {
      const updates = {};
      updates[`users/data/${user.uid}/catalog_items/${itemId}`] = null;
      updates[`products/${user.uid}/${itemId}`] = null;
      await update(ref(database), updates);
      console.log('✅ [DELETE] Item removido atomicamente de catalog_items e products');
      
      showToast(t('toast.itemDeleted'), 'success');
    } catch (error) {
      console.error('❌ [DELETE] Erro ao excluir item:', error);
      showToast(`${t('toast.itemDeleteErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const handleLogout = () => {
    if (auth) {
      firebaseSignOut(auth);
    }
    setUser(null);
    setIsAuthenticated(false);
    showToast(t('toast.logoutSuccess'), 'success');
  };

  // Funções para Email Templates
  const saveEmailTemplate = async (templateData, emailEditorRef) => {
    if (!user || !database || !user.isMaster) {
      showToast(t('toast.masterOnlyTemplates'), 'error');
      return;
    }

    if (!emailTemplateForm.name || !emailTemplateForm.subject) {
      showToast(t('toast.emailTemplateNameSubjectRequired'), 'error');
      return;
    }

    try {
      if (emailEditorRef && emailEditorRef.current) {
        emailEditorRef.current.exportHtml((data) => {
          const templateToSave = {
            name: emailTemplateForm.name,
            subject: emailTemplateForm.subject,
            body: data.design, // JSON do Unlayer
            html: data.html, // HTML compilado
            createdAt: editingEmailTemplate?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          if (editingEmailTemplate) {
            // Atualizar template existente
            const templateRef = ref(database, `email_templates/${editingEmailTemplate.id}`);
            set(templateRef, templateToSave);
            showToast(t('toast.emailTemplateUpdated'), 'success');
          } else {
            // Criar novo template
            const templatesRef = ref(database, 'email_templates');
            const newTemplateRef = push(templatesRef);
            set(newTemplateRef, templateToSave);
            showToast(t('toast.emailTemplateCreated'), 'success');
          }

          setShowEmailTemplateModal(false);
          setEditingEmailTemplate(null);
          setEmailTemplateForm({ name: '', subject: '', body: null });
        });
      } else {
        showToast(t('toast.editorNotReadyUnlayer'), 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      showToast(`${t('toast.emailTemplateSaveError')}: ${error.message}`, 'error');
    }
  };

  const deleteEmailTemplate = async (templateId) => {
    if (!user || !database || !user.isMaster) {
      showToast(t('toast.masterOnlyDeleteTemplates'), 'error');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const templateRef = ref(database, `email_templates/${templateId}`);
      await remove(templateRef);
      showToast(t('toast.emailTemplateDeleted'), 'success');
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      showToast(`${t('toast.emailTemplateDeleteError')}: ${error.message}`, 'error');
    }
  };

  // Funções do WhatsApp
  const connectWhatsApp = async () => {
    if (!user) {
      showToast(t('toast.userNotAuthenticatedShort'), 'error');
      return;
    }

    setIsConnecting(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });

      const data = await response.json();
      
      if (data.status === 'success' || data.status === 'already_active') {
        showToast(t('toast.whatsappSessionStarted'), 'success');
      } else {
        throw new Error(data.error || 'Erro ao criar sessão');
      }
    } catch (error) {
      console.error('Erro ao conectar WhatsApp:', error);
      showToast(`${t('toast.whatsappConnectErrorWithMessage')}: ${error.message}`, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        showToast(t('toast.whatsappDisconnected'), 'success');
        setWhatsappStatus('disconnected');
        setWhatsappQRCode(null);
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      showToast(t('toast.whatsappDisconnectError'), 'error');
    }
  };

  // Funções das Conversas
  const fetchConversations = async () => {
    if (!user) return;
    
    setLoadingConversations(true);
    try {
      console.log('🔍 Buscando conversas do backend...', `${BACKEND_URL}/api/conversations/${user.uid}`);
      const response = await fetch(`${BACKEND_URL}/api/conversations/${user.uid}`);
      const data = await response.json();
      
      console.log('📊 Resposta do backend:', data);
      console.log('📱 Total de conversas:', data.conversations?.length || 0);
      console.log('🔍 Tipo de data.conversations:', typeof data.conversations, Array.isArray(data.conversations));
      console.log('🔍 data.conversations:', JSON.stringify(data.conversations));
      
      if (data.conversations && data.conversations.length > 0) {
        console.log('✅ Atualizando state com conversas:', data.conversations);
        setRealConversations(data.conversations);
        console.log('✅ setRealConversations chamado com', data.conversations.length, 'conversas');
        
        // Selecionar a primeira conversa automaticamente se não houver nenhuma selecionada
        if (!selectedConversation && data.conversations.length > 0) {
          console.log('✅ Selecionando primeira conversa:', data.conversations[0].contactNumber);
          setSelectedConversation(data.conversations[0].contactNumber);
          fetchMessages(data.conversations[0].contactNumber);
        }
      } else {
        console.log('⚠️ Nenhuma conversa encontrada ou array vazio');
        setRealConversations([]);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar conversas:', error);
      showToast(t('toast.loadConversationsError'), 'error');
      setRealConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchMessages = async (contactNumber) => {
    if (!user || !contactNumber) return;
    
    try {
      // Buscar mensagens do Firebase Realtime Database
      if (database) {
        const messagesRef = ref(database, `conversations/${user.uid}/${contactNumber}/messages`);
        onValue(messagesRef, (snapshot) => {
          const messages = [];
          snapshot.forEach((childSnapshot) => {
            messages.push({
              id: childSnapshot.key,
              ...childSnapshot.val()
            });
          });
          setCurrentMessages(messages);
        });
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      showToast(t('toast.loadMessagesError'), 'error');
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedConversation || !messageInput.trim()) return;
    
    try {
      await fetch(`${BACKEND_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          to: selectedConversation,
          message: messageInput
        })
      });
      
      setMessageInput('');
      showToast(t('toast.messageSent'), 'success');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showToast(t('toast.messageSendError'), 'error');
    }
  };

  // Buscar conversas quando o usuário estiver autenticado e na seção de conversas
  useEffect(() => {
    if (typeof window === 'undefined') return; // Skip durante SSR
    if (user && currentPage === 'conversas') {
      fetchConversations();
      // Atualizar conversas a cada 30 segundos
      const interval = setInterval(fetchConversations, 30000);
      return () => clearInterval(interval);
    }
  }, [user, currentPage]);

  // Debug: Monitorar mudanças em realConversations
  useEffect(() => {
    console.log('🔄 [STATE CHANGED] realConversations:', realConversations?.length || 0, 'conversas');
  }, [realConversations]);

  const regenerateQRCode = async () => {
    if (!user) return;

    try {
      // Primeiro desconecta
      await fetch(`${BACKEND_URL}/api/sessions/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });

      // Aguarda 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Depois reconecta para gerar novo QR Code
      setIsConnecting(true);
      const response = await fetch(`${BACKEND_URL}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });

      const data = await response.json();
      
      if (data.status === 'success' || data.status === 'already_active') {
        showToast(t('toast.newQrGenerated'), 'success');
      } else {
        throw new Error(data.error || 'Erro ao gerar novo QR Code');
      }
    } catch (error) {
      console.error('Erro ao regenerar QR Code:', error);
      showToast(`${t('toast.qrGenerateErrorWithMessage')}: ${error.message}`, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Função para fazer upload de foto de perfil (agora salva como Base64 no Realtime Database)
  const handlePhotoUpload = async (file) => {
    if (!file || !database) return;
    
    setUploadingPhoto(true);
    try {
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        showToast(t('toast.invalidImageFormat'), 'error');
        setUploadingPhoto(false);
        return;
      }
      
      // Validar tamanho (máximo 2MB para Base64)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        showToast(t('toast.imageMax2mb'), 'error');
        setUploadingPhoto(false);
        return;
      }
      
      // Converter arquivo para Base64
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      setUserForm(prev => ({ ...prev, photoURL: base64String }));
      setPhotoPreview(base64String);
      showToast(t('toast.photoProcessed'));
    } catch (error) {
      console.error('Erro ao processar a foto:', error);
      showToast(`${t('toast.photoProcessErrorWithMessage')}: ${error.message || t('toast.unknownError')}`, 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Funções de gerenciamento de usuários (apenas para master)
  const saveUser = async (userData) => {
    console.log('saveUser chamado:', { user, isMaster: user?.isMaster, database: !!database });
    
    if (!user?.isMaster || !database || !auth) {
      console.error('Condições não atendidas:', { 
        hasUser: !!user, 
        isMaster: user?.isMaster, 
        hasDatabase: !!database, 
        hasAuth: !!auth 
      });
      showToast(t('toast.cannotCreateUser'), 'error');
      return;
    }
    
    try {
      if (editingUser) {
        console.log('Atualizando usuário existente:', editingUser.id);
        
        // Atualizar usuário existente no Realtime Database
        const userRef = ref(database, `users/registered/${editingUser.id}`);
        
        // NOTA: Não atualizamos photoURL no Auth porque Base64 é muito longo para o Auth
        // A foto fica apenas no Realtime Database
        
        // Manter os dados existentes e atualizar apenas os campos editados
        const updatedData = {
          ...editingUser,
          name: userData.name || userData.companyName || editingUser.name,
          email: userData.email || editingUser.email,
          photoURL: userData.photoURL || editingUser.photoURL || '',
          isActive: userData.isActive !== undefined ? userData.isActive : editingUser.isActive,
          updatedAt: new Date().toISOString()
        };
        
        await set(userRef, updatedData);
        console.log('Usuário atualizado no Realtime Database:', editingUser.id);
        
        // Atualizar company_profile se tiver uid
        if (editingUser.uid) {
          const companyProfileRef = ref(database, `users/data/${editingUser.uid}/company_profile`);
          const companyProfileData = {
            companyName: userData.companyName || '',
            cnpj: userData.cnpj || '',
            whatsappNumber: userData.whatsappNumber || '',
            updatedAt: new Date().toISOString()
          };
          await set(companyProfileRef, companyProfileData);
          console.log('Company profile atualizado para usuário:', editingUser.uid);
        }
        
        // Nota: A atualização de senha precisa ser feita separadamente via resetUserPassword
        // Por enquanto, a senha só pode ser atualizada através da função resetUserPassword
        
        showToast(t('toast.userUpdated'));
      } else {
        console.log('Criando novo usuário:', userData.email);
        
        // Salvar o email do master atual para fazer re-login depois
        const masterEmail = user.email;
        const masterPassword = prompt('Para criar o usuário, confirme sua senha de master:');
        
        if (!masterPassword) {
          showToast(t('toast.creationCancelledNoPassword'), 'error');
          return;
        }
        
        // Criar novo usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        console.log('Usuário criado no Auth:', userCredential.user.uid);
        
        // NOTA: Não atualizamos photoURL no Auth porque Base64 é muito longo para o Auth
        // A foto fica apenas no Realtime Database
        
        // Salvar dados adicionais no Realtime Database
        const userDoc = {
          name: userData.name || userData.companyName || '',
          email: userData.email,
          uid: userCredential.user.uid,
          photoURL: userData.photoURL || '',
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          isMaster: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          registeredVia: 'created_by_master'
        };
        
        console.log('Salvando no Realtime Database:', userDoc);
        
        // Criar nova entrada no Realtime Database
        const usersRef = ref(database, 'users/registered');
        const newUserRef = push(usersRef);
        await set(newUserRef, userDoc);
        
        console.log('Usuário criado no Realtime Database com ID:', newUserRef.key);
        
        // Salvar company_profile
        const companyProfileRef = ref(database, `users/data/${userCredential.user.uid}/company_profile`);
        const companyProfileData = {
          companyName: userData.companyName || '',
          cnpj: userData.cnpj || '',
          whatsappNumber: userData.whatsappNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await set(companyProfileRef, companyProfileData);
        console.log('Company profile criado para usuário:', userCredential.user.uid);
        
        // Fazer logout do novo usuário e re-login como master
        await firebaseSignOut(auth);
        await signInWithEmailAndPassword(auth, masterEmail, masterPassword);
        console.log('Master re-logado com sucesso');
        
        showToast(t('toast.userCreated'));
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      showToast(`${t('toast.userSaveErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const deleteUser = async (userId) => {
    if (!user?.isMaster || !database) return;
    
    try {
      console.log('Excluindo usuário:', userId);
      const userRef = ref(database, `users/registered/${userId}`);
      await remove(userRef);
      console.log('Usuário excluído do Realtime Database:', userId);
      showToast(t('toast.userDeleted'));
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      showToast(`${t('toast.userDeleteErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const toggleUserPlan = async (userData) => {
    if (!user?.isMaster || !database || !userData.uid) return;
    
    try {
      const activePlanRef = ref(database, `users/data/${userData.uid}/activePlan`);
      const planSnapshot = await get(activePlanRef);
      
      if (planSnapshot.exists()) {
        // Desativar plano
        await remove(activePlanRef);
        console.log('Plano desativado para usuário:', userData.uid);
        showToast(t('toast.planDeactivatedSuccess'));
        
        // Atualizar estado local imediatamente
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.uid === userData.uid 
              ? { ...u, activePlan: undefined, hasActivePlan: false }
              : u
          )
        );
      } else {
        // Abrir modal para escolher plano
        setSelectedUserForPlan(userData);
        setShowPlanSelectionModal(true);
      }
    } catch (error) {
      console.error('Erro ao gerenciar plano do usuário:', error);
      showToast(`${t('toast.planManageErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  const activatePlanForUser = async (planId) => {
    if (!user?.isMaster || !database || !selectedUserForPlan?.uid) {
      showToast(t('toast.insufficientData'), 'error');
      return;
    }

    try {
      // Buscar dados do plano
      const planRef = ref(database, `plans/${planId}`);
      const planSnapshot = await get(planRef);
      
      if (!planSnapshot.exists()) {
        showToast(t('toast.planNotFoundToast'), 'error');
        return;
      }

      const planData = planSnapshot.val();
      
      // Se for plano de teste com uso único, verificar se usuário já usou
      if (planData.isTrialPlan && planData.oneTimeUse) {
        const usedTrialsRef = ref(database, `users/data/${selectedUserForPlan.uid}/usedTrials`);
        const usedTrialsSnapshot = await get(usedTrialsRef);
        const usedTrials = usedTrialsSnapshot.exists() ? usedTrialsSnapshot.val() : {};
        
        if (usedTrials[planId]) {
          showToast(t('toast.trialAlreadyUsedByUser'), 'error');
          return;
        }
      }
      
      // Calcular data de expiração
      let nextDueDate;
      if (planData.isTrialPlan) {
        // Para planos de teste, calcular baseado em horas e minutos
        const hours = planData.trialDurationHours || 0;
        const minutes = planData.trialDurationMinutes || 30;
        const totalMilliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
        const expirationDate = new Date(Date.now() + totalMilliseconds);
        nextDueDate = expirationDate.toISOString();
      } else {
        // Para planos normais, usar cálculo mensal/anual
        const days = planData.billingCycle === 'yearly' ? 365 : 30;
        nextDueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      // Criar activePlan para o usuário
      const activePlanRef = ref(database, `users/data/${selectedUserForPlan.uid}/activePlan`);
      await set(activePlanRef, {
        planId: planId,
        planName: planData.name,
        currency: normalizePlanCurrency(planData.currency),
        startedAt: new Date().toISOString(),
        nextDueDate: nextDueDate,
        isTrialPlan: planData.isTrialPlan || false,
        trialDurationHours: planData.trialDurationHours || 0,
        trialDurationMinutes: planData.trialDurationMinutes || 30,
        allowedFeatures: planData.allowedFeatures || [],
        limits: planData.limits || {
          messagesPerMonth: null,
          conversations: null,
          catalogItems: null,
          integrations: []
        }
      });
      
      // Se for plano de teste com uso único, marcar como usado
      if (planData.isTrialPlan && planData.oneTimeUse) {
        const usedTrialsRef = ref(database, `users/data/${selectedUserForPlan.uid}/usedTrials/${planId}`);
        await set(usedTrialsRef, {
          usedAt: new Date().toISOString(),
          planName: planData.name
        });
      }
      
      console.log('Plano ativado manualmente para usuário:', selectedUserForPlan.uid);
      showToast(t('toast.planActivatedNamed', { name: planData.name }));
      
      // Atualizar estado local imediatamente
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.uid === selectedUserForPlan.uid 
            ? { ...u, activePlan: planData.name, hasActivePlan: true }
            : u
        )
      );
      
      setShowPlanSelectionModal(false);
      setSelectedUserForPlan(null);
    } catch (error) {
      console.error('Erro ao ativar plano:', error);
      showToast(`${t('toast.activatePlanErrorWithMessage')}: ${error.message}`, 'error');
    }
  };

  // Modal de seleção de planos
  const PlanSelectionModal = () => {
    if (!showPlanSelectionModal || !selectedUserForPlan) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }} onClick={() => {
        setShowPlanSelectionModal(false);
        setSelectedUserForPlan(null);
      }}>
        <div style={{
          backgroundColor: '#1a1f36',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '2px solid rgba(16, 185, 129, 0.3)'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
              Selecionar Plano para {selectedUserForPlan.name || selectedUserForPlan.email}
            </h3>
            <button
              onClick={() => {
                setShowPlanSelectionModal(false);
                setSelectedUserForPlan(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ✕
            </button>
          </div>

          {plans.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px' }}>
              Nenhum plano disponível
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    backgroundColor: '#0f1419',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => activatePlanForUser(plan.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#ffffff', margin: 0 }}>
                      {plan.name}
                    </h4>
                    <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                      {formatPlanPrice(plan)}
                    </span>
                  </div>
                  {plan.description && (
                    <p style={{ color: '#9ca3af', marginBottom: '12px', fontSize: '0.9375rem' }}>
                      {plan.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                    {plan.limits?.messagesPerMonth && (
                      <span style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}>
                        {plan.limits.messagesPerMonth} mensagens/mês
                      </span>
                    )}
                    {plan.limits?.messagesPerMonth === null && (
                      <span style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}>
                        Mensagens ilimitadas
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Modal obrigatório de seleção de plano para novos usuários
  const RequiredPlanSelectionModal = () => {
    if (!showRequiredPlanModal || user?.isMaster) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }}>
        <div style={{
          backgroundColor: '#1a1f36',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '900px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '2px solid rgba(139, 92, 246, 0.5)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
              Bem-vindo!
            </h2>
            <p style={{ fontSize: '1.125rem', color: '#9ca3af', marginBottom: '8px' }}>
              Para começar a usar nossa plataforma, você precisa selecionar um plano.
            </p>
            <p style={{ fontSize: '0.9375rem', color: '#6b7280' }}>
              Escolha o plano que melhor se adequa às suas necessidades.
            </p>
          </div>

          {plans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <p style={{ color: '#9ca3af', fontSize: '1.125rem', marginBottom: '16px' }}>
                Carregando planos disponíveis...
              </p>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid rgba(139, 92, 246, 0.2)',
                borderTop: '4px solid #8b5cf6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '20px',
              marginBottom: '24px'
            }}>
              {plans.map((plan) => {
                const isUsedTrial = plan.isTrialPlan && plan.oneTimeUse && (usedTrials || {})[plan.id];
                
                return (
                  <div
                    key={plan.id}
                    style={{
                      backgroundColor: '#0f1419',
                      borderRadius: '16px',
                      padding: '24px',
                      border: '2px solid rgba(139, 92, 246, 0.3)',
                      cursor: isUsedTrial ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      opacity: isUsedTrial ? 0.6 : 1,
                      position: 'relative'
                    }}
                    onClick={() => {
                      if (!isUsedTrial) {
                        subscribeToPlan(plan);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isUsedTrial) {
                        e.currentTarget.style.borderColor = '#8b5cf6';
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isUsedTrial) {
                        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {/* Badge de Trial */}
                    {plan.isTrialPlan && (
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        🎁 TESTE {formatTrialDuration(plan.trialDurationHours, plan.trialDurationMinutes)}{plan.oneTimeUse ? ' (ÚNICO)' : ''}
                      </div>
                    )}
                    
                    {/* Badge de Usado */}
                    {isUsedTrial && (
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        JÁ USADO
                      </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p style={{ color: '#9ca3af', fontSize: '0.9375rem', marginBottom: '16px' }}>
                          {plan.description}
                        </p>
                      )}
                    </div>

                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: plan.isTrialPlan ? 'rgba(245, 158, 11, 0.1)' : 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', border: `1px solid ${plan.isTrialPlan ? 'rgba(245, 158, 11, 0.3)' : 'rgba(139, 92, 246, 0.3)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        {plan.isTrialPlan ? (
                          <span style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>
                            🎁 GRÁTIS
                          </span>
                        ) : (
                          <>
                            <span style={{ fontSize: '2rem', fontWeight: '700', color: '#a78bfa' }}>
                              {formatPlanPrice(plan)}
                            </span>
                            <span style={{ fontSize: '1rem', color: '#9ca3af' }}>
                              / {plan.billingCycle === 'yearly' ? 'ano' : 'mês'}
                            </span>
                          </>
                        )}
                      </div>
                      {plan.isTrialPlan && (
                        <p style={{ fontSize: '0.875rem', color: '#f59e0b', marginTop: '8px', fontWeight: '600' }}>
                          Teste por {formatTrialDurationFull(plan.trialDurationHours, plan.trialDurationMinutes)}{plan.oneTimeUse ? ' • Uso único' : ''}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      {plan.limits?.messagesPerMonth ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '0.875rem' }}>
                          <span>✅</span>
                          <span>{plan.limits.messagesPerMonth} mensagens/mês</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '0.875rem' }}>
                          <span>✅</span>
                          <span>Mensagens ilimitadas</span>
                        </div>
                      )}
                      {plan.features && plan.features.length > 0 && plan.features.slice(0, 3).map((feature, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '0.875rem' }}>
                          <span>✅</span>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      disabled={isUsedTrial}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isUsedTrial) {
                          subscribeToPlan(plan);
                        }
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: isUsedTrial ? '#6b7280' : '#8b5cf6',
                        color: 'white',
                        padding: '14px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: isUsedTrial ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: isUsedTrial ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isUsedTrial) {
                          e.target.style.backgroundColor = '#7c3aed';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isUsedTrial) {
                          e.target.style.backgroundColor = '#8b5cf6';
                        }
                      }}
                    >
                      {isUsedTrial ? 'Já Utilizado' : plan.isTrialPlan ? 'Iniciar Teste Grátis' : 'Selecionar Plano'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ 
            padding: '20px', 
            backgroundColor: 'rgba(139, 92, 246, 0.1)', 
            borderRadius: '12px', 
            border: '1px solid rgba(139, 92, 246, 0.3)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#a78bfa', margin: 0 }}>
              ⚠️ Este modal não pode ser fechado até que você selecione um plano.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const openUserModal = (userData = null) => {
    setEditingUser(userData);
    setShowUserModal(true);
  };

  const resetUserPassword = async (email) => {
    if (!user?.isMaster || !auth) return;
    
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(t('toast.resetPasswordSent'));
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      showToast(t('toast.resetPasswordError'), 'error');
    }
  };

  // Se Firebase não está pronto
  if (!isReady && !error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #4f46e5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6b7280' }}>Inicializando sistema...</p>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Configurando Firebase...</p>
        </div>
      </div>
    );
  }

  // Se há erro no Firebase
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '24px',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '8px' }}>
              Erro na Aplicação
            </p>
            <p style={{ fontSize: '0.875rem', marginBottom: '12px' }}>{error}</p>
            <p style={{ fontSize: '0.75rem', color: '#991b1b' }}>
              Se o problema persistir, verifique as configurações do Firebase.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#4f46e5',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Componente PaymentPage removido - agora redirecionamos direto para o checkout

  // Se não está autenticado, mostrar landing page
  if (!isAuthenticated) {
    return (
      <div>
        <SimpleLanding onLoginSuccess={() => setIsAuthenticated(true)} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // Não precisa mais do componente PaymentPage - redirecionamos direto para o checkout

  // Renderizar dashboard com Firebase integrado
  return (
    <div>
      <DashboardWithFirebase
        user={user}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        toggleUserPlan={toggleUserPlan}
        companyProfile={companyProfile}
        integrationsConfig={integrationsConfig}
        assistantSettings={assistantSettings}
        catalogItems={catalogItems}
        savedCategories={savedCategories}
        users={users}
        showUserModal={showUserModal}
        setShowUserModal={setShowUserModal}
        editingUser={editingUser}
        saveCompanyProfile={saveCompanyProfile}
        saveIntegrationsConfig={saveIntegrationsConfig}
        saveAssistantSettings={saveAssistantSettings}
        saveCatalogItem={saveCatalogItem}
        deleteCatalogItem={deleteCatalogItem}
        saveUser={saveUser}
        deleteUser={deleteUser}
        openUserModal={openUserModal}
        resetUserPassword={resetUserPassword}
        handleLogout={handleLogout}
        whatsappStatus={whatsappStatus}
        whatsappQRCode={whatsappQRCode}
        isConnecting={isConnecting}
        connectWhatsApp={connectWhatsApp}
        disconnectWhatsApp={disconnectWhatsApp}
        regenerateQRCode={regenerateQRCode}
        agendamentos={agendamentos}
        setAgendamentos={setAgendamentos}
        loadingAgendamentos={loadingAgendamentos}
        showAgendamentoModal={showAgendamentoModal}
        setShowAgendamentoModal={setShowAgendamentoModal}
        editingAgendamento={editingAgendamento}
        setEditingAgendamento={setEditingAgendamento}
        agendamentoFilter={agendamentoFilter}
        setAgendamentoFilter={setAgendamentoFilter}
        agendamentoTypeFilter={agendamentoTypeFilter}
        setAgendamentoTypeFilter={setAgendamentoTypeFilter}
        agendamentoViewMode={agendamentoViewMode}
        setAgendamentoViewMode={setAgendamentoViewMode}
        selectedCalendarDate={selectedCalendarDate}
        setSelectedCalendarDate={setSelectedCalendarDate}
        selectedDateAgendamentos={selectedDateAgendamentos}
        setSelectedDateAgendamentos={setSelectedDateAgendamentos}
        database={database}
        showToast={showToast}
        plans={plans}
        loadingPlans={loadingPlans}
        showPlanModal={showPlanModal}
        setShowPlanModal={setShowPlanModal}
        editingPlan={editingPlan}
        setEditingPlan={setEditingPlan}
        savePlan={savePlan}
        deletePlan={deletePlan}
        openPlanModal={openPlanModal}
        subscribeToPlan={subscribeToPlan}
        userActivePlan={userActivePlan}
        userPlanUsage={userPlanUsage}
        usedTrials={usedTrials}
        formatTrialDuration={formatTrialDuration}
        formatTrialDurationFull={formatTrialDurationFull}
        isMobile={isMobile}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        handleCompanyPhotoUpload={handleCompanyPhotoUpload}
        companyPhotoPreview={companyPhotoPreview}
        setCompanyPhotoPreview={setCompanyPhotoPreview}
        uploadingCompanyPhoto={uploadingCompanyPhoto}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PlanSelectionModal />
      <RequiredPlanSelectionModal />
    </div>
  );
};

// Componente Dashboard com Firebase
const DashboardWithFirebase = ({
  user,
  currentPage,
  setCurrentPage,
  companyProfile,
  integrationsConfig,
  assistantSettings,
  catalogItems,
  savedCategories = [],
  users,
  showUserModal,
  setShowUserModal,
  editingUser,
  saveCompanyProfile,
  saveIntegrationsConfig,
  saveAssistantSettings,
  saveCatalogItem,
  deleteCatalogItem,
  saveUser,
  deleteUser,
  toggleUserPlan,
  openUserModal,
  resetUserPassword,
  handleLogout,
  whatsappStatus = 'disconnected',
  whatsappQRCode = null,
  isConnecting = false,
  connectWhatsApp,
  disconnectWhatsApp,
  regenerateQRCode,
  agendamentos = [],
  setAgendamentos,
  loadingAgendamentos = false,
  showAgendamentoModal = false,
  setShowAgendamentoModal,
  editingAgendamento = null,
  setEditingAgendamento,
  agendamentoFilter = 'todos',
  setAgendamentoFilter,
  agendamentoTypeFilter = 'todos',
  setAgendamentoTypeFilter,
  agendamentoViewMode = 'lista',
  setAgendamentoViewMode,
  selectedCalendarDate = null,
  setSelectedCalendarDate,
  selectedDateAgendamentos = [],
  setSelectedDateAgendamentos,
  database,
  showToast,
  plans = [],
  loadingPlans = false,
  showPlanModal = false,
  setShowPlanModal,
  editingPlan = null,
  setEditingPlan,
  savePlan,
  deletePlan,
  openPlanModal,
  subscribeToPlan,
  userActivePlan,
  userPlanUsage,
  usedTrials = {},
  formatTrialDuration,
  formatTrialDurationFull,
  isMobile = false,
  isMobileMenuOpen = false,
  setIsMobileMenuOpen,
  handleCompanyPhotoUpload,
  companyPhotoPreview = undefined,
  setCompanyPhotoPreview = undefined,
  uploadingCompanyPhoto = undefined
}) => {
  // Garantir que usedTrials sempre seja um objeto
  const safeUsedTrials = usedTrials || {};
  const { t, locale, setLocale } = useI18n();
  const [isActive, setIsActive] = useState(assistantSettings.isActive || true);
  const [stripeOps, setStripeOps] = useState({
    loading: true,
    total: 0,
    active: 0,
    pastDue: 0,
    cancelled: 0,
    pending: 0,
    renewalsNext7Days: 0,
    recent: []
  });
  const [stripeOpsFilter, setStripeOpsFilter] = useState('all');

  const [agendamentoSearch, setAgendamentoSearch] = useState('');
  const [agendamentoCurrentPage, setAgendamentoCurrentPage] = useState(0);

  const getStatusColor = useCallback((status) => {
    return AGENDAMENTO_STATUS_CONFIG[status]?.color || '#6b7280';
  }, []);

  const getStatusLabel = useCallback((status) => {
    return AGENDAMENTO_STATUS_CONFIG[status]?.label || status || 'N/A';
  }, []);

  const getTipoIcon = useCallback((tipo) => {
    return AGENDAMENTO_TIPO_ICON[tipo] || '📅';
  }, []);

  const parseAgendamentoDateTime = useCallback((data, horario = '00:00') => {
    if (!data) return null;
    const time = String(horario || '00:00');
    if (String(data).includes('-')) {
      const dt = new Date(`${data}T${time}:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    const parts = String(data).split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const dt = new Date(`${year}-${month}-${day}T${time}:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }, []);

  const agendamentosOrdenados = useMemo(() => {
    const list = [...(agendamentos || [])];
    list.sort((a, b) => {
      const dateA = parseAgendamentoDateTime(a.data, a.horario);
      const dateB = parseAgendamentoDateTime(b.data, b.horario);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeA - timeB;
    });
    return list;
  }, [agendamentos, parseAgendamentoDateTime]);

  const agendamentosFiltradosOrdenados = useMemo(() => {
    const query = String(agendamentoSearch || '').toLowerCase().trim();
    return agendamentosOrdenados.filter((agend) => {
      const matchStatus = (agendamentoFilter || 'todos') === 'todos' || agend.status === agendamentoFilter;
      const matchType = (agendamentoTypeFilter || 'todos') === 'todos' || agend.tipo === agendamentoTypeFilter;
      const text = `${agend.titulo || ''} ${agend.descricao || ''} ${agend.cliente || ''} ${agend.telefone || ''}`.toLowerCase();
      const matchSearch = !query || text.includes(query);
      return matchStatus && matchType && matchSearch;
    });
  }, [agendamentosOrdenados, agendamentoFilter, agendamentoTypeFilter, agendamentoSearch]);

  const agendamentoStats = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 7);
    next7.setHours(23, 59, 59, 999);

    const isOpenStatus = (s) => s !== 'concluido' && s !== 'cancelado';
    const values = agendamentosOrdenados;
    return {
      total: values.length,
      pendente: values.filter((a) => a.status === 'pendente').length,
      confirmado: values.filter((a) => a.status === 'confirmado').length,
      concluido: values.filter((a) => a.status === 'concluido').length,
      cancelado: values.filter((a) => a.status === 'cancelado').length,
      em_andamento: values.filter((a) => a.status === 'em_andamento').length,
      atrasados: values.filter((a) => {
        const dt = parseAgendamentoDateTime(a.data, a.horario);
        return dt && dt < now && isOpenStatus(a.status);
      }).length,
      hoje: values.filter((a) => {
        const dt = parseAgendamentoDateTime(a.data, a.horario);
        return dt && dt >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && dt <= endOfToday;
      }).length,
      proximos7: values.filter((a) => {
        const dt = parseAgendamentoDateTime(a.data, a.horario);
        return dt && dt >= now && dt <= next7;
      }).length
    };
  }, [agendamentosOrdenados, parseAgendamentoDateTime]);

  const agendamentoItemsPerPage = 8;
  const agendamentoTotalPages = Math.max(1, Math.ceil(agendamentosFiltradosOrdenados.length / agendamentoItemsPerPage));
  const agendamentoPaginaAtual = Math.min(agendamentoCurrentPage, agendamentoTotalPages - 1);
  const agendamentosPaginados = useMemo(() => {
    const start = agendamentoPaginaAtual * agendamentoItemsPerPage;
    return agendamentosFiltradosOrdenados.slice(start, start + agendamentoItemsPerPage);
  }, [agendamentosFiltradosOrdenados, agendamentoPaginaAtual]);

  useEffect(() => {
    if (!user || !database) return;
    let isCancelled = false;

    const loadStripeOps = async () => {
      try {
        setStripeOps(prev => ({ ...prev, loading: true }));

        const subsRef = user?.isMaster
          ? ref(database, 'subscriptions')
          : ref(database, `subscriptions/${user.uid}`);
        const snapshot = await get(subsRef);
        const raw = snapshot.val() || {};

        const entries = [];
        if (user?.isMaster) {
          Object.entries(raw).forEach(([uid, userSubs]) => {
            Object.entries(userSubs || {}).forEach(([subKey, subData]) => {
              entries.push({ uid, subKey, ...(subData || {}) });
            });
          });
        } else {
          Object.entries(raw).forEach(([subKey, subData]) => {
            entries.push({ uid: user.uid, subKey, ...(subData || {}) });
          });
        }

        const now = new Date();
        const next7 = new Date();
        next7.setDate(next7.getDate() + 7);

        let active = 0;
        let pastDue = 0;
        let cancelledCount = 0;
        let pending = 0;
        let renewalsNext7Days = 0;

        entries.forEach((s) => {
          const status = String(s.status || '').toLowerCase();
          if (status === 'active') active += 1;
          else if (status === 'past_due' || status === 'overdue' || status === 'unpaid') pastDue += 1;
          else if (status === 'cancelled' || status === 'canceled') cancelledCount += 1;
          else if (status === 'pending_payment' || status === 'pending') pending += 1;

          if (s.nextDueDate && status === 'active') {
            const due = new Date(s.nextDueDate);
            if (!Number.isNaN(due.getTime()) && due >= now && due <= next7) {
              renewalsNext7Days += 1;
            }
          }
        });

        const recent = entries
          .map((s) => ({
            uid: s.uid,
            planName: s.planName || s.planId || 'Plano',
            status: s.status || 'unknown',
            timestamp: s.updatedAt || s.lastPaymentDate || s.createdAt || null
          }))
          .filter((r) => r.timestamp)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 6);

        if (!isCancelled) {
          setStripeOps({
            loading: false,
            total: entries.length,
            active,
            pastDue,
            cancelled: cancelledCount,
            pending,
            renewalsNext7Days,
            recent
          });
        }
      } catch (error) {
        console.error('Erro ao carregar painel Stripe:', error);
        if (!isCancelled) {
          setStripeOps(prev => ({ ...prev, loading: false }));
        }
      }
    };

    loadStripeOps();
    const intervalId = setInterval(loadStripeOps, 120000);
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [user?.uid, user?.isMaster, database]);
  
  // Componente EmailTemplateModal (movido para dentro do DashboardWithFirebase)
  // MIGRADO PARA BEEFREE - Editor mais estável e gratuito
  const EmailTemplateModal = React.memo(({ isOpen, onClose, template, formData, setFormData, database, showToast }) => {
    const beefreeEditorRef = React.useRef(null);
    const [editorReady, setEditorReady] = useState(false);
    
    // API Key do Beefree
    const beefreeClientId = process.env.NEXT_PUBLIC_BEEFREE_CLIENT_ID;
    const beefreeClientSecret = process.env.NEXT_PUBLIC_BEEFREE_CLIENT_SECRET;

    // Callback quando editor estiver pronto
    const handleEditorReady = React.useCallback((editorInstance) => {
      console.log('✅ Editor Beefree pronto');
      beefreeEditorRef.current = editorInstance;
      setEditorReady(true);
    }, []);

    // Preparar conteúdo inicial para o editor
    const getInitialContent = React.useCallback(() => {
      if (!template?.body) return null;
      
      // Se for formato Unlayer antigo, tentar extrair HTML
      if (template.body.design) {
        return template.body.design;
      }
      
      // Se for HTML direto
      if (template.html) {
        return template.html;
      }
      
      // Se for objeto com design
      if (typeof template.body === 'object') {
        return template.body;
      }
      
      return null;
    }, [template]);
    
    // Resetar estado quando modal fechar
    React.useEffect(() => {
      if (!isOpen) {
        setEditorReady(false);
        beefreeEditorRef.current = null;
      }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#1a1f36',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '95vw',
            maxHeight: '95vh',
            width: '100%',
            height: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
              {template ? 'Editar Template' : 'Criar Template'}
            </h2>
            <button
              onClick={onClose}
              style={{
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
          </div>

          {/* Formulário */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                Nome do Template
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, name: value }));
                }}
                placeholder="Ex: Boas-vindas"
                style={{
                  width: '100%',
                  padding: '12px 16px',
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

            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                Assunto do Email
              </label>
              <input
                type="text"
                value={formData.subject || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, subject: value }));
                }}
                placeholder="Ex: Bem-vindo ao {{companyName}}!"
                style={{
                  width: '100%',
                  padding: '12px 16px',
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
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
                Use variáveis: {'{{clientName}}'}, {'{{clientEmail}}'}, {'{{companyName}}'}
              </p>
            </div>
          </div>

          {/* Editor Unlayer */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
              Corpo do Email
            </label>
            <div style={{ flex: 1, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', position: 'relative', backgroundColor: '#ffffff' }}>
              {beefreeClientId && beefreeClientSecret ? (
                <BeefreeEditor
                  ref={beefreeEditorRef}
                  clientId={beefreeClientId}
                  clientSecret={beefreeClientSecret}
                  initialContent={getInitialContent()}
                  onReady={handleEditorReady}
                  height="100%"
                />
              ) : (
                <div style={{ 
                  padding: '40px', 
                  textAlign: 'center', 
                  color: '#991b1b',
                  backgroundColor: '#fee2e2'
                }}>
                  <strong>Erro:</strong> Credenciais do Beefree não configuradas.
                  <br />
                  <small>
                    1. Crie conta em <a href="https://developers.beefree.io" target="_blank" rel="noopener" style={{ color: '#059669' }}>developers.beefree.io</a>
                    <br />
                    2. Crie uma aplicação e obtenha Client ID e Client Secret
                    <br />
                    3. Configure NEXT_PUBLIC_BEEFREE_CLIENT_ID e NEXT_PUBLIC_BEEFREE_CLIENT_SECRET no .env.local
                  </small>
                </div>
              )}
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                backgroundColor: '#6b7280',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (!beefreeEditorRef.current) {
                  showToast(t('toast.editorNotReadyWait'), 'error');
                  return;
                }

                if (!database) {
                  showToast(t('toast.databaseUnavailable'), 'error');
                  return;
                }

                if (!formData.name || !formData.subject) {
                  showToast(t('toast.templateNameSubjectRequired'), 'error');
                  return;
                }
                
                try {
                  // Exportar HTML do editor Beefree usando método do ref
                  if (beefreeEditorRef.current && beefreeEditorRef.current.exportHtml) {
                    beefreeEditorRef.current.exportHtml(async (data) => {
                      if (!data) {
                        showToast(t('toast.editorExportRetry'), 'error');
                        return;
                      }

                      try {
                        // Atualizar formData com o design
                        setFormData(prev => ({ ...prev, body: { design: data.design || data } }));
                        
                        // Salvar template
                        const templateToSave = {
                          name: formData.name.trim(),
                          subject: formData.subject.trim(),
                          body: { design: data.design || data }, // JSON do Beefree
                          html: data.html, // HTML compilado
                          createdAt: template?.createdAt || new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        };

                        if (template) {
                          // Atualizar template existente
                          const templateRef = ref(database, `email_templates/${template.id}`);
                          await set(templateRef, templateToSave);
                          console.log('✅ Template atualizado:', template.id);
                          showToast(t('toast.templateUpdated'), 'success');
                        } else {
                          // Criar novo template
                          const templatesRef = ref(database, 'email_templates');
                          const newTemplateRef = push(templatesRef);
                          await set(newTemplateRef, templateToSave);
                          console.log('✅ Template criado:', newTemplateRef.key);
                          showToast(t('toast.templateCreated'), 'success');
                        }

                        onClose();
                      } catch (error) {
                        console.error('❌ Erro ao salvar template:', error);
                        showToast(`${t('toast.flowTemplateSaveError')}: ${error.message || t('toast.unknownError')}`, 'error');
                      }
                    });
                  } else {
                    showToast(t('toast.editorNotReadyFullLoad'), 'error');
                  }
                } catch (error) {
                  console.error('❌ Erro ao exportar HTML do editor:', error);
                  showToast(`${t('toast.flowEditorExportError')}: ${error.message || t('toast.unknownError')}`, 'error');
                }
              }}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
              }}
            >
              {template ? 'Atualizar Template' : 'Salvar Template'}
            </button>
          </div>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Comparação customizada para evitar re-renders desnecessários
    // Só re-renderiza se isOpen, template ou database mudarem
    // IGNORA mudanças em formData, showToast, setFormData e onClose para evitar reinicialização do editor
    // Essas funções podem mudar a cada render mas não devem causar re-render do modal
    // React.memo: retorna true se props são iguais (NÃO re-renderiza), false se diferentes (re-renderiza)
    const propsChanged = (
      prevProps.isOpen !== nextProps.isOpen ||
      prevProps.template !== nextProps.template ||
      prevProps.database !== nextProps.database
    );
    
    if (propsChanged) {
      console.log('🔄 EmailTemplateModal: Props importantes mudaram, re-renderizando');
      return false; // Props mudaram, deve re-renderizar
    }
    
    // Props importantes são iguais, NÃO re-renderiza (ignora mudanças em formData, funções, etc)
    // Isso evita que o editor seja reinicializado quando o usuário digita
    return true; // Props são iguais, NÃO re-renderiza
  });
  
  // Função auxiliar para padding responsivo
  const getResponsivePadding = () => isMobile ? '16px' : '40px';
  const getResponsiveFontSize = (desktopSize) => isMobile ? `${parseFloat(desktopSize) * 0.75}rem` : desktopSize;
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [catalogForm, setCatalogForm] = useState({
    name: '',
    description: '',
    price: '',
    stockQuantity: '',
    type: 'product',
    category: '',
    sku: '',
    image: '',
    link: '',
    featured: false,
    minStock: 5
  });

  // Estados do Catálogo Avançado
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all');
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogView, setCatalogView] = useState('grid');
  const [catalogCurrentPage, setCatalogCurrentPage] = useState(0);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCatalogCurrentPage(0);
  }, [catalogSearch, catalogFilter, catalogCategory]);

  const catalogValidItems = useMemo(
    () => catalogItems.filter((i) => i && i.name),
    [catalogItems]
  );

  const catalogStats = useMemo(() => {
    const products = catalogValidItems.filter((i) => i.type === 'product');
    return {
      total: products.length,
      products: products.length,
      services: catalogValidItems.filter((i) => i.type === 'service').length,
      totalValue: products.reduce((sum, item) => {
        const price = item.price !== null && item.price !== undefined ? parseFloat(item.price) : 0;
        return sum + (price * (parseInt(item.stockQuantity, 10) || 0));
      }, 0),
      lowStock: products.filter((i) => (parseInt(i.stockQuantity, 10) || 0) < (i.minStock || 5)).length,
      featured: products.filter((i) => i.featured).length
    };
  }, [catalogValidItems]);

  const catalogFilteredItems = useMemo(() => catalogValidItems.filter((item) => {
    const searchTerm = catalogSearch.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchTerm) ||
                         (item.description || '').toLowerCase().includes(searchTerm) ||
                         (item.sku || '').toLowerCase().includes(searchTerm);
    const matchesFilter = catalogFilter === 'all' || item.type === catalogFilter;
    const matchesCategory = catalogCategory === 'all' || item.category === catalogCategory;
    return matchesSearch && matchesFilter && matchesCategory;
  }), [catalogValidItems, catalogSearch, catalogFilter, catalogCategory]);

  const catalogCategories = useMemo(
    () => [...new Set(catalogValidItems.map((i) => i.category).filter(Boolean))],
    [catalogValidItems]
  );
  const [tutorialsCurrentPage, setTutorialsCurrentPage] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    setAgendamentoCurrentPage(0);
  }, [agendamentoFilter, agendamentoTypeFilter, agendamentoSearch]);

  // Estados do companyForm - usar props se disponíveis, senão criar locais
  const [companyForm, setCompanyForm] = useState({
    companyName: '',
    cnpj: '',
    whatsappNumber: '',
    photoURL: ''
  });
  const [localCompanyPhotoPreview, setLocalCompanyPhotoPreview] = useState(null);
  const [localUploadingCompanyPhoto, setLocalUploadingCompanyPhoto] = useState(false);
  
  // Usar props se disponíveis, senão usar estados locais
  const finalCompanyPhotoPreview = (companyPhotoPreview !== undefined && companyPhotoPreview !== null) ? companyPhotoPreview : localCompanyPhotoPreview;
  const setFinalCompanyPhotoPreview = (setCompanyPhotoPreview && typeof setCompanyPhotoPreview === 'function') ? setCompanyPhotoPreview : setLocalCompanyPhotoPreview;
  const finalUploadingCompanyPhoto = (uploadingCompanyPhoto !== undefined && uploadingCompanyPhoto !== null) ? uploadingCompanyPhoto : localUploadingCompanyPhoto;
  const [integrationsForm, setIntegrationsForm] = useState({
    openaiApiKey: '',
    stripeApiKey: '',
    municipalRegistration: '',
    fiscalEnabled: false,
    issRate: 0,
    retainIss: false,
    cofinsRate: 0,
    csllRate: 0,
    inssRate: 0,
    irRate: 0,
    pisRate: 0,
    deductions: 0,
    fiscalObservations: ''
  });
  const [assistantForm, setAssistantForm] = useState({
    aiProvider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: '',
    welcomeMessage: '',
    enabledFeatures: [],
    includeCatalogProducts: false,
    includeCatalogServices: false,
    flowMode: 'visual', // Sempre visual agora
    flowSteps: [], // Steps do flow builder
    enableAppointments: false,
    appointmentTypes: [],
    paymentProvider: 'stripe',
    paymentManualMessage: '',
    paymentStripeMessage: '',
    configUiMode: 'simple', // 'simple' = assistente guiado | 'advanced' = Flow Builder
    fixedApproaches: [] // abordagens fixas do modo guiado (por etapa)
  });
  const [wizardResetKey, setWizardResetKey] = useState(0);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    cnpj: '',
    whatsappNumber: '',
    photoURL: '',
    isActive: true
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Estados para Email Templates
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState(null);
  const [emailTemplateForm, setEmailTemplateForm] = useState({
    name: '',
    subject: '',
    body: null // JSON do Unlayer
  });
  const [emailSends, setEmailSends] = useState([]);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  
  // Função estável para fechar o modal de template (evita re-renders desnecessários)
  const handleCloseEmailTemplateModal = useCallback(() => {
    setShowEmailTemplateModal(false);
    setEditingEmailTemplate(null);
    setEmailTemplateForm({ name: '', subject: '', body: null });
  }, []); // Sem dependências - função sempre a mesma
  
  // Listener para Email Templates (movido para dentro do DashboardWithFirebase)
  useEffect(() => {
    if (!user || !database || !user.isMaster) return;

    const templatesRef = ref(database, 'email_templates');
    
    const unsubscribe = onValue(templatesRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const templatesData = snapshot.val();
          const templatesList = Object.keys(templatesData).map(key => ({
            id: key,
            ...templatesData[key]
          }));
          setEmailTemplates(templatesList);
        } else {
          setEmailTemplates([]);
        }
      } catch (error) {
        console.error('Erro ao processar templates de email:', error);
      }
    }, (error) => {
      console.error('Erro ao carregar templates de email:', error);
    });
    
    return () => {
      try {
        off(templatesRef);
      } catch (e) {
        // Ignorar erros ao desconectar
      }
    };
  }, [user?.uid, user?.isMaster, database]);
  
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price: 0,
    currency: 'R$',
    billingCycle: 'monthly', // monthly, yearly
    features: [],
    allowedFeatures: [], // Funcionalidades do sidebar permitidas para este plano
    isTrialPlan: false, // Se é um plano de teste
    trialDurationHours: 0, // Duração do teste em horas
    trialDurationMinutes: 30, // Duração do teste em minutos (padrão 30 minutos)
    oneTimeUse: false, // Se cada usuário só pode usar uma vez
    limits: {
      messagesPerMonth: null,
      conversations: null,
      catalogItems: null,
      integrations: []
    },
    active: true
  });

  // Inicializar formulários com dados existentes
  useEffect(() => {
    setCompanyForm({
      companyName: companyProfile.companyName || '',
      cnpj: companyProfile.cnpj || '',
      whatsappNumber: companyProfile.whatsappNumber || '',
      photoURL: companyProfile.photoURL || ''
    });
    setFinalCompanyPhotoPreview(companyProfile.photoURL || null);
  }, [companyProfile]);
  
  // Wrapper para handleCompanyPhotoUpload que atualiza os estados corretos
  const handleCompanyPhotoUploadWrapper = async (file) => {
    if (handleCompanyPhotoUpload) {
      // Usar função que vem como prop (preferencial)
      await handleCompanyPhotoUpload(file);
    } else if (file && user && database) {
      // Se não vier como prop, criar função local usando Base64
      setLocalUploadingCompanyPhoto(true);
      try {
        // Validar tipo de arquivo
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          showToast(t('toast.invalidImageFormat'), 'error');
          setLocalUploadingCompanyPhoto(false);
          return;
        }
        
        // Validar tamanho (máximo 2MB para Base64)
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
          showToast(t('toast.imageMax2mb'), 'error');
          setLocalUploadingCompanyPhoto(false);
          return;
        }
        
        // Converter arquivo para Base64
        const base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        setCompanyForm(prev => ({ ...prev, photoURL: base64String }));
        setFinalCompanyPhotoPreview(base64String);
        showToast(t('toast.photoProcessed'));
      } catch (error) {
        console.error('Erro ao processar a foto:', error);
        showToast(`${t('toast.photoProcessErrorWithMessage')}: ${error.message || t('toast.unknownError')}`, 'error');
      } finally {
        setLocalUploadingCompanyPhoto(false);
      }
    } else {
      showToast(t('toast.databaseOrUserUnavailable'), 'error');
    }
  };

  useEffect(() => {
    setIntegrationsForm({
      openaiApiKey: integrationsConfig.openaiApiKey || '',
      stripeApiKey: integrationsConfig.stripeApiKey || '',
      municipalRegistration: integrationsConfig.municipalRegistration || ''
    });
  }, [integrationsConfig]);

  useEffect(() => {
    setAssistantForm({
      aiProvider: assistantSettings.aiProvider || 'openai',
      apiKey: assistantSettings.apiKey || '',
      model: assistantSettings.model || 'gpt-3.5-turbo',
      systemPrompt: assistantSettings.systemPrompt || '',
      welcomeMessage: assistantSettings.welcomeMessage || '',
      enabledFeatures: assistantSettings.enabledFeatures || [],
      includeCatalogProducts: assistantSettings.includeCatalogProducts || false,
      includeCatalogServices: assistantSettings.includeCatalogServices || false,
      catalogProductCategories: assistantSettings.catalogProductCategories || [],
      catalogServiceCategories: assistantSettings.catalogServiceCategories || [],
      flowMode: 'visual', // Sempre visual
      flowSteps: assistantSettings.flowSteps || [], // ✅ Carregar steps salvos
      enableAppointments: assistantSettings.enableAppointments || false,
      appointmentTypes: assistantSettings.appointmentTypes || [],
      audioLanguage: assistantSettings.audioLanguage || 'pt-BR',
      audioVoice: assistantSettings.audioVoice || '',
      paymentProvider: assistantSettings.paymentProvider || 'stripe',
      paymentManualMessage: assistantSettings.paymentManualMessage || '',
      paymentStripeMessage: assistantSettings.paymentStripeMessage || '',
      configUiMode: assistantSettings.configUiMode || 'simple',
      fixedApproaches: Array.isArray(assistantSettings.fixedApproaches)
        ? assistantSettings.fixedApproaches
        : []
    });
  }, [assistantSettings]);

  // Preencher planForm quando editingPlan mudar
  useEffect(() => {
    if (editingPlan) {
      setPlanForm({
        name: editingPlan.name || '',
        description: editingPlan.description || '',
        price: editingPlan.price || 0,
        currency: normalizePlanCurrency(editingPlan.currency),
        billingCycle: editingPlan.billingCycle || 'monthly',
        features: editingPlan.features || [],
        allowedFeatures: editingPlan.allowedFeatures || [],
        isTrialPlan: editingPlan.isTrialPlan || false,
        trialDurationHours: editingPlan.trialDurationHours || 0,
        trialDurationMinutes: editingPlan.trialDurationMinutes || 30,
        oneTimeUse: editingPlan.oneTimeUse || false,
        limits: editingPlan.limits || {
          messagesPerMonth: null,
          conversations: null,
          catalogItems: null,
          integrations: []
        },
        active: editingPlan.active !== undefined ? editingPlan.active : true
      });
    } else {
      setPlanForm({
        name: '',
        description: '',
        price: 0,
        currency: 'R$',
        billingCycle: 'monthly',
        features: [],
        allowedFeatures: [],
        isTrialPlan: false,
        trialDurationHours: 0,
        trialDurationMinutes: 30,
        oneTimeUse: false,
        limits: {
          messagesPerMonth: null,
          conversations: null,
          catalogItems: null,
          integrations: []
        },
        active: true
      });
    }
  }, [editingPlan]);

  // Handlers para catálogo
  const openCatalogModal = (item = null) => {
    if (item) {
      setCatalogForm({
        name: item.name || '',
        description: item.description || '',
        price: item.price || '',
        stockQuantity: item.stockQuantity || '',
        type: item.type || 'product',
        category: item.category || '',
        sku: item.sku || '',
        image: item.image || '',
        link: item.link || '',
        featured: item.featured || false,
        minStock: item.minStock || 5
      });
      setEditingItem(item);
    } else {
      setCatalogForm({
        name: '',
        description: '',
        price: '',
        stockQuantity: '',
        type: 'product',
        category: '',
        sku: '',
        image: '',
        link: '',
        featured: false,
        minStock: 5
      });
      setEditingItem(null);
    }
    setShowCatalogModal(true);
  };

  // Handlers para usuário
  const handleUserSubmit = (e) => {
    e.preventDefault();
    const normalizedUserForm = {
      ...userForm,
      name: userForm.name || userForm.companyName || ''
    };
    saveUser(normalizedUserForm);
    setShowUserModal(false);
    setUserForm({
      name: '',
      email: '',
      password: '',
      companyName: '',
      cnpj: '',
      whatsappNumber: '',
      photoURL: '',
      isActive: true
    });
    setPhotoPreview(null);
  };

  const handleOpenUserModal = async (userData = null) => {
    if (userData) {
      // Buscar dados de company_profile se estiver editando
      let companyName = userData.companyName || '';
      let cnpj = '';
      let whatsappNumber = '';
      
      if (userData.uid && database) {
        try {
          const companyProfileRef = ref(database, `users/data/${userData.uid}/company_profile`);
          const companySnapshot = await get(companyProfileRef);
          if (companySnapshot.exists()) {
            const companyData = companySnapshot.val();
            companyName = companyData.companyName || '';
            cnpj = companyData.cnpj || '';
            whatsappNumber = companyData.whatsappNumber || '';
          }
        } catch (error) {
          console.error('Erro ao buscar company_profile:', error);
        }
      }
      
      setUserForm({
        name: userData.name || '',
        email: userData.email || '',
        password: '', // Não mostrar senha existente
        companyName: companyName,
        cnpj: cnpj,
        whatsappNumber: whatsappNumber,
        photoURL: userData.photoURL || '',
        isActive: userData.isActive !== undefined ? userData.isActive : true
      });
      setPhotoPreview(userData.photoURL || null);
    } else {
      setUserForm({
        name: '',
        email: '',
        password: '',
        companyName: '',
        cnpj: '',
        whatsappNumber: '',
        photoURL: '',
        isActive: true
      });
      setPhotoPreview(null);
    }
    openUserModal(userData);
  };

  const handleCatalogSubmit = (e) => {
    e.preventDefault();
    const name = String(catalogForm.name || '').trim();
    if (!name) {
      showToast(t('toast.itemNameRequired'), 'error');
      return;
    }

    const stockValue = Number(catalogForm.stockQuantity);
    if (!Number.isInteger(stockValue) || stockValue < 0) {
      showToast(t('toast.stockMustBeInteger'), 'error');
      return;
    }

    const minStockValue = Number(catalogForm.minStock);
    if (!Number.isInteger(minStockValue) || minStockValue < 0) {
      showToast(t('toast.minStockMustBeInteger'), 'error');
      return;
    }

    const priceRaw = String(catalogForm.price ?? '').trim();
    if (priceRaw !== '') {
      const priceValue = Number(priceRaw.replace(',', '.'));
      const hasTooManyDecimals = !/^\d+([.,]\d{1,2})?$/.test(priceRaw);
      if (!Number.isFinite(priceValue) || priceValue < 0 || hasTooManyDecimals) {
        showToast(t('toast.invalidPriceFormat'), 'error');
        return;
      }
    }

    const sku = String(catalogForm.sku || '').trim();
    if (sku) {
      const hasDuplicateSku = catalogItems.some((item) => (
        item &&
        item.id !== (editingItem?.id || null) &&
        String(item.sku || '').trim().toLowerCase() === sku.toLowerCase()
      ));
      if (hasDuplicateSku) {
        showToast(t('toast.skuAlreadyExists'), 'error');
        return;
      }
    }

    saveCatalogItem(catalogForm, editingItem?.id || null);
    setShowCatalogModal(false);
    setEditingItem(null);
  };

  // Handlers para formulários
  const handleCompanySubmit = (e) => {
    e.preventDefault();
    saveCompanyProfile(companyForm);
  };

  const handleIntegrationsSubmit = (e) => {
    e.preventDefault();
    saveIntegrationsConfig(integrationsForm);
  };

  const applyAssistantFlowSteps = useCallback((newSteps, meta) => {
    setAssistantForm((prev) => {
      const merged = mergeFlowStepsIntoAssistantForm(prev, newSteps);
      if (meta && meta.fixedApproaches !== undefined) {
        return { ...merged, fixedApproaches: meta.fixedApproaches };
      }
      return merged;
    });
  }, []);

  const handleAssistantSubmit = (e) => {
    e.preventDefault();

    let steps = assistantForm.flowSteps || [];
    if (assistantForm.fixedApproaches?.length) {
      steps = applyFixedApproachesToSteps(steps, assistantForm.fixedApproaches);
    }

    const dataToSave = {
      ...assistantForm,
      flowSteps: steps,
      systemPrompt:
        assistantForm.fixedApproaches?.length > 0
          ? convertStepsToPrompt(steps)
          : assistantForm.systemPrompt,
      isActive: isActive,
      flowMode: 'visual'
    };

    if (assistantForm.fixedApproaches?.length) {
      setAssistantForm((prev) => ({
        ...prev,
        flowSteps: dataToSave.flowSteps,
        systemPrompt: dataToSave.systemPrompt
      }));
    }

    saveAssistantSettings(dataToSave);
  };

  // ==================== FUNÇÕES DO CRM ====================
  // CRM temporariamente desativado - será reconstruído depois
  // ==================== FIM FUNÇÕES DO CRM ====================
  
  // Função para renderizar o catálogo avançado
  const renderCatalog = () => {
    const validItems = catalogValidItems;
    const stats = catalogStats;
    const filteredItems = catalogFilteredItems;

    // Paginação - máximo 4 itens por página
    const catalogItemsPerPage = 4;
    const catalogTotalPages = Math.ceil(filteredItems.length / catalogItemsPerPage);
    const catalogStartIndex = (catalogCurrentPage || 0) * catalogItemsPerPage;
    const catalogEndIndex = catalogStartIndex + catalogItemsPerPage;
    const catalogPaginatedItems = filteredItems.slice(catalogStartIndex, catalogEndIndex);

    // Obter categorias únicas (apenas de itens válidos)
    const categories = catalogCategories;

    return (
      <div className={`${isMobile ? 'p-4' : 'p-6 lg:p-10'} space-y-6`} style={{ width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
        {/* Header Modernizado */}
        <div className="mb-8">
          <div className={`flex ${isMobile ? 'flex-col' : 'justify-between'} items-start mb-2`} style={{ gap: isMobile ? '16px' : '0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold text-white mb-2 flex items-center gap-3`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ display: 'inline-block', lineHeight: '1' }}>
                  {renderPageIcon('catalog', isMobile ? '1.875rem' : '2.25rem')}
                </span>
                Catálogo
              </h2>
              <p className={`${isMobile ? 'text-sm' : 'text-base'} text-gray-400`}>
                Gerencie seus produtos e serviços em um só lugar
              </p>
            </div>
          <div className={`flex ${isMobile ? 'flex-col w-full' : 'space-x-3'}`} style={{ gap: isMobile ? '8px' : '0' }}>
            <button
              onClick={() => setShowImportModal(true)}
                className={`bg-gradient-to-br from-gray-800 to-gray-900 text-gray-300 ${isMobile ? 'px-4 py-2 w-full' : 'px-5 py-2.5'} rounded-xl font-semibold hover:from-gray-700 hover:to-gray-800 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 flex items-center ${isMobile ? 'justify-center' : ''} space-x-2 border border-gray-700`}
            >
              <Upload className={isMobile ? 'w-3 h-3' : 'w-4 h-4'} />
              <span className={isMobile ? 'text-sm' : ''}>Importar</span>
            </button>
            <button
              onClick={() => openCatalogModal()}
                className={`bg-gradient-to-br from-green-600 to-green-700 text-white ${isMobile ? 'px-4 py-2 w-full' : 'px-6 py-3'} rounded-xl font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center ${isMobile ? 'justify-center' : ''} space-x-2 border border-green-500`}
            >
              <Plus className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
              <span className={isMobile ? 'text-sm' : ''}>Novo Item</span>
            </button>
            </div>
          </div>
        </div>

        {/* Dashboard de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg border border-green-400">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{stats.products}</span>
            </div>
            <p className="text-green-100">Total Produtos</p>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 text-white shadow-lg border border-green-500">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{stats.featured}</span>
            </div>
            <p className="text-green-100">Em Destaque</p>
          </div>

          <div className="bg-gradient-to-br from-green-700 to-green-800 rounded-2xl p-6 text-white shadow-lg border border-green-600">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{stats.lowStock}</span>
            </div>
            <p className="text-green-100">Estoque Baixo</p>
          </div>

          <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-2xl p-6 text-white shadow-lg border border-green-700">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">
                {stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <p className="text-green-100">Valor Total</p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nome, descrição ou SKU..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-500"
              />
            </div>

            {/* Filtro por Tipo */}
            <select
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value)}
              className="px-4 py-3 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">Todos os Tipos</option>
              <option value="product">Produtos</option>
              <option value="service">Serviços</option>
            </select>

            {/* Filtro por Categoria */}
            <select
              value={catalogCategory}
              onChange={(e) => setCatalogCategory(e.target.value)}
              className="px-4 py-3 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">Todas Categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Toggle de Visualização */}
            <div className="flex border border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setCatalogView('grid')}
                className={`px-4 py-3 ${catalogView === 'grid' ? 'bg-green-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCatalogView('list')}
                className={`px-4 py-3 ${catalogView === 'list' ? 'bg-green-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Itens */}
        {filteredItems.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 p-12 text-center">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300 mb-2">
              {catalogItems.length === 0 ? 'Nenhum item no catálogo' : 'Nenhum item encontrado'}
            </h3>
            <p className="text-gray-500 mb-6">
              {catalogItems.length === 0 
                ? 'Comece adicionando produtos ou serviços ao seu catálogo' 
                : 'Tente ajustar os filtros ou busca'}
            </p>
            {catalogItems.length === 0 && (
              <button
                onClick={() => openCatalogModal()}
                className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Adicionar Primeiro Item
              </button>
            )}
          </div>
        ) : catalogView === 'grid' ? (
          <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {catalogPaginatedItems.map((item) => (
              <div key={item.id} className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 overflow-hidden hover:shadow-xl hover:border-green-600 transition-all duration-300 group">
                {/* Imagem */}
                <div className="relative h-48 bg-gradient-to-br from-green-800 to-green-900 overflow-hidden">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-20 h-20 text-green-600 opacity-50" />
                    </div>
                  )}
                  {/* Badge de Destaque */}
                  {item.featured && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 border border-green-400">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Destaque</span>
                    </div>
                  )}
                  {/* Badge de Tipo */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      item.type === 'product' 
                        ? 'bg-green-600 border-green-400 text-white' 
                        : 'bg-green-700 border-green-500 text-white'
                    }`}>
                      {item.type === 'product' ? 'Produto' : 'Serviço'}
                    </span>
                  </div>
                  {/* Alerta de Estoque Baixo */}
                  {item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5) && (
                    <div className="absolute bottom-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 border border-red-500">
                      <AlertCircle className="w-3 h-3" />
                      <span>Estoque Baixo</span>
                    </div>
                  )}
                </div>

                {/* Conteúdo */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-white text-lg line-clamp-1">{item.name}</h3>
                    {item.sku && (
                      <span className="text-xs text-gray-400 font-mono">{item.sku}</span>
                    )}
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{item.description}</p>
                  )}

                  {item.category && (
                    <div className="flex items-center space-x-1 text-xs text-gray-500 mb-3">
                      <Tag className="w-3 h-3" />
                      <span>{item.category}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {item.price !== null && item.price !== undefined ? (
                        <p className="text-2xl font-bold text-green-400">
                          R$ {parseFloat(item.price).toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-400">
                          Preço no link
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Estoque</p>
                      <p className={`text-sm font-bold ${
                        item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5)
                          ? 'text-red-500'
                          : 'text-white'
                      }`}>
                        {item.stockQuantity}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openCatalogModal(item)}
                      className="flex-1 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2 border border-green-600"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => deleteCatalogItem(item.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors border border-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Navegação de Páginas - Catálogo */}
          {filteredItems.length > catalogItemsPerPage && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              marginTop: '24px',
              padding: '16px',
              backgroundColor: '#1a1f36',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                type="button"
                onClick={() => setCatalogCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={catalogCurrentPage === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: catalogCurrentPage === 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
                  backgroundColor: catalogCurrentPage === 0 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
                  color: 'white',
                  cursor: catalogCurrentPage === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: catalogCurrentPage === 0 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (catalogCurrentPage > 0) {
                    e.currentTarget.style.backgroundColor = '#0f1419';
                    e.currentTarget.style.borderColor = '#059669';
                  }
                }}
                onMouseLeave={(e) => {
                  if (catalogCurrentPage > 0) {
                    e.currentTarget.style.backgroundColor = '#1a1f36';
                    e.currentTarget.style.borderColor = '#10b981';
                  }
                }}
              >
                <ChevronLeft size={20} />
                Anterior
              </button>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ffffff',
                fontSize: '0.875rem'
              }}>
                <span>Página</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>{catalogCurrentPage + 1}</span>
                <span>de</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>{catalogTotalPages}</span>
                <span style={{ color: '#9ca3af' }}>({filteredItems.length} itens)</span>
              </div>
              
              <button
                type="button"
                onClick={() => setCatalogCurrentPage(prev => Math.min(catalogTotalPages - 1, prev + 1))}
                disabled={catalogCurrentPage >= catalogTotalPages - 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: catalogCurrentPage >= catalogTotalPages - 1 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
                  backgroundColor: catalogCurrentPage >= catalogTotalPages - 1 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
                  color: 'white',
                  cursor: catalogCurrentPage >= catalogTotalPages - 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: catalogCurrentPage >= catalogTotalPages - 1 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (catalogCurrentPage < catalogTotalPages - 1) {
                    e.currentTarget.style.backgroundColor = '#0f1419';
                    e.currentTarget.style.borderColor = '#059669';
                  }
                }}
                onMouseLeave={(e) => {
                  if (catalogCurrentPage < catalogTotalPages - 1) {
                    e.currentTarget.style.backgroundColor = '#1a1f36';
                    e.currentTarget.style.borderColor = '#10b981';
                  }
                }}
              >
                Próxima
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          </div>
        ) : (
          <div>
            <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Produto</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">SKU</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Categoria</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Preço</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Estoque</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {catalogPaginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-900">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center flex-shrink-0 border border-green-700">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Package className="w-6 h-6 text-green-600 opacity-50" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white flex items-center space-x-2">
                              <span>{item.name}</span>
                              {item.featured && <Star className="w-4 h-4 text-green-500 fill-current" />}
                            </div>
                            <div className="text-sm text-gray-400 truncate max-w-xs">{item.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-400">{item.sku || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {item.category ? (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                            <Tag className="w-3 h-3" />
                            <span>{item.category}</span>
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.price !== null && item.price !== undefined ? (
                          <span className="text-sm font-bold text-green-400">R$ {parseFloat(item.price).toFixed(2)}</span>
                        ) : (
                          <span className="text-sm font-bold text-blue-400">Preço no link</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${
                          item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5)
                            ? 'text-red-500'
                            : 'text-white'
                        }`}>
                          {item.stockQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block w-fit border ${
                            item.type === 'product' 
                              ? 'bg-green-600 text-white border-green-400' 
                              : 'bg-green-700 text-white border-green-500'
                          }`}>
                            {item.type === 'product' ? 'Produto' : 'Serviço'}
                          </span>
                          {item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5) && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-600 text-white inline-flex items-center space-x-1 w-fit border border-red-500">
                              <AlertCircle className="w-3 h-3" />
                              <span>Baixo</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openCatalogModal(item)}
                            className="p-2 text-green-600 hover:bg-green-900/30 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCatalogItem(item.id)}
                            className="p-2 text-red-600 hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Navegação de Páginas - Catálogo (Lista) */}
            {filteredItems.length > catalogItemsPerPage && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              marginTop: '24px',
              padding: '16px',
              backgroundColor: '#1a1f36',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                type="button"
                onClick={() => setCatalogCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={catalogCurrentPage === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: catalogCurrentPage === 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
                  backgroundColor: catalogCurrentPage === 0 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
                  color: 'white',
                  cursor: catalogCurrentPage === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: catalogCurrentPage === 0 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (catalogCurrentPage > 0) {
                    e.currentTarget.style.backgroundColor = '#0f1419';
                    e.currentTarget.style.borderColor = '#059669';
                  }
                }}
                onMouseLeave={(e) => {
                  if (catalogCurrentPage > 0) {
                    e.currentTarget.style.backgroundColor = '#1a1f36';
                    e.currentTarget.style.borderColor = '#10b981';
                  }
                }}
              >
                <ChevronLeft size={20} />
                Anterior
              </button>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ffffff',
                fontSize: '0.875rem'
              }}>
                <span>Página</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>{catalogCurrentPage + 1}</span>
                <span>de</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>{catalogTotalPages}</span>
                <span style={{ color: '#9ca3af' }}>({filteredItems.length} itens)</span>
              </div>
              
              <button
                type="button"
                onClick={() => setCatalogCurrentPage(prev => Math.min(catalogTotalPages - 1, prev + 1))}
                disabled={catalogCurrentPage >= catalogTotalPages - 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: catalogCurrentPage >= catalogTotalPages - 1 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
                  backgroundColor: catalogCurrentPage >= catalogTotalPages - 1 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
                  color: 'white',
                  cursor: catalogCurrentPage >= catalogTotalPages - 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: catalogCurrentPage >= catalogTotalPages - 1 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (catalogCurrentPage < catalogTotalPages - 1) {
                    e.currentTarget.style.backgroundColor = '#0f1419';
                    e.currentTarget.style.borderColor = '#059669';
                  }
                }}
                onMouseLeave={(e) => {
                  if (catalogCurrentPage < catalogTotalPages - 1) {
                    e.currentTarget.style.backgroundColor = '#1a1f36';
                    e.currentTarget.style.borderColor = '#10b981';
                  }
                }}
              >
                Próxima
                <ChevronRight size={20} />
              </button>
            </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const openAgendamentoModal = useCallback(() => {
    setEditingAgendamento(null);
    setShowAgendamentoModal(true);
  }, []);

  const editAgendamento = useCallback((agendamento) => {
    setEditingAgendamento(agendamento);
    setShowAgendamentoModal(true);
  }, []);

  const deleteAgendamento = useCallback(async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir?')) return;
    if (!user || !database) {
      showToast(t('toast.unauthenticated'), 'error');
      return;
    }
    try {
      const agendamentoRef = ref(database, `users/data/${user.uid}/agendamentos/${id}`);
      await remove(agendamentoRef);
      showToast(t('toast.scheduleDeleted'), 'success');
    } catch (error) {
      console.error('❌ [FIREBASE] Erro ao excluir agendamento:', error);
      showToast(t('toast.scheduleDeleteError'), 'error');
    }
  }, [user, database]);

  const updateAgendamentoStatus = useCallback(async (agendamentoId, newStatus) => {
    if (!user || !database) {
      showToast(t('toast.unauthenticated'), 'error');
      return;
    }
    try {
      const agendamentoRef = ref(database, `users/data/${user.uid}/agendamentos/${agendamentoId}`);
      const snapshot = await get(agendamentoRef);
      if (!snapshot.exists()) {
        showToast(t('toast.scheduleNotFound'), 'error');
        return;
      }
      const agendamentoData = snapshot.val();
      const statusHistory = Array.isArray(agendamentoData.statusHistory) ? agendamentoData.statusHistory : [];
      await set(agendamentoRef, {
        ...agendamentoData,
        status: newStatus,
        statusHistory: [
          ...statusHistory,
          {
            from: agendamentoData.status || 'pendente',
            to: newStatus,
            changedAt: new Date().toISOString(),
            changedBy: user.uid
          }
        ],
        updatedAt: new Date().toISOString()
      });
      showToast(t('toast.scheduleStatusChangedTo', { label: getStatusLabel(newStatus) }), 'success');
    } catch (error) {
      console.error('❌ [FIREBASE] Erro ao atualizar status:', error);
      showToast(t('toast.scheduleStatusUpdateError'), 'error');
    }
  }, [user, database, getStatusLabel]);

  const exportAgendamentosCsv = useCallback(() => {
    const rows = agendamentosFiltradosOrdenados.map((a) => ({
      titulo: a.titulo || '',
      tipo: a.tipo || '',
      status: getStatusLabel(a.status),
      data: a.data || '',
      horario: a.horario || '',
      cliente: a.cliente || '',
      telefone: a.telefone || '',
      descricao: a.descricao || '',
      observacoes: a.observacoes || ''
    }));

    const header = ['titulo', 'tipo', 'status', 'data', 'horario', 'cliente', 'telefone', 'descricao', 'observacoes'];
    const csvLines = [header.join(';')].concat(rows.map((row) => (
      header.map((k) => `"${String(row[k]).replace(/"/g, '""')}"`).join(';')
    )));

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `agendamentos-${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(t('toast.csvExported'), 'success');
  }, [agendamentosFiltradosOrdenados, getStatusLabel]);

  const openWhatsAppReminder = useCallback((agendamento) => {
    const phone = String(agendamento?.telefone || '').replace(/\D/g, '');
    if (!phone) {
      showToast(t('toast.scheduleMissingPhone'), 'error');
      return;
    }
    const mensagem = `Olá ${agendamento.cliente || ''}! Lembrete do seu agendamento "${agendamento.titulo || 'Compromisso'}" em ${agendamento.data || ''} às ${agendamento.horario || ''}.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  }, []);

  const copyUpcomingReminders = useCallback((hoursAhead) => {
    const now = new Date();
    const limit = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));
    const list = agendamentosOrdenados.filter((a) => {
      const dt = parseAgendamentoDateTime(a.data, a.horario);
      return dt && dt >= now && dt <= limit && ['pendente', 'confirmado', 'em_andamento'].includes(a.status);
    });

    if (list.length === 0) {
      showToast(t('toast.noRemindersInHours', { hours: hoursAhead }), 'error');
      return;
    }

    const text = list.map((a) => {
      const phone = String(a.telefone || '').replace(/\D/g, '');
      return `${a.cliente || 'Cliente'} | ${a.data} ${a.horario} | tel: ${phone || 'sem telefone'}`;
    }).join('\n');

    navigator.clipboard.writeText(text)
      .then(() => showToast(t('toast.remindersListCopied', { hours: hoursAhead }), 'success'))
      .catch(() => showToast(t('toast.copyRemindersError'), 'error'));
  }, [agendamentosOrdenados, parseAgendamentoDateTime]);

  // Função para renderizar agendamentos (igual ao renderCatalog - tem acesso aos states!)
  const renderAgendamentos = () => {
    const agendamentosAtual = agendamentosOrdenados;
    const agendamentosFiltrados = agendamentosFiltradosOrdenados;
    const stats = agendamentoStats;
    
    return (
      <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '16px', gap: isMobile ? '16px' : '0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: isMobile ? '1.5rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('agendamentos')}
                {t('agendamentosPage.title')}
              </h2>
              <p style={{ fontSize: isMobile ? '0.875rem' : '1rem', color: '#9ca3af' }}>
                {t('agendamentosPage.subtitle')}
              </p>
            </div>
            <button
              onClick={openAgendamentoModal}
              style={{
                backgroundColor: '#1a1f36',
                border: '1px solid #10b981',
                color: 'white',
                padding: isMobile ? '10px 16px' : '14px 28px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: isMobile ? '0.875rem' : '1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                whiteSpace: 'nowrap',
                width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>+</span> {t('agendamentosPage.new')}
            </button>
          </div>

          {/* Estatísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.total')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#ffffff' }}>{stats.total}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.pending')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#eab308' }}>{stats.pendente}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.confirmed')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#10b981' }}>{stats.confirmado}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.inProgress')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#10b981' }}>{stats.em_andamento}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.completed')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#10b981' }}>{stats.concluido}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.cancelled')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.cancelado}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.late')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.atrasados}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.today')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#3b82f6' }}>{stats.hoje}</div>
            </div>
            <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{t('agendamentosPage.next7')}</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#10b981' }}>{stats.proximos7}</div>
            </div>
          </div>

          {/* Filtros e Toggle de Visualização */}
          <div style={{ backgroundColor: '#1a1f36', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#ffffff', marginBottom: '8px', fontWeight: '600' }}>
                {t('agendamentosPage.search')}
              </label>
              <input
                type="text"
                value={agendamentoSearch}
                onChange={(e) => setAgendamentoSearch(e.target.value)}
                placeholder={t('agendamentosPage.searchPlaceholder')}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f1419',
                  color: '#ffffff',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#ffffff', marginBottom: '8px', fontWeight: '600' }}>
                {t('agendamentosPage.statusFilter')}
              </label>
              <select
                value={agendamentoFilter}
                onChange={(e) => setAgendamentoFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f1419',
                  color: '#ffffff',
                  outline: 'none'
                }}
              >
                <option value="todos">{t('agendamentosPage.allStatus')}</option>
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#ffffff', marginBottom: '8px', fontWeight: '600' }}>
                {t('agendamentosPage.type')}
              </label>
              <select
                value={agendamentoTypeFilter}
                onChange={(e) => setAgendamentoTypeFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f1419',
                  color: '#ffffff',
                  outline: 'none'
                }}
              >
                <option value="todos">{t('agendamentosPage.allTypes')}</option>
                <option value="retirada">📦 Retirada</option>
                <option value="servico">🔧 Serviço</option>
                <option value="visita">🏢 Visita</option>
                <option value="entrega">🚚 Entrega</option>
                <option value="ligacao">📞 Ligação</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', overflow: 'hidden' }}>
              <button
                onClick={() => setAgendamentoViewMode('lista')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: agendamentoViewMode === 'lista' ? '#10b981' : '#0f1419',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                📋 {t('agendamentosPage.list')}
              </button>
              <button
                onClick={() => setAgendamentoViewMode('calendario')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: agendamentoViewMode === 'calendario' ? '#10b981' : '#0f1419',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                📅 {t('agendamentosPage.calendar')}
              </button>
            </div>
            <button
              onClick={exportAgendamentosCsv}
              type="button"
              style={{ backgroundColor: '#0f1419', color: '#ffffff', border: '1px solid rgba(59,130,246,0.5)', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontWeight: '600' }}
            >
              {t('agendamentosPage.exportCsv')}
            </button>
            <button
              onClick={() => copyUpcomingReminders(24)}
              type="button"
              style={{ backgroundColor: '#0f1419', color: '#ffffff', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontWeight: '600' }}
            >
              {t('agendamentosPage.copy24h')}
            </button>
            <button
              onClick={() => copyUpcomingReminders(1)}
              type="button"
              style={{ backgroundColor: '#0f1419', color: '#ffffff', border: '1px solid rgba(168,85,247,0.5)', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontWeight: '600' }}
            >
              {t('agendamentosPage.copy1h')}
            </button>
          </div>
        </div>

        {/* Visualização: Lista ou Calendário */}
        {agendamentoViewMode === 'calendario' ? (
          <AgendamentosCalendar 
            agendamentos={agendamentosFiltrados}
            onDayClick={(date, agendamentosDoDia) => {
              setSelectedCalendarDate(date);
              setSelectedDateAgendamentos(agendamentosDoDia);
            }}
            onEdit={editAgendamento}
            onDelete={deleteAgendamento}
            getStatusColor={getStatusColor}
            getStatusLabel={getStatusLabel}
            getTipoIcon={getTipoIcon}
          />
        ) : (
          /* Lista de Agendamentos */
          agendamentosFiltrados.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '48px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📅</div>
            <h3 style={{ fontSize: '1.25rem', color: '#1f2937', marginBottom: '8px' }}>
              {t('agendamentosPage.emptyTitle')}
            </h3>
            <p style={{ color: '#6b7280' }}>
              {agendamentosAtual.length === 0 
                ? t('agendamentosPage.emptyCreate')
                : t('agendamentosPage.emptyFilter')}
            </p>
          </div>
        ) : (
          <>
          <div style={{ display: 'grid', gap: '16px' }}>
            {agendamentosPaginados.map(agend => (
              <div
                key={agend.id}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${getStatusColor(agend.status)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{getTipoIcon(agend.tipo)}</span>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                        {agend.titulo}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: 'white',
                          backgroundColor: getStatusColor(agend.status),
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        {getStatusLabel(agend.status)}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{agend.descricao}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {/* Campo rápido para alterar status */}
                    <select
                      value={agend.status || 'pendente'}
                      onChange={(e) => updateAgendamentoStatus(agend.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '6px 10px',
                        border: `1px solid ${getStatusColor(agend.status)}`,
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: 'white',
                        color: getStatusColor(agend.status),
                        cursor: 'pointer',
                        outline: 'none',
                        minWidth: '120px'
                      }}
                      title="Alterar status rapidamente"
                    >
                      <option value="pendente">🟡 Pendente</option>
                      <option value="confirmado">🔵 Confirmado</option>
                      <option value="em_andamento">🟣 Em Andamento</option>
                      <option value="concluido">🟢 Concluído</option>
                      <option value="cancelado">🔴 Cancelado</option>
                    </select>
                    <button
                      onClick={() => editAgendamento(agend)}
                      style={{
                        padding: '8px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#6366f1'
                      }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteAgendamento(agend.id)}
                      style={{
                        padding: '8px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#ef4444'
                      }}
                      title="Excluir"
                    >
                      🗑️
                    </button>
                    <button
                      onClick={() => openWhatsAppReminder(agend)}
                      style={{
                        padding: '8px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#10b981'
                      }}
                      title="Lembrete WhatsApp"
                    >
                      💬
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>📅 Data e Hora</div>
                    <div style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: '500' }}>
                      {agend.data} às {agend.horario}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>👤 Cliente</div>
                    <div style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: '500' }}>{agend.cliente}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>📞 Telefone</div>
                    <div style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: '500' }}>{agend.telefone}</div>
                  </div>
                </div>

                {agend.observacoes && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    color: '#4b5563'
                  }}>
                    <strong>📝 Observações:</strong> {agend.observacoes}
                  </div>
                )}
                {Array.isArray(agend.statusHistory) && agend.statusHistory.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
                    Histórico de status: {agend.statusHistory.length} alteração(ões)
                  </div>
                )}
              </div>
            ))}
          </div>
          {agendamentosFiltrados.length > agendamentoItemsPerPage && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              marginTop: '24px',
              padding: '16px',
              backgroundColor: '#1a1f36',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                type="button"
                onClick={() => setAgendamentoCurrentPage((prev) => Math.max(0, prev - 1))}
                disabled={agendamentoPaginaAtual === 0}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #10b981', backgroundColor: '#1a1f36', color: 'white', cursor: agendamentoPaginaAtual === 0 ? 'not-allowed' : 'pointer', opacity: agendamentoPaginaAtual === 0 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <span style={{ color: '#ffffff', fontSize: '0.875rem' }}>
                Página <strong>{agendamentoPaginaAtual + 1}</strong> de <strong>{agendamentoTotalPages}</strong> ({agendamentosFiltrados.length} itens)
              </span>
              <button
                type="button"
                onClick={() => setAgendamentoCurrentPage((prev) => Math.min(agendamentoTotalPages - 1, prev + 1))}
                disabled={agendamentoPaginaAtual >= agendamentoTotalPages - 1}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #10b981', backgroundColor: '#1a1f36', color: 'white', cursor: agendamentoPaginaAtual >= agendamentoTotalPages - 1 ? 'not-allowed' : 'pointer', opacity: agendamentoPaginaAtual >= agendamentoTotalPages - 1 ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}
          </>
        )
        )}
      </div>
    );
  };

  // Componente de Calendário de Agendamentos
  const AgendamentosCalendar = ({ agendamentos, onDayClick, onEdit, onDelete, getStatusColor, getStatusLabel, getTipoIcon }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Obter primeiro dia do mês e quantos dias tem
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Domingo, 6 = Sábado

    // Agrupar agendamentos por data (suporta ambos os formatos: YYYY-MM-DD e DD/MM/YYYY)
    const agendamentosPorData = {};
    agendamentos.forEach(agend => {
      const dataOriginal = agend.data;
      
      // Converter para formato padrão se estiver em formato diferente
      let dataKey;
      if (dataOriginal.includes('-')) {
        // Formato YYYY-MM-DD, converter para DD/MM/YYYY
        const [year, month, day] = dataOriginal.split('-');
        dataKey = `${day}/${month}/${year}`;
      } else {
        // Já está em DD/MM/YYYY
        dataKey = dataOriginal;
      }
      
      if (!agendamentosPorData[dataKey]) {
        agendamentosPorData[dataKey] = [];
      }
      agendamentosPorData[dataKey].push(agend);
    });

    // Verificar se uma data tem agendamentos
    const temAgendamentosNoDia = (day) => {
      const dateStr = `${String(day).padStart(2, '0')}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()}`;
      return agendamentosPorData[dateStr] && agendamentosPorData[dateStr].length > 0;
    };

    // Obter agendamentos do dia
    const getAgendamentosDoDia = (day) => {
      const dateStr = `${String(day).padStart(2, '0')}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()}`;
      return agendamentosPorData[dateStr] || [];
    };

    // Navegar para mês anterior
    const previousMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    // Navegar para próximo mês
    const nextMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    // Nomes dos dias da semana
    const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    return (
      <div style={{
        backgroundColor: '#1a1f36',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Cabeçalho do Calendário */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button
            onClick={previousMonth}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0f1419',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            ← Anterior
          </button>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff' }}>
            {meses[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            onClick={nextMonth}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0f1419',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            Próximo →
          </button>
        </div>

          {/* Grid do Calendário */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', width: '100%' }}>
          {/* Cabeçalhos dos dias da semana */}
          {diasDaSemana.map(day => (
            <div key={day} style={{
              padding: isMobile ? '8px 4px' : '12px',
              textAlign: 'center',
              fontWeight: '600',
              color: '#9ca3af',
              fontSize: isMobile ? '0.75rem' : '0.875rem',
              backgroundColor: '#0f1419',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {day}
            </div>
          ))}

          {/* Dias vazios no início */}
          {Array.from({ length: startingDayOfWeek }).map((_, index) => (
            <div key={`empty-${index}`} style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#0f1419' }} />
          ))}

          {/* Dias do mês */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const temAgendamentos = temAgendamentosNoDia(day);
            const hoje = new Date();
            const isToday = day === hoje.getDate() && 
                          currentMonth.getMonth() === hoje.getMonth() && 
                          currentMonth.getFullYear() === hoje.getFullYear();

            return (
              <div
                key={day}
                onClick={() => {
                  if (temAgendamentos) {
                    const agendamentosDoDia = getAgendamentosDoDia(day);
                    const dateStr = `${String(day).padStart(2, '0')}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()}`;
                    onDayClick(dateStr, agendamentosDoDia);
                  }
                }}
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#0f1419',
                  border: isToday ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontWeight: isToday ? '700' : '500',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  minHeight: '60px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                  e.target.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#0f1419';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                <span style={{ fontSize: '1rem' }}>{day}</span>
                {temAgendamentos && (
                  <div style={{
                    display: 'flex',
                    gap: '2px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    marginTop: '4px'
                  }}>
                    {getAgendamentosDoDia(day).slice(0, 3).map((agend, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: getStatusColor(agend.status)
                        }}
                      />
                    ))}
                    {getAgendamentosDoDia(day).length > 3 && (
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        +{getAgendamentosDoDia(day).length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    // Proteção SSR e undefined - garantir que sempre temos valores válidos
    const safeRealConversations = (typeof realConversations !== 'undefined') ? (realConversations || []) : [];
    const safeCurrentMessages = (typeof currentMessages !== 'undefined') ? (currentMessages || []) : [];
    const safeLoadingConversations = (typeof loadingConversations !== 'undefined') ? loadingConversations : false;
    const safeAgendamentos = (typeof agendamentos !== 'undefined') ? (agendamentos || []) : [];
    const safeLoadingAgendamentos = (typeof loadingAgendamentos !== 'undefined') ? loadingAgendamentos : false;
    const safeShowEmojiPicker = (typeof showEmojiPicker !== 'undefined') ? showEmojiPicker : false;
    const safeMessageInput = (typeof messageInput !== 'undefined') ? (messageInput || '') : '';
    const safeIsDragging = (typeof isDragging !== 'undefined') ? isDragging : false;
    const safeChatSearchQuery = (typeof chatSearchQuery !== 'undefined') ? (chatSearchQuery || '') : '';
    const safeIsCompactMode = (typeof isCompactMode !== 'undefined') ? isCompactMode : false;
    const safeSelectedConversation = (typeof selectedConversation !== 'undefined') ? selectedConversation : null;
    const safeAgendamentoFilter = (typeof agendamentoFilter !== 'undefined') ? (agendamentoFilter || 'todos') : 'todos';
    const safeAgendamentoTypeFilter = (typeof agendamentoTypeFilter !== 'undefined') ? (agendamentoTypeFilter || 'todos') : 'todos';
    
    // Verificar acesso à página atual
    const isAlwaysAvailable = currentPage === 'plans' || currentPage === 'users';
    const isMasterOnly = currentPage === 'users';
    const isBasicAccess = currentPage === 'company';
    
    let hasAccess = false;
    if (user?.isMaster) {
      hasAccess = true; // Master tem acesso a tudo
    } else if (isAlwaysAvailable || isBasicAccess) {
      hasAccess = true; // Planos e Cadastro sempre disponíveis
    } else if (userActivePlan?.allowedFeatures && Array.isArray(userActivePlan.allowedFeatures)) {
      hasAccess = userActivePlan.allowedFeatures.includes(currentPage);
    }
    
    // Se não tem acesso, mostrar mensagem e redirecionar para planos
    if (!hasAccess && !isMasterOnly) {
      return (
        <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#1a1f36', borderRadius: '20px', padding: '48px', border: '2px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔒</div>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
              {t('locked.title')}
            </h2>
            <p style={{ fontSize: '1.125rem', color: '#9ca3af', marginBottom: '32px', lineHeight: '1.6' }}>
              {t('locked.body')}
            </p>
            <button
              onClick={() => setCurrentPage('plans')}
              style={{
                backgroundColor: '#8b5cf6',
                color: 'white',
                padding: '14px 28px',
                borderRadius: '12px',
                border: 'none',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
              }}
            >
              {t('locked.cta')}
            </button>
          </div>
        </div>
      );
    }
    
    switch (currentPage) {
      case 'dashboard':
        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('dashboard')}
                {t('dashboard.title')}
              </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                {t('dashboard.subtitle')}
              </p>
            </div>

            {/* Toggle Assistente */}
            <div style={{ 
              backgroundColor: '#1a1f36', 
              borderRadius: '16px', 
              padding: '24px', 
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                    {t('dashboard.aiTitle')}
                </h3>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                    {isActive ? `🟢 ${t('dashboard.aiOn')}` : `🔴 ${t('dashboard.aiOff')}`}
                  </p>
                </div>
                <label style={{ 
                  position: 'relative', 
                  display: 'inline-block', 
                  width: '56px', 
                  height: '28px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: isActive ? '#10b981' : '#d1d5db',
                    borderRadius: '28px',
                    transition: '0.3s',
                    boxShadow: isActive ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '',
                      height: '22px',
                      width: '22px',
                      left: isActive ? '30px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.3s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {/* Cards de Status */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '20px',
              marginBottom: '32px'
            }}>
              {/* Card: Meu Plano */}
              {userActivePlan ? (
                <div style={{ 
                  backgroundColor: '#1a1f36',
                  borderRadius: '16px', 
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: userActivePlan?.isTrialPlan ? '2px solid #f59e0b' : '2px solid #8b5cf6',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => setCurrentPage('plans')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = userActivePlan?.isTrialPlan ? '#fbbf24' : '#a78bfa';
            e.currentTarget.style.boxShadow = userActivePlan?.isTrialPlan ? '0 8px 24px rgba(245, 158, 11, 0.4)' : '0 8px 24px rgba(139, 92, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = userActivePlan?.isTrialPlan ? '#f59e0b' : '#8b5cf6';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                }}
                >
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{userActivePlan?.isTrialPlan ? '🎁' : '💎'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <h4 style={{ fontWeight: '600', fontSize: '1rem', color: '#ffffff' }}>Meu Plano Ativo</h4>
              {userActivePlan?.isTrialPlan && (
                <span style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: '700'
                }}>
                  TESTE
                </span>
              )}
            </div>
            <p style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px', color: userActivePlan?.isTrialPlan ? '#f59e0b' : '#a78bfa' }}>
                    {userActivePlan.planName}
                  </p>
            
            {/* Mostrar tempo restante para planos de teste */}
            {userActivePlan?.isTrialPlan && userActivePlan?.nextDueDate && (() => {
              const expirationDate = new Date(userActivePlan.nextDueDate);
              const now = new Date();
              const timeLeft = expirationDate - now;
              const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
              const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
              const isExpired = timeLeft <= 0;
              
              return (
                <div style={{ 
                  marginTop: '12px', 
                  marginBottom: '12px',
                  padding: '12px', 
                  backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                  borderRadius: '8px',
                  border: `1px solid ${isExpired ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                }}>
                  {isExpired ? (
                    <p style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: '600', margin: 0 }}>
                      ⏰ Plano de teste expirado
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.875rem', color: '#f59e0b', fontWeight: '600', margin: 0 }}>
                      ⏱️ Tempo restante: {hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`}
                    </p>
                  )}
                </div>
              );
            })()}
            
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Uso Mensal</p>
                      <p style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff', margin: 0 }}>
                        {userPlanUsage?.messagesPerMonth?.used || 0} / {userPlanUsage?.messagesPerMonth?.limit === null || userPlanUsage?.messagesPerMonth?.limit === -1 ? '∞' : userPlanUsage?.messagesPerMonth?.limit}
                      </p>
                    </div>
              {!userActivePlan?.isTrialPlan && userActivePlan?.nextDueDate && (
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Próxima cobrança</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#a78bfa', margin: 0 }}>
                          {new Date(userActivePlan.nextDueDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : user?.isMaster ? null : (
                <div style={{ 
                  backgroundColor: '#1a1f36',
                  borderRadius: '16px', 
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  border: '2px solid #f59e0b',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => setCurrentPage('plans')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#fbbf24';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(245, 158, 11, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#f59e0b';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
                  <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1rem', color: '#ffffff' }}>Nenhum Plano Ativo</h4>
                  <p style={{ fontSize: '0.875rem', marginBottom: '12px', color: '#fbbf24' }}>
                    Contrate um plano para usar todas as funcionalidades
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPage('plans');
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#d97706'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#f59e0b'}
                  >
                    Ver Planos Disponíveis
                  </button>
                </div>
              )}

              <div style={{ 
                backgroundColor: '#1a1f36',
                borderRadius: '16px', 
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: companyProfile.companyName ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = companyProfile.companyName ? '#10b981' : 'rgba(255,255,255,0.1)';
              }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏢</div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1rem', color: '#ffffff' }}>Configuração da Empresa</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px', color: companyProfile.companyName ? '#10b981' : '#9ca3af' }}>
                  {companyProfile.companyName ? '✓ Completa' : 'Pendente'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  {companyProfile.companyName || 'Configure os dados da sua empresa'}
                  </p>
                </div>

              <div style={{ 
                backgroundColor: '#1a1f36',
                borderRadius: '16px', 
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: integrationsConfig.openaiApiKey ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = integrationsConfig.openaiApiKey ? '#10b981' : 'rgba(255,255,255,0.1)';
              }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚙️</div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1rem', color: '#ffffff' }}>Integrações</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px', color: integrationsConfig.openaiApiKey ? '#10b981' : '#9ca3af' }}>
                  {integrationsConfig.openaiApiKey ? '✓ Configurado' : 'Pendente'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  {integrationsConfig.openaiApiKey ? 'API Key configurada' : 'Configure sua API Key'}
                  </p>
                </div>

              <div style={{ 
                backgroundColor: '#1a1f36',
                borderRadius: '16px', 
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: catalogItems.length > 0 ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = catalogItems.length > 0 ? '#10b981' : 'rgba(255,255,255,0.1)';
              }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📦</div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1rem', color: '#ffffff' }}>Catálogo</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px', color: catalogItems.length > 0 ? '#10b981' : '#9ca3af' }}>
                  {catalogItems.length} itens
                </p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  {catalogItems.filter(i => i && i.type === 'product').length} produtos · {catalogItems.filter(i => i && i.type === 'service').length} serviços
                </p>
              </div>
            </div>

            {/* Card de Boas-Vindas */}
            <div style={{ 
              backgroundColor: '#1a1f36', 
              borderRadius: '20px', 
              padding: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                🚀 Começe Agora
              </h3>
              <p style={{ color: '#9ca3af', marginBottom: '24px', lineHeight: '1.6' }}>
                Configure seu assistente de vendas com IA em poucos passos. Complete as configurações abaixo para começar a atender seus clientes automaticamente pelo WhatsApp.
              </p>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ 
                  padding: '20px', 
                  backgroundColor: companyProfile.companyName ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '12px',
                  border: `2px solid ${companyProfile.companyName ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setCurrentPage('company')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px)';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = companyProfile.companyName ? '#10b981' : 'rgba(255, 255, 255, 0.1)';
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2rem' }}>{companyProfile.companyName ? '✅' : '1️⃣'}</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                        Dados da Empresa
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: companyProfile.companyName ? '#10b981' : '#9ca3af' }}>
                        {companyProfile.companyName ? 'Configurado ✓' : 'Clique para configurar'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: '20px', 
                  backgroundColor: integrationsConfig.openaiApiKey ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '12px',
                  border: `2px solid ${integrationsConfig.openaiApiKey ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setCurrentPage('integrations')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px)';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = integrationsConfig.openaiApiKey ? '#10b981' : 'rgba(255, 255, 255, 0.1)';
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2rem' }}>{integrationsConfig.openaiApiKey ? '✅' : '2️⃣'}</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                        Integração com IA
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: integrationsConfig.openaiApiKey ? '#10b981' : '#9ca3af' }}>
                        {integrationsConfig.openaiApiKey ? 'API Key configurada ✓' : 'Configure sua API Key'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: '20px', 
                  backgroundColor: assistantSettings.systemPrompt ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '12px',
                  border: `2px solid ${assistantSettings.systemPrompt ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setCurrentPage('assistant')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px)';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = assistantSettings.systemPrompt ? '#10b981' : 'rgba(255, 255, 255, 0.1)';
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2rem' }}>{assistantSettings.systemPrompt ? '✅' : '3️⃣'}</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                        Configuração do Assistente
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: assistantSettings.systemPrompt ? '#10b981' : '#9ca3af' }}>
                        {assistantSettings.systemPrompt ? 'Prompt configurado ✓' : 'Defina o comportamento da IA'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'company':
        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('company')}
                Cadastro do Usuário
              </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                Configure seus dados para personalizar o atendimento
              </p>
            </div>

            {/* Formulário */}
            <div style={{ 
              backgroundColor: '#1a1f36', 
              borderRadius: '20px', 
              padding: getResponsivePadding(), 
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
              border: '1px solid rgba(16, 185, 129, 0.2)' 
            }}>
              <form onSubmit={handleCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Upload de Foto de Perfil */}
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                    Foto de Perfil
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {finalCompanyPhotoPreview ? (
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={finalCompanyPhotoPreview} 
                          alt="Preview" 
                          style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #10b981'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFinalCompanyPhotoPreview(null);
                            setCompanyForm(prev => ({ ...prev, photoURL: '' }));
                          }}
                          style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#ef4444',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '2px dashed rgba(255, 255, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        color: '#9ca3af'
                      }}>
                        👤
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Validar tamanho (máximo 5MB)
                            if (file.size > 2 * 1024 * 1024) {
                              showToast(t('toast.imageMax2mb'), 'error');
                              return;
                            }
                            handleCompanyPhotoUploadWrapper(file);
                          }
                        }}
                        disabled={finalUploadingCompanyPhoto}
                        style={{ display: 'none' }}
                        id="company-photo-upload"
                      />
                      <label
                        htmlFor="company-photo-upload"
                        style={{
                          display: 'inline-block',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          backgroundColor: finalUploadingCompanyPhoto ? 'rgba(16, 185, 129, 0.3)' : '#10b981',
                          color: 'white',
                          cursor: finalUploadingCompanyPhoto ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          transition: 'all 0.2s',
                          opacity: finalUploadingCompanyPhoto ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!finalUploadingCompanyPhoto) {
                            e.target.style.backgroundColor = '#059669';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!finalUploadingCompanyPhoto) {
                            e.target.style.backgroundColor = '#10b981';
                          }
                        }}
                      >
                        {finalUploadingCompanyPhoto ? 'Enviando...' : finalCompanyPhotoPreview ? 'Alterar Foto' : 'Escolher Foto'}
                      </label>
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
                        Formatos: JPG, PNG, GIF (máx. 2MB)
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600', 
                    marginBottom: '10px', 
                    color: '#ffffff',
                    fontSize: '0.9375rem'
                  }}>
                    <span style={{ 
                      fontSize: '1.25rem', 
                      display: 'inline-block',
                      filter: 'brightness(0) invert(1)',
                      lineHeight: '1'
                    }}>👤</span>
                    Nome do Cliente/Razão Social
                  </label>
                  <input
                    type="text"
                    value={companyForm.companyName}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, companyName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    placeholder="Digite seu nome ou razão social"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '6px' }}>
                    Nome ou razão social que será usado nas mensagens e documentos
                  </p>
                </div>

                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600', 
                    marginBottom: '10px', 
                    color: '#ffffff',
                    fontSize: '0.9375rem'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>📄</span>
                    CPF/CNPJ
                  </label>
                  <input
                    type="text"
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, cnpj: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '6px' }}>
                    Obrigatório para assinatura de planos e emissão de notas fiscais
                  </p>
                </div>

                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600', 
                    marginBottom: '10px', 
                    color: '#ffffff',
                    fontSize: '0.9375rem'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>📱</span>
                    Número do WhatsApp
                  </label>
                  <input
                    type="text"
                    value={companyForm.whatsappNumber}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    placeholder="+55 11 99999-9999"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '6px' }}>
                    Número que receberá as mensagens dos clientes
                  </p>
                </div>

                <div style={{ 
                  marginTop: '8px',
                  paddingTop: '24px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                <button
                  type="submit"
                  style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                      padding: '14px 32px',
                      borderRadius: '12px',
                    border: 'none',
                      fontWeight: '600',
                      fontSize: '1rem',
                    cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>✓</span>
                    Salvar Dados do Usuário
                </button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'stripe': {
        const normalizeStripeStatus = (status) => {
          const s = String(status || '').toLowerCase();
          if (s === 'active') return 'active';
          if (s === 'pending' || s === 'pending_payment') return 'pending';
          if (s === 'past_due' || s === 'overdue' || s === 'unpaid') return 'past_due';
          if (s === 'cancelled' || s === 'canceled') return 'cancelled';
          return 'other';
        };

        const filteredRecent = stripeOps.recent.filter((item) => {
          if (stripeOpsFilter === 'all') return true;
          return normalizeStripeStatus(item.status) === stripeOpsFilter;
        });
        const pastDueItems = stripeOps.recent.filter((item) => normalizeStripeStatus(item.status) === 'past_due');

        const copyPastDueList = async () => {
          if (pastDueItems.length === 0) {
            showToast(t('toast.noPastDueClientsToCopy'), 'error');
            return;
          }

          const uniqueRows = Array.from(
            new Set(
              pastDueItems.map((item) => {
                const when = item?.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : 'sem data';
                const plan = item?.planName || 'Plano não informado';
                const uid = item?.uid || 'UID não informado';
                return `${plan} | UID: ${uid} | status: ${item.status} | atualizado: ${when}`;
              })
            )
          );

          const text = `Clientes past_due (${uniqueRows.length})\n\n${uniqueRows.join('\n')}`;

          try {
            await navigator.clipboard.writeText(text);
            showToast(t('toast.pastDueListCopied', { count: uniqueRows.length }), 'success');
          } catch (error) {
            showToast(t('toast.clipboardPermissionError'), 'error');
          }
        };

        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('stripe')}
                Stripe
              </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                Painel operacional de assinaturas, renovacoes e falhas
              </p>
            </div>

            <div style={{
              backgroundColor: '#1a1f36',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '1px solid rgba(139, 92, 246, 0.25)'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>
                Stripe - Painel Operacional
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '16px' }}>
                Monitoramento rapido de assinaturas, renovacoes e falhas
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {[
                  ['all', 'Todos'],
                  ['active', 'Ativas'],
                  ['pending', 'Pendentes'],
                  ['past_due', 'Past Due'],
                  ['cancelled', 'Canceladas']
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStripeOpsFilter(id)}
                    style={{
                      backgroundColor: stripeOpsFilter === id ? '#8b5cf6' : '#0f1419',
                      color: stripeOpsFilter === id ? '#ffffff' : '#cbd5e1',
                      border: stripeOpsFilter === id ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '9999px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={copyPastDueList}
                  style={{
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    border: '1px solid rgba(167, 139, 250, 0.9)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '0.8125rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Copiar lista de clientes past_due (WhatsApp)
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                {[
                  ['Total', stripeOps.total, '#94a3b8'],
                  ['Ativas', stripeOps.active, '#10b981'],
                  ['Pendentes', stripeOps.pending, '#f59e0b'],
                  ['Past Due', stripeOps.pastDue, '#ef4444'],
                  ['Canceladas', stripeOps.cancelled, '#64748b'],
                  ['Renovam em 7d', stripeOps.renewalsNext7Days, '#a78bfa']
                ].map(([label, value, color]) => (
                  <div key={label} style={{
                    backgroundColor: '#0f1419',
                    borderRadius: '12px',
                    padding: '14px',
                    border: `1px solid ${color}33`
                  }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>{label}</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '1.375rem', fontWeight: '700', color }}>{value}</p>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: '#0f1419', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff' }}>
                  Ultimas movimentacoes {stripeOpsFilter !== 'all' ? `(filtro: ${stripeOpsFilter})` : ''}
                </p>
                {stripeOps.loading ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>Carregando...</p>
                ) : filteredRecent.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>Nenhuma movimentacao encontrada ainda.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {filteredRecent.map((item, idx) => (
                      <div key={`${item.uid}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#e5e7eb' }}>{item.planName} - {item.status}</span>
                        <span style={{ color: '#9ca3af' }}>{new Date(item.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'catalog':
        return renderCatalog();

      case 'agendamentos':
        return renderAgendamentos();

      case 'conversas': {
        // Usar componente SIMPLES e NOVO sem complexidade
        if (!user) return null;
        
        // Definir backend URL diretamente (sem depender da constante BACKEND_URL)
        const conversasBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ia-agente-backend.up.railway.app';
        
        return (
          <ConversasSimples 
            userId={user.uid}
            backendUrl={conversasBackendUrl}
          />
        );
      }

      case 'crm':
        return (
          <CRMDashboard 
            user={user} 
            database={database} 
            showToast={showToast}
          />
        );

      case 'integrations':
        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('integrations')}
                Integrações
              </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                Configure as integrações com serviços externos
              </p>
            </div>

            <div style={{ backgroundColor: '#1a1f36', borderRadius: '20px', padding: getResponsivePadding(), boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(16, 185, 129, 0.2)', width: '100%', boxSizing: 'border-box' }}>
              <form onSubmit={handleIntegrationsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* OpenAI API */}
                <div style={{ 
                  padding: '24px', 
                  backgroundColor: 'rgba(16, 185, 129, 0.05)', 
                  borderRadius: '16px',
                  border: '2px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '8px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.75rem' }}>🤖</span>
                    OpenAI API
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: '#9ca3af', marginBottom: '20px' }}>
                    Integração com GPT para respostas inteligentes
                  </p>
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#ffffff', fontSize: '0.9375rem' }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={integrationsForm.openaiApiKey}
                      onChange={(e) => setIntegrationsForm(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid rgba(255, 255, 255, 0.1)',
                        fontSize: '1rem',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        backgroundColor: '#0f1419',
                        color: '#ffffff'
                      }}
                      placeholder="sk-..."
                      onFocus={(e) => {
                        e.target.style.borderColor = '#10b981';
                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <p style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '8px' }}>
                      💡 Obtenha sua chave em: https://platform.openai.com/api-keys
                    </p>
                  </div>
                </div>

                {/* Stripe */}
                <div style={{ 
                  padding: '24px', 
                  backgroundColor: 'rgba(124, 58, 237, 0.08)', 
                  borderRadius: '16px',
                  border: '2px solid rgba(124, 58, 237, 0.3)'
                }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '8px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.75rem' }}>💠</span>
                    Stripe (Pagamentos)
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: '#9ca3af', marginBottom: '20px' }}>
                    Gateway principal para pagamentos e assinaturas
                  </p>
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#7c3aed', fontSize: '0.9375rem' }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={integrationsForm.stripeApiKey}
                      onChange={(e) => setIntegrationsForm(prev => ({ ...prev, stripeApiKey: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid rgba(124, 58, 237, 0.3)',
                        fontSize: '1rem',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        backgroundColor: '#0f1419',
                        color: '#ffffff'
                      }}
                      placeholder="sk_live_..."
                      onFocus={(e) => {
                        e.target.style.borderColor = '#8b5cf6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.2)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(124, 58, 237, 0.3)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Nota Fiscal */}
                <div style={{ 
                  padding: '24px', 
                  backgroundColor: 'rgba(16, 185, 129, 0.05)', 
                  borderRadius: '16px',
                  border: '2px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '8px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.75rem' }}>📄</span>
                    Configuração de Nota Fiscal
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: '#9ca3af', marginBottom: '20px' }}>
                    Emissão automática de NFS-e após confirmação de pagamento
                  </p>
                  
                  {/* Toggle Emissão Automática */}
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>Emissão Automática de Nota Fiscal</h4>
                        <p style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                          Habilite para emitir NFS-e automaticamente após confirmação de pagamento
                        </p>
                      </div>
                      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={integrationsForm.fiscalEnabled}
                          onChange={(e) => setIntegrationsForm(prev => ({ ...prev, fiscalEnabled: e.target.checked }))}
                          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        />
                        <div style={{
                          width: '56px',
                          height: '28px',
                          backgroundColor: integrationsForm.fiscalEnabled ? '#2563eb' : '#d1d5db',
                          borderRadius: '14px',
                          position: 'relative',
                          transition: 'background-color 0.3s'
                        }}>
                          <div style={{
                            position: 'absolute',
                            left: integrationsForm.fiscalEnabled ? '30px' : '4px',
                            top: '4px',
                            width: '20px',
                            height: '20px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: 'left 0.3s'
                          }}></div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Inscrição Municipal */}
                    <div>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                        Inscrição Municipal
                      </label>
                      <input
                        type="text"
                        value={integrationsForm.municipalRegistration}
                        onChange={(e) => setIntegrationsForm(prev => ({ ...prev, municipalRegistration: e.target.value }))}
                        disabled={!integrationsForm.fiscalEnabled}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          fontSize: '1rem',
                          opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                        }}
                        placeholder="Digite sua inscrição municipal"
                      />
                    </div>

                    {/* Alíquotas de Impostos */}
                    <div>
                      <h4 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>Alíquotas de Impostos (%)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                            ISS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={integrationsForm.issRate}
                            onChange={(e) => setIntegrationsForm(prev => ({ ...prev, issRate: parseFloat(e.target.value) || 0 }))}
                            disabled={!integrationsForm.fiscalEnabled}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '1rem',
                              opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                            }}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                            COFINS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={integrationsForm.cofinsRate}
                            onChange={(e) => setIntegrationsForm(prev => ({ ...prev, cofinsRate: parseFloat(e.target.value) || 0 }))}
                            disabled={!integrationsForm.fiscalEnabled}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '1rem',
                              opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                            }}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                            CSLL (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={integrationsForm.csllRate}
                            onChange={(e) => setIntegrationsForm(prev => ({ ...prev, csllRate: parseFloat(e.target.value) || 0 }))}
                            disabled={!integrationsForm.fiscalEnabled}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '1rem',
                              opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                            }}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                            INSS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={integrationsForm.inssRate}
                            onChange={(e) => setIntegrationsForm(prev => ({ ...prev, inssRate: parseFloat(e.target.value) || 0 }))}
                            disabled={!integrationsForm.fiscalEnabled}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '1rem',
                              opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                            }}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                            IR (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={integrationsForm.irRate}
                            onChange={(e) => setIntegrationsForm(prev => ({ ...prev, irRate: parseFloat(e.target.value) || 0 }))}
                            disabled={!integrationsForm.fiscalEnabled}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '1rem',
                              opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                            }}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                            PIS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={integrationsForm.pisRate}
                            onChange={(e) => setIntegrationsForm(prev => ({ ...prev, pisRate: parseFloat(e.target.value) || 0 }))}
                            disabled={!integrationsForm.fiscalEnabled}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '1rem',
                              opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                            }}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Reter ISS */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        id="retainIss"
                        checked={integrationsForm.retainIss}
                        onChange={(e) => setIntegrationsForm(prev => ({ ...prev, retainIss: e.target.checked }))}
                        disabled={!integrationsForm.fiscalEnabled}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: integrationsForm.fiscalEnabled ? 'pointer' : 'not-allowed'
                        }}
                      />
                      <label htmlFor="retainIss" style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                        Reter ISS (o cliente retém o ISS na fonte)
                      </label>
                    </div>

                    {/* Deduções */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                        Deduções (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={integrationsForm.deductions}
                        onChange={(e) => setIntegrationsForm(prev => ({ ...prev, deductions: parseFloat(e.target.value) || 0 }))}
                        disabled={!integrationsForm.fiscalEnabled}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          fontSize: '1rem',
                          opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                        }}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Observações */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                        Observações (opcional)
                      </label>
                      <textarea
                        value={integrationsForm.fiscalObservations}
                        onChange={(e) => setIntegrationsForm(prev => ({ ...prev, fiscalObservations: e.target.value }))}
                        disabled={!integrationsForm.fiscalEnabled}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          fontSize: '1rem',
                          resize: 'vertical',
                          opacity: integrationsForm.fiscalEnabled ? 1 : 0.6
                        }}
                        placeholder="Observações que aparecerão na nota fiscal..."
                      />
                    </div>

                    {/* Informações */}
                    <div style={{ backgroundColor: '#d1fae5', border: '1px solid #86efac', borderRadius: '12px', padding: '16px' }}>
                      <h4 style={{ fontWeight: '600', color: '#166534', marginBottom: '8px' }}>✅ Como funciona:</h4>
                      <ul style={{ fontSize: '0.875rem', color: '#166534', paddingLeft: '20px', margin: 0 }}>
                        <li>Habilite a emissão automática acima</li>
                        <li>Configure suas alíquotas de acordo com sua legislação municipal</li>
                        <li>Após o pagamento ser confirmado, a NFS-e será emitida automaticamente</li>
                        <li>O cliente receberá a nota fiscal via WhatsApp com link para PDF</li>
                        <li>Todas as notas emitidas ficarão salvas no Firebase</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Botão Salvar */}
                <div style={{ 
                  marginTop: '16px',
                  paddingTop: '32px',
                  borderTop: '2px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                <button
                  type="submit"
                  style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                      padding: '16px 40px',
                      borderRadius: '12px',
                    border: 'none',
                      fontWeight: '600',
                      fontSize: '1.0625rem',
                    cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>✓</span>
                    Salvar Todas as Integrações
                </button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'whatsapp': {
        // Garantir valores padrão para prevenir erros
        const currentWhatsappStatus = whatsappStatus || 'disconnected';
        const currentQRCode = whatsappQRCode || null;
        const currentIsConnecting = isConnecting || false;
        
        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('whatsapp')}
                Conexão WhatsApp
            </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                Conecte seu WhatsApp para ativar o assistente automático
              </p>
            </div>
            
            {/* Card de Status */}
                <div style={{
              backgroundColor: '#1a1f36', 
              borderRadius: '20px', 
              padding: '32px', 
              marginBottom: '24px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
              border: '2px solid ' + (currentWhatsappStatus === 'connected' ? '#10b981' : currentWhatsappStatus === 'qrcode' ? '#10b981' : 'rgba(255, 255, 255, 0.1)')
            }}>
              <div style={{ 
                display: 'inline-block',
                padding: '12px 24px',
                borderRadius: '12px',
                marginBottom: '24px',
                background: currentWhatsappStatus === 'connected' 
                  ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' 
                  : currentWhatsappStatus === 'qrcode' 
                  ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' 
                  : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                border: '2px solid ' + (currentWhatsappStatus === 'connected' ? '#10b981' : currentWhatsappStatus === 'qrcode' ? '#f59e0b' : '#ef4444')
              }}>
                <div style={{
                  color: currentWhatsappStatus === 'connected' ? '#065f46' : currentWhatsappStatus === 'qrcode' ? '#92400e' : '#991b1b',
                  fontWeight: '700',
                  fontSize: '1.125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ 
                    fontSize: '1.5rem',
                    animation: currentWhatsappStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none'
                  }}>
                    {currentWhatsappStatus === 'connected' ? '✅' : currentWhatsappStatus === 'qrcode' ? '⏳' : currentWhatsappStatus === 'connecting' ? '🔄' : '❌'}
                  </span>
                  {
                    currentWhatsappStatus === 'connected' ? 'WhatsApp Conectado' :
                    currentWhatsappStatus === 'qrcode' ? 'Aguardando QR Code' :
                    currentWhatsappStatus === 'connecting' ? 'Conectando...' :
                    'WhatsApp Desconectado'
                  }
                </div>
              </div>
              
              {/* QR Code Display */}
              {currentQRCode && currentWhatsappStatus === 'qrcode' && (
                <div style={{ 
                  padding: '32px', 
                  background: 'linear-gradient(135deg, #fafafa 0%, #f3f4f6 100%)', 
                  borderRadius: '16px', 
                  marginBottom: '24px', 
                  textAlign: 'center',
                  border: '2px dashed #d1d5db'
                }}>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '2rem' }}>📱</span>
                    Escaneie o QR Code
                  </h4>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginBottom: '24px'
                  }}>
                    <div style={{ 
                      padding: '24px', 
                      backgroundColor: 'white', 
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                      border: '3px solid #10b981'
                    }}>
                    <img 
                      src={currentQRCode} 
                      alt="QR Code WhatsApp" 
                      style={{ 
                          width: '300px',
                          height: '300px',
                        objectFit: 'contain',
                          imageRendering: 'pixelated'
                      }} 
                    />
                  </div>
                  </div>
                  <div style={{ 
                    textAlign: 'left', 
                    backgroundColor: 'white', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: '1.8', margin: 0 }}>
                      <strong style={{ color: '#111827' }}>📋 Passo a passo:</strong><br />
                      1️⃣ Abra o <strong>WhatsApp</strong> no celular<br />
                      2️⃣ Vá em <strong>Configurações</strong> → <strong>Aparelhos conectados</strong><br />
                      3️⃣ Toque em <strong>"Conectar aparelho"</strong><br />
                      4️⃣ Escaneie este QR Code com a câmera
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = currentQRCode;
                      link.download = 'whatsapp-qrcode.png';
                      link.click();
                    }}
                    style={{
                      backgroundColor: '#1a1f36',
                      border: '1px solid #10b981',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      fontSize: '0.9375rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>📥</span>
                    Baixar QR Code
                  </button>
                </div>
              )}
              
              {/* Success Message */}
              {currentWhatsappStatus === 'connected' && (
                <div style={{ 
                  padding: '20px', 
                  background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', 
                  borderRadius: '12px', 
                  marginBottom: '20px',
                  border: '2px solid #10b981'
                }}>
                  <p style={{ fontSize: '1rem', color: '#065f46', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>✅</span>
                    <span><strong>WhatsApp Conectado!</strong> Seu assistente está online e pronto para atender mensagens automaticamente.</span>
                  </p>
                </div>
              )}
              
              {/* Info Message */}
              {currentWhatsappStatus === 'disconnected' && (
                <div style={{ 
                  padding: '20px', 
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                  borderRadius: '12px', 
                  marginBottom: '20px',
                  border: '2px solid #f59e0b'
                }}>
                  <p style={{ fontSize: '1rem', color: '#92400e', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>💡</span>
                    <span><strong>Instrução:</strong> Clique em "Conectar" e aguarde alguns minutos até o QR code ser gerado.</span>
                  </p>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {currentWhatsappStatus === 'disconnected' ? (
                  <button
                    onClick={connectWhatsApp}
                    disabled={currentIsConnecting}
                    style={{
                      background: currentIsConnecting 
                        ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' 
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      padding: '14px 32px',
                      borderRadius: '12px',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '1rem',
                      cursor: currentIsConnecting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: currentIsConnecting ? 'none' : '0 4px 16px rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!currentIsConnecting) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!currentIsConnecting) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)';
                      }
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{currentIsConnecting ? '⏳' : '🔌'}</span>
                    {currentIsConnecting ? 'Conectando...' : 'Conectar WhatsApp'}
                  </button>
                ) : currentWhatsappStatus === 'qrcode' ? (
                  <>
                    <button
                      onClick={regenerateQRCode}
                      disabled={currentIsConnecting}
                      style={{
                        background: currentIsConnecting 
                          ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' 
                          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: 'white',
                        padding: '14px 28px',
                        borderRadius: '12px',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '1rem',
                        cursor: currentIsConnecting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: currentIsConnecting ? 'none' : '0 4px 16px rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        if (!currentIsConnecting) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!currentIsConnecting) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.3)';
                        }
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>{currentIsConnecting ? '⏳' : '🔄'}</span>
                      {currentIsConnecting ? 'Gerando...' : 'Gerar Novo QR Code'}
                    </button>
                    <button
                      onClick={disconnectWhatsApp}
                      disabled={currentIsConnecting}
                      style={{
                        background: currentIsConnecting 
                          ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' 
                          : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        padding: '14px 28px',
                        borderRadius: '12px',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '1rem',
                        cursor: currentIsConnecting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: currentIsConnecting ? 'none' : '0 4px 16px rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        if (!currentIsConnecting) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!currentIsConnecting) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.3)';
                        }
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>❌</span>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={disconnectWhatsApp}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white',
                      padding: '14px 32px',
                      borderRadius: '12px',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>🔌</span>
                    Desconectar WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'assistant': 
        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('assistant')}
                Configuração do Assistente
            </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                Configure a inteligência artificial e o fluxo de atendimento
              </p>
            </div>

            {/* Configuração de IA */}
            <div style={{ 
              backgroundColor: '#1a1f36', 
              borderRadius: '20px', 
              padding: '32px', 
              marginBottom: '24px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
              border: '1px solid rgba(16, 185, 129, 0.2)' 
            }}>
              <form id="assistant-form" onSubmit={handleAssistantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {/* Campos visíveis apenas para o Master */}
                {user.isMaster && (
                  <>
                    <div>
                      <label style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600', 
                        marginBottom: '10px', 
                        color: '#ffffff',
                        fontSize: '0.9375rem'
                      }}>
                        <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                        Provedor de IA
                      </label>
                      <select
                        value={assistantForm.aiProvider || 'openai'}
                        onChange={(e) => setAssistantForm(prev => ({ ...prev, aiProvider: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '2px solid rgba(255, 255, 255, 0.1)',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease',
                          outline: 'none',
                          backgroundColor: '#0f1419',
                          color: '#ffffff'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#10b981';
                          e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <option value="openai">OpenAI (GPT-3.5 / GPT-4)</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="google">Google (Gemini)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600', 
                        marginBottom: '10px', 
                        color: '#ffffff',
                        fontSize: '0.9375rem'
                      }}>
                        <span style={{ fontSize: '1.25rem' }}>🔑</span>
                        API Key
                      </label>
                      <input
                        type="password"
                        value={assistantForm.apiKey || ''}
                        onChange={(e) => setAssistantForm(prev => ({ ...prev, apiKey: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '2px solid rgba(255, 255, 255, 0.1)',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease',
                          outline: 'none',
                          backgroundColor: '#0f1419',
                          color: '#ffffff'
                        }}
                        placeholder="sk-..."
                        onFocus={(e) => {
                          e.target.style.borderColor = '#10b981';
                          e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔒</span>
                        Sua chave API será criptografada e armazenada com segurança
                      </p>
                    </div>
                    <div>
                      <label style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600', 
                        marginBottom: '10px', 
                        color: '#ffffff',
                        fontSize: '0.9375rem'
                      }}>
                        <span style={{ fontSize: '1.25rem' }}>🎯</span>
                        Modelo
                      </label>
                      <select
                        value={assistantForm.model || 'gpt-3.5-turbo'}
                        onChange={(e) => setAssistantForm(prev => ({ ...prev, model: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '2px solid rgba(255, 255, 255, 0.1)',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease',
                          outline: 'none',
                          backgroundColor: '#0f1419',
                          color: '#ffffff'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#10b981';
                          e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Rápido e Econômico)</option>
                        <option value="gpt-4">GPT-4 (Mais Inteligente)</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo (Equilibrado)</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Modo guiado vs Flow Builder avançado */}
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'rgba(15, 20, 25, 0.85)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: '10px', fontSize: '1.05rem' }}>
                    Como deseja configurar o fluxo?
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '16px', lineHeight: 1.5 }}>
                    O <strong style={{ color: '#e5e7eb' }}>assistente guiado</strong> separa negócio, CRM e tom de voz em passos claros, com modelos prontos e resumo antes de aplicar.
                    O <strong style={{ color: '#e5e7eb' }}>modo avançado</strong> mantém o editor completo de passos (arrastar, condições, IA).
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAssistantForm((prev) => ({ ...prev, configUiMode: 'simple' }));
                        setWizardResetKey((k) => k + 1);
                      }}
                      style={{
                        padding: '12px 20px',
                        borderRadius: '12px',
                        border: assistantForm.configUiMode !== 'advanced' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                        background: assistantForm.configUiMode !== 'advanced' ? 'rgba(16, 185, 129, 0.2)' : '#0f1419',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      ✨ Assistente guiado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const steps = assistantForm.flowSteps || [];
                        const shouldSync =
                          (assistantForm.fixedApproaches?.length || 0) > 0 && steps.length > 0;
                        if (shouldSync) {
                          setAssistantForm((prev) => {
                            const nextSteps = applyFixedApproachesToSteps(
                              prev.flowSteps || [],
                              prev.fixedApproaches
                            );
                            return {
                              ...mergeFlowStepsIntoAssistantForm(prev, nextSteps),
                              configUiMode: 'advanced'
                            };
                          });
                          showToast(t('toast.fixedApproachesSynced'), 'success');
                        } else {
                          setAssistantForm((prev) => ({ ...prev, configUiMode: 'advanced' }));
                        }
                      }}
                      style={{
                        padding: '12px 20px',
                        borderRadius: '12px',
                        border: assistantForm.configUiMode === 'advanced' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                        background: assistantForm.configUiMode === 'advanced' ? 'rgba(16, 185, 129, 0.2)' : '#0f1419',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      🛠️ Modo avançado (Flow Builder)
                    </button>
                  </div>
                </div>

                {assistantForm.configUiMode !== 'advanced' ? (
                  <div style={{ marginTop: '8px' }}>
                    <AssistantSetupWizard
                      catalogItems={catalogItems}
                      flowSteps={assistantForm.flowSteps || []}
                      fixedApproaches={assistantForm.fixedApproaches || []}
                      resetKey={wizardResetKey}
                      showToast={showToast}
                      onApplyFlow={(newSteps, meta) => applyAssistantFlowSteps(newSteps, meta)}
                    />
                  </div>
                ) : (
                  <div>
                    <FlowBuilder 
                      initialSteps={assistantForm.flowSteps || []}
                      catalogItems={catalogItems}
                      agendamentos={agendamentos}
                      onSave={() => {
                        const form = document.getElementById('assistant-form');
                        if (form) {
                          const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
                          form.dispatchEvent(submitEvent);
                        }
                      }}
                      onChange={applyAssistantFlowSteps}
                      onPromptChange={(improvedPrompt) => {
                        setAssistantForm(prev => ({
                          ...prev,
                          systemPrompt: improvedPrompt
                        }));
                      }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    maxWidth: '420px',
                    padding: '16px 24px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  Salvar configurações do assistente
                </button>
              </form>
            </div>

          </div>
        );

      case 'plans':
        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('plans')}
                {t('plans.title')}
              </h2>
              <p style={{ fontSize: '1.125rem', color: '#9ca3af' }}>
                {user?.isMaster ? t('plans.masterSubtitle') : t('plans.userSubtitle')}
              </p>
            </div>

            {user?.isMaster && (
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => openPlanModal()}
                  style={{
                    backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                    color: 'white',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    fontWeight: '700',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.backgroundColor = '#0f1419';
                    e.target.style.borderColor = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.backgroundColor = '#1a1f36';
                    e.target.style.borderColor = '#10b981';
                  }}
                >
                  <Plus size={20} />
                  {t('plans.createNew')}
                </button>
              </div>
            )}

            {plans.length === 0 ? (
              user?.isMaster ? (
                <div style={{ backgroundColor: '#1a1f36', borderRadius: '16px', padding: '48px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>💎</div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                    {t('plans.emptyMasterTitle')}
                  </h3>
                  <p style={{ fontSize: '1rem', color: '#9ca3af', marginBottom: '24px' }}>
                    {t('plans.emptyMasterBody')}
                  </p>
                  <button
                    onClick={() => openPlanModal()}
                    style={{
                      backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#059669';
                      e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#10b981';
                      e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                  >
                    {t('plans.createFirst')}
                  </button>
                </div>
              ) : (
                <div style={{ backgroundColor: '#1a1f36', borderRadius: '16px', padding: '48px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                    {t('plans.emptyUserTitle')}
                  </h3>
                  <p style={{ fontSize: '1rem', color: '#9ca3af', marginBottom: '24px' }}>
                    {t('plans.emptyUserBody')}
                  </p>
                </div>
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {(user?.isMaster ? plans : plans.filter(p => p.active)).map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      backgroundColor: '#1a1f36',
                      borderRadius: '20px',
                      padding: '32px',
                      border: plan.active ? '2px solid #10b981' : '2px solid #4b5563',
                      boxShadow: plan.active ? '0 8px 24px rgba(16, 185, 129, 0.2)' : '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.3)';
                      e.currentTarget.style.borderColor = '#10b981';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = plan.active ? '0 8px 24px rgba(16, 185, 129, 0.2)' : '0 4px 12px rgba(0,0,0,0.2)';
                      e.currentTarget.style.borderColor = plan.active ? '#10b981' : '#4b5563';
                    }}
                  >
                    {/* Nome do Plano com Badges */}
                    <div style={{ marginBottom: '16px', position: 'relative', paddingRight: plan.active ? '80px' : '0' }}>
                      {/* Badge de Status */}
                      {plan.active && (
                        <div style={{ position: 'absolute', top: '0', right: '0', zIndex: 1 }}>
                          <div style={{
                            backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            whiteSpace: 'nowrap'
                          }}>
                            {t('plans.active')}
                          </div>
                        </div>
                      )}
                      
                      <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', wordBreak: 'break-word' }}>
                        {plan.name}
                      </h3>
                      <p style={{ fontSize: '0.9375rem', color: '#9ca3af', wordBreak: 'break-word' }}>
                        {plan.description || t('plans.noDescription')}
                      </p>
                    </div>

                    {/* Preço */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: plan.isTrialPlan ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: `1px solid ${plan.isTrialPlan ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        {plan.isTrialPlan ? (
                          <span style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>
                            🎁 {t('plans.free')}
                          </span>
                        ) : (
                          <>
                        <span style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981' }}>
                          {formatPlanPrice(plan)}
                        </span>
                        <span style={{ fontSize: '1rem', color: '#9ca3af' }}>
                          / {plan.billingCycle === 'yearly' ? t('plans.perYear') : t('plans.perMonth')}
                        </span>
                          </>
                        )}
                      </div>
                      {plan.isTrialPlan && (
                        <p style={{ fontSize: '0.875rem', color: '#f59e0b', marginTop: '8px', fontWeight: '600' }}>
                          {t('plans.trialFor')} {formatTrialDurationFull(plan.trialDurationHours, plan.trialDurationMinutes)}{plan.oneTimeUse ? ` • ${t('plans.oneTimeUse')}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Limites */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                        {t('plans.limitsTitle')}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {plan.limits?.messagesPerMonth !== null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d1d5db' }}>
                            <span>📨</span>
                            <span>{plan.limits.messagesPerMonth === -1 ? t('plans.unlimited') : `${plan.limits.messagesPerMonth} ${t('plans.messagesPerMonth')}`}</span>
                          </div>
                        )}
                        {plan.limits?.conversations !== null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d1d5db' }}>
                            <span>💬</span>
                            <span>{plan.limits.conversations === -1 ? t('plans.unlimitedConversations') : `${plan.limits.conversations} ${t('plans.conversations')}`}</span>
                          </div>
                        )}
                        {plan.limits?.catalogItems !== null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d1d5db' }}>
                            <span>📦</span>
                            <span>{plan.limits.catalogItems === -1 ? t('plans.unlimitedCatalog') : `${plan.limits.catalogItems} ${t('plans.catalogItems')}`}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    {user?.isMaster ? (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPlanModal(plan);
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                            color: 'white',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePlan(plan.id);
                          }}
                          style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        {(() => {
                          // Verificar se é plano de teste com uso único que já foi usado
                          const isUsedTrial = plan.isTrialPlan && plan.oneTimeUse && safeUsedTrials[plan.id];
                          const isCurrentPlan = userActivePlan?.planId === plan.id;
                          const isDisabled = isCurrentPlan || isUsedTrial;
                          
                          return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                                if (isCurrentPlan) {
                              showToast(t('toast.alreadyOnPlan'), 'error');
                                } else if (isUsedTrial) {
                                  showToast(t('toast.trialAlreadyUsed'), 'error');
                            } else {
                              subscribeToPlan(plan);
                            }
                          }}
                              disabled={isDisabled}
                          style={{
                            width: '100%',
                                backgroundColor: isDisabled ? '#6b7280' : '#10b981',
                            color: 'white',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: '700',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s ease',
                                boxShadow: isDisabled ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                                opacity: isDisabled ? 0.7 : 1
                          }}
                          onMouseEnter={(e) => {
                                if (!isDisabled) {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = isDisabled ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)';
                          }}
                        >
                              {isCurrentPlan ? `✓ ${t('plans.currentPlan')}` : isUsedTrial ? `🔒 ${t('plans.alreadyUsed')}` : t('plans.subscribe')}
                        </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'users':
        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px', gap: isMobile ? '16px' : '0' }}>
              <h2 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 'bold', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('users', isMobile ? '1.75rem' : '2.25rem')}
                {t('usersPage.title')}
              </h2>
              <button
                onClick={() => handleOpenUserModal()}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: isMobile ? '10px 16px' : '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  fontSize: isMobile ? '0.875rem' : '1rem',
                  whiteSpace: 'nowrap',
                  width: isMobile ? '100%' : 'auto'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                }}
              >
                + {t('usersPage.addUser')}
              </button>
            </div>
            
            <div style={{ backgroundColor: '#1a1f36', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              {users.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                  <p style={{ fontSize: '1.125rem', marginBottom: '8px', color: '#ffffff' }}>{t('usersPage.emptyTitle')}</p>
                  <p style={{ fontSize: '0.875rem' }}>{t('usersPage.emptyBody')}</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(16, 185, 129, 0.2)' }}>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#ffffff' }}>{t('usersPage.name')}</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#ffffff' }}>{t('usersPage.email')}</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#ffffff' }}>{t('usersPage.whatsappNumber')}</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#ffffff' }}>{t('usersPage.plan')}</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#ffffff' }}>{t('usersPage.status')}</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#ffffff' }}>{t('usersPage.registeredVia')}</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#ffffff' }}>{t('usersPage.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((userItem) => (
                        <tr key={userItem.id} style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
                          <td style={{ padding: '12px', color: '#ffffff' }}>{userItem.name || userItem.companyName || '-'}</td>
                          <td style={{ padding: '12px', color: '#9ca3af' }}>{userItem.email}</td>
                          <td style={{ padding: '12px', color: '#9ca3af' }}>{userItem.whatsappNumber || '-'}</td>
                          <td style={{ padding: '12px', color: '#ffffff', fontWeight: '500' }}>{userItem.activePlan || '-'}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              backgroundColor: userItem.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                              color: userItem.isActive ? '#10b981' : '#ef4444',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              border: `1px solid ${userItem.isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`
                            }}>
                              {userItem.isActive ? t('usersPage.active') : t('usersPage.inactive')}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              backgroundColor: userItem.registeredVia === 'landing_page' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                              color: userItem.registeredVia === 'landing_page' ? '#60a5fa' : '#a78bfa',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              border: `1px solid ${userItem.registeredVia === 'landing_page' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                            }}>
                              {userItem.registeredVia === 'landing_page' ? t('usersPage.landingPage') : t('usersPage.createdByMaster')}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleOpenUserModal(userItem)}
                                style={{
                                  backgroundColor: '#6b7280',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {t('usersPage.edit')}
                              </button>
                              <button
                                onClick={() => resetUserPassword(userItem.email)}
                                style={{
                                  backgroundColor: '#f59e0b',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {t('usersPage.resetPassword')}
                              </button>
                              <button
                                onClick={() => toggleUserPlan(userItem)}
                                style={{
                                  backgroundColor: userItem.hasActivePlan ? '#dc2626' : '#10b981',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {userItem.hasActivePlan ? t('usersPage.deactivatePlan') : t('usersPage.activatePlan')}
                              </button>
                              <button
                                onClick={() => deleteUser(userItem.id)}
                                style={{
                                  backgroundColor: '#dc2626',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {t('usersPage.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'tutorials':
        // Array com os passos do tutorial
        const tutorialSteps = [
          {
            numero: 1,
            titulo: 'Cadastro do Usuário',
            descricao: 'Configure seus dados pessoais e da empresa. Este é o primeiro passo obrigatório.',
            itens: [
              'Preencha o nome ou razão social',
              'Adicione CPF/CNPJ (obrigatório para planos pagos)',
              'Configure seu número do WhatsApp'
            ]
          },
          {
            numero: 2,
            titulo: 'Conexão WhatsApp',
            descricao: 'Conecte seu WhatsApp para ativar o assistente automático. Sem isso, o sistema não funcionará.',
            itens: [
              'Clique em "Conectar WhatsApp"',
              'Escaneie o QR Code com seu WhatsApp',
              'Aguarde a confirmação de conexão'
            ]
          },
          {
            numero: 3,
            titulo: 'Catálogo de Produtos/Serviços',
            descricao: 'Adicione seus produtos ou serviços para que o assistente possa apresentá-los aos clientes.',
            itens: [
              'Adicione produtos individualmente ou importe em lote',
              'Inclua nome, descrição, preço e imagem',
              'Organize por categorias'
            ]
          },
          {
            numero: 4,
            titulo: 'Integrações',
            descricao: 'Configure as integrações necessárias, especialmente a API da OpenAI para respostas inteligentes.',
            itens: [
              'Adicione sua chave da API OpenAI',
              'Configure integrações fiscais (se necessário)',
              'Configure outras integrações conforme sua necessidade'
            ]
          },
          {
            numero: 5,
            titulo: 'Configuração do Assistente',
            descricao: 'Configure o comportamento do assistente de IA, incluindo personalidade, fluxo de conversa e regras de negócio.',
            itens: [
              'Defina a personalidade do assistente',
              'Configure o fluxo de atendimento',
              'Adicione regras e condições específicas'
            ]
          },
          {
            numero: 6,
            titulo: 'Ativar o Assistente',
            descricao: 'Após configurar tudo, ative o assistente no Dashboard para começar a receber e responder mensagens automaticamente.',
            itens: [
              'Vá para o Dashboard',
              'Ative o toggle "Assistente Ativo"',
              'O assistente começará a responder automaticamente'
            ]
          }
        ];

        // Paginação - 1 passo por página
        const stepsPerPage = 1;
        const totalPages = tutorialSteps.length;
        const currentStep = tutorialSteps[tutorialsCurrentPage];

        return (
          <div style={{ padding: getResponsivePadding(), width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('tutorials')}
                {t('tutorialsPage.title')}
              </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                {t('tutorialsPage.subtitle')}
              </p>
            </div>

            {/* Conteúdo dos Tutorias */}
            <div style={{ 
              backgroundColor: '#1a1f36', 
              borderRadius: '20px', 
              padding: getResponsivePadding(), 
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
              border: '1px solid rgba(16, 185, 129, 0.2)',
              marginBottom: '24px'
            }}>
              {/* Introdução */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.75rem' }}>👋</span>
                  {t('tutorialsPage.welcome')}
                </h3>
                <p style={{ fontSize: '1rem', color: '#d1d5db', lineHeight: '1.6', marginBottom: '16px' }}>
                  {t('tutorialsPage.welcomeBody')}
                </p>
              </div>

              {/* Ordem de Configuração */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.75rem' }}>📋</span>
                  {t('tutorialsPage.setupOrder')}
                </h3>
                
                {/* Passo Atual */}
                {currentStep && (
                  <div style={{ 
                    marginBottom: '24px', 
                    padding: '24px', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                    borderRadius: '12px',
                    border: '2px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '12px' }}>
                      <div style={{
                        minWidth: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#1a1f36',
                        border: '1px solid #10b981',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '1.25rem',
                        flexShrink: 0
                      }}>
                        {currentStep.numero}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                          {currentStep.titulo}
                        </h4>
                        <p style={{ fontSize: '1rem', color: '#d1d5db', lineHeight: '1.6', marginBottom: '16px' }}>
                          {currentStep.descricao}
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {currentStep.itens.map((item, idx) => (
                            <li key={idx} style={{ fontSize: '0.9375rem', color: '#9ca3af', marginBottom: '10px', paddingLeft: '24px', position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 0, color: '#10b981', fontSize: '1.125rem' }}>✓</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navegação de Páginas */}
                {tutorialSteps.length > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '16px',
                    marginTop: '32px',
                    padding: '16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <button
                      type="button"
                      onClick={() => setTutorialsCurrentPage(prev => Math.max(0, prev - 1))}
                      disabled={tutorialsCurrentPage === 0}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: tutorialsCurrentPage === 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
                        backgroundColor: tutorialsCurrentPage === 0 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
                        color: 'white',
                        cursor: tutorialsCurrentPage === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: tutorialsCurrentPage === 0 ? 0.5 : 1,
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                      onMouseEnter={(e) => {
                        if (tutorialsCurrentPage > 0) {
                          e.currentTarget.style.backgroundColor = '#0f1419';
                          e.currentTarget.style.borderColor = '#059669';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (tutorialsCurrentPage > 0) {
                          e.currentTarget.style.backgroundColor = '#1a1f36';
                          e.currentTarget.style.borderColor = '#10b981';
                        }
                      }}
                    >
                      <span>‹</span>
                      {t('tutorialsPage.previous')}
                    </button>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}>
                      <span>{t('tutorialsPage.page')}</span>
                      <span style={{
                        fontWeight: '600',
                        color: '#10b981'
                      }}>{tutorialsCurrentPage + 1}</span>
                      <span>{t('tutorialsPage.of')}</span>
                      <span style={{
                        fontWeight: '600',
                        color: '#10b981'
                      }}>{totalPages}</span>
                      <span style={{ color: '#9ca3af' }}>({tutorialSteps.length} {t('tutorialsPage.steps')})</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setTutorialsCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                      disabled={tutorialsCurrentPage >= totalPages - 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: tutorialsCurrentPage >= totalPages - 1 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
                        backgroundColor: tutorialsCurrentPage >= totalPages - 1 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
                        color: 'white',
                        cursor: tutorialsCurrentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: tutorialsCurrentPage >= totalPages - 1 ? 0.5 : 1,
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                      onMouseEnter={(e) => {
                        if (tutorialsCurrentPage < totalPages - 1) {
                          e.currentTarget.style.backgroundColor = '#0f1419';
                          e.currentTarget.style.borderColor = '#059669';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (tutorialsCurrentPage < totalPages - 1) {
                          e.currentTarget.style.backgroundColor = '#1a1f36';
                          e.currentTarget.style.borderColor = '#10b981';
                        }
                      }}
                    >
                      {t('tutorialsPage.next')}
                      <span>›</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dicas Importantes */}
              <div style={{ 
                padding: '24px', 
                backgroundColor: 'rgba(251, 191, 36, 0.1)', 
                borderRadius: '12px',
                border: '2px solid rgba(251, 191, 36, 0.3)'
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fbbf24', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.5rem' }}>💡</span>
                  {t('tutorialsPage.importantTips')}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ fontSize: '0.9375rem', color: '#d1d5db', marginBottom: '12px', paddingLeft: '24px', position: 'relative', lineHeight: '1.6' }}>
                    <span style={{ position: 'absolute', left: 0, fontSize: '1.25rem' }}>•</span>
                    {t('tutorialsPage.tip1')}
                  </li>
                  <li style={{ fontSize: '0.9375rem', color: '#d1d5db', marginBottom: '12px', paddingLeft: '24px', position: 'relative', lineHeight: '1.6' }}>
                    <span style={{ position: 'absolute', left: 0, fontSize: '1.25rem' }}>•</span>
                    {t('tutorialsPage.tip2')}
                  </li>
                  <li style={{ fontSize: '0.9375rem', color: '#d1d5db', marginBottom: '12px', paddingLeft: '24px', position: 'relative', lineHeight: '1.6' }}>
                    <span style={{ position: 'absolute', left: 0, fontSize: '1.25rem' }}>•</span>
                    {t('tutorialsPage.tip3')}
                  </li>
                  <li style={{ fontSize: '0.9375rem', color: '#d1d5db', marginBottom: '12px', paddingLeft: '24px', position: 'relative', lineHeight: '1.6' }}>
                    <span style={{ position: 'absolute', left: 0, fontSize: '1.25rem' }}>•</span>
                    {t('tutorialsPage.tip4')}
                  </li>
                  <li style={{ fontSize: '0.9375rem', color: '#d1d5db', marginBottom: '12px', paddingLeft: '24px', position: 'relative', lineHeight: '1.6' }}>
                    <span style={{ position: 'absolute', left: 0, fontSize: '1.25rem' }}>•</span>
                    {t('tutorialsPage.tip5')}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'email':
        return (
          <div style={{ padding: getResponsivePadding(), maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPageIcon('email')}
                Email
              </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                {t('emailPage.subtitle')}
              </p>
            </div>

            {/* Botão Criar Template */}
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => {
                  setEditingEmailTemplate(null);
                  setEmailTemplateForm({ name: '', subject: '', body: null });
                  setShowEmailTemplateModal(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                }}
              >
                <span>+</span>
                {t('emailPage.createTemplate')}
              </button>
            </div>

            {/* Lista de Templates */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}>
              {emailTemplates.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  backgroundColor: '#1a1f36',
                  borderRadius: '16px',
                  padding: '48px',
                  textAlign: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📧</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                    {t('emailPage.emptyTitle')}
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: '#9ca3af', marginBottom: '24px' }}>
                    {t('emailPage.emptyBody')}
                  </p>
                </div>
              ) : (
                emailTemplates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      backgroundColor: '#1a1f36',
                      borderRadius: '16px',
                      padding: '24px',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onClick={() => {
                      setEditingEmailTemplate(template);
                      setEmailTemplateForm({
                        name: template.name || '',
                        subject: template.subject || '',
                        body: template.body || null
                      });
                      setShowEmailTemplateModal(true);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#ffffff', margin: 0 }}>
                        {template.name || t('emailPage.unnamed')}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEmailTemplate(template.id);
                        }}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px',
                          fontSize: '1.25rem'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '12px' }}>
                      {t('emailPage.subject')}: {template.subject || t('emailPage.noSubject')}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEmailTemplate(template);
                          setShowSendEmailModal(true);
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {t('emailPage.send')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal de Criar/Editar Template */}
            {showEmailTemplateModal && (
              <EmailTemplateModal
                isOpen={showEmailTemplateModal}
                onClose={handleCloseEmailTemplateModal}
                template={editingEmailTemplate}
                formData={emailTemplateForm}
                setFormData={setEmailTemplateForm}
                database={database}
                showToast={showToast}
              />
            )}

            {/* Modal de Enviar Email */}
            {showSendEmailModal && editingEmailTemplate && (
              <SendEmailModal
                isOpen={showSendEmailModal}
                onClose={() => {
                  setShowSendEmailModal(false);
                  setEditingEmailTemplate(null);
                }}
                template={editingEmailTemplate}
                users={users}
                database={database}
                user={user}
                showToast={showToast}
              />
            )}
          </div>
        );

      default:
        return (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>
              Página {currentPage}
            </h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280' }}>Conteúdo da página {currentPage}</p>
            </div>
          </div>
        );
    }
  };

  // Cor padrão verde do site para todos os ícones
  const iconColor = '#10b981';

  // Componente do ícone do WhatsApp
  const WhatsAppIcon = ({ size = 24, opacity = 1, color = 'currentColor' }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity }}
    >
      <path 
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" 
        fill={color}
      />
    </svg>
  );

  // Ícone simples: "S" branco em círculo roxo
  const StripeIcon = ({ size = 24, opacity = 1 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity }}
    >
      <circle cx="12" cy="12" r="10" fill="#635BFF" />
      <text
        x="12"
        y="12"
        fill="#FFFFFF"
        fontSize="12"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Arial, sans-serif"
      >
        S
      </text>
    </svg>
  );

  const menuItems = useMemo(
    () => [
      { id: 'dashboard', label: t('nav.dashboard'), icon: '🏠' },
      { id: 'tutorials', label: t('nav.tutorials'), icon: '📚' },
      { id: 'company', label: t('nav.company'), icon: '👤' },
      { id: 'catalog', label: t('nav.catalog'), icon: '📦' },
      { id: 'agendamentos', label: t('nav.agendamentos'), icon: '📅' },
      { id: 'conversas', label: t('nav.conversas'), icon: 'whatsapp' },
      { id: 'crm', label: t('nav.crm'), icon: 'target' },
      { id: 'integrations', label: t('nav.integrations'), icon: '⚙️' },
      { id: 'whatsapp', label: t('nav.whatsapp'), icon: '📱' },
      { id: 'assistant', label: t('nav.assistant'), icon: '🤖' },
      { id: 'plans', label: t('nav.plans'), icon: '💎' },
      ...(user?.isMaster
        ? [
            { id: 'stripe', label: t('nav.stripe'), icon: 'stripe' },
            { id: 'users', label: t('nav.users'), icon: '👤' },
            { id: 'email', label: t('nav.email'), icon: '📧' }
          ]
        : [])
    ],
    [t, user?.isMaster]
  );

  // Função helper para renderizar ícones de página (mesma lógica do sidebar)
  const renderPageIcon = (pageId, customSize = null) => {
    const coloredIcons = ['dashboard', 'catalog', 'agendamentos', 'conversas', 'whatsapp', 'assistant', 'plans', 'tutorials', 'email', 'stripe'];
    const shouldBeColored = coloredIcons.includes(pageId);
    const menuItem = menuItems.find(item => item.id === pageId);
    
    if (!menuItem) return null;
    
    // Tamanho padrão: 2.5rem no desktop, 2rem no mobile (ou tamanho customizado)
    const defaultSize = isMobile ? '2rem' : '2.5rem';
    const iconSize = customSize || defaultSize;
    
    // Converter rem para pixels para o WhatsAppIcon (1rem ≈ 16px)
    const remToPx = (rem) => {
      const remValue = parseFloat(rem);
      return Math.round(remValue * 16);
    };
    
    if (menuItem.icon === 'whatsapp') {
      const iconPxSize = remToPx(iconSize);
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: iconSize, height: iconSize }}>
          <WhatsAppIcon 
            size={iconPxSize} 
            color="#25D366"
            style={{ display: 'block' }}
          />
        </span>
      );
    }
    
    if (menuItem.icon === 'target') {
      const iconPxSize = remToPx(iconSize);
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: iconSize, height: iconSize }}>
          <Target 
            size={iconPxSize} 
            color="#FF9800"
            style={{ display: 'block' }}
          />
        </span>
      );
    }

    if (menuItem.icon === 'stripe') {
      const iconPxSize = remToPx(iconSize);
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: iconSize, height: iconSize }}>
          <StripeIcon size={iconPxSize} />
        </span>
      );
    }
    
    if (shouldBeColored) {
      return (
        <span style={{ fontSize: iconSize, display: 'inline-block', lineHeight: '1' }}>
          {menuItem.icon}
        </span>
      );
    } else {
      return (
        <span style={{ 
          fontSize: iconSize, 
          display: 'inline-block',
          lineHeight: '1',
          filter: 'brightness(0) invert(1)',
          textShadow: '-1px -1px 0 rgba(0, 0, 0, 0.3), 1px -1px 0 rgba(0, 0, 0, 0.3), -1px 1px 0 rgba(0, 0, 0, 0.3), 1px 1px 0 rgba(0, 0, 0, 0.3), 0 0 2px rgba(0, 0, 0, 0.2)'
        }}>
          {menuItem.icon}
        </span>
      );
    }
  };

  return (
        <>
          {/* Estilos CSS para Mobile */}
          <style jsx global>{`
            * {
              box-sizing: border-box;
            }
            
            body {
              overflow-x: hidden;
              max-width: 100vw;
            }
            
            /* Estilos responsivos para mobile */
            @media (max-width: 768px) {
              .main-content {
                margin-left: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                padding-top: 0 !important;
                overflow-x: hidden !important;
                max-width: 100vw !important;
                width: 100% !important;
              }
              
              /* Reduzir padding geral */
              [style*="padding: 40px"] {
                padding: 16px !important;
              }
              
              [style*="padding: '40px'"] {
                padding: 16px !important;
              }
              
              /* Reduzir tamanhos de fonte */
              h1, h2, h3 {
                font-size: 1.5rem !important;
              }
              
              /* Garantir que inputs e botões não ultrapassem */
              input, textarea, select, button {
                max-width: 100% !important;
                box-sizing: border-box !important;
              }
              
              /* Tabelas responsivas */
              table {
                display: block !important;
                overflow-x: auto !important;
                white-space: nowrap !important;
                width: 100% !important;
              }
              
              /* Cards e containers */
              [style*="maxWidth"] {
                max-width: 100% !important;
                padding-left: 16px !important;
                padding-right: 16px !important;
              }
              
              /* Grids responsivos */
              [style*="gridTemplateColumns"] {
                grid-template-columns: 1fr !important;
              }
              
              /* Reduzir ícones */
              [style*="fontSize: '2rem'"],
              [style*="fontSize: '1.5rem'"] {
                font-size: 1.25rem !important;
              }
              
              /* Botões com texto longo */
              button {
                white-space: normal !important;
                word-wrap: break-word !important;
                padding: 10px 12px !important;
                font-size: 0.875rem !important;
              }
              
              /* Calendário responsivo */
              [style*="gridTemplateColumns: 'repeat(7"] {
                grid-template-columns: repeat(7, minmax(40px, 1fr)) !important;
                font-size: 0.75rem !important;
              }
            }
          `}</style>
          
        <div style={{ minHeight: '100vh', backgroundColor: '#0f1419', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', overflowX: 'hidden', maxWidth: '100vw', display: 'flex' }}>

            {/* Overlay para mobile quando sidebar está aberto */}
            {isMobile && isMobileMenuOpen && (
              <div
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 999,
                  transition: 'opacity 0.3s ease'
                }}
              />
            )}

            {/* Sidebar Lateral Esquerdo */}
            <div 
              style={{ 
                position: 'fixed',
                top: 0,
                left: isMobile ? (isMobileMenuOpen ? '0' : '-280px') : '0',
                width: '280px',
                height: '100vh',
                backgroundColor: '#1a1f36', 
                color: 'white', 
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '4px 0 12px rgba(0,0,0,0.4)',
                borderRight: '2px solid rgba(16, 185, 129, 0.2)',
                zIndex: 1000,
                transition: 'left 0.3s ease',
                overflowY: 'auto',
                overflowX: 'hidden'
              }}
            >
              {/* Header do Sidebar - Logo e Badge Master */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                padding: '24px 16px',
                borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
                flexShrink: 0,
                position: 'relative'
              }}>
                {isMobile && (
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      fontSize: '24px',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.color = '#10b981';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.color = '#9ca3af';
                    }}
                  >
                    ✕
                  </button>
                )}
                <img 
                  src="/logo.png" 
                  alt="dadosIA Logo" 
                  style={{ 
                    width: isMobile ? '120px' : '160px',
                    height: isMobile ? '120px' : '160px',
                    objectFit: 'contain'
                  }} 
                />
                {user?.isMaster && (
                  <div style={{ 
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: '#78350f', 
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: '700',
                    boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.5px',
                    width: 'fit-content',
                    marginTop: '4px'
                  }}>
                    👑 {t('common.master')}
                  </div>
                )}
              </div>

              {/* Navegação Vertical */}
              <nav style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '4px', 
                flex: 1,
                padding: '16px 12px',
                overflowY: 'auto',
                overflowX: 'hidden'
              }}>
                {menuItems.map((item) => {
                  // Verificar se a funcionalidade está disponível para o usuário
                  const isAlwaysAvailable = item.id === 'plans' || item.id === 'users';
                  const isMasterOnly = item.id === 'users';
                  const isBasicAccess = item.id === 'company';
                  
                  let userHasAccess = false;
                  if (user?.isMaster) {
                    userHasAccess = true;
                  } else if (isAlwaysAvailable || isBasicAccess) {
                    userHasAccess = true;
                  } else if (userActivePlan?.allowedFeatures && Array.isArray(userActivePlan.allowedFeatures)) {
                    userHasAccess = userActivePlan.allowedFeatures.includes(item.id);
                  }
                  
                  const isLocked = !userHasAccess && !isMasterOnly;

                  // Ícones que devem manter suas cores originais
                  const coloredIcons = ['dashboard', 'catalog', 'agendamentos', 'conversas', 'whatsapp', 'assistant', 'plans', 'tutorials', 'stripe'];
                  const shouldBeColored = coloredIcons.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isLocked) {
                          showToast(t('toast.featureLocked'), 'error');
                          setCurrentPage('plans');
                        } else {
                          setCurrentPage(item.id);
                          if (isMobile) {
                            setIsMobileMenuOpen(false);
                          }
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isLocked ? 'rgba(107, 114, 128, 0.1)' : 'transparent',
                        color: isLocked 
                          ? '#6b7280' 
                          : (currentPage === item.id ? '#ffffff' : '#d1d5db'),
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '14px',
                        fontWeight: currentPage === item.id ? '600' : '500',
                        transition: 'all 0.2s ease',
                        opacity: isLocked ? 0.5 : 1,
                        width: '100%',
                        boxShadow: 'none',
                        position: 'relative',
                        minHeight: '44px'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== item.id && !isLocked) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== item.id && !isLocked) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        minWidth: '28px',
                        maxWidth: '28px',
                        height: '28px',
                        minHeight: '28px',
                        flexShrink: 0,
                        flexGrow: 0,
                        position: 'relative',
                        zIndex: 2,
                        visibility: 'visible',
                        opacity: 1
                      }}>
                        {item.icon === 'whatsapp' ? (
                          <WhatsAppIcon 
                            size={24} 
                            color={isLocked ? '#6b7280' : '#25D366'}
                            style={{ 
                              opacity: isLocked ? 0.4 : 1,
                              display: 'block',
                              visibility: 'visible'
                            }}
                          />
                        ) : item.icon === 'target' ? (
                          <Target 
                            size={24} 
                            color={isLocked ? '#6b7280' : '#FF9800'}
                            style={{ 
                              opacity: isLocked ? 0.4 : (currentPage === item.id ? 1 : 0.9),
                              display: 'block',
                              visibility: 'visible'
                            }}
                          />
                        ) : item.icon === 'stripe' ? (
                          <StripeIcon
                            size={29}
                            opacity={isLocked ? 0.4 : 1}
                          />
                        ) : (
                          <span style={{ 
                            fontSize: '24px',
                            lineHeight: '24px',
                            height: '24px',
                            width: '24px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            filter: isLocked 
                              ? (shouldBeColored ? 'opacity(0.4)' : 'brightness(0) invert(1) opacity(0.4)')
                              : (shouldBeColored ? 'none' : 'brightness(0) invert(1)'),
                            opacity: isLocked ? 0.4 : 1,
                            transition: 'all 0.2s ease',
                            visibility: 'visible',
                            textShadow: shouldBeColored 
                              ? 'none'
                              : (currentPage === item.id 
                                ? '-1px -1px 0 rgba(0, 0, 0, 0.3), 1px -1px 0 rgba(0, 0, 0, 0.3), -1px 1px 0 rgba(0, 0, 0, 0.3), 1px 1px 0 rgba(0, 0, 0, 0.3), 0 0 2px rgba(0, 0, 0, 0.2)' 
                                : '-1px -1px 0 rgba(0, 0, 0, 0.2), 1px -1px 0 rgba(0, 0, 0, 0.2), -1px 1px 0 rgba(0, 0, 0, 0.2), 1px 1px 0 rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.15)')
                          }}>
                            {item.icon}
                          </span>
                        )}
                      </span>
                      <span style={{ 
                        flex: 1,
                        fontSize: '14px',
                        letterSpacing: '0.2px'
                      }}>
                        {item.label}
                      </span>
                      {isLocked && (
                        <span style={{ 
                          fontSize: '14px', 
                          opacity: 0.6
                        }}>
                          🔒
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Footer do Sidebar - Perfil do Usuário e Logout */}
              <div style={{ 
                padding: '16px',
                borderTop: '1px solid rgba(16, 185, 129, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                flexShrink: 0
              }}>
                <div style={{ padding: '0 12px 4px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      marginBottom: '6px',
                      fontWeight: 600
                    }}
                  >
                    {t('common.language')}
                  </label>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: '#0f1419',
                      color: '#fff',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="pt">Português (PT)</option>
                    <option value="it">Italiano (IT)</option>
                    <option value="es">Español (ES)</option>
                    <option value="en">English (EN)</option>
                  </select>
                </div>

                {/* Perfil do Usuário */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px'
                }}>
                  {/* Foto do Perfil */}
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                    overflow: 'hidden',
                      flexShrink: 0,
                      border: '2px solid rgba(16, 185, 129, 0.3)',
                      backgroundColor: '#1a1f36',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {finalCompanyPhotoPreview ? (
                      <img
                        src={finalCompanyPhotoPreview}
                        alt="Foto do perfil"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          fontSize: '1.5rem',
                          fontWeight: '700'
                        }}
                      >
                        {(companyProfile?.companyName || user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                      </div>
                  )}
                </div>

                  {/* Nome e Email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: '600',
                        color: '#ffffff',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {companyProfile?.companyName || user?.displayName || t('common.user')}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: '#9ca3af',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {user?.email || ''}
                    </div>
                  </div>
                </div>

                {/* Botão Sair */}
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
                    width: '100%',
                    letterSpacing: '0.3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(239, 68, 68, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.3)';
                  }}
                >
                  <span>🚪</span>
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            </div>

            {/* Botão para abrir menu em mobile (quando fechado) */}
            {isMobile && !isMobileMenuOpen && (
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                style={{
                  position: 'fixed',
                  top: '16px',
                  left: '16px',
                  backgroundColor: '#1a1f36',
                  border: '2px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#10b981',
                  cursor: 'pointer',
                  fontSize: '20px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                  zIndex: 999,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#10b981';
                  e.target.style.color = 'white';
                  e.target.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#1a1f36';
                  e.target.style.color = '#10b981';
                  e.target.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                }}
              >
                ☰
              </button>
            )}

            {/* Main Content - Responsivo */}
            <div 
              className="main-content"
              style={{ 
                marginLeft: isMobile ? '0' : '280px',
                paddingTop: '0',
                minHeight: '100vh',
                backgroundColor: '#0f1419',
                overflowY: 'auto',
                overflowX: 'hidden',
                width: isMobile ? '100%' : 'calc(100% - 280px)',
                transition: 'margin-left 0.3s ease, width 0.3s ease',
                flex: 1
              }}
            >
          {renderContent()}
      </div>

      {/* Botão flutuante de Suporte via WhatsApp */}
      <a
        href="https://wa.me/5561991442727?text=Ol%C3%A1%2C%20vim%20pela%20ferramenta%20DadosIA."
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: isMobile ? '16px' : '24px',
          right: isMobile ? '16px' : '24px',
          width: isMobile ? '52px' : '60px',
          height: isMobile ? '52px' : '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isMobile ? '22px' : '26px',
          fontWeight: 'bold',
          textDecoration: 'none',
          boxShadow: '0 12px 24px rgba(16, 185, 129, 0.35)',
          zIndex: 1100,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!isMobile) {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 16px 32px rgba(16, 185, 129, 0.45)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMobile) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(16, 185, 129, 0.35)';
          }
        }}
        title="Suporte DadosIA"
      >
        <WhatsAppIcon size={isMobile ? 22 : 26} color="#ffffff" />
      </a>

      {/* Modal do Catálogo */}
      {showCatalogModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '1500px',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px', color: '#ffffff' }}>
              {editingItem ? t('catalogModal.editTitle') : t('catalogModal.createTitle')}
            </h3>
            
            <form onSubmit={handleCatalogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                  {t('catalogModal.itemName')}
                </label>
                <input
                  type="text"
                  value={catalogForm.name}
                  onChange={(e) => setCatalogForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    fontSize: '1rem',
                    backgroundColor: '#111827',
                    color: '#ffffff'
                  }}
                  placeholder={t('catalogModal.itemNamePlaceholder')}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                  {t('catalogModal.description')}
                </label>
                <textarea
                  value={catalogForm.description}
                  onChange={(e) => setCatalogForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    fontSize: '1rem',
                    minHeight: '80px',
                    resize: 'vertical',
                    backgroundColor: '#111827',
                    color: '#ffffff'
                  }}
                  placeholder={t('catalogModal.descriptionPlaceholder')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                  {t('catalogModal.itemType')}
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="type"
                      value="product"
                      checked={catalogForm.type === 'product'}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, type: e.target.value }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>{t('catalogModal.product')}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="type"
                      value="service"
                      checked={catalogForm.type === 'service'}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, type: e.target.value }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>{t('catalogModal.service')}</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                  {t('catalogModal.price')} <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: 'normal' }}>({t('catalogModal.optional')})</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={catalogForm.price}
                  onChange={(e) => setCatalogForm(prev => ({ ...prev, price: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    fontSize: '1rem',
                    backgroundColor: '#111827',
                    color: '#ffffff'
                  }}
                  placeholder={t('catalogModal.pricePlaceholder')}
                />
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                  {t('catalogModal.priceHint')}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                  {catalogForm.type === 'product' ? t('catalogModal.stockQuantity') : t('catalogModal.capacityHours')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={catalogForm.stockQuantity}
                  onChange={(e) => setCatalogForm(prev => ({ ...prev, stockQuantity: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    fontSize: '1rem',
                    backgroundColor: '#111827',
                    color: '#ffffff'
                  }}
                  placeholder={catalogForm.type === 'product' ? 'Ex: 50' : 'Ex: 40'}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                    {t('catalogModal.sku')}
                  </label>
                  <input
                    type="text"
                    value={catalogForm.sku || ''}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, sku: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      fontSize: '1rem',
                      fontFamily: 'monospace',
                      backgroundColor: '#111827',
                      color: '#ffffff'
                    }}
                    placeholder="Ex: PROD-001"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                    {t('catalogModal.category')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={catalogForm.category || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '__new__') {
                          // Usuário quer criar nova categoria
                          const newCategory = prompt(t('catalogModal.categoryPrompt'));
                          if (newCategory && newCategory.trim()) {
                            setCatalogForm(prev => ({ ...prev, category: newCategory.trim() }));
                          } else {
                            setCatalogForm(prev => ({ ...prev, category: '' }));
                          }
                        } else {
                          setCatalogForm(prev => ({ ...prev, category: value }));
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #374151',
                        fontSize: '1rem',
                        backgroundColor: '#111827',
                        color: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">{t('catalogModal.categorySelect')}</option>
                      {savedCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__" style={{ color: '#10b981', fontWeight: 'bold' }}>
                        + {t('catalogModal.createCategory')}
                      </option>
                    </select>
                    {catalogForm.category && !savedCategories.includes(catalogForm.category) && (
                  <input
                    type="text"
                        value={catalogForm.category}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, category: e.target.value }))}
                    style={{
                          flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                          border: '1px solid #10b981',
                      fontSize: '1rem',
                      backgroundColor: '#111827',
                      color: '#ffffff'
                    }}
                        placeholder={t('catalogModal.categoryPlaceholder')}
                      />
                    )}
                  </div>
                  {savedCategories.length > 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
                      {savedCategories.length} categoria{savedCategories.length !== 1 ? 's' : ''} disponível{savedCategories.length !== 1 ? 'is' : ''}
                    </p>
                  )}
                </div>
              </div>

              {catalogForm.type === 'product' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                    {t('catalogModal.minStock')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={catalogForm.minStock || 5}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, minStock: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      fontSize: '1rem',
                      backgroundColor: '#111827',
                      color: '#ffffff'
                    }}
                    placeholder="5"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                  {t('catalogModal.productImage')}
                </label>
                
                {/* Upload de arquivo */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    display: 'inline-block',
                    padding: '10px 16px',
                    backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    border: '1px solid #059669'
                  }}>
                    📁 {t('catalogModal.chooseFile')}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          // Verificar tamanho (max 2MB)
                          if (file.size > 2 * 1024 * 1024) {
                            alert(`❌ ${t('catalogModal.imageTooLarge')}`);
                            return;
                          }
                          
                          // Converter para Base64
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCatalogForm(prev => ({ ...prev, image: reader.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                    {t('catalogModal.fileHint')}
                  </p>
                </div>

                {/* OU separador */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  margin: '12px 0',
                  gap: '8px'
                }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#374151' }}></div>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 'bold' }}>{t('catalogModal.or')}</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#374151' }}></div>
                </div>

                {/* URL da imagem */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <input
                    type="url"
                    value={catalogForm.image && catalogForm.image.startsWith('http') ? catalogForm.image : ''}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, image: e.target.value }))}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      fontSize: '1rem',
                      backgroundColor: '#111827',
                      color: '#ffffff'
                    }}
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                  {catalogForm.image && (
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      border: '2px solid #10b981',
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}>
                      <img 
                        src={catalogForm.image} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                  {t('catalogModal.imageUrlHint')}
                </p>

                {/* Botão para remover imagem */}
                {catalogForm.image && (
                  <button
                    type="button"
                    onClick={() => setCatalogForm(prev => ({ ...prev, image: '' }))}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️ {t('catalogModal.removeImage')}
                  </button>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                  🔗 {t('catalogModal.joinLink')} ({t('catalogModal.optional')})
                </label>
                <input
                  type="url"
                  value={catalogForm.link || ''}
                  onChange={(e) => setCatalogForm(prev => ({ ...prev, link: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    fontSize: '1rem',
                    backgroundColor: '#111827',
                    color: '#ffffff'
                  }}
                  placeholder="https://exemplo.com/adesao"
                />
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                  {t('catalogModal.joinLinkHint')}
                </p>
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '8px',
                border: '1px solid #10b981'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={catalogForm.featured || false}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, featured: e.target.checked }))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 'bold', color: '#ffffff' }}>⭐ {t('catalogModal.featured')}</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  style={{
                    backgroundColor: '#374151',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #4b5563',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {t('catalogModal.cancel')}
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #059669',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {editingItem ? t('catalogModal.update') : t('catalogModal.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importação/Exportação */}
      {showImportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload style={{ width: '24px', height: '24px', color: '#4f46e5' }} />
              Importar/Exportar Catálogo
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Exportar */}
              <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '12px', border: '1px solid #10b981' }}>
                <h4 style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download style={{ width: '20px', height: '20px', color: '#10b981' }} />
                  Exportar Catálogo
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '12px' }}>
                  Baixe todos os itens do catálogo em formato JSON
                </p>
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(catalogItems, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `catalogo-${new Date().toISOString().split('T')[0]}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                    showToast(t('toast.catalogExported'), 'success');
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                    color: 'white',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Download style={{ width: '16px', height: '16px' }} />
                  Baixar JSON
                </button>
              </div>

              {/* Importar */}
              <div style={{ padding: '16px', backgroundColor: '#dbeafe', borderRadius: '12px', border: '1px solid #3b82f6' }}>
                <h4 style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                  Importar Catálogo
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '12px' }}>
                  Carregue um arquivo JSON com itens do catálogo
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    try {
                      const text = await file.text();
                      const items = JSON.parse(text);
                      
                      if (!Array.isArray(items)) {
                        showToast(t('toast.invalidImportFormat'), 'error');
                        return;
                      }

                      const validItems = items.filter(item => item.name && item.price && item.type);

                      if (validItems.length === 0) {
                        showToast(t('toast.noValidImportItems'), 'error');
                        return;
                      }

                      const promises = validItems.map(item => {
                        const itemData = {
                          ...item,
                          id: item.id || Date.now() + Math.random(),
                          createdAt: item.createdAt || new Date().toISOString()
                        };
                        return set(ref(database, `${APP_ID}/users/${user.uid}/catalog_items/${itemData.id}`), itemData);
                      });

                      await Promise.all(promises);
                      alert(`✓ ${validItems.length} itens importados com sucesso!`);
                      setShowImportModal(false);
                      e.target.value = '';
                    } catch (error) {
                      console.error('Erro ao importar:', error);
                      showToast(t('toast.importFileError'), 'error');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px dashed #3b82f6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              {/* Exemplo */}
              <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '12px', border: '1px solid #d1d5db' }}>
                <h4 style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '0.875rem', color: '#1f2937' }}>
                  📋 Formato do Arquivo JSON:
                </h4>
                <pre style={{
                  fontSize: '0.75rem',
                  backgroundColor: '#1f2937',
                  color: '#10b981',
                  padding: '12px',
                  borderRadius: '8px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
{`[
  {
    "name": "Queijo Fresco",
    "description": "Queijo Leiteiro Premium",
    "price": 49.90,
    "type": "product",
    "stockQuantity": 10,
    "category": "Laticínios",
    "sku": "QF-001",
    "image": "https://exemplo.com/queijo.jpg",
    "featured": true,
    "minStock": 5
  },
  {
    "name": "Consultoria",
    "description": "Serviço de consultoria",
    "price": 500.00,
    "type": "service",
    "stockQuantity": 20,
    "category": "Serviços",
    "sku": "CONS-001",
    "image": "",
    "featured": false,
    "minStock": 0
  }
]`}
                </pre>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  border: '2px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agendamento - FORA de renderAgendamentos() para funcionar corretamente */}
      <AgendamentoModal
        isOpen={showAgendamentoModal}
        onClose={() => {
          setShowAgendamentoModal(false);
          setEditingAgendamento(null);
        }}
        editingAgendamento={editingAgendamento}
        user={user}
        database={database}
        agendamentos={agendamentos}
        showToast={showToast}
      />

      {/* Modal de Agendamentos do Dia Selecionado */}
      {selectedCalendarDate && selectedDateAgendamentos.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff' }}>
                📅 {t('dayScheduleModal.title')} - {selectedCalendarDate}
              </h3>
              <button
                onClick={() => {
                  setSelectedCalendarDate(null);
                  setSelectedDateAgendamentos([]);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#374151',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                ✕ {t('dayScheduleModal.close')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {selectedDateAgendamentos.map((agend) => {
                return (
                  <div
                    key={agend.id}
                    style={{
                      backgroundColor: '#0f1419',
                      padding: '20px',
                      borderRadius: '12px',
                      border: `1px solid ${getStatusColor(agend.status)}`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '1.5rem' }}>{getTipoIcon(agend.tipo)}</span>
                          <h4 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#ffffff' }}>
                            {agend.titulo}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              color: 'white',
                              backgroundColor: getStatusColor(agend.status),
                              padding: '2px 8px',
                              borderRadius: '12px'
                            }}
                          >
                            {getStatusLabel(agend.status)}
                          </span>
                        </div>
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '8px' }}>{agend.descricao}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            editAgendamento(agend);
                            setSelectedCalendarDate(null);
                            setSelectedDateAgendamentos([]);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}
                          title={t('dayScheduleModal.edit')}
                        >
                          ✏️ {t('dayScheduleModal.edit')}
                        </button>
                        <button
                          onClick={async () => {
                            await deleteAgendamento(agend.id);
                            setSelectedDateAgendamentos((prev) => prev.filter((a) => a.id !== agend.id));
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}
                          title={t('dayScheduleModal.delete')}
                        >
                          🗑️ {t('dayScheduleModal.delete')}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>⏰ {t('dayScheduleModal.time')}</div>
                        <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: '500' }}>
                          {agend.horario}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>👤 {t('dayScheduleModal.client')}</div>
                        <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: '500' }}>{agend.cliente}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>📞 {t('dayScheduleModal.phone')}</div>
                        <div style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: '500' }}>{agend.telefone}</div>
                      </div>
                    </div>

                    {agend.observacoes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        color: '#9ca3af'
                      }}>
                        <strong>📝 {t('dayScheduleModal.notes')}:</strong> {agend.observacoes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Plano */}
      {showPlanModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '20px',
            padding: '32px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '2px solid #8b5cf6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff' }}>
                {editingPlan ? `✏️ ${t('planModal.editTitle')}` : `💎 ${t('planModal.createTitle')}`}
              </h3>
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setEditingPlan(null);
                  setPlanForm({
                    name: '',
                    description: '',
                    price: 0,
                    currency: 'R$',
                    billingCycle: 'monthly',
                    features: [],
                    allowedFeatures: [],
                    isTrialPlan: false,
                    trialDurationHours: 0,
                    trialDurationMinutes: 30,
                    oneTimeUse: false,
                    limits: { messagesPerMonth: null, conversations: null, catalogItems: null, integrations: [] },
                    active: true
                  });
                }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  fontWeight: '600'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              await savePlan(planForm);
              setShowPlanModal(false);
              setEditingPlan(null);
              setPlanForm({
                name: '',
                description: '',
                price: 0,
                currency: 'R$',
                billingCycle: 'monthly',
                features: [],
                allowedFeatures: [],
                isTrialPlan: false,
                trialDurationHours: 0,
                trialDurationMinutes: 30,
                oneTimeUse: false,
                limits: { messagesPerMonth: null, conversations: null, catalogItems: null, integrations: [] },
                active: true
              });
            }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Nome do Plano */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  {t('planModal.name')} *
                </label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '1rem',
                    backgroundColor: '#0f1419',
                    color: '#ffffff'
                  }}
                  placeholder={t('planModal.namePlaceholder')}
                  required
                />
              </div>

              {/* Descrição */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  {t('planModal.description')}
                </label>
                <textarea
                  value={planForm.description}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '1rem',
                    backgroundColor: '#0f1419',
                    color: '#ffffff',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder={t('planModal.descriptionPlaceholder')}
                />
              </div>

              {/* Preço e Ciclo de Cobrança */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                    {t('planModal.price')} ({planForm.currency || 'R$'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planForm.price}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, price: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      fontSize: '1rem',
                      backgroundColor: '#0f1419',
                      color: '#ffffff'
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                    {t('planModal.currency')} *
                  </label>
                  <select
                    value={normalizePlanCurrency(planForm.currency)}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, currency: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      fontSize: '1rem',
                      backgroundColor: '#0f1419',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                    required
                  >
                    {PLAN_CURRENCY_OPTIONS.map((currencyOption) => (
                      <option key={currencyOption} value={currencyOption}>{currencyOption}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                    {t('planModal.billingCycle')} *
                  </label>
                  <select
                    value={planForm.billingCycle}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, billingCycle: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      fontSize: '1rem',
                      backgroundColor: '#0f1419',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="monthly">{t('planModal.monthly')}</option>
                    <option value="yearly">{t('planModal.yearly')}</option>
                  </select>
                </div>
              </div>

              {/* Limites */}
              <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <h4 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#a78bfa', marginBottom: '16px' }}>
                  {t('planModal.limitsTitle')}
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Mensagens por Mês */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px', color: '#d1d5db' }}>
                      📨 Mensagens por Mês
                    </label>
                    <input
                      type="number"
                      value={planForm.limits.messagesPerMonth === null ? '' : planForm.limits.messagesPerMonth}
                      onChange={(e) => setPlanForm(prev => ({ 
                        ...prev, 
                        limits: { 
                          ...prev.limits, 
                          messagesPerMonth: e.target.value === '' ? null : parseInt(e.target.value) 
                        } 
                      }))}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        fontSize: '0.9375rem',
                        backgroundColor: '#0f1419',
                        color: '#ffffff'
                      }}
                      placeholder="Ilimitado (deixar vazio)"
                    />
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                      Deixe vazio para ilimitado, -1 para ilimitado
                    </p>
                  </div>

                  {/* Conversas */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px', color: '#d1d5db' }}>
                      💬 Conversas Simultâneas
                    </label>
                    <input
                      type="number"
                      value={planForm.limits.conversations === null ? '' : planForm.limits.conversations}
                      onChange={(e) => setPlanForm(prev => ({ 
                        ...prev, 
                        limits: { 
                          ...prev.limits, 
                          conversations: e.target.value === '' ? null : parseInt(e.target.value) 
                        } 
                      }))}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        fontSize: '0.9375rem',
                        backgroundColor: '#0f1419',
                        color: '#ffffff'
                      }}
                      placeholder="Ilimitado (deixar vazio)"
                    />
                  </div>

                  {/* Itens no Catálogo */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px', color: '#d1d5db' }}>
                      📦 Itens no Catálogo
                    </label>
                    <input
                      type="number"
                      value={planForm.limits.catalogItems === null ? '' : planForm.limits.catalogItems}
                      onChange={(e) => setPlanForm(prev => ({ 
                        ...prev, 
                        limits: { 
                          ...prev.limits, 
                          catalogItems: e.target.value === '' ? null : parseInt(e.target.value) 
                        } 
                      }))}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        fontSize: '0.9375rem',
                        backgroundColor: '#0f1419',
                        color: '#ffffff'
                      }}
                      placeholder="Ilimitado (deixar vazio)"
                    />
                  </div>
                </div>
              </div>

              {/* Funcionalidades Permitidas */}
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <h4 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#10b981', marginBottom: '16px' }}>
                  🔓 {t('planModal.allowedFeaturesTitle')}
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '16px' }}>
                  {t('planModal.allowedFeaturesBody')}
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {[
                    { id: 'dashboard', label: 'Dashboard', icon: '🏠', iconType: 'emoji' },
                    { id: 'company', label: 'Cadastro do Usuário', icon: '👤', iconType: 'emoji' },
                    { id: 'catalog', label: 'Catálogo', icon: '📦', iconType: 'emoji' },
                    { id: 'agendamentos', label: 'Agendamentos', icon: '📅', iconType: 'emoji' },
                    { id: 'conversas', label: 'Conversas WhatsApp', icon: 'whatsapp', iconType: 'whatsapp' },
                    { id: 'crm', label: 'CRM', icon: 'target', iconType: 'target' },
                    { id: 'integrations', label: 'Integrações', icon: '⚙️', iconType: 'emoji' },
                    { id: 'whatsapp', label: 'Conexão WhatsApp', icon: '📱', iconType: 'emoji' },
                    { id: 'assistant', label: 'Configuração do Assistente', icon: '🤖', iconType: 'emoji' },
                    { id: 'tutorials', label: 'Tutoriais', icon: '📚', iconType: 'emoji' }
                  ].map((feature) => (
                    <label
                      key={feature.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        backgroundColor: (planForm.allowedFeatures || []).includes(feature.id) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        border: `2px solid ${(planForm.allowedFeatures || []).includes(feature.id) ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!(planForm.allowedFeatures || []).includes(feature.id)) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(planForm.allowedFeatures || []).includes(feature.id)) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={(planForm.allowedFeatures || []).includes(feature.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPlanForm(prev => ({
                              ...prev,
                              allowedFeatures: [...(prev.allowedFeatures || []), feature.id]
                            }));
                          } else {
                            setPlanForm(prev => ({
                              ...prev,
                              allowedFeatures: (prev.allowedFeatures || []).filter(f => f !== feature.id)
                            }));
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ 
                        fontSize: '16px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        flexShrink: 0
                      }}>
                        {feature.iconType === 'whatsapp' ? (
                          <WhatsAppIcon size={16} color="#25D366" />
                        ) : feature.iconType === 'target' ? (
                          <Target size={16} color="#FF9800" />
                        ) : (
                          feature.icon
                        )}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: '500', flex: 1 }}>
                        {feature.label}
                      </span>
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '12px', fontStyle: 'italic' }}>
                  💡 Dica: Selecione todas as funcionalidades que deseja que este plano ofereça. "Planos e Assinaturas" sempre estará disponível para todos os usuários.
                </p>
              </div>

              {/* Configurações de Plano de Teste */}
              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <h4 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#f59e0b', marginBottom: '16px' }}>
                  🎁 Plano de Teste (Trial)
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '16px' }}>
                  Configure este plano como um período de teste gratuito. Perfeito para permitir que novos usuários experimentem a plataforma antes de assinar um plano pago.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Checkbox: É plano de teste */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffffff', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={planForm.isTrialPlan}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, isTrialPlan: e.target.checked }))}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '1rem', fontWeight: '600' }}>
                      Este é um plano de teste
                    </span>
                  </label>

                  {/* Configurações que aparecem apenas se for plano de teste */}
                  {planForm.isTrialPlan && (
                    <div style={{ marginLeft: '32px', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
                      {/* Duração do teste */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px', color: '#d1d5db' }}>
                          ⏱️ Duração do Teste
                        </label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {/* Campo de Horas */}
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>
                              Horas
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="720"
                              value={planForm.trialDurationHours}
                              onChange={(e) => setPlanForm(prev => ({ 
                                ...prev, 
                                trialDurationHours: Math.max(0, parseInt(e.target.value) || 0) 
                              }))}
                              style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                fontSize: '0.9375rem',
                                backgroundColor: '#0f1419',
                                color: '#ffffff'
                              }}
                              placeholder="0"
                            />
                          </div>
                          
                          {/* Campo de Minutos */}
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>
                              Minutos
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={planForm.trialDurationMinutes}
                              onChange={(e) => {
                                const minutes = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                setPlanForm(prev => ({ 
                                  ...prev, 
                                  trialDurationMinutes: minutes 
                                }));
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                fontSize: '0.9375rem',
                                backgroundColor: '#0f1419',
                                color: '#ffffff'
                              }}
                              placeholder="30"
                            />
                          </div>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px' }}>
                          {planForm.trialDurationHours === 0 && planForm.trialDurationMinutes === 0 
                            ? '⚠️ A duração total deve ser maior que 0'
                            : planForm.trialDurationHours === 0
                            ? `Duração total: ${planForm.trialDurationMinutes} minuto${planForm.trialDurationMinutes !== 1 ? 's' : ''}`
                            : planForm.trialDurationMinutes === 0
                            ? `Duração total: ${planForm.trialDurationHours} hora${planForm.trialDurationHours !== 1 ? 's' : ''}`
                            : `Duração total: ${planForm.trialDurationHours}h ${planForm.trialDurationMinutes}min`
                          }
                        </p>
                      </div>

                      {/* Uso único */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffffff', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={planForm.oneTimeUse}
                          onChange={(e) => setPlanForm(prev => ({ ...prev, oneTimeUse: e.target.checked }))}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.9375rem', fontWeight: '600' }}>
                            Uso único por usuário
                          </span>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                            Se marcado, cada usuário só poderá usar este plano de teste uma vez. Após usar, não poderá mais ativar este plano.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
                
                {planForm.isTrialPlan && (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <p style={{ fontSize: '0.875rem', color: '#10b981', margin: 0 }}>
                      ✅ <strong>Plano de teste configurado:</strong> Este plano terá duração de{' '}
                      {planForm.trialDurationHours === 0 && planForm.trialDurationMinutes === 0 
                        ? '30 minutos (padrão)'
                        : planForm.trialDurationHours === 0
                        ? `${planForm.trialDurationMinutes} minuto${planForm.trialDurationMinutes !== 1 ? 's' : ''}`
                        : planForm.trialDurationMinutes === 0
                        ? `${planForm.trialDurationHours} hora${planForm.trialDurationHours !== 1 ? 's' : ''}`
                        : `${planForm.trialDurationHours}h ${planForm.trialDurationMinutes}min`
                      }
                      {planForm.oneTimeUse ? ' e será de uso único por usuário' : ' e poderá ser usado múltiplas vezes'}.
                    </p>
                  </div>
                )}
              </div>

              {/* Status Ativo */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffffff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={planForm.active}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, active: e.target.checked }))}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '1rem', fontWeight: '600' }}>
                    {t('planModal.activePlan')}
                  </span>
                </label>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '8px', marginLeft: '32px' }}>
                  {t('planModal.activePlanHint')}
                </p>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPlanModal(false);
                    setEditingPlan(null);
                    setPlanForm({
                      name: '',
                      description: '',
                      price: 0,
                      currency: 'R$',
                      billingCycle: 'monthly',
                      features: [],
                      allowedFeatures: [],
                      limits: { messagesPerMonth: null, conversations: null, catalogItems: null, integrations: [] },
                      isTrialPlan: false,
                      trialDurationHours: 0,
                      trialDurationMinutes: 30,
                      oneTimeUse: false,
                      active: true
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: '#374151',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#374151'}
                >
                  {t('planModal.cancel')}
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  {editingPlan ? t('planModal.saveChanges') : t('planModal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Usuário */}
      {showUserModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '20px',
            padding: '32px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '2px solid rgba(16, 185, 129, 0.3)'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '24px', color: '#ffffff' }}>
              {editingUser ? t('userModal.editTitle') : t('userModal.createTitle')}
            </h3>
            
            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Upload de Foto de Perfil */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  {t('userModal.photo')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {photoPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={photoPreview} 
                        alt="Preview" 
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #10b981'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null);
                          setUserForm(prev => ({ ...prev, photoURL: '' }));
                        }}
                        style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-5px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '2px dashed rgba(255, 255, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      color: '#9ca3af'
                    }}>
                      👤
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Validar tamanho (máximo 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            showToast(t('toast.imageMax5mb'), 'error');
                            return;
                          }
                          handlePhotoUpload(file);
                        }
                      }}
                      disabled={uploadingPhoto}
                      style={{ display: 'none' }}
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      style={{
                        display: 'inline-block',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        backgroundColor: uploadingPhoto ? 'rgba(16, 185, 129, 0.3)' : '#10b981',
                        color: 'white',
                        cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        opacity: uploadingPhoto ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!uploadingPhoto) {
                          e.target.style.backgroundColor = '#059669';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!uploadingPhoto) {
                          e.target.style.backgroundColor = '#10b981';
                        }
                      }}
                    >
                      {uploadingPhoto ? t('userModal.uploading') : photoPreview ? t('userModal.changePhoto') : t('userModal.choosePhoto')}
                    </label>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
                      {t('userModal.photoFormats')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  {t('userModal.companyName')}
                </label>
                <input
                  type="text"
                  value={userForm.companyName}
                  onChange={(e) => setUserForm(prev => ({ ...prev, companyName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder={t('userModal.companyPlaceholder')}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  CPF/CNPJ
                </label>
                <input
                  type="text"
                  value={userForm.cnpj}
                  onChange={(e) => setUserForm(prev => ({ ...prev, cnpj: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  {t('userModal.whatsappNumber')}
                </label>
                <input
                  type="text"
                  value={userForm.whatsappNumber}
                  onChange={(e) => setUserForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="+55 11 99999-9999"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                  {t('userModal.password')} {editingUser && <span style={{ color: '#9ca3af', fontWeight: '400' }}>({t('userModal.keepCurrentPassword')})</span>}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder={t('userModal.passwordPlaceholder')}
                  required={!editingUser}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setPhotoPreview(null);
                  }}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#4b5563';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#6b7280';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  {t('userModal.cancel')}
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  {editingUser ? t('userModal.update') : t('userModal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
        </>
  );
};

export default FirebaseApp;
