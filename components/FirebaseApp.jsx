'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase } from '../hooks/useFirebase';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, push, set, remove, onValue, off } from 'firebase/database';
import SimpleLanding from './SimpleLanding';
import dynamic from 'next/dynamic';
import { convertStepsToPrompt } from '../hooks/useFlowBuilder';

// Import dinâmico para evitar problemas de SSR
const FlowBuilder = dynamic(() => import('./FlowBuilder'), { ssr: false });
const AgendamentoModal = dynamic(() => import('./AgendamentoModal'), { ssr: false });
const ConversasSimples = dynamic(() => import('./ConversasSimples'), { ssr: false });
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
  ShoppingCart,
  DollarSign
} from 'lucide-react';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsappsalesagent';

const FirebaseApp = () => {
  const { app, db, auth, database, isReady, error } = useFirebase();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [toast, setToast] = useState(null);

  // Estados dos dados
  const [companyProfile, setCompanyProfile] = useState({});
  const [integrationsConfig, setIntegrationsConfig] = useState({});
  const [assistantSettings, setAssistantSettings] = useState({});
  const [catalogItems, setCatalogItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
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
  
  // CRM temporariamente desativado - será reconstruído depois
  
  // URL do backend
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  // Função para mostrar toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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

  // Verificar autenticação
  useEffect(() => {
    if (!auth || !isReady) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Verificar se é master apenas pelo email específico
        let isMaster = currentUser.email === 'brayan@master.com';
        
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
      setupFirestoreListeners();
    }
  }, [user, db, database]);

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

  // Configurar listeners do Realtime Database
  const setupFirestoreListeners = () => {
    if (!user || !database) return;

    const userId = user.uid;

    // Listener para perfil da empresa no Realtime Database
    const companyRef = ref(database, `users/data/${userId}/company_profile`);
    onValue(companyRef, (snapshot) => {
      if (snapshot.exists()) {
        setCompanyProfile(snapshot.val());
      } else {
        setCompanyProfile({});
      }
    });

    // Listener para configurações de integração no Realtime Database
    const integrationsRef = ref(database, `users/data/${userId}/integrations_config`);
    onValue(integrationsRef, (snapshot) => {
      if (snapshot.exists()) {
        setIntegrationsConfig(snapshot.val());
      } else {
        setIntegrationsConfig({});
      }
    });

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

    // Listener para itens do catálogo no Realtime Database
    const catalogRef = ref(database, `users/data/${userId}/catalog_items`);
    onValue(catalogRef, (snapshot) => {
      const items = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach((key) => {
          items.push({ id: key, ...data[key] });
        });
        // Ordenar por data de criação (mais recente primeiro)
        items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }
      setCatalogItems(items);
    });

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

    // Se for usuário master, ouvir usuários registrados no Realtime Database
    if (user.isMaster && database) {
      console.log('Configurando listener para usuários registrados no Realtime Database');
      
      const usersRef = ref(database, 'users/registered');
      
      const unsubscribe = onValue(usersRef, (snapshot) => {
        console.log('Snapshot de usuários recebido do Realtime Database');
        const usersList = [];
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log('Dados recebidos:', data);
          Object.keys(data).forEach((key) => {
            usersList.push({ id: key, ...data[key] });
          });
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
      
      // Retornar função de limpeza
      return () => {
        console.log('Limpando listener de usuários');
        off(usersRef);
      };
    } else {
      console.log('Usuário não é master ou database não disponível');
    }
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
      showToast('Perfil da empresa salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      showToast('Erro ao salvar perfil da empresa', 'error');
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
      showToast('Configurações de integração salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar integrações:', error);
      showToast('Erro ao salvar configurações', 'error');
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
      showToast('Configurações do assistente salvas com sucesso!');
    } catch (error) {
      console.error('❌ [SAVE] Erro ao salvar assistente:', error);
      showToast('Erro ao salvar configurações', 'error');
    }
  };

  const saveCatalogItem = async (itemData) => {
    if (!user || !database) return;
    
    console.log('🔄 [SYNC] Iniciando salvamento de item...');
    console.log('🔄 [SYNC] Dados recebidos:', itemData);
    
    try {
      const data = {
        ...itemData,
        price: parseFloat(itemData.price) || 0,
        stockQuantity: parseInt(itemData.stockQuantity) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // 1️⃣ Salvar em catalog_items (para exibição no dashboard)
      const catalogRef = ref(database, `users/data/${user.uid}/catalog_items`);
      const newItemRef = push(catalogRef);
      await set(newItemRef, data);
      const itemId = newItemRef.key;
      
      console.log('✅ [SYNC] Item salvo em catalog_items com ID:', itemId);
      
      // 2️⃣ SINCRONIZAR COM products/ (para o backend usar)
      console.log('🔄 [SYNC] Sincronizando com products/...');
      const productRef = ref(database, `products/${user.uid}/${itemId}`);
      const productData = {
        id: itemId,
        name: data.name,
        description: data.description || '',
        price: data.price,
        stock: data.stockQuantity,
        category: data.category || '',
        image: data.image || '',
        type: data.type || 'product',
        active: true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
      
      await set(productRef, productData);
      console.log('✅ [SYNC] Item sincronizado em products/' + user.uid + '/' + itemId);
      
      const itemType = data.type === 'service' ? 'Serviço' : 'Produto';
      showToast(`${itemType} adicionado e sincronizado com sucesso!`);
    } catch (error) {
      console.error('❌ [SYNC] Erro ao salvar item:', error);
      showToast('Erro ao salvar item: ' + error.message, 'error');
    }
  };

  const deleteCatalogItem = async (itemId) => {
    if (!user || !database) {
      showToast('Erro: Usuário não autenticado', 'error');
      return;
    }

    if (!itemId) {
      showToast('Erro: ID do item inválido', 'error');
      return;
    }

    // Confirmação antes de deletar
    if (!window.confirm('Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    console.log('🗑️ [DELETE] Excluindo item ID:', itemId);
    
    try {
      // 1️⃣ Remover de catalog_items
      const itemRef = ref(database, `users/data/${user.uid}/catalog_items/${itemId}`);
      await remove(itemRef);
      console.log('✅ [DELETE] Removido de catalog_items');
      
      // 2️⃣ Remover de products/ também
      const productRef = ref(database, `products/${user.uid}/${itemId}`);
      await remove(productRef);
      console.log('✅ [DELETE] Removido de products/' + user.uid);
      
      showToast('✅ Item excluído com sucesso!', 'success');
    } catch (error) {
      console.error('❌ [DELETE] Erro ao excluir item:', error);
      showToast('❌ Erro ao excluir item: ' + error.message, 'error');
    }
  };

  const handleLogout = () => {
    if (auth) {
      firebaseSignOut(auth);
    }
    setUser(null);
    setIsAuthenticated(false);
    showToast('Logout realizado com sucesso!', 'success');
  };

  // Funções do WhatsApp
  const connectWhatsApp = async () => {
    if (!user) {
      showToast('Usuário não autenticado', 'error');
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
        showToast('Sessão WhatsApp iniciada! Aguarde o QR Code...', 'success');
      } else {
        throw new Error(data.error || 'Erro ao criar sessão');
      }
    } catch (error) {
      console.error('Erro ao conectar WhatsApp:', error);
      showToast('Erro ao conectar WhatsApp: ' + error.message, 'error');
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
        showToast('WhatsApp desconectado com sucesso!', 'success');
        setWhatsappStatus('disconnected');
        setWhatsappQRCode(null);
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      showToast('Erro ao desconectar WhatsApp', 'error');
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
      showToast('Erro ao carregar conversas', 'error');
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
      showToast('Erro ao carregar mensagens', 'error');
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
      showToast('Mensagem enviada!', 'success');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showToast('Erro ao enviar mensagem', 'error');
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
        showToast('Novo QR Code gerado! Escaneie rapidamente.', 'success');
      } else {
        throw new Error(data.error || 'Erro ao gerar novo QR Code');
      }
    } catch (error) {
      console.error('Erro ao regenerar QR Code:', error);
      showToast('Erro ao gerar novo QR Code: ' + error.message, 'error');
    } finally {
      setIsConnecting(false);
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
      showToast('Erro: Não é possível criar usuário', 'error');
      return;
    }
    
    try {
      if (editingUser) {
        console.log('Atualizando usuário existente:', editingUser.id);
        
        // Atualizar usuário existente no Realtime Database
        const userRef = ref(database, `users/registered/${editingUser.id}`);
        
        // Manter os dados existentes e atualizar apenas os campos editados
        const updatedData = {
          ...editingUser,
          ...userData,
          updatedAt: new Date().toISOString()
        };
        
        await set(userRef, updatedData);
        console.log('Usuário atualizado no Realtime Database:', editingUser.id);
        showToast('Usuário atualizado com sucesso!');
      } else {
        console.log('Criando novo usuário:', userData.email);
        
        // Salvar o email do master atual para fazer re-login depois
        const masterEmail = user.email;
        const masterPassword = prompt('Para criar o usuário, confirme sua senha de master:');
        
        if (!masterPassword) {
          showToast('Criação cancelada - senha não fornecida', 'error');
          return;
        }
        
        // Criar novo usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        console.log('Usuário criado no Auth:', userCredential.user.uid);
        
        // Salvar dados adicionais no Realtime Database
        const userDoc = {
          name: userData.name,
          email: userData.email,
          companyName: userData.companyName,
          uid: userCredential.user.uid,
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
        
        // Fazer logout do novo usuário e re-login como master
        await firebaseSignOut(auth);
        await signInWithEmailAndPassword(auth, masterEmail, masterPassword);
        console.log('Master re-logado com sucesso');
        
        showToast('Usuário criado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      showToast('Erro ao salvar usuário: ' + error.message, 'error');
    }
  };

  const deleteUser = async (userId) => {
    if (!user?.isMaster || !database) return;
    
    try {
      console.log('Excluindo usuário:', userId);
      const userRef = ref(database, `users/registered/${userId}`);
      await remove(userRef);
      console.log('Usuário excluído do Realtime Database:', userId);
      showToast('Usuário excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      showToast('Erro ao excluir usuário: ' + error.message, 'error');
    }
  };

  const openUserModal = (userData = null) => {
    setEditingUser(userData);
    setShowUserModal(true);
  };

  const resetUserPassword = async (email) => {
    if (!user?.isMaster || !auth) return;
    
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Email de redefinição de senha enviado!');
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      showToast('Erro ao enviar email de redefinição', 'error');
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

  // Se não está autenticado, mostrar landing page
  if (!isAuthenticated) {
    return (
      <div>
        <SimpleLanding onLoginSuccess={() => setIsAuthenticated(true)} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // Renderizar dashboard com Firebase integrado
  return (
    <div>
      <DashboardWithFirebase
        user={user}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        companyProfile={companyProfile}
        integrationsConfig={integrationsConfig}
        assistantSettings={assistantSettings}
        catalogItems={catalogItems}
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
        database={database}
        showToast={showToast}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
  database,
  showToast
}) => {
  const [isActive, setIsActive] = useState(assistantSettings.isActive || true);
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
    featured: false,
    minStock: 5
  });

  // Estados do Catálogo Avançado
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all');
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogView, setCatalogView] = useState('grid');
  const [showImportModal, setShowImportModal] = useState(false);

  const [companyForm, setCompanyForm] = useState({
    companyName: '',
    cnpj: '',
    whatsappNumber: ''
  });
  const [integrationsForm, setIntegrationsForm] = useState({
    openaiApiKey: '',
    asaasApiKey: '',
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
    flowSteps: [] // Steps do flow builder
  });
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    isActive: true
  });

  // Inicializar formulários com dados existentes
  useEffect(() => {
    setCompanyForm({
      companyName: companyProfile.companyName || '',
      cnpj: companyProfile.cnpj || '',
      whatsappNumber: companyProfile.whatsappNumber || ''
    });
  }, [companyProfile]);

  useEffect(() => {
    setIntegrationsForm({
      openaiApiKey: integrationsConfig.openaiApiKey || '',
      asaasApiKey: integrationsConfig.asaasApiKey || '',
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
      flowMode: 'visual', // Sempre visual
      flowSteps: assistantSettings.flowSteps || [] // ✅ Carregar steps salvos
    });
  }, [assistantSettings]);

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
    saveUser(userForm);
    setShowUserModal(false);
    setUserForm({
      name: '',
      email: '',
      password: '',
      companyName: '',
      isActive: true
    });
  };

  const handleOpenUserModal = (userData = null) => {
    if (userData) {
      setUserForm({
        name: userData.name || '',
        email: userData.email || '',
        password: '', // Não mostrar senha existente
        companyName: userData.companyName || '',
        isActive: userData.isActive !== undefined ? userData.isActive : true
      });
    } else {
      setUserForm({
        name: '',
        email: '',
        password: '',
        companyName: '',
        isActive: true
      });
    }
    openUserModal(userData);
  };

  const handleCatalogSubmit = (e) => {
    e.preventDefault();
    saveCatalogItem(catalogForm);
    setShowCatalogModal(false);
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

  const handleAssistantSubmit = (e) => {
    e.preventDefault();
    
    // Garantir que o prompt seja gerado dos steps (modo visual sempre ativo)
    const dataToSave = { 
      ...assistantForm, 
      isActive: isActive,
      flowMode: 'visual' // Sempre modo visual
    };
    
    // Se houver steps, gerar o prompt automaticamente
    if (assistantForm.flowSteps && assistantForm.flowSteps.length > 0) {
      dataToSave.systemPrompt = convertStepsToPrompt(assistantForm.flowSteps);
    }
    
    saveAssistantSettings(dataToSave);
  };

  // ==================== FUNÇÕES DO CRM ====================
  // CRM temporariamente desativado - será reconstruído depois
  // ==================== FIM FUNÇÕES DO CRM ====================
  
  // Função para renderizar o catálogo avançado
  const renderCatalog = () => {
    // Calcular estatísticas
    const stats = {
      total: catalogItems.length,
      products: catalogItems.filter(i => i.type === 'product').length,
      services: catalogItems.filter(i => i.type === 'service').length,
      totalValue: catalogItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.stockQuantity) || 0), 0),
      lowStock: catalogItems.filter(i => i.type === 'product' && (parseInt(i.stockQuantity) || 0) < (i.minStock || 5)).length,
      featured: catalogItems.filter(i => i.featured).length
    };

    // Filtrar itens
    const filteredItems = catalogItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                           (item.description || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                           (item.sku || '').toLowerCase().includes(catalogSearch.toLowerCase());
      const matchesFilter = catalogFilter === 'all' || item.type === catalogFilter;
      const matchesCategory = catalogCategory === 'all' || item.category === catalogCategory;
      return matchesSearch && matchesFilter && matchesCategory;
    });

    // Obter categorias únicas
    const categories = [...new Set(catalogItems.map(i => i.category).filter(Boolean))];

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">Catálogo (Itens)</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Importar</span>
            </button>
            <button
              onClick={() => openCatalogModal()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Novo Item</span>
            </button>
          </div>
        </div>

        {/* Dashboard de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{stats.products}</span>
            </div>
            <p className="text-blue-100">Produtos</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{stats.services}</span>
            </div>
            <p className="text-green-100">Serviços</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{stats.lowStock}</span>
            </div>
            <p className="text-yellow-100">Estoque Baixo</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">R$ {(stats.totalValue / 1000).toFixed(1)}k</span>
            </div>
            <p className="text-purple-100">Valor Total</p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white rounded-2xl p-4 shadow-lg border">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nome, descrição ou SKU..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Filtro por Tipo */}
            <select
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Todos os Tipos</option>
              <option value="product">Produtos</option>
              <option value="service">Serviços</option>
            </select>

            {/* Filtro por Categoria */}
            <select
              value={catalogCategory}
              onChange={(e) => setCatalogCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Todas Categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Toggle de Visualização */}
            <div className="flex border border-gray-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setCatalogView('grid')}
                className={`px-4 py-3 ${catalogView === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCatalogView('list')}
                className={`px-4 py-3 ${catalogView === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Itens */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-600 mb-2">
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
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Adicionar Primeiro Item
              </button>
            )}
          </div>
        ) : catalogView === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl shadow-lg border overflow-hidden hover:shadow-xl transition-all duration-300 group">
                {/* Imagem */}
                <div className="relative h-48 bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-20 h-20 text-indigo-300" />
                    </div>
                  )}
                  {/* Badge de Destaque */}
                  {item.featured && (
                    <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Destaque</span>
                    </div>
                  )}
                  {/* Badge de Tipo */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.type === 'product' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-green-500 text-white'
                    }`}>
                      {item.type === 'product' ? 'Produto' : 'Serviço'}
                    </span>
                  </div>
                  {/* Alerta de Estoque Baixo */}
                  {item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5) && (
                    <div className="absolute bottom-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Estoque Baixo</span>
                    </div>
                  )}
                </div>

                {/* Conteúdo */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{item.name}</h3>
                    {item.sku && (
                      <span className="text-xs text-gray-500 font-mono">{item.sku}</span>
                    )}
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                  )}

                  {item.category && (
                    <div className="flex items-center space-x-1 text-xs text-gray-500 mb-3">
                      <Tag className="w-3 h-3" />
                      <span>{item.category}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600">
                        R$ {parseFloat(item.price).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Estoque</p>
                      <p className={`text-sm font-bold ${
                        item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5)
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {item.stockQuantity}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openCatalogModal(item)}
                      className="flex-1 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => deleteCatalogItem(item.id)}
                      className="bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Produto</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">SKU</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Categoria</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Preço</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Estoque</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Package className="w-6 h-6 text-indigo-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 flex items-center space-x-2">
                              <span>{item.name}</span>
                              {item.featured && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{item.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-600">{item.sku || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {item.category ? (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <Tag className="w-3 h-3" />
                            <span>{item.category}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-900">R$ {parseFloat(item.price).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${
                          item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5)
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}>
                          {item.stockQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block w-fit ${
                            item.type === 'product' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {item.type === 'product' ? 'Produto' : 'Serviço'}
                          </span>
                          {item.type === 'product' && parseInt(item.stockQuantity) < (item.minStock || 5) && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 inline-flex items-center space-x-1 w-fit">
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
                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCatalogItem(item.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
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
        )}
      </div>
    );
  };

  // Função para renderizar agendamentos (igual ao renderCatalog - tem acesso aos states!)
  const renderAgendamentos = () => {
    // ✅ Proteção segura - usar valores padrão se undefined
    const agendamentosAtual = agendamentos || [];
    const filterAtual = agendamentoFilter || 'todos';
    const typeFilterAtual = agendamentoTypeFilter || 'todos';
    
    console.log('🎨 [renderAgendamentos] INÍCIO - agendamentos:', agendamentosAtual.length);
    
    // 🆕 FUNÇÕES LOCAIS (dentro do escopo de renderAgendamentos)
    const handleOpenModal = () => {
      console.log('🔘 [MODAL] Abrindo modal...');
      setEditingAgendamento(null);
      setShowAgendamentoModal(true);
    };

    const handleEdit = (agendamento) => {
      console.log('✏️ [EDIT] Editando:', agendamento);
      setEditingAgendamento(agendamento);
      setShowAgendamentoModal(true);
    };

    const handleDelete = async (id) => {
      if (!confirm('Tem certeza que deseja excluir?')) return;
      
      if (!user || !database) {
        showToast('❌ Erro: Usuário não autenticado', 'error');
        return;
      }
      
      try {
        console.log('🗑️ [DELETE] Excluindo agendamento:', id);
        const agendamentoRef = ref(database, `users/data/${user.uid}/agendamentos/${id}`);
        await remove(agendamentoRef);
        console.log('✅ [FIREBASE] Agendamento excluído:', id);
        showToast('Agendamento excluído!', 'success');
    } catch (error) {
        console.error('❌ [FIREBASE] Erro ao excluir agendamento:', error);
        showToast('❌ Erro ao excluir agendamento', 'error');
      }
    };
    
    // Filtrar agendamentos
    const agendamentosFiltrados = agendamentosAtual.filter(agend => {
      const matchStatus = filterAtual === 'todos' || agend.status === filterAtual;
      const matchType = typeFilterAtual === 'todos' || agend.tipo === typeFilterAtual;
      return matchStatus && matchType;
    });

    // Estatísticas
    const stats = {
      total: agendamentosAtual.length,
      pendente: agendamentosAtual.filter(a => a.status === 'pendente').length,
      confirmado: agendamentosAtual.filter(a => a.status === 'confirmado').length,
      concluido: agendamentosAtual.filter(a => a.status === 'concluido').length,
      cancelado: agendamentosAtual.filter(a => a.status === 'cancelado').length,
      em_andamento: agendamentosAtual.filter(a => a.status === 'em_andamento').length,
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'pendente': return '#eab308';
        case 'confirmado': return '#3b82f6';
        case 'em_andamento': return '#8b5cf6';
        case 'concluido': return '#10b981';
        case 'cancelado': return '#ef4444';
        default: return '#6b7280';
      }
    };

    const getStatusLabel = (status) => {
      switch (status) {
        case 'pendente': return 'Pendente';
        case 'confirmado': return 'Confirmado';
        case 'em_andamento': return 'Em Andamento';
        case 'concluido': return 'Concluído';
        case 'cancelado': return 'Cancelado';
        default: return status;
      }
    };

    const getTipoIcon = (tipo) => {
      switch (tipo) {
        case 'retirada': return '📦';
        case 'servico': return '🔧';
        case 'visita': return '🏢';
        case 'entrega': return '🚚';
        case 'ligacao': return '📞';
        default: return '📅';
      }
    };
    
    return (
      <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
              📅 Agendamentos
            </h2>
            <button
              onClick={handleOpenModal}
              style={{
                backgroundColor: '#6366f1',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>+</span> Novo Agendamento
            </button>
          </div>

          {/* Estatísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937' }}>{stats.total}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Pendentes</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#eab308' }}>{stats.pendente}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Confirmados</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#3b82f6' }}>{stats.confirmado}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Em Andamento</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#8b5cf6' }}>{stats.em_andamento}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Concluídos</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#10b981' }}>{stats.concluido}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Cancelados</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.cancelado}</div>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                Status
              </label>
              <select
                value={agendamentoFilter}
                onChange={(e) => setAgendamentoFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.875rem'
                }}
              >
                <option value="todos">Todos os Status</option>
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                Tipo
              </label>
              <select
                value={agendamentoTypeFilter}
                onChange={(e) => setAgendamentoTypeFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.875rem'
                }}
              >
                <option value="todos">Todos os Tipos</option>
                <option value="retirada">📦 Retirada</option>
                <option value="servico">🔧 Serviço</option>
                <option value="visita">🏢 Visita</option>
                <option value="entrega">🚚 Entrega</option>
                <option value="ligacao">📞 Ligação</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Agendamentos */}
        {agendamentosFiltrados.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '48px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📅</div>
            <h3 style={{ fontSize: '1.25rem', color: '#1f2937', marginBottom: '8px' }}>
              Nenhum agendamento encontrado
            </h3>
            <p style={{ color: '#6b7280' }}>
              {agendamentosAtual.length === 0 
                ? 'Crie seu primeiro agendamento clicando no botão acima'
                : 'Nenhum agendamento corresponde aos filtros selecionados'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {agendamentosFiltrados.map(agend => (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEdit(agend)}
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
                      onClick={() => handleDelete(agend.id)}
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
              </div>
            ))}
          </div>
        )}
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
    
    switch (currentPage) {
      case 'dashboard':
        return (
          <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                Dashboard
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280' }}>
                Visão geral do seu sistema de vendas com IA
              </p>
            </div>

            {/* Toggle Assistente */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '16px', 
              padding: '24px', 
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                    Assistente de IA
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {isActive ? '🟢 Ativo e respondendo mensagens' : '🔴 Desativado'}
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
              <div style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '16px', 
                padding: '24px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                color: 'white',
                transition: 'transform 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.9 }}>🏢</div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1rem' }}>Configuração da Empresa</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>
                  {companyProfile.companyName ? '✓ Completa' : 'Pendente'}
                </p>
                <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                  {companyProfile.companyName || 'Configure os dados da sua empresa'}
                </p>
              </div>

              <div style={{ 
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                borderRadius: '16px', 
                padding: '24px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                color: 'white',
                transition: 'transform 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.9 }}>⚙️</div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1rem' }}>Integrações</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>
                  {integrationsConfig.openaiApiKey ? '✓ Configurado' : 'Pendente'}
                </p>
                <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                  {integrationsConfig.openaiApiKey ? 'API Key configurada' : 'Configure sua API Key'}
                </p>
              </div>

              <div style={{ 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                borderRadius: '16px', 
                padding: '24px',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
                color: 'white',
                transition: 'transform 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.9 }}>📦</div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1rem' }}>Catálogo</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>
                  {catalogItems.length} itens
                </p>
                <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                  {catalogItems.filter(i => i.type === 'product').length} produtos · {catalogItems.filter(i => i.type === 'service').length} serviços
                </p>
              </div>
            </div>

            {/* Card de Boas-Vindas */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '20px', 
              padding: '32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                🚀 Começe Agora
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                Configure seu assistente de vendas com IA em poucos passos. Complete as configurações abaixo para começar a atender seus clientes automaticamente pelo WhatsApp.
              </p>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ 
                  padding: '20px', 
                  backgroundColor: companyProfile.companyName ? '#f0fdf4' : '#fef3c7', 
                  borderRadius: '12px',
                  border: `2px solid ${companyProfile.companyName ? '#86efac' : '#fde047'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setCurrentPage('company')}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(8px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2rem' }}>{companyProfile.companyName ? '✅' : '1️⃣'}</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                        Dados da Empresa
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {companyProfile.companyName ? 'Configurado ✓' : 'Clique para configurar'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: '20px', 
                  backgroundColor: integrationsConfig.openaiApiKey ? '#f0fdf4' : '#fef3c7', 
                  borderRadius: '12px',
                  border: `2px solid ${integrationsConfig.openaiApiKey ? '#86efac' : '#fde047'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setCurrentPage('integrations')}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(8px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2rem' }}>{integrationsConfig.openaiApiKey ? '✅' : '2️⃣'}</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                        Integração com IA
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {integrationsConfig.openaiApiKey ? 'API Key configurada ✓' : 'Configure sua API Key'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: '20px', 
                  backgroundColor: assistantSettings.systemPrompt ? '#f0fdf4' : '#fef3c7', 
                  borderRadius: '12px',
                  border: `2px solid ${assistantSettings.systemPrompt ? '#86efac' : '#fde047'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setCurrentPage('assistant')}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(8px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2rem' }}>{assistantSettings.systemPrompt ? '✅' : '3️⃣'}</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                        Configuração do Assistente
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
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
          <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                Cadastro da Empresa
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280' }}>
                Configure os dados da sua empresa para personalizar o atendimento
              </p>
            </div>

            {/* Formulário */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '20px', 
              padding: '40px', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', 
              border: '1px solid #e5e7eb' 
            }}>
              <form onSubmit={handleCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600', 
                    marginBottom: '10px', 
                    color: '#111827',
                    fontSize: '0.9375rem'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>🏢</span>
                    Nome da Empresa
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
                    placeholder="Digite o nome da sua empresa"
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
                    Nome que será exibido nas mensagens automáticas
                  </p>
                </div>

                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600', 
                    marginBottom: '10px', 
                    color: '#111827',
                    fontSize: '0.9375rem'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>📄</span>
                    CNPJ
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
                    placeholder="00.000.000/0000-00"
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
                    Opcional - usado para emissão de notas fiscais
                  </p>
                </div>

                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600', 
                    marginBottom: '10px', 
                    color: '#111827',
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
                    Salvar Dados da Empresa
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

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
          <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
              🎯 CRM - Gestão de Clientes
              </h2>
            <p style={{ color: '#6b7280', marginBottom: '32px' }}>
              Sistema de gerenciamento de relacionamento com clientes
            </p>
            
                              <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '16px', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              padding: '64px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '80px', marginBottom: '24px' }}>🚧</div>
              <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
                CRM Temporariamente Desativado
                                </h3>
              <p style={{ color: '#6b7280', fontSize: '18px', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' }}>
                O módulo CRM está sendo reconstruído para melhor performance e estabilidade.<br />
                Em breve você terá acesso a:
              </p>
              
                            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '20px', 
                marginTop: '40px',
                maxWidth: '800px',
                margin: '40px auto 0'
              }}>
                <div style={{ padding: '20px', backgroundColor: '#f0f9ff', borderRadius: '12px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
                  <h4 style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Lista de Clientes</h4>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>Visualize todos os seus clientes</p>
                                </div>
                
                <div style={{ padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '12px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
                  <h4 style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Conversas</h4>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>Histórico completo de mensagens</p>
                            </div>

                <div style={{ padding: '20px', backgroundColor: '#fef3c7', borderRadius: '12px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🛒</div>
                  <h4 style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Pedidos</h4>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>Gerencie todas as vendas</p>
                                        </div>
                                    </div>
              
              <p style={{ marginTop: '40px', color: '#9ca3af', fontSize: '14px' }}>
                Enquanto isso, continue usando o Dashboard, Catálogo e WhatsApp normalmente! ✨
                        </p>
                      </div>
                                    </div>
        );

      case 'integrations':
        return (
          <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                Integrações
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280' }}>
                Configure as integrações com serviços externos
              </p>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
              <form onSubmit={handleIntegrationsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* OpenAI API */}
                <div style={{ 
                  padding: '24px', 
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
                  borderRadius: '16px',
                  border: '2px solid #86efac'
                }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '8px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.75rem' }}>🤖</span>
                    OpenAI API
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: '#047857', marginBottom: '20px' }}>
                    Integração com GPT para respostas inteligentes
                  </p>
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#065f46', fontSize: '0.9375rem' }}>
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
                        border: '2px solid #bbf7d0',
                        fontSize: '1rem',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        backgroundColor: 'white'
                      }}
                      placeholder="sk-..."
                      onFocus={(e) => {
                        e.target.style.borderColor = '#10b981';
                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#bbf7d0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <p style={{ fontSize: '0.875rem', color: '#047857', marginTop: '8px' }}>
                      💡 Obtenha sua chave em: https://platform.openai.com/api-keys
                    </p>
                  </div>
                </div>

                {/* Asaas */}
                <div style={{ 
                  padding: '24px', 
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                  borderRadius: '16px',
                  border: '2px solid #93c5fd'
                }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '8px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.75rem' }}>💳</span>
                    Asaas (Pagamentos)
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: '#1d4ed8', marginBottom: '20px' }}>
                    Gateway de pagamento e cobranças automáticas
                  </p>
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#1e40af', fontSize: '0.9375rem' }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={integrationsForm.asaasApiKey}
                      onChange={(e) => setIntegrationsForm(prev => ({ ...prev, asaasApiKey: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid #bfdbfe',
                        fontSize: '1rem',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        backgroundColor: 'white'
                      }}
                      placeholder="$aact_..."
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#bfdbfe';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px dashed #93c5fd' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#1e40af', fontSize: '0.875rem' }}>
                      📎 Webhook URL
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        value={`https://your-api.com/webhook/${user?.uid}`}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: '1px solid #bfdbfe',
                          fontSize: '0.875rem',
                          backgroundColor: 'white',
                          color: '#64748b',
                          fontFamily: 'monospace'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://your-api.com/webhook/${user?.uid}`);
                          alert('✅ URL copiada para a área de transferência!');
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          padding: '12px 20px',
                          borderRadius: '10px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                        }}
                      >
                        📋 Copiar
                      </button>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#1d4ed8', marginTop: '8px' }}>
                      💡 Configure este webhook no painel do Asaas
                    </p>
                  </div>
                </div>

                {/* Nota Fiscal */}
                <div style={{ 
                  padding: '24px', 
                  background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)', 
                  borderRadius: '16px',
                  border: '2px solid #fde047'
                }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '8px', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.75rem' }}>📄</span>
                    Configuração de Nota Fiscal
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: '#a16207', marginBottom: '20px' }}>
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
          <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2.5rem' }}>📱</span>
                Conexão WhatsApp
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280' }}>
                Conecte seu WhatsApp para ativar o assistente automático
              </p>
            </div>
            
            {/* Card de Status */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '20px', 
              padding: '32px', 
              marginBottom: '24px', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', 
              border: '2px solid ' + (currentWhatsappStatus === 'connected' ? '#10b981' : currentWhatsappStatus === 'qrcode' ? '#f59e0b' : '#e5e7eb')
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
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
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
                    <span><strong>Dica:</strong> Certifique-se de que o servidor backend está rodando antes de conectar.</span>
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
                <button
                  onClick={() => window.open('/WPPCONNECT_SETUP.md', '_blank')}
                  style={{
                    background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                    color: 'white',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(107, 114, 128, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(107, 114, 128, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 16px rgba(107, 114, 128, 0.3)';
                  }}
                >
                  📖 Ver Documentação
                </button>
              </div>
            </div>
          </div>
        );
      }

      case 'assistant': 
        return (
          <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2.5rem' }}>🤖</span>
                Configuração do Assistente
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280' }}>
                Configure a inteligência artificial e o fluxo de atendimento
              </p>
            </div>

            {/* Configuração de IA */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '20px', 
              padding: '32px', 
              marginBottom: '24px', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', 
              border: '2px solid #e5e7eb' 
            }}>
              <h3 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: '#111827', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '1.75rem' }}>🧠</span>
                Inteligência Artificial
              </h3>
              <p style={{ fontSize: '0.9375rem', color: '#6b7280', marginBottom: '24px' }}>
                Configure o modelo e comportamento da IA
              </p>
              
              <form onSubmit={handleAssistantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
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
                        color: '#111827',
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
                          border: '2px solid #e5e7eb',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease',
                          outline: 'none',
                          backgroundColor: 'white'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#8b5cf6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e5e7eb';
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
                        color: '#111827',
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
                          border: '2px solid #e5e7eb',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease',
                          outline: 'none',
                          backgroundColor: 'white'
                        }}
                        placeholder="sk-..."
                        onFocus={(e) => {
                          e.target.style.borderColor = '#8b5cf6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e5e7eb';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                        color: '#111827',
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
                          border: '2px solid #e5e7eb',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease',
                          outline: 'none',
                          backgroundColor: 'white'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#8b5cf6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e5e7eb';
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

                {/* Flow Builder Visual */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px', color: '#374151' }}>
                    🎯 Fluxo de Atendimento
                  </label>
                  <FlowBuilder 
                    initialSteps={assistantForm.flowSteps || []}
                    catalogItems={catalogItems}
                    onChange={(newSteps) => {
                      setAssistantForm(prev => ({
                        ...prev,
                        flowSteps: newSteps,
                        flowMode: 'visual',
                        // Gerar prompt automaticamente dos steps
                        systemPrompt: convertStepsToPrompt(newSteps)
                      }));
                    }}
                  />
                </div>

                {/* Configuração de Agendamentos */}
                <div style={{ 
                  backgroundColor: '#f0f9ff', 
                  border: '2px solid #3b82f6', 
                  borderRadius: '12px', 
                  padding: '24px',
                  marginTop: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={assistantForm.enableAppointments || false}
                        onChange={(e) => setAssistantForm(prev => ({ 
                          ...prev, 
                          enableAppointments: e.target.checked,
                          appointmentTypes: e.target.checked ? (prev.appointmentTypes || []) : []
                        }))}
                        style={{ width: '20px', height: '20px', marginRight: '12px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e40af' }}>
                        📅 Habilitar Sistema de Agendamentos
                      </span>
                    </label>
                  </div>
                  
                  <p style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '16px' }}>
                    Quando habilitado, o agente poderá criar agendamentos durante a conversa que aparecerão automaticamente na seção Agendamentos.
                  </p>

                  {assistantForm.enableAppointments && (
                    <div>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px', color: '#1e40af' }}>
                        Tipos de Agendamento Permitidos:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {[
                          { value: 'retirada', label: '📦 Retirada', icon: '📦' },
                          { value: 'servico', label: '🔧 Serviço', icon: '🔧' },
                          { value: 'visita', label: '🏢 Visita', icon: '🏢' },
                          { value: 'entrega', label: '🚚 Entrega', icon: '🚚' },
                          { value: 'ligacao', label: '📞 Ligação', icon: '📞' },
                          { value: 'consulta', label: '🩺 Consulta', icon: '🩺' },
                          { value: 'reuniao', label: '👥 Reunião', icon: '👥' }
                        ].map((type) => {
                          const isSelected = assistantForm.appointmentTypes?.includes(type.value);
                          return (
                            <label
                              key={type.value}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px',
                                backgroundColor: isSelected ? '#dbeafe' : 'white',
                                border: `2px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentTypes = assistantForm.appointmentTypes || [];
                                  const newTypes = e.target.checked
                                    ? [...currentTypes, type.value]
                                    : currentTypes.filter(t => t !== type.value);
                                  setAssistantForm(prev => ({ ...prev, appointmentTypes: newTypes }));
                                }}
                                style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.9rem', color: isSelected ? '#1e40af' : '#374151', fontWeight: isSelected ? 'bold' : 'normal' }}>
                                {type.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ 
                        marginTop: '16px', 
                        padding: '12px', 
                        backgroundColor: '#fef3c7', 
                        borderRadius: '8px', 
                        border: '1px solid #fbbf24' 
                      }}>
                        <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                          💡 <strong>Como funciona:</strong> Quando o agente criar um agendamento durante a conversa (com data, horário e tipo selecionado), 
                          ele será salvo automaticamente na seção Agendamentos para você gerenciar.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Editor de Prompt Final (Opcional) */}
                {assistantForm.flowSteps && assistantForm.flowSteps.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', color: '#374151' }}>
                        📝 Prompt Final Gerado (Edição Opcional)
                      </label>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Gerado automaticamente dos steps acima
                      </span>
                    </div>
                    <div style={{ 
                      background: '#fffbeb', 
                      border: '1px solid #fbbf24', 
                      borderRadius: '8px', 
                      padding: '12px',
                      marginBottom: '12px'
                    }}>
                      <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                        💡 <strong>Dica:</strong> Este prompt é gerado automaticamente com base nos steps que você configurou. 
                        Você pode editá-lo manualmente se precisar fazer ajustes finos ou adicionar instruções específicas.
                      </p>
                    </div>
                    <textarea
                      value={assistantForm.systemPrompt || ''}
                      onChange={(e) => setAssistantForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.875rem',
                        minHeight: '300px',
                        fontFamily: 'monospace',
                        resize: 'vertical',
                        background: '#f9fafb'
                      }}
                      placeholder="O prompt será gerado automaticamente quando você adicionar steps..."
                    />
                  </div>
                )}

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
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      color: 'white',
                      padding: '16px 40px',
                      borderRadius: '12px',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '1.0625rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>💾</span>
                    Salvar Configurações do Assistente
                  </button>
                </div>
              </form>
            </div>

            {/* Estatísticas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4f46e5' }}>0</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>Conversas Ativas</div>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>0</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>Mensagens Hoje</div>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>-</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>Tempo Médio</div>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>-</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>Taxa de Satisfação</div>
              </div>
            </div>
          </div>
        );

      case 'users':
        return (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
                Gerenciar Usuários
              </h2>
              <button
                onClick={() => handleOpenUserModal()}
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
                + Adicionar Usuário
              </button>
            </div>
            
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              {users.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                  <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>Nenhum usuário cadastrado</p>
                  <p style={{ fontSize: '0.875rem' }}>Adicione usuários clicando no botão acima</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold', color: '#374151' }}>Nome</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold', color: '#374151' }}>Email</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold', color: '#374151' }}>Empresa</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold', color: '#374151' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold', color: '#374151' }}>Registrado via</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold', color: '#374151' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((userItem) => (
                        <tr key={userItem.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px' }}>{userItem.name}</td>
                          <td style={{ padding: '12px' }}>{userItem.email}</td>
                          <td style={{ padding: '12px' }}>{userItem.companyName || '-'}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              backgroundColor: userItem.isActive ? '#dcfce7' : '#fee2e2',
                              color: userItem.isActive ? '#166534' : '#dc2626',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {userItem.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              backgroundColor: userItem.registeredVia === 'landing_page' ? '#dbeafe' : '#f3e8ff',
                              color: userItem.registeredVia === 'landing_page' ? '#1e40af' : '#7c3aed',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {userItem.registeredVia === 'landing_page' ? 'Landing Page' : 'Criado pelo Master'}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
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
                                Editar
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
                                Reset Senha
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
                                Excluir
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

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'company', label: 'Cadastro da Empresa', icon: '🏢' },
    { id: 'catalog', label: 'Catálogo (Itens)', icon: '📦' },
    { id: 'agendamentos', label: 'Agendamentos', icon: '📅' },
    { id: 'conversas', label: 'Conversas WhatsApp', icon: '💬' },
    { id: 'crm', label: 'CRM', icon: '👥' },
    { id: 'integrations', label: 'Integrações', icon: '⚙️' },
    { id: 'whatsapp', label: 'Conexão WhatsApp', icon: '📱' },
    { id: 'assistant', label: 'Configuração do Assistente', icon: '🤖' },
    ...(user?.isMaster ? [{ id: 'users', label: 'Gerenciar Usuários', icon: '👤' }] : [])
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar Modernizada */}
        <div style={{ 
          width: '280px', 
          backgroundColor: '#1a1f36', 
          color: 'white', 
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 12px rgba(0,0,0,0.08)'
        }}>
          {/* Logo/Título */}
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              marginBottom: '4px',
              background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              WhatsApp Sales Agent
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Sistema de Vendas com IA
            </p>
          </div>

          {/* Badge Master */}
          {user?.isMaster && (
            <div style={{ 
              backgroundColor: '#fbbf24', 
              color: '#78350f', 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '0.75rem', 
              fontWeight: '700', 
              marginBottom: '24px', 
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
            }}>
              👑 USUÁRIO MASTER
            </div>
          )}

          {/* Navegação */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: currentPage === item.id ? '#10b981' : 'transparent',
                  color: currentPage === item.id ? 'white' : '#d1d5db',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '0.9375rem',
                  fontWeight: currentPage === item.id ? '600' : '500',
                  transition: 'all 0.2s ease',
                  transform: currentPage === item.id ? 'translateX(4px)' : 'translateX(0)',
                  boxShadow: currentPage === item.id ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== item.id) {
                    e.target.style.backgroundColor = '#2a3142';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== item.id) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#d1d5db';
                  }
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Footer da Sidebar */}
          <div style={{ 
            marginTop: '24px', 
            paddingTop: '24px', 
            borderTop: '1px solid #2a3142' 
          }}>
            <p style={{ 
              fontSize: '0.8125rem', 
              color: '#6b7280', 
              marginBottom: '12px',
              fontWeight: '500'
            }}>
              Logado como:
            </p>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#d1d5db',
              marginBottom: '16px',
              fontWeight: '600'
            }}>
              {user?.email}
            </p>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#dc2626';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#ef4444';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
              }}
            >
              Sair
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ 
          flex: 1, 
          backgroundColor: '#fafafa',
          overflowY: 'auto'
        }}>
          {renderContent()}
        </div>
      </div>

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
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>
              {editingItem ? 'Editar Item' : 'Adicionar Item'}
            </h3>
            
            <form onSubmit={handleCatalogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Nome do Item
                </label>
                <input
                  type="text"
                  value={catalogForm.name}
                  onChange={(e) => setCatalogForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                  placeholder="Digite o nome do item"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Descrição
                </label>
                <textarea
                  value={catalogForm.description}
                  onChange={(e) => setCatalogForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Descreva o item"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Tipo do Item
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="type"
                      value="product"
                      checked={catalogForm.type === 'product'}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, type: e.target.value }))}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>Produto</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="type"
                      value="service"
                      checked={catalogForm.type === 'service'}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, type: e.target.value }))}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>Serviço</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Preço (R$)
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
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  {catalogForm.type === 'product' ? 'Qtd. em Estoque' : 'Capacidade/Horas (Simulado)'}
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
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                  placeholder={catalogForm.type === 'product' ? 'Ex: 50' : 'Ex: 40'}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    SKU / Código
                  </label>
                  <input
                    type="text"
                    value={catalogForm.sku || ''}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, sku: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem',
                      fontFamily: 'monospace'
                    }}
                    placeholder="Ex: PROD-001"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={catalogForm.category || ''}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, category: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem'
                    }}
                    placeholder="Ex: Eletrônicos"
                  />
                </div>
              </div>

              {catalogForm.type === 'product' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    Estoque Mínimo (para alertas)
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
                      border: '1px solid #d1d5db',
                      fontSize: '1rem'
                    }}
                    placeholder="5"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Imagem do Produto
                </label>
                
                {/* Upload de arquivo */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    display: 'inline-block',
                    padding: '10px 16px',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.875rem'
                  }}>
                    📁 Escolher Arquivo do PC
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          // Verificar tamanho (max 2MB)
                          if (file.size > 2 * 1024 * 1024) {
                            alert('❌ Imagem muito grande! Máximo 2MB.');
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
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                    Envie do seu computador (máx. 2MB)
                  </p>
                </div>

                {/* OU separador */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  margin: '12px 0',
                  gap: '8px'
                }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }}></div>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold' }}>OU</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }}></div>
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
                      border: '1px solid #d1d5db',
                      fontSize: '1rem'
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
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
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
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                  Cole a URL de uma imagem online (Imgur, Cloudinary, etc)
                </p>

                {/* Botão para remover imagem */}
                {catalogForm.image && (
                  <button
                    type="button"
                    onClick={() => setCatalogForm(prev => ({ ...prev, image: '' }))}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️ Remover Imagem
                  </button>
                )}
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                border: '1px solid #fbbf24'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={catalogForm.featured || false}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, featured: e.target.checked }))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 'bold', color: '#374151' }}>⭐ Marcar como Destaque</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
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
                  {editingItem ? 'Atualizar' : 'Adicionar'}
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
                    alert('✓ Catálogo exportado com sucesso!');
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#10b981',
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
                        alert('❌ Formato inválido! O arquivo deve conter um array de itens.');
                        return;
                      }

                      const validItems = items.filter(item => item.name && item.price && item.type);

                      if (validItems.length === 0) {
                        alert('❌ Nenhum item válido encontrado no arquivo!');
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
                      alert('❌ Erro ao importar arquivo. Verifique o formato.');
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
        showToast={showToast}
      />

      {/* Modal de Usuário */}
      {showUserModal && (
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
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>
              {editingUser ? 'Editar Usuário' : 'Adicionar Usuário'}
            </h3>
            
            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                  placeholder="Digite o nome completo"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Senha {editingUser && '(deixe em branco para manter a atual)'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                  placeholder="Digite a senha"
                  required={!editingUser}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={userForm.companyName}
                  onChange={(e) => setUserForm(prev => ({ ...prev, companyName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                  placeholder="Nome da empresa"
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(e) => setUserForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span style={{ fontWeight: 'bold', color: '#374151' }}>Usuário Ativo</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
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
                  {editingUser ? 'Atualizar' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirebaseApp;
