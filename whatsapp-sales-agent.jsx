'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, remove, onValue, off } from 'firebase/database';
import { 
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { LandingPage } from './components/LandingPage';
import { LogoutButton } from './components/AuthComponents';
import { 
  Home, 
  Building2, 
  Package, 
  Settings, 
  Bot, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Check, 
  X,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Users,
  UserPlus,
  Key,
  Mail,
  Search,
  Filter,
  Star,
  Grid,
  List,
  Upload,
  Download,
  Image as ImageIcon,
  Tag,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  MessageSquare,
  Calendar,
  Phone,
  Clock,
  ExternalLink
} from 'lucide-react';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializar Firebase apenas no cliente
let app, database, auth;
if (typeof window !== 'undefined') {
  try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
  }
}

// Configurações do app
const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsapp-sales-agent';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const APP_VERSION = '1.1.0'; // CRM v1.1.0

// Componente Toast
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center space-x-3 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5" />
      ) : (
        <AlertCircle className="w-5 h-5" />
      )}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Componente principal
const WhatsAppSalesAgent = () => {
  // Estados principais
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  // Estados dos dados
  const [companyProfile, setCompanyProfile] = useState({});
  const [integrationsConfig, setIntegrationsConfig] = useState({});
  const [assistantSettings, setAssistantSettings] = useState({});
  const [catalogItems, setCatalogItems] = useState([]);

  // Estados dos modais e formulários
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
    variations: [],
    minStock: 5
  });

  // Estados do Catálogo Avançado
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all', 'product', 'service'
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogView, setCatalogView] = useState('grid'); // 'grid' ou 'list'
  const [showImportModal, setShowImportModal] = useState(false);

  // Estados para gerenciamento de usuários
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    isActive: true
  });
  const [userFormErrors, setUserFormErrors] = useState({});

  // Estados de autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados da sessão WhatsApp
  const [whatsappSession, setWhatsappSession] = useState({
    status: 'disconnected',
    qrCode: null,
    isActive: false
  });
  const [sessionLoading, setSessionLoading] = useState(false);

  // Estados do CRM
  const [crmTab, setCrmTab] = useState('clients'); // 'clients', 'conversations', 'orders'
  const [crmClients, setCrmClients] = useState([]);
  const [crmConversations, setCrmConversations] = useState([]);
  const [crmOrders, setCrmOrders] = useState([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [crmLoading, setCrmLoading] = useState(false);

  // Verificar se Firebase está pronto
  useEffect(() => {
    if (typeof window !== 'undefined' && auth) {
      setFirebaseReady(true);
    } else {
      setLoading(false);
    }
  }, [auth]);

  // Inicialização
  useEffect(() => {
    try {
      if (!auth) {
        setLoading(false);
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        try {
          if (currentUser) {
            // Verificar se é master baseado no email ou configuração
            const isMaster = currentUser.email?.includes('master') || 
                            currentUser.email?.includes('admin') ||
                            currentUser.email === 'brayan@master.com' ||
                            process.env.NEXT_PUBLIC_MASTER_EMAIL === currentUser.email;
            
            setUser({ 
              ...currentUser, 
              isMaster 
            });
            setIsAuthenticated(true);
            setupFirestoreListeners();
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Erro na autenticação:', error);
          setError('Erro na autenticação: ' + error.message);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Erro na inicialização:', error);
      setError('Erro na inicialização: ' + error.message);
      setLoading(false);
    }
  }, [auth]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    showToast('Login realizado com sucesso!', 'success');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    showToast('Logout realizado com sucesso!', 'success');
  };

  const setupFirestoreListeners = () => {
    if (!user || !db) return;

    const userId = user.uid;
    const appId = APP_ID;

    // Listener para perfil da empresa
    const companyRef = doc(db, `artifacts/${appId}/users/${userId}/company_profile/config`);
    onSnapshot(companyRef, (doc) => {
      if (doc.exists()) {
        setCompanyProfile(doc.data());
      }
    });

    // Listener para configurações de integração
    const integrationsRef = doc(db, `artifacts/${appId}/users/${userId}/integrations_config/config`);
    onSnapshot(integrationsRef, (doc) => {
      if (doc.exists()) {
        setIntegrationsConfig(doc.data());
      }
    });

    // Listener para configurações do assistente
    const assistantRef = doc(db, `artifacts/${appId}/users/${userId}/assistant_settings/config`);
    onSnapshot(assistantRef, (doc) => {
      if (doc.exists()) {
        setAssistantSettings(doc.data());
      }
    });

    // Listener para itens do catálogo
    const catalogRef = collection(db, `artifacts/${appId}/users/${userId}/company_profile/config/catalog_items`);
    const catalogQuery = query(catalogRef, orderBy('createdAt', 'desc'));
    onSnapshot(catalogQuery, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setCatalogItems(items);
    });

    // Listener para usuários (apenas para Master)
    if (user.isMaster) {
      // Buscar usuários criados via registro na landing page
      const usersRef = collection(db, `artifacts/${appId}/registered_users`);
      const usersQuery = query(usersRef, orderBy('createdAt', 'desc'));
      onSnapshot(usersQuery, (snapshot) => {
        const usersList = [];
        snapshot.forEach((doc) => {
          const userData = doc.data();
          usersList.push({ id: doc.id, ...userData });
        });
        setUsers(usersList);
      });
    }
  };

  // Funções utilitárias
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copiado para a área de transferência!');
  };

  // Funções de controle da sessão WhatsApp
  const checkWhatsAppSession = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/status/${user.uid}`);
      const data = await response.json();
      
      setWhatsappSession({
        status: data.status || 'disconnected',
        qrCode: data.qrCode || null,
        isActive: data.isActive || false
      });
    } catch (error) {
      console.error('Erro ao verificar sessão WhatsApp:', error);
    }
  }, [user]);

  const startWhatsAppSession = async () => {
    if (!user) {
      showToast('Usuário não autenticado', 'error');
      return;
    }

    setSessionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await response.json();
      
      if (data.status === 'success' || data.status === 'already_active') {
        showToast('Sessão WhatsApp iniciada! Escaneie o QR Code.', 'success');
        // Iniciar verificação periódica do QR Code
        const interval = setInterval(checkWhatsAppSession, 3000);
        // Limpar intervalo após 2 minutos
        setTimeout(() => clearInterval(interval), 120000);
      } else {
        showToast('Erro ao iniciar sessão WhatsApp', 'error');
      }
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      showToast('Erro ao conectar com o servidor', 'error');
    } finally {
      setSessionLoading(false);
    }
  };

  const stopWhatsAppSession = async () => {
    if (!user) {
      showToast('Usuário não autenticado', 'error');
      return;
    }

    setSessionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        showToast('Sessão WhatsApp desconectada!', 'success');
        setWhatsappSession({
          status: 'disconnected',
          qrCode: null,
          isActive: false
        });
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      showToast('Erro ao desconectar sessão', 'error');
    } finally {
      setSessionLoading(false);
    }
  };

  // Verificar sessão WhatsApp ao carregar
  useEffect(() => {
    if (user) {
      checkWhatsAppSession();
      // Verificar status a cada 30 segundos
      const interval = setInterval(checkWhatsAppSession, 30000);
      return () => clearInterval(interval);
    }
  }, [user, checkWhatsAppSession]);

  // Funções de dados
  const saveCompanyProfile = async (data) => {
    try {
      if (!user || !user.uid) {
        showToast('Usuário não autenticado. Usando modo demo.', 'error');
        return;
      }
      
      const userId = user.uid;
      const appId = APP_ID;
      
      if (!db) {
        showToast('Firebase não inicializado. Verifique as configurações.', 'error');
        return;
      }
      
      await setDoc(doc(db, `artifacts/${appId}/users/${userId}/company_profile/config`), data, { merge: true });
      showToast('Perfil da empresa salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      showToast('Erro ao salvar perfil da empresa', 'error');
    }
  };

  const saveIntegrationsConfig = async (data) => {
    try {
      if (!user || !user.uid || !db) {
        showToast('Sistema não inicializado.', 'error');
        return;
      }
      
      // Verificar se é usuário master
      if (!user.isMaster) {
        showToast('Apenas usuários Master podem configurar integrações.', 'error');
        return;
      }
      
      const userId = user.uid;
      const appId = APP_ID;
      
      await setDoc(doc(db, `artifacts/${appId}/users/${userId}/integrations_config/config`), data, { merge: true });
      showToast('Configurações de integração salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar integrações:', error);
      showToast('Erro ao salvar configurações', 'error');
    }
  };

  const saveAssistantSettings = async (data) => {
    try {
      if (!user || !user.uid) {
        showToast('Usuário não autenticado. Usando modo demo.', 'error');
        return;
      }
      
      const userId = user.uid;
      const appId = APP_ID;
      
      if (!db) {
        showToast('Firebase não inicializado. Verifique as configurações.', 'error');
        return;
      }
      
      await setDoc(doc(db, `artifacts/${appId}/users/${userId}/assistant_settings/config`), data, { merge: true });
      showToast('Configurações do assistente salvas!');
    } catch (error) {
      console.error('Erro ao salvar assistente:', error);
      showToast('Erro ao salvar configurações do assistente', 'error');
    }
  };

  const handleToggleAssistant = async () => {
    const newStatus = !assistantSettings.isActive;
    await saveAssistantSettings({ ...assistantSettings, isActive: newStatus });
  };

  const saveCatalogItem = async (itemData) => {
    try {
      if (!user || !user.uid) {
        showToast('Usuário não autenticado. Usando modo demo.', 'error');
        return;
      }
      
      const userId = user.uid;
      const appId = APP_ID;
      
      if (!db) {
        showToast('Firebase não inicializado. Verifique as configurações.', 'error');
        return;
      }
      const itemToSave = {
        ...itemData,
        price: parseFloat(itemData.price),
        stockQuantity: parseInt(itemData.stockQuantity),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      let productId = editingItem?.id;

      if (editingItem) {
        // Atualizar item existente no Firestore
        await updateDoc(
          doc(db, `artifacts/${appId}/users/${userId}/company_profile/config/catalog_items/${editingItem.id}`),
          { ...itemToSave, updatedAt: new Date().toISOString() }
        );
        const itemType = itemToSave.type === 'service' ? 'Serviço' : 'Produto';
        showToast(`${itemType} atualizado com sucesso!`);
      } else {
        // Criar novo item no Firestore
        const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/company_profile/config/catalog_items`), itemToSave);
        productId = docRef.id;
        const itemType = itemToSave.type === 'service' ? 'Serviço' : 'Produto';
        showToast(`${itemType} adicionado com sucesso!`);
      }
      
      // ============================================
      // SINCRONIZAR COM REALTIME DATABASE
      // Salva produtos E serviços em products/{userId}
      // IMPORTANTE: Backend busca em products/{userId} para AMBOS os tipos
      // ============================================
      try {
        const realtimeDb = getDatabase();
        // Usar productId como chave, ou gerar um timestamp se não houver
        const finalProductId = productId || editingItem?.id || `product_${Date.now()}`;
        const productRef = ref(realtimeDb, `products/${userId}/${finalProductId}`);
        
        const realtimeProduct = {
          id: finalProductId,
          name: itemToSave.name,
          description: itemToSave.description || '',
          price: itemToSave.price,
          stock: itemToSave.stockQuantity || 0,
          category: itemToSave.category || '',
          image: itemToSave.image || '',
          type: itemToSave.type || 'product',
          active: true,
          createdAt: itemToSave.createdAt,
          updatedAt: itemToSave.updatedAt
        };
        
        await set(productRef, realtimeProduct);
        const itemType = itemToSave.type === 'service' ? 'Serviço' : 'Produto';
        console.log(`✅ ${itemType} sincronizado com Realtime Database em: products/${userId}/${finalProductId}`);
      } catch (realtimeError) {
        console.error('⚠️ Erro ao sincronizar com Realtime Database:', realtimeError);
        // Não bloqueia o fluxo principal
      }
      
      setShowCatalogModal(false);
      setEditingItem(null);
      setCatalogForm({ name: '', description: '', price: '', stockQuantity: '', type: 'product' });
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      showToast('Erro ao salvar item', 'error');
    }
  };

  const deleteCatalogItem = async (itemId) => {
    try {
      if (!user || !user.uid) {
        showToast('Usuário não autenticado. Usando modo demo.', 'error');
        return;
      }
      
      const userId = user.uid;
      const appId = APP_ID;
      
      if (!db) {
        showToast('Firebase não inicializado. Verifique as configurações.', 'error');
        return;
      }
      
      // Excluir do Firestore
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/company_profile/config/catalog_items/${itemId}`));
      
      // ============================================
      // SINCRONIZAR COM REALTIME DATABASE
      // Remove produtos E serviços de products/{userId}
      // ============================================
      try {
        const realtimeDb = getDatabase();
        const productRef = ref(realtimeDb, `products/${userId}/${itemId}`);
        await remove(productRef);
        console.log('✅ Item removido do Realtime Database (products/' + userId + ')');
      } catch (realtimeError) {
        console.error('⚠️ Erro ao remover do Realtime Database:', realtimeError);
      }
      
      showToast('Item excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      showToast('Erro ao excluir item', 'error');
    }
  };

  const openCatalogModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setCatalogForm({
        name: item.name || '',
        description: item.description || '',
        price: item.price || '',
        stockQuantity: item.stockQuantity || '',
        type: item.type || 'product'
      });
    } else {
      setEditingItem(null);
      setCatalogForm({ name: '', description: '', price: '', stockQuantity: '', type: 'product' });
    }
    setShowCatalogModal(true);
  };

  // Funções para gerenciamento de usuários
  const saveUser = async (userData) => {
    try {
      if (!user?.isMaster) {
        showToast('Apenas usuários Master podem gerenciar usuários.', 'error');
        return;
      }

      const appId = APP_ID;
      const userToSave = {
        ...userData,
        createdAt: editingUser ? userData.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isMaster: false, // Usuários criados pelo master nunca são master
        registeredVia: editingUser ? userData.registeredVia : 'created_by_master'
      };

      if (editingUser) {
        // Atualizar usuário existente
        await updateDoc(
          doc(db, `artifacts/${appId}/registered_users/${editingUser.id}`),
          { ...userToSave, updatedAt: new Date().toISOString() }
        );
        showToast('Usuário atualizado com sucesso!');
      } else {
        // Criar novo usuário
        await addDoc(collection(db, `artifacts/${appId}/registered_users`), userToSave);
        showToast('Usuário criado com sucesso!');
      }
      
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', companyName: '', isActive: true });
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      showToast('Erro ao salvar usuário', 'error');
    }
  };

  const deleteUser = async (userId) => {
    try {
      if (!user?.isMaster) {
        showToast('Apenas usuários Master podem excluir usuários.', 'error');
        return;
      }

      if (confirm('Tem certeza que deseja excluir este usuário?')) {
        const appId = APP_ID;
        await deleteDoc(doc(db, `artifacts/${appId}/registered_users/${userId}`));
        showToast('Usuário excluído com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      showToast('Erro ao excluir usuário', 'error');
    }
  };

  const openUserModal = (userData = null) => {
    if (userData) {
      setEditingUser(userData);
      setUserForm({
        name: userData.name || '',
        email: userData.email || '',
        password: '', // Não mostrar senha atual
        companyName: userData.companyName || '',
        isActive: userData.isActive !== undefined ? userData.isActive : true
      });
    } else {
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', companyName: '', isActive: true });
    }
    setUserFormErrors({});
    setShowUserModal(true);
  };

  // Handlers específicos para cada campo
  const handleUserNameChange = useCallback((value) => {
    setUserForm(prev => ({ ...prev, name: value }));
  }, []);

  const handleUserEmailChange = useCallback((value) => {
    setUserForm(prev => ({ ...prev, email: value }));
  }, []);

  const handleUserPasswordChange = useCallback((value) => {
    setUserForm(prev => ({ ...prev, password: value }));
  }, []);

  const handleUserCompanyChange = useCallback((value) => {
    setUserForm(prev => ({ ...prev, companyName: value }));
  }, []);

  const handleUserActiveChange = useCallback((checked) => {
    setUserForm(prev => ({ ...prev, isActive: checked }));
  }, []);

  // Componente Sidebar
  const Sidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'company', label: 'Cadastro da Empresa', icon: Building2 },
      { id: 'catalog', label: 'Catálogo (Itens)', icon: Package },
      { id: 'crm', label: 'CRM', icon: Users },
      { id: 'integrations', label: 'Integrações', icon: Settings },
      { id: 'assistant', label: 'Configuração do Assistente', icon: Bot }
    ];

    // Adicionar gerenciamento de usuários apenas para Master
    if (user?.isMaster) {
      menuItems.push({ id: 'users', label: 'Gerenciar Usuários', icon: Users });
    }

    return (
      <div className="w-64 bg-indigo-900 text-white min-h-screen fixed left-0 top-0 overflow-y-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold mb-2">WhatsApp Sales Agent</h1>
            {user?.isMaster && (
              <div className="bg-yellow-500 text-yellow-900 px-2 py-1 rounded-lg text-xs font-bold">
                👑 USUÁRIO MASTER
              </div>
            )}
          </div>
          <nav>
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setCurrentPage(item.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                        currentPage === item.id
                          ? 'bg-indigo-700 text-white'
                          : 'text-indigo-200 hover:bg-indigo-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          
          {/* Logout Button */}
          <div className="mt-8 pt-6 border-t border-indigo-800">
            <div className="px-4 py-2">
              <div className="text-xs text-indigo-300 mb-2">
                Logado como: {user?.displayName || user?.email}
              </div>
              <LogoutButton onLogout={handleLogout} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Componente Dashboard
  const Dashboard = () => {
    const isCompanyConfigured = companyProfile.companyName && companyProfile.cnpj && companyProfile.whatsappNumber;
    const isCatalogConfigured = catalogItems.length > 0;
    const isIntegrationsConfigured = integrationsConfig.asaasConfig || integrationsConfig.fiscalConfig || integrationsConfig.openaiConfig;
    const isAssistantConfigured = assistantSettings.welcomeMessage && assistantSettings.enabledFeatures?.length > 0;

    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h2>
        
        {/* Card de Controle do WhatsApp */}
        <div className="mb-8 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold mb-2">Controle da Sessão WhatsApp</h3>
              <p className="text-green-100">
                Status: {whatsappSession.status === 'connected' ? '🟢 Conectado' : 
                         whatsappSession.status === 'qrcode' ? '🟡 Aguardando QR Code' : 
                         '🔴 Desconectado'}
              </p>
            </div>
            <div className="flex gap-3">
              {whatsappSession.status !== 'connected' ? (
                <button
                  onClick={startWhatsAppSession}
                  disabled={sessionLoading}
                  className="bg-white text-green-600 px-6 py-3 rounded-xl font-bold hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sessionLoading ? 'Iniciando...' : 'Iniciar WhatsApp'}
                </button>
              ) : (
                <button
                  onClick={stopWhatsAppSession}
                  disabled={sessionLoading}
                  className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sessionLoading ? 'Desconectando...' : 'Desconectar'}
                </button>
              )}
              <button
                onClick={checkWhatsAppSession}
                className="bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-bold hover:bg-opacity-30 transition-colors"
              >
                Atualizar Status
              </button>
            </div>
          </div>
          
          {whatsappSession.qrCode && whatsappSession.status === 'qrcode' && (
            <div className="mt-4 bg-white rounded-xl p-4">
              <p className="text-gray-800 font-semibold mb-3 text-center">
                Escaneie o QR Code com seu WhatsApp:
              </p>
              <div className="flex justify-center">
                <img 
                  src={whatsappSession.qrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 border-4 border-green-500 rounded-lg"
                />
              </div>
              <p className="text-gray-600 text-sm text-center mt-3">
                Abra o WhatsApp → Configurações → Aparelhos Conectados → Conectar Aparelho
              </p>
            </div>
          )}

          {whatsappSession.status === 'connected' && (
            <div className="mt-4 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <p className="text-center font-semibold">
                ✅ WhatsApp conectado e funcionando! O assistente está respondendo automaticamente.
              </p>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Status do Assistente</p>
                <p className={`text-2xl font-bold ${assistantSettings.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {assistantSettings.isActive ? 'Ativo' : 'Inativo'}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                assistantSettings.isActive ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Bot className={`w-6 h-6 ${assistantSettings.isActive ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Itens no Catálogo</p>
                <p className="text-2xl font-bold text-indigo-600">{catalogItems.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Perfil da Empresa</p>
                <p className="text-lg font-bold text-gray-800">
                  {isCompanyConfigured ? 'Configurado' : 'Pendente'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Integrações</p>
                <p className="text-lg font-bold text-gray-800">
                  {isIntegrationsConfigured ? 'Configurado' : 'Pendente'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Status de Configuração</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              {isCompanyConfigured ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span className={isCompanyConfigured ? 'text-green-600' : 'text-red-600'}>
                Perfil da Empresa
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {isCatalogConfigured ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span className={isCatalogConfigured ? 'text-green-600' : 'text-red-600'}>
                Catálogo de Itens
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {isIntegrationsConfigured ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span className={isIntegrationsConfigured ? 'text-green-600' : 'text-red-600'}>
                Integrações
              </span>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t">
            <button
              onClick={handleToggleAssistant}
              className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-colors ${
                assistantSettings.isActive
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {assistantSettings.isActive ? 'Desligar Assistente' : 'Ligar Assistente'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Componente Cadastro da Empresa
  const CompanySetup = () => {
    const [formData, setFormData] = useState({
      companyName: '',
      cnpj: '',
      whatsappNumber: ''
    });

    useEffect(() => {
      setFormData({
        companyName: companyProfile.companyName || '',
        cnpj: companyProfile.cnpj || '',
        whatsappNumber: companyProfile.whatsappNumber || ''
      });
    }, [companyProfile]);

    const handleSubmit = (e) => {
      e.preventDefault();
      saveCompanyProfile(formData);
    };

    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Cadastro da Empresa</h2>
        
        <div className="bg-white rounded-2xl p-6 shadow-lg border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Empresa
              </label>
              <input
                type="text"
                value={formData.companyName || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, companyName: value }));
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Digite o nome da sua empresa"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CNPJ
              </label>
              <input
                type="text"
                value={formData.cnpj || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, cnpj: value }));
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="00.000.000/0000-00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do WhatsApp
              </label>
              <input
                type="text"
                value={formData.whatsappNumber || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, whatsappNumber: value }));
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="+55 11 99999-9999"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Salvar Perfil da Empresa
            </button>
          </form>
        </div>
      </div>
    );
  };

  // Componente Catálogo Avançado
  const Catalog = () => {
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

        {/* Modal do Catálogo Avançado */}
        {showCatalogModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
                <Package className="w-6 h-6 text-indigo-600" />
                <span>{editingItem ? 'Editar Item' : 'Adicionar Novo Item'}</span>
              </h3>
              
              <form onSubmit={(e) => { e.preventDefault(); saveCatalogItem(catalogForm); }} className="space-y-5">
                {/* Grid de 2 colunas para campos principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                    <input
                      type="text"
                      value={catalogForm.name || ''}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Ex: Notebook Dell"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SKU / Código</label>
                    <input
                      type="text"
                      value={catalogForm.sku || ''}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, sku: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                      placeholder="Ex: PROD-001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                  <textarea
                    value={catalogForm.description || ''}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows="3"
                    placeholder="Descreva o produto ou serviço..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          value="product"
                          checked={catalogForm.type === 'product'}
                          onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Produto</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          value="service"
                          checked={catalogForm.type === 'service'}
                          onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Serviço</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                    <input
                      type="text"
                      value={catalogForm.category || ''}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Ex: Eletrônicos, Roupas..."
                      list="categories-list"
                    />
                    <datalist id="categories-list">
                      {categories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preço (R$) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={catalogForm.price || ''}
                        onChange={(e) => setCatalogForm(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0,00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {catalogForm.type === 'product' ? 'Estoque *' : 'Capacidade *'}
                    </label>
                    <input
                      type="number"
                      value={catalogForm.stockQuantity || ''}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, stockQuantity: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0"
                      required
                    />
                  </div>

                  {catalogForm.type === 'product' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Mínimo</label>
                      <input
                        type="number"
                        value={catalogForm.minStock || 5}
                        onChange={(e) => setCatalogForm(prev => ({ ...prev, minStock: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="5"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">URL da Imagem</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={catalogForm.image || ''}
                      onChange={(e) => setCatalogForm(prev => ({ ...prev, image: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                    {catalogForm.image && (
                      <div className="w-16 h-16 rounded-lg border-2 border-gray-300 overflow-hidden flex-shrink-0">
                        <img src={catalogForm.image} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Cole a URL de uma imagem online</p>
                </div>

                <div className="flex items-center space-x-2 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={catalogForm.featured || false}
                    onChange={(e) => setCatalogForm(prev => ({ ...prev, featured: e.target.checked }))}
                    className="w-5 h-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                  />
                  <label htmlFor="featured" className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-700">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span>Marcar como Destaque</span>
                  </label>
                </div>

                <div className="flex space-x-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCatalogModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                  >
                    {editingItem ? '✓ Atualizar' : '+ Adicionar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Importação/Exportação */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
                <Upload className="w-6 h-6 text-indigo-600" />
                <span>Importar/Exportar Catálogo</span>
              </h3>

              <div className="space-y-4">
                {/* Exportar */}
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center space-x-2">
                    <Download className="w-5 h-5 text-green-600" />
                    <span>Exportar Catálogo</span>
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
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
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar JSON</span>
                  </button>
                </div>

                {/* Importar */}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center space-x-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    <span>Importar Catálogo</span>
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
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

                        // Validar estrutura básica
                        const validItems = items.filter(item => 
                          item.name && item.price && item.type
                        );

                        if (validItems.length === 0) {
                          alert('❌ Nenhum item válido encontrado no arquivo!');
                          return;
                        }

                        // Importar itens
                        const promises = validItems.map(item => {
                          const itemData = {
                            ...item,
                            id: item.id || Date.now() + Math.random(),
                            createdAt: item.createdAt || new Date().toISOString()
                          };
                          return set(ref(database, `${APP_ID}/users/${user.uid}/catalog/${itemData.id}`), itemData);
                        });

                        await Promise.all(promises);
                        alert(`✓ ${validItems.length} itens importados com sucesso!`);
                        setShowImportModal(false);
                      } catch (error) {
                        console.error('Erro ao importar:', error);
                        alert('❌ Erro ao importar arquivo. Verifique o formato.');
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 cursor-pointer transition-colors text-sm"
                  />
                </div>

                {/* Exemplo */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-2 text-sm">Formato do Arquivo JSON:</h4>
                  <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded-lg overflow-x-auto">
{`[
  {
    "name": "Produto 1",
    "description": "Descrição",
    "price": 99.90,
    "type": "product",
    "stockQuantity": 10,
    "category": "Categoria",
    "sku": "PROD-001",
    "featured": false
  }
]`}
                  </pre>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Componente Integrações
  const Integrations = () => {
    const [activeTab, setActiveTab] = useState('openai');
    const [asaasConfig, setAsaasConfig] = useState({
      asaasApiKey: ''
    });
    const [fiscalConfig, setFiscalConfig] = useState({
      enabled: false,
      municipalRegistration: '',
      issRate: 0,
      retainIss: false,
      cofinsRate: 0,
      csllRate: 0,
      inssRate: 0,
      irRate: 0,
      pisRate: 0,
      deductions: 0,
      observations: ''
    });
    const [openaiConfig, setOpenaiConfig] = useState({
      apiKey: '',
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.7
    });

    useEffect(() => {
      setAsaasConfig(integrationsConfig.asaasConfig || { asaasApiKey: '' });
      setFiscalConfig(integrationsConfig.fiscalConfig || { 
        enabled: false,
        municipalRegistration: '',
        issRate: 0,
        retainIss: false,
        cofinsRate: 0,
        csllRate: 0,
        inssRate: 0,
        irRate: 0,
        pisRate: 0,
        deductions: 0,
        observations: ''
      });
      setOpenaiConfig(integrationsConfig.openaiConfig || { 
        apiKey: '', 
        model: 'gpt-3.5-turbo', 
        maxTokens: 1000, 
        temperature: 0.7 
      });
    }, [integrationsConfig]);

    const saveAsaasConfig = () => {
      saveIntegrationsConfig({
        ...integrationsConfig,
        asaasConfig
      });
    };

    const saveFiscalConfig = () => {
      saveIntegrationsConfig({
        ...integrationsConfig,
        fiscalConfig
      });
    };

    const saveOpenaiConfig = () => {
      saveIntegrationsConfig({
        ...integrationsConfig,
        openaiConfig
      });
    };

    const webhookUrl = `https://your-api.com/webhook/${user?.uid}`;

    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Integrações</h2>
        
        {!user?.isMaster && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Settings className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-blue-800">Integrações Configuradas pelo Master</h3>
                <p className="text-sm text-blue-600">Você tem acesso a todas as funcionalidades de IA sem precisar configurar APIs.</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-2xl shadow-lg border">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('asaas')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'asaas'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Asaas
              </button>
              <button
                onClick={() => setActiveTab('fiscal')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'fiscal'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Fiscal
              </button>
              <button
                onClick={() => setActiveTab('openai')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'openai'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                OpenAI
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'asaas' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Configuração Asaas</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key do Asaas
                      </label>
                      <input
                        type="password"
                        value={asaasConfig.asaasApiKey}
                        onChange={(e) => setAsaasConfig({ ...asaasConfig, asaasApiKey: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Digite sua API Key do Asaas"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Webhook URL
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={webhookUrl}
                          readOnly
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl bg-gray-50"
                        />
                        <button
                          onClick={() => copyToClipboard(webhookUrl)}
                          className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        Configure este webhook no painel do Asaas para receber notificações
                      </p>
                    </div>

                    <button
                      onClick={saveAsaasConfig}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Salvar Configuração Asaas
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fiscal' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📄 Configuração de Nota Fiscal</h3>
                  
                  {/* Toggle para habilitar emissão de NF */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-blue-800">Emissão Automática de Nota Fiscal</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Habilite para emitir NFS-e automaticamente após confirmação de pagamento
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fiscalConfig.enabled}
                          onChange={(e) => setFiscalConfig({ ...fiscalConfig, enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Inscrição Municipal */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Inscrição Municipal
                      </label>
                      <input
                        type="text"
                        value={fiscalConfig.municipalRegistration}
                        onChange={(e) => setFiscalConfig({ ...fiscalConfig, municipalRegistration: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Digite sua inscrição municipal"
                        disabled={!fiscalConfig.enabled}
                      />
                    </div>

                    {/* Alíquotas de Impostos */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-3">Alíquotas de Impostos (%)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ISS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={fiscalConfig.issRate}
                            onChange={(e) => setFiscalConfig({ ...fiscalConfig, issRate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                            disabled={!fiscalConfig.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            COFINS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={fiscalConfig.cofinsRate}
                            onChange={(e) => setFiscalConfig({ ...fiscalConfig, cofinsRate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                            disabled={!fiscalConfig.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            CSLL (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={fiscalConfig.csllRate}
                            onChange={(e) => setFiscalConfig({ ...fiscalConfig, csllRate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                            disabled={!fiscalConfig.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            INSS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={fiscalConfig.inssRate}
                            onChange={(e) => setFiscalConfig({ ...fiscalConfig, inssRate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                            disabled={!fiscalConfig.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            IR (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={fiscalConfig.irRate}
                            onChange={(e) => setFiscalConfig({ ...fiscalConfig, irRate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                            disabled={!fiscalConfig.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            PIS (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={fiscalConfig.pisRate}
                            onChange={(e) => setFiscalConfig({ ...fiscalConfig, pisRate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                            disabled={!fiscalConfig.enabled}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Reter ISS */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="retainIss"
                        checked={fiscalConfig.retainIss}
                        onChange={(e) => setFiscalConfig({ ...fiscalConfig, retainIss: e.target.checked })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        disabled={!fiscalConfig.enabled}
                      />
                      <label htmlFor="retainIss" className="text-sm font-medium text-gray-700">
                        Reter ISS (o cliente retém o ISS na fonte)
                      </label>
                    </div>

                    {/* Deduções */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deduções (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={fiscalConfig.deductions}
                        onChange={(e) => setFiscalConfig({ ...fiscalConfig, deductions: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0.00"
                        disabled={!fiscalConfig.enabled}
                      />
                    </div>

                    {/* Observações */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Observações (opcional)
                      </label>
                      <textarea
                        value={fiscalConfig.observations}
                        onChange={(e) => setFiscalConfig({ ...fiscalConfig, observations: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Observações que aparecerão na nota fiscal..."
                        disabled={!fiscalConfig.enabled}
                      />
                    </div>

                    {/* Informações */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <h4 className="font-medium text-green-800 mb-2">✅ Como funciona:</h4>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Habilite a emissão automática acima</li>
                        <li>• Configure suas alíquotas de acordo com sua legislação municipal</li>
                        <li>• Após o pagamento ser confirmado, a NFS-e será emitida automaticamente</li>
                        <li>• O cliente receberá a nota fiscal via WhatsApp com link para PDF</li>
                        <li>• Todas as notas emitidas ficarão salvas no Firebase</li>
                      </ul>
                    </div>

                    <button
                      onClick={saveFiscalConfig}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!fiscalConfig.enabled}
                    >
                      Salvar Configuração Fiscal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'openai' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Configuração OpenAI</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key do OpenAI
                      </label>
                      <input
                        type="password"
                        value={openaiConfig.apiKey}
                        onChange={(e) => setOpenaiConfig({ ...openaiConfig, apiKey: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="sk-... (sua chave API do OpenAI)"
                      />
                      <p className="text-sm text-gray-500 mt-2">
                        Sua chave API será armazenada de forma segura e usada para processar mensagens do assistente
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Modelo
                        </label>
                        <select
                          value={openaiConfig.model}
                          onChange={(e) => setOpenaiConfig({ ...openaiConfig, model: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Máximo de Tokens
                        </label>
                        <input
                          type="number"
                          value={openaiConfig.maxTokens}
                          onChange={(e) => setOpenaiConfig({ ...openaiConfig, maxTokens: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          min="100"
                          max="4000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperatura (Criatividade)
                      </label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={openaiConfig.temperature}
                          onChange={(e) => setOpenaiConfig({ ...openaiConfig, temperature: parseFloat(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium text-gray-700 w-12">
                          {openaiConfig.temperature}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        0 = Mais preciso e consistente | 2 = Mais criativo e variado
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <h4 className="font-medium text-blue-800 mb-2">💡 Como funciona:</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Sua API Key será usada para gerar respostas inteligentes</li>
                        <li>• O assistente usará o modelo selecionado para processar conversas</li>
                        <li>• A temperatura controla o nível de criatividade das respostas</li>
                        <li>• Os tokens limitam o tamanho das respostas geradas</li>
                      </ul>
                    </div>

                    <button
                      onClick={saveOpenaiConfig}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Salvar Configuração OpenAI
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Componente Gerenciamento de Usuários
  const UsersManagement = () => {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Gerenciar Usuários</h2>
          <button
            onClick={() => openUserModal()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center space-x-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Adicionar Usuário</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
          {users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-600 mb-2">Nenhum usuário encontrado</h3>
              <p className="text-gray-500 mb-6">Comece criando o primeiro usuário do sistema</p>
              <button
                onClick={() => openUserModal()}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Criar Primeiro Usuário
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Usuário</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Empresa</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Origem</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Criado em</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((userData) => (
                    <tr key={userData.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{userData.name}</div>
                          <div className="text-sm text-gray-500">{userData.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {userData.companyName || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          userData.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {userData.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          userData.registeredVia === 'landing_page'
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {userData.registeredVia === 'landing_page' ? 'Landing Page' : 'Criado pelo Master'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openUserModal(userData)}
                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Editar usuário"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteUser(userData.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Excluir usuário"
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
          )}
        </div>

        {/* Modal de Usuário */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div key={editingUser?.id || 'new'} className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-bold text-gray-800 mb-6">
                {editingUser ? 'Editar Usuário' : 'Adicionar Usuário'}
              </h3>
              
              <form onSubmit={(e) => { e.preventDefault(); saveUser(userForm); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => handleUserNameChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => handleUserEmailChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => handleUserPasswordChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required={!editingUser}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa</label>
                  <input
                    type="text"
                    value={userForm.companyName}
                    onChange={(e) => handleUserCompanyChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={userForm.isActive}
                      onChange={(e) => handleUserActiveChange(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">Usuário ativo</span>
                  </label>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                  >
                    {editingUser ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Componente CRM
  const CRM = () => {
    // Carregar dados do CRM quando a aba mudar
    useEffect(() => {
      if (user?.uid) {
        loadCRMData();
      }
    }, [user, crmTab]);

    const loadCRMData = async () => {
      if (!user?.uid) return;
      
      setCrmLoading(true);
      try {
        if (crmTab === 'clients') {
          await loadClients();
        } else if (crmTab === 'conversations') {
          await loadConversations();
        } else if (crmTab === 'orders') {
          await loadOrders();
        }
      } catch (error) {
        console.error('Erro ao carregar dados do CRM:', error);
        showToast('Erro ao carregar dados', 'error');
      } finally {
        setCrmLoading(false);
      }
    };

    const loadClients = async () => {
      const conversationsRef = ref(database, `conversations/${user.uid}`);
      const snapshot = await onValue(conversationsRef, (snap) => {
        const clients = [];
        if (snap.exists()) {
          const data = snap.val();
          Object.keys(data).forEach(contactNumber => {
            const messages = data[contactNumber].messages || {};
            const messageArray = Object.values(messages);
            const lastMessage = messageArray[messageArray.length - 1];
            
            clients.push({
              phone: contactNumber,
              name: contactNumber.replace('@c.us', ''),
              lastContact: lastMessage?.timestamp || new Date().toISOString(),
              messageCount: messageArray.length,
              firstContact: messageArray[0]?.timestamp || new Date().toISOString()
            });
          });
        }
        setCrmClients(clients.sort((a, b) => new Date(b.lastContact) - new Date(a.lastContact)));
      }, { onlyOnce: true });
    };

    const loadConversations = async () => {
      const conversationsRef = ref(database, `conversations/${user.uid}`);
      const snapshot = await onValue(conversationsRef, (snap) => {
        const convs = [];
        if (snap.exists()) {
          const data = snap.val();
          Object.keys(data).forEach(contactNumber => {
            const messages = data[contactNumber].messages || {};
            const messageArray = Object.entries(messages).map(([id, msg]) => ({
              id,
              ...msg
            })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            convs.push({
              phone: contactNumber,
              name: contactNumber.replace('@c.us', ''),
              messages: messageArray
            });
          });
        }
        setCrmConversations(convs);
      }, { onlyOnce: true });
    };

    const loadOrders = async () => {
      const ordersRef = ref(database, `orders/${user.uid}`);
      const snapshot = await onValue(ordersRef, (snap) => {
        const orders = [];
        if (snap.exists()) {
          const data = snap.val();
          Object.entries(data).forEach(([orderId, order]) => {
            orders.push({
              id: orderId,
              ...order
            });
          });
        }
        setCrmOrders(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }, { onlyOnce: true });
    };

    const filteredClients = crmClients.filter(client =>
      client.name.toLowerCase().includes(crmSearch.toLowerCase()) ||
      client.phone.toLowerCase().includes(crmSearch.toLowerCase())
    );

    const filteredConversations = crmConversations.filter(conv =>
      conv.name.toLowerCase().includes(crmSearch.toLowerCase()) ||
      conv.phone.toLowerCase().includes(crmSearch.toLowerCase())
    );

    const filteredOrders = crmOrders.filter(order =>
      order.customerPhone?.toLowerCase().includes(crmSearch.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(crmSearch.toLowerCase()) ||
      order.description?.toLowerCase().includes(crmSearch.toLowerCase())
    );

    const formatPhone = (phone) => {
      return phone.replace('@c.us', '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const getStatusColor = (status) => {
      const colors = {
        pending: 'bg-yellow-100 text-yellow-800',
        paid: 'bg-green-100 text-green-800',
        confirmed: 'bg-blue-100 text-blue-800',
        cancelled: 'bg-red-100 text-red-800',
        overdue: 'bg-orange-100 text-orange-800'
      };
      return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getStatusLabel = (status) => {
      const labels = {
        pending: 'Pendente',
        paid: 'Pago',
        confirmed: 'Confirmado',
        cancelled: 'Cancelado',
        overdue: 'Vencido'
      };
      return labels[status] || status;
    };

    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">CRM</h2>
          <p className="text-gray-600">Gerencie seus clientes, conversas e pedidos</p>
        </div>

        {/* Abas */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <nav className="flex border-b border-gray-200">
            <button
              onClick={() => setCrmTab('clients')}
              className={`flex items-center space-x-2 px-6 py-4 font-medium text-sm border-b-2 ${
                crmTab === 'clients'
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Lista de Clientes</span>
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">
                {crmClients.length}
              </span>
            </button>
            <button
              onClick={() => setCrmTab('conversations')}
              className={`flex items-center space-x-2 px-6 py-4 font-medium text-sm border-b-2 ${
                crmTab === 'conversations'
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>Histórico de Conversas</span>
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">
                {crmConversations.length}
              </span>
            </button>
            <button
              onClick={() => setCrmTab('orders')}
              className={`flex items-center space-x-2 px-6 py-4 font-medium text-sm border-b-2 ${
                crmTab === 'orders'
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Histórico de Compras</span>
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">
                {crmOrders.length}
              </span>
            </button>
          </nav>

          {/* Barra de busca */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={`Buscar ${crmTab === 'clients' ? 'clientes' : crmTab === 'conversations' ? 'conversas' : 'pedidos'}...`}
                value={crmSearch}
                onChange={(e) => setCrmSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Conteúdo das abas */}
          <div className="p-6">
            {crmLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando dados...</p>
              </div>
            ) : (
              <>
                {/* Lista de Clientes */}
                {crmTab === 'clients' && (
                  <div className="space-y-4">
                    {filteredClients.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium">Nenhum cliente encontrado</p>
                        <p className="text-gray-400 text-sm mt-2">
                          {crmSearch ? 'Tente ajustar sua busca' : 'Os clientes aparecerão aqui após as primeiras conversas'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredClients.map((client) => (
                          <div
                            key={client.phone}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => setSelectedClient(client)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                  <Users className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-800">{client.name}</h3>
                                  <p className="text-sm text-gray-500 flex items-center space-x-1">
                                    <Phone className="w-3 h-3" />
                                    <span>{formatPhone(client.phone)}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between text-gray-600">
                                <span className="flex items-center space-x-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>Primeiro contato:</span>
                                </span>
                                <span className="font-medium">{formatDate(client.firstContact).split(' ')[0]}</span>
                              </div>
                              <div className="flex items-center justify-between text-gray-600">
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-4 h-4" />
                                  <span>Último contato:</span>
                                </span>
                                <span className="font-medium">{formatDate(client.lastContact).split(' ')[0]}</span>
                              </div>
                              <div className="flex items-center justify-between text-gray-600">
                                <span className="flex items-center space-x-1">
                                  <MessageSquare className="w-4 h-4" />
                                  <span>Mensagens:</span>
                                </span>
                                <span className="font-bold text-indigo-600">{client.messageCount}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Histórico de Conversas */}
                {crmTab === 'conversations' && (
                  <div className="space-y-6">
                    {filteredConversations.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium">Nenhuma conversa encontrada</p>
                        <p className="text-gray-400 text-sm mt-2">
                          {crmSearch ? 'Tente ajustar sua busca' : 'As conversas aparecerão aqui após os primeiros atendimentos'}
                        </p>
                      </div>
                    ) : (
                      filteredConversations.map((conversation) => (
                        <div key={conversation.phone} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          {/* Header da conversa */}
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold">{conversation.name}</h3>
                                <p className="text-sm opacity-90 flex items-center space-x-1">
                                  <Phone className="w-3 h-3" />
                                  <span>{formatPhone(conversation.phone)}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Mensagens */}
                          <div className="p-4 space-y-3 max-h-96 overflow-y-auto bg-gray-50">
                            {conversation.messages.map((message, idx) => {
                              const isBot = message.from !== conversation.phone;
                              return (
                                <div
                                  key={message.id || idx}
                                  className={`flex ${isBot ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                    isBot 
                                      ? 'bg-indigo-600 text-white' 
                                      : 'bg-white border border-gray-200 text-gray-800'
                                  }`}>
                                    <p className="text-sm">{message.body}</p>
                                    {message.imageUrl && (
                                      <div className="mt-2">
                                        <img 
                                          src={message.imageUrl} 
                                          alt="Imagem enviada"
                                          className="rounded max-w-full h-auto"
                                        />
                                      </div>
                                    )}
                                    <p className={`text-xs mt-1 ${isBot ? 'text-indigo-200' : 'text-gray-500'}`}>
                                      {formatDate(message.timestamp)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Histórico de Compras */}
                {crmTab === 'orders' && (
                  <div className="space-y-4">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium">Nenhum pedido encontrado</p>
                        <p className="text-gray-400 text-sm mt-2">
                          {crmSearch ? 'Tente ajustar sua busca' : 'Os pedidos aparecerão aqui quando os clientes realizarem compras'}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Cliente</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Descrição</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Valor</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Data</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {filteredOrders.map((order) => (
                              <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4">
                                  <div>
                                    <p className="font-medium text-gray-800">{order.customerName || 'Cliente WhatsApp'}</p>
                                    <p className="text-sm text-gray-500">{formatPhone(order.customerPhone)}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="text-sm text-gray-800">{order.description}</p>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="font-bold text-green-600">
                                    R$ {Number(order.value).toFixed(2)}
                                  </p>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="text-sm text-gray-600">{formatDate(order.createdAt)}</p>
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                                    {getStatusLabel(order.status)}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  {order.invoiceUrl && (
                                    <a
                                      href={order.invoiceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 text-sm font-medium"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                      <span>Ver Cobrança</span>
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal de Detalhes do Cliente */}
        {selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <Users className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedClient.name}</h2>
                      <p className="opacity-90 flex items-center space-x-1">
                        <Phone className="w-4 h-4" />
                        <span>{formatPhone(selectedClient.phone)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Primeiro Contato</p>
                    <p className="font-bold text-gray-800">{formatDate(selectedClient.firstContact)}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Último Contato</p>
                    <p className="font-bold text-gray-800">{formatDate(selectedClient.lastContact)}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Total de Mensagens</p>
                    <p className="font-bold text-gray-800 text-2xl">{selectedClient.messageCount}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <p className="font-bold text-green-600">Ativo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Componente Configuração do Assistente
  const AssistantConfig = () => {
    const [formData, setFormData] = useState({
      welcomeMessage: '',
      enabledFeatures: []
    });

    const availableFeatures = [
      { id: 'sales', label: 'Vendas' },
      { id: 'support', label: 'Suporte' },
      { id: 'stock', label: 'Controle de Estoque' },
      { id: 'orders', label: 'Pedidos' },
      { id: 'payments', label: 'Pagamentos' }
    ];

    useEffect(() => {
      setFormData({
        welcomeMessage: assistantSettings.welcomeMessage || '',
        enabledFeatures: assistantSettings.enabledFeatures || []
      });
    }, [assistantSettings]);

    const handleFeatureToggle = (featureId) => {
      const newFeatures = formData.enabledFeatures.includes(featureId)
        ? formData.enabledFeatures.filter(f => f !== featureId)
        : [...formData.enabledFeatures, featureId];
      
      setFormData({ ...formData, enabledFeatures: newFeatures });
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      saveAssistantSettings(formData);
    };

    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Configuração do Assistente</h2>
        
        <div className="bg-white rounded-2xl p-6 shadow-lg border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mensagem de Boas-vindas
              </label>
              <textarea
                value={formData.welcomeMessage}
                onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows="4"
                placeholder="Olá! Como posso ajudá-lo hoje?"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Funcionalidades Habilitadas
              </label>
              <div className="space-y-3">
                {availableFeatures.map((feature) => (
                  <label key={feature.id} className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.enabledFeatures.includes(feature.id)}
                      onChange={() => handleFeatureToggle(feature.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">{feature.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Salvar Configurações do Assistente
            </button>
          </form>
        </div>
      </div>
    );
  };

  // Renderização do conteúdo principal
  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'company':
        return <CompanySetup />;
      case 'catalog':
        return <Catalog />;
      case 'crm':
        return <CRM />;
      case 'integrations':
        return <Integrations />;
      case 'assistant':
        return <AssistantConfig />;
      case 'users':
        return <UsersManagement />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Mostrar erro se houver algum
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-4">
            <p className="font-bold text-lg">Erro na Aplicação</p>
            <p className="text-sm mt-2">{error}</p>
            <p className="text-xs mt-3 text-red-600">
              Se o problema persistir, verifique as configurações do Firebase.
            </p>
          </div>
          <button 
            onClick={() => {
              setError(null);
              window.location.reload();
            }} 
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Aguardar Firebase estar pronto
  if (!firebaseReady && typeof window !== 'undefined') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando sistema...</p>
          <p className="text-sm text-gray-500 mt-2">Configurando Firebase...</p>
        </div>
      </div>
    );
  }

  // Se não está autenticado, mostrar landing page
  if (!isAuthenticated) {
    return (
      <div>
        <LandingPage onLoginSuccess={handleLoginSuccess} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      </div>
    );
  }

  // Se está autenticado, mostrar dashboard
  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="ml-64">
        {renderContent()}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
};

export default WhatsAppSalesAgent;
