'use client';

import React, { useState, useEffect } from 'react';
import { 
  initializeApp
} from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  getAuth,
  signInWithCustomToken
} from 'firebase/auth';
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
  EyeOff
} from 'lucide-react';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializar Firebase apenas se as variáveis estiverem disponíveis
let app, db, auth;
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

// Configurações do app
const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsapp-sales-agent';

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
    type: 'product'
  });

  // Inicialização
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Para desenvolvimento local, você pode usar um token de teste
      // Em produção, configure a autenticação apropriada
      if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_TOKEN) {
        await signInWithCustomToken(auth, process.env.NEXT_PUBLIC_FIREBASE_AUTH_TOKEN);
      }
      const currentUser = auth.currentUser;
      setUser(currentUser);
      setupFirestoreListeners();
    } catch (error) {
      console.error('Erro na autenticação:', error);
      setToast({ message: 'Erro na autenticação', type: 'error' });
      // Para desenvolvimento, continuar sem autenticação
      setUser({ uid: 'demo-user' });
      setupFirestoreListeners();
    } finally {
      setLoading(false);
    }
  };

  const setupFirestoreListeners = () => {
    if (!user) return;

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

  // Funções de dados
  const saveCompanyProfile = async (data) => {
    try {
      const userId = user.uid;
      const appId = APP_ID;
      await setDoc(doc(db, `artifacts/${appId}/users/${userId}/company_profile/config`), data, { merge: true });
      showToast('Perfil da empresa salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      showToast('Erro ao salvar perfil da empresa', 'error');
    }
  };

  const saveIntegrationsConfig = async (data) => {
    try {
      const userId = user.uid;
      const appId = APP_ID;
      await setDoc(doc(db, `artifacts/${appId}/users/${userId}/integrations_config/config`), data, { merge: true });
      showToast('Configurações de integração salvas!');
    } catch (error) {
      console.error('Erro ao salvar integrações:', error);
      showToast('Erro ao salvar configurações', 'error');
    }
  };

  const saveAssistantSettings = async (data) => {
    try {
      const userId = user.uid;
      const appId = APP_ID;
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
      const userId = user.uid;
      const appId = APP_ID;
      const itemToSave = {
        ...itemData,
        price: parseFloat(itemData.price),
        stockQuantity: parseInt(itemData.stockQuantity),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingItem) {
        // Atualizar item existente
        await updateDoc(
          doc(db, `artifacts/${appId}/users/${userId}/company_profile/config/catalog_items/${editingItem.id}`),
          { ...itemToSave, updatedAt: new Date().toISOString() }
        );
        showToast('Item atualizado com sucesso!');
      } else {
        // Criar novo item
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/company_profile/config/catalog_items`), itemToSave);
        showToast('Item adicionado com sucesso!');
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
      const userId = user.uid;
      const appId = APP_ID;
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/company_profile/config/catalog_items/${itemId}`));
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

  // Componente Sidebar
  const Sidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'company', label: 'Cadastro da Empresa', icon: Building2 },
      { id: 'catalog', label: 'Catálogo (Itens)', icon: Package },
      { id: 'integrations', label: 'Integrações', icon: Settings },
      { id: 'assistant', label: 'Configuração do Assistente', icon: Bot }
    ];

    return (
      <div className="w-64 bg-indigo-900 text-white min-h-screen fixed left-0 top-0 overflow-y-auto">
        <div className="p-6">
          <h1 className="text-xl font-bold mb-8">WhatsApp Sales Agent</h1>
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
        </div>
      </div>
    );
  };

  // Componente Dashboard
  const Dashboard = () => {
    const isCompanyConfigured = companyProfile.companyName && companyProfile.cnpj && companyProfile.whatsappNumber;
    const isCatalogConfigured = catalogItems.length > 0;
    const isIntegrationsConfigured = integrationsConfig.asaasConfig || integrationsConfig.fiscalConfig;
    const isAssistantConfigured = assistantSettings.welcomeMessage && assistantSettings.enabledFeatures?.length > 0;

    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h2>
        
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
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
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
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
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

  // Componente Catálogo
  const Catalog = () => {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Catálogo (Itens)</h2>
          <button
            onClick={() => openCatalogModal()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Adicionar Item</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
          {catalogItems.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-600 mb-2">Nenhum item no catálogo</h3>
              <p className="text-gray-500 mb-6">Comece adicionando produtos ou serviços ao seu catálogo</p>
              <button
                onClick={() => openCatalogModal()}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Adicionar Primeiro Item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Nome</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Tipo</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Preço</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Estoque/Capacidade</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {catalogItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{item.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          item.type === 'product' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.type === 'product' ? 'Produto' : 'Serviço'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        R$ {item.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {item.stockQuantity}
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
          )}
        </div>

        {/* Modal do Catálogo */}
        {showCatalogModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-bold text-gray-800 mb-6">
                {editingItem ? 'Editar Item' : 'Adicionar Item'}
              </h3>
              
              <form onSubmit={(e) => { e.preventDefault(); saveCatalogItem(catalogForm); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                  <input
                    type="text"
                    value={catalogForm.name}
                    onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                  <textarea
                    value={catalogForm.description}
                    onChange={(e) => setCatalogForm({ ...catalogForm, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="product"
                        checked={catalogForm.type === 'product'}
                        onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })}
                        className="mr-2"
                      />
                      Produto
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="service"
                        checked={catalogForm.type === 'service'}
                        onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })}
                        className="mr-2"
                      />
                      Serviço
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={catalogForm.price}
                    onChange={(e) => setCatalogForm({ ...catalogForm, price: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {catalogForm.type === 'product' ? 'Qtd. em Estoque' : 'Capacidade/Horas (Simulado)'}
                  </label>
                  <input
                    type="number"
                    value={catalogForm.stockQuantity}
                    onChange={(e) => setCatalogForm({ ...catalogForm, stockQuantity: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCatalogModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                  >
                    {editingItem ? 'Atualizar' : 'Adicionar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Componente Integrações
  const Integrations = () => {
    const [activeTab, setActiveTab] = useState('asaas');
    const [asaasConfig, setAsaasConfig] = useState({
      asaasApiKey: ''
    });
    const [fiscalConfig, setFiscalConfig] = useState({
      municipalRegistration: ''
    });

    useEffect(() => {
      setAsaasConfig(integrationsConfig.asaasConfig || { asaasApiKey: '' });
      setFiscalConfig(integrationsConfig.fiscalConfig || { municipalRegistration: '' });
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

    const webhookUrl = `https://your-api.com/webhook/${user?.uid}`;

    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Integrações</h2>
        
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
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Configuração Fiscal</h3>
                  <div className="space-y-4">
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
                      />
                    </div>

                    <button
                      onClick={saveFiscalConfig}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Salvar Configuração Fiscal
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
      case 'integrations':
        return <Integrations />;
      case 'assistant':
        return <AssistantConfig />;
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
