'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase } from '../hooks/useFirebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import LandingPageSimple from './LandingPageSimple';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsapp-sales-agent';

const FirebaseApp = () => {
  const { app, db, auth, isReady, error } = useFirebase();
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

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const isMaster = currentUser.email?.includes('master') || 
                        currentUser.email?.includes('admin') ||
                        currentUser.email === 'brayan@master.com';
        
        setUser({ ...currentUser, isMaster });
        setIsAuthenticated(true);
        setupFirestoreListeners();
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, isReady]);

  // Configurar listeners do Firestore
  const setupFirestoreListeners = () => {
    if (!user || !db) return;

    const userId = user.uid;

    // Listener para perfil da empresa
    const companyRef = doc(db, `artifacts/${APP_ID}/users/${userId}/company_profile/config`);
    onSnapshot(companyRef, (doc) => {
      if (doc.exists()) {
        setCompanyProfile(doc.data());
      }
    });

    // Listener para configurações de integração
    const integrationsRef = doc(db, `artifacts/${APP_ID}/users/${userId}/integrations_config/config`);
    onSnapshot(integrationsRef, (doc) => {
      if (doc.exists()) {
        setIntegrationsConfig(doc.data());
      }
    });

    // Listener para configurações do assistente
    const assistantRef = doc(db, `artifacts/${APP_ID}/users/${userId}/assistant_settings/config`);
    onSnapshot(assistantRef, (doc) => {
      if (doc.exists()) {
        setAssistantSettings(doc.data());
      }
    });

    // Listener para itens do catálogo
    const catalogRef = collection(db, `artifacts/${APP_ID}/users/${userId}/company_profile/config/catalog_items`);
    const catalogQuery = query(catalogRef, orderBy('createdAt', 'desc'));
    onSnapshot(catalogQuery, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setCatalogItems(items);
    });
  };

  // Funções de salvamento
  const saveCompanyProfile = async (data) => {
    if (!user || !db) return;
    
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/company_profile/config`), data, { merge: true });
      showToast('Perfil da empresa salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      showToast('Erro ao salvar perfil da empresa', 'error');
    }
  };

  const saveIntegrationsConfig = async (data) => {
    if (!user || !db) return;
    
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/integrations_config/config`), data, { merge: true });
      showToast('Configurações de integração salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar integrações:', error);
      showToast('Erro ao salvar configurações', 'error');
    }
  };

  const saveAssistantSettings = async (data) => {
    if (!user || !db) return;
    
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/assistant_settings/config`), data, { merge: true });
      showToast('Configurações do assistente salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar assistente:', error);
      showToast('Erro ao salvar configurações', 'error');
    }
  };

  const saveCatalogItem = async (itemData) => {
    if (!user || !db) return;
    
    try {
      const data = {
        ...itemData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/company_profile/config/catalog_items`), data);
      showToast('Item adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      showToast('Erro ao salvar item', 'error');
    }
  };

  const handleLogout = () => {
    if (auth) {
      auth.signOut();
    }
    setUser(null);
    setIsAuthenticated(false);
    showToast('Logout realizado com sucesso!', 'success');
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
        <LandingPageSimple onLoginSuccess={() => setIsAuthenticated(true)} />
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
        saveCompanyProfile={saveCompanyProfile}
        saveIntegrationsConfig={saveIntegrationsConfig}
        saveAssistantSettings={saveAssistantSettings}
        saveCatalogItem={saveCatalogItem}
        handleLogout={handleLogout}
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
  saveCompanyProfile,
  saveIntegrationsConfig,
  saveAssistantSettings,
  saveCatalogItem,
  handleLogout
}) => {
  const [isActive, setIsActive] = useState(assistantSettings.isActive || true);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [catalogForm, setCatalogForm] = useState({
    name: '',
    description: '',
    price: '',
    stockQuantity: '',
    type: 'product'
  });
  const [companyForm, setCompanyForm] = useState({
    companyName: '',
    cnpj: '',
    whatsappNumber: ''
  });
  const [integrationsForm, setIntegrationsForm] = useState({
    openaiApiKey: '',
    asaasApiKey: '',
    municipalRegistration: ''
  });
  const [assistantForm, setAssistantForm] = useState({
    welcomeMessage: '',
    enabledFeatures: []
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
      welcomeMessage: assistantSettings.welcomeMessage || '',
      enabledFeatures: assistantSettings.enabledFeatures || []
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
        type: item.type || 'product'
      });
      setEditingItem(item);
    } else {
      setCatalogForm({
        name: '',
        description: '',
        price: '',
        stockQuantity: '',
        type: 'product'
      });
      setEditingItem(null);
    }
    setShowCatalogModal(true);
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
    saveAssistantSettings({
      ...assistantForm,
      isActive: isActive
    });
  };

  const handleFeatureToggle = (feature) => {
    setAssistantForm(prev => ({
      ...prev,
      enabledFeatures: prev.enabledFeatures.includes(feature)
        ? prev.enabledFeatures.filter(f => f !== feature)
        : [...prev.enabledFeatures, feature]
    }));
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>
              Dashboard
            </h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                  Status do Sistema
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span style={{ color: '#6b7280' }}>Assistente Ativo</span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Configuração da Empresa</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {companyProfile.companyName ? '✅ Completa' : '⚠️ Pendente'}
                  </p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Integrações</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {integrationsConfig.openaiApiKey ? '✅ Configurado' : '⚠️ Pendente'}
                  </p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Catálogo</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    📦 {catalogItems.length} itens
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'company':
        return (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>
              Cadastro da Empresa
            </h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <form onSubmit={handleCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={companyForm.companyName}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, companyName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem'
                    }}
                    placeholder="Digite o nome da sua empresa"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, cnpj: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem'
                    }}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    Número do WhatsApp
                  </label>
                  <input
                    type="text"
                    value={companyForm.whatsappNumber}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem'
                    }}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    alignSelf: 'flex-start'
                  }}
                >
                  Salvar Perfil
                </button>
              </form>
            </div>
          </div>
        );

      case 'catalog':
        return (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
                Catálogo (Itens)
              </h2>
              <button
                onClick={() => openCatalogModal()}
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
                + Adicionar Item
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {catalogItems.map((item) => (
                <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <h3 style={{ fontWeight: 'bold', color: '#1f2937' }}>{item.name}</h3>
                    <span style={{
                      backgroundColor: item.type === 'product' ? '#dcfce7' : '#dbeafe',
                      color: item.type === 'product' ? '#166534' : '#1e40af',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {item.type === 'product' ? 'Produto' : 'Serviço'}
                    </span>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '12px' }}>
                    {item.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#059669' }}>
                      R$ {parseFloat(item.price || 0).toFixed(2)}
                    </span>
                    <button
                      onClick={() => openCatalogModal(item)}
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
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
                    {item.type === 'product' ? 'Estoque' : 'Capacidade'}: {item.stockQuantity}
                  </div>
                </div>
              ))}
            </div>

            {catalogItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>Nenhum item no catálogo</p>
                <p style={{ fontSize: '0.875rem' }}>Adicione seu primeiro item clicando no botão acima</p>
              </div>
            )}
          </div>
        );

      case 'integrations':
        return (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>
              Integrações
            </h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <form onSubmit={handleIntegrationsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
                    🤖 OpenAI API
                  </h3>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={integrationsForm.openaiApiKey}
                      onChange={(e) => setIntegrationsForm(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '1rem'
                      }}
                      placeholder="sk-..."
                    />
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
                    💳 Asaas
                  </h3>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={integrationsForm.asaasApiKey}
                      onChange={(e) => setIntegrationsForm(prev => ({ ...prev, asaasApiKey: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '1rem'
                      }}
                      placeholder="asaas_api_key"
                    />
                  </div>
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      Webhook URL
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={`https://your-api.com/webhook/${user?.uid}`}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.875rem',
                          backgroundColor: '#f9fafb'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://your-api.com/webhook/${user?.uid}`);
                          alert('URL copiada para a área de transferência!');
                        }}
                        style={{
                          backgroundColor: '#6b7280',
                          color: 'white',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
                    📋 Fiscal
                  </h3>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      Inscrição Municipal
                    </label>
                    <input
                      type="text"
                      value={integrationsForm.municipalRegistration}
                      onChange={(e) => setIntegrationsForm(prev => ({ ...prev, municipalRegistration: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '1rem'
                      }}
                      placeholder="12345678"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    alignSelf: 'flex-start'
                  }}
                >
                  Salvar Configurações
                </button>
              </form>
            </div>
          </div>
        );

      case 'assistant':
        return (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>
              Configuração do Assistente
            </h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <form onSubmit={handleAssistantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    Mensagem de Boas-vindas
                  </label>
                  <textarea
                    value={assistantForm.welcomeMessage}
                    onChange={(e) => setAssistantForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '1rem',
                      minHeight: '100px',
                      resize: 'vertical'
                    }}
                    placeholder="Olá! Como posso ajudá-lo hoje?"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '16px', color: '#374151' }}>
                    Funcionalidades Habilitadas
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { id: 'sales', label: 'Vendas', description: 'Processar pedidos e vendas' },
                      { id: 'support', label: 'Suporte', description: 'Atendimento ao cliente' },
                      { id: 'stock', label: 'Estoque', description: 'Consultar disponibilidade' },
                      { id: 'pricing', label: 'Preços', description: 'Informar valores' },
                      { id: 'schedule', label: 'Agendamento', description: 'Agendar serviços' }
                    ].map((feature) => (
                      <label key={feature.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <input
                          type="checkbox"
                          checked={assistantForm.enabledFeatures.includes(feature.id)}
                          onChange={() => handleFeatureToggle(feature.id)}
                          style={{ width: '20px', height: '20px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{feature.label}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{feature.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    alignSelf: 'flex-start'
                  }}
                >
                  Salvar Configurações
                </button>
              </form>
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
    { id: 'integrations', label: 'Integrações', icon: '⚙️' },
    { id: 'assistant', label: 'Configuração do Assistente', icon: '🤖' }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: '256px', backgroundColor: '#1e3a8a', color: 'white', padding: '24px' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '24px' }}>
            WhatsApp Sales Agent
          </h1>
          {user?.isMaster && (
            <div style={{ backgroundColor: '#fbbf24', color: '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
              👑 USUÁRIO MASTER
            </div>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: currentPage === item.id ? '#3730a3' : 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.875rem'
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #3730a3' }}>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '8px' }}>
              Logado como: {user?.email}
            </p>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                backgroundColor: '#dc2626',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Sair
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
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
    </div>
  );
};

export default FirebaseApp;
