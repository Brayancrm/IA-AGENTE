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
  const [isActive, setIsActive] = useState(true);

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
    </div>
  );
};

export default FirebaseApp;
