'use client';

import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, push, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: 'https://ia-agente-b2f46.firebaseio.com'
};

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsappsalesagent';

let app, db, auth, database;
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  database = getDatabase(app);
}

const SimpleLanding = ({ onLoginSuccess }) => {
  const [showModal, setShowModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [mode, setMode] = useState('login'); // 'login' ou 'register'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        // Registrar usuário
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Salvar dados adicionais no Realtime Database
        if (database) {
          const userData = {
            name: formData.name,
            email: formData.email,
            companyName: formData.companyName,
            uid: userCredential.user.uid,
            isActive: true,
            isMaster: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            registeredVia: 'landing_page'
          };

          console.log('Salvando usuário no Realtime Database:', userData);
          
          const usersRef = ref(database, 'users/registered');
          const newUserRef = push(usersRef);
          await set(newUserRef, userData);
          
          console.log('Usuário salvo no Realtime Database com ID:', newUserRef.key);
        }
        
        onLoginSuccess();
      } else {
        // Login
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        onLoginSuccess();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
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
          Escolha o Plano Ideal
        </h2>
        <p style={{
          fontSize: '1.125rem',
          color: '#9ca3af',
          textAlign: 'center',
          marginBottom: '60px'
        }}>
          Planos flexíveis para empresas de todos os tamanhos
        </p>

        <div 
          className="pricing-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '24px',
            maxWidth: '1600px',
            margin: '0 auto',
            padding: '0 20px'
          }}
        >
          {/* Teste Gratuito */}
          <div style={{
            backgroundColor: '#1a1f36',
            padding: '40px',
            borderRadius: '20px',
            border: '3px solid #10b981',
            position: 'relative',
            transition: 'all 0.3s ease',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px)';
            e.currentTarget.style.boxShadow = '0 16px 40px rgba(16, 185, 129, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
          }}>
            {/* Badge GRÁTIS */}
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
              GRÁTIS
            </div>

            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                Teste Gratuito
              </h3>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '3rem', fontWeight: '800', color: '#10b981' }}>24h</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Acesso total sem compromisso</div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px' }}>
              {[
                'Acesso completo a todos recursos',
                'Teste todas as funcionalidades',
                'Sem cartão de crédito',
                'Sem compromisso',
                'Suporte técnico incluído',
                'Upgrade fácil após teste'
              ].map((feature, idx) => (
                <li key={idx} style={{ 
                  padding: '12px 0', 
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: idx < 5 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                  <span style={{ color: '#10b981', fontSize: '1.25rem' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

          <button
              onClick={() => handleSelectPlan('teste-gratuito')}
            style={{
              width: '100%',
                padding: '14px',
              borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: '700',
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
              🚀 Começar Teste Grátis
          </button>
        </div>

          {/* Plano Básico */}
        <div style={{
            backgroundColor: '#1a1f36',
            padding: '40px',
            borderRadius: '20px',
            border: '2px solid rgba(16, 185, 129, 0.2)',
            position: 'relative',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px)';
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                Básico
              </h3>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '3rem', fontWeight: '800', color: '#10b981' }}>R$ 399</span>
                <span style={{ fontSize: '1.25rem', color: '#9ca3af' }}>,90</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>por mês</div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px' }}>
              {[
                'Até 500 conversas/mês',
                '1 atendente simultâneo',
                'Catálogo de produtos',
                'Respostas automáticas',
                'Relatórios básicos',
                'Suporte por email'
              ].map((feature, idx) => (
                <li key={idx} style={{ 
                  padding: '12px 0', 
                  color: '#9ca3af',
          display: 'flex',
          alignItems: 'center',
                  gap: '12px',
                  borderBottom: idx < 5 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                  <span style={{ color: '#10b981', fontSize: '1.25rem' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan('basico')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '2px solid #10b981',
                backgroundColor: 'transparent',
                color: '#10b981',
                fontSize: '1rem',
                fontWeight: '700',
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
              Começar Agora
            </button>
          </div>

          {/* Plano Pro (Destaque) */}
          <div style={{
            backgroundColor: '#1a1f36',
            padding: '40px',
            borderRadius: '20px',
            border: '3px solid #10b981',
            position: 'relative',
            transition: 'all 0.3s ease',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px)';
            e.currentTarget.style.boxShadow = '0 16px 40px rgba(16, 185, 129, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
          }}>
            {/* Badge Popular */}
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
              MAIS POPULAR
            </div>

            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                Pro
              </h3>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '3rem', fontWeight: '800', color: '#10b981' }}>R$ 1.099</span>
                <span style={{ fontSize: '1.25rem', color: '#9ca3af' }}>,90</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>por mês</div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px' }}>
              {[
                'Conversas ilimitadas',
                '5 atendentes simultâneos',
                'Tudo do Básico +',
                'IA conversacional avançada',
                'Agendamentos automáticos',
                'Integração com pagamentos',
                'Relatórios avançados',
                'Suporte prioritário'
              ].map((feature, idx) => (
                <li key={idx} style={{ 
                  padding: '12px 0', 
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: idx < 7 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                  <span style={{ color: '#10b981', fontSize: '1.25rem' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan('pro')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: '700',
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
              Começar Agora
            </button>
          </div>

          {/* Plano Enterprise */}
          <div style={{
            backgroundColor: '#1a1f36',
            padding: '40px',
            borderRadius: '20px',
            border: '2px solid rgba(16, 185, 129, 0.2)',
            position: 'relative',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px)';
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px' }}>
                Enterprise
              </h3>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '3rem', fontWeight: '800', color: '#10b981' }}>R$ 1.999</span>
                <span style={{ fontSize: '1.25rem', color: '#9ca3af' }}>,90</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>por mês</div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px' }}>
              {[
                'Tudo ilimitado',
                'Atendentes ilimitados',
                'Tudo do Pro +',
                'API dedicada',
                'Customizações personalizadas',
                'Gerente de conta dedicado',
                'Treinamento da equipe',
                'Suporte 24/7 prioritário'
              ].map((feature, idx) => (
                <li key={idx} style={{ 
                  padding: '12px 0', 
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: idx < 7 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                  <span style={{ color: '#10b981', fontSize: '1.25rem' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan('enterprise')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '2px solid #10b981',
                backgroundColor: 'transparent',
                color: '#10b981',
                fontSize: '1rem',
                fontWeight: '700',
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
              Começar Agora
            </button>
          </div>
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
        <p>© 2025 WhatsApp Sales Agent. Todos os direitos reservados.</p>
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
          {mode === 'register' && (
                <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Nome completo"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
          )}

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

          {mode === 'register' && (
                <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                    placeholder="Nome da empresa (opcional)"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
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
                Escolha seu Plano
              </h2>
              <p style={{
                fontSize: '1.125rem',
                color: '#9ca3af'
              }}>
                Selecione o plano ideal para sua empresa
              </p>
            </div>

            {/* Cards de Planos */}
            <div 
              className="modal-plan-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '20px'
              }}
            >
              {/* Teste Gratuito */}
              <div
                onClick={() => handleSelectPlan('teste-gratuito')}
                style={{
                  backgroundColor: '#0f1419',
                  padding: '32px',
                  borderRadius: '16px',
                  border: '3px solid #10b981',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 16px 40px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
                }}
              >
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
                  GRÁTIS
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px', textAlign: 'center' }}>
                  Teste Gratuito
                </h3>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div>
                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>24 horas</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '8px' }}>
                    Acesso total sem compromisso
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
                  {['Acesso completo', 'Todos os recursos', 'Sem cartão de crédito', 'Sem compromisso', 'Suporte incluído'].map((item, idx) => (
                    <li key={idx} style={{ padding: '8px 0', color: '#ffffff', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#10b981' }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div style={{
                  textAlign: 'center',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  🚀 Começar Teste Grátis
                </div>
              </div>

              {/* Plano Básico */}
              <div
                onClick={() => handleSelectPlan('basico')}
                style={{
                  backgroundColor: '#0f1419',
                  padding: '32px',
                  borderRadius: '16px',
                  border: '2px solid rgba(16, 185, 129, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px', textAlign: 'center' }}>
                  Básico
                </h3>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div>
                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>R$ 399</span>
                    <span style={{ fontSize: '1rem', color: '#9ca3af' }}>,90/mês</span>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
                  {['500 conversas/mês', '1 atendente', 'Catálogo básico', 'Suporte email'].map((item, idx) => (
                    <li key={idx} style={{ padding: '8px 0', color: '#9ca3af', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#10b981' }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '8px',
                  color: '#10b981',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  Clique para selecionar
                </div>
              </div>

              {/* Plano Pro */}
              <div
                onClick={() => handleSelectPlan('pro')}
                style={{
                  backgroundColor: '#0f1419',
                  padding: '32px',
                  borderRadius: '16px',
                  border: '3px solid #10b981',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 16px 40px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
                }}
              >
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
                  POPULAR
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px', textAlign: 'center' }}>
                  Pro
                </h3>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div>
                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>R$ 1.099</span>
                    <span style={{ fontSize: '1rem', color: '#9ca3af' }}>,90/mês</span>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
                  {['Conversas ilimitadas', '5 atendentes', 'IA avançada', 'Pagamentos', 'Suporte prioritário'].map((item, idx) => (
                    <li key={idx} style={{ padding: '8px 0', color: '#ffffff', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#10b981' }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div style={{
                  textAlign: 'center',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  Clique para selecionar
                </div>
              </div>

              {/* Plano Enterprise */}
              <div
                onClick={() => handleSelectPlan('enterprise')}
                style={{
                  backgroundColor: '#0f1419',
                  padding: '32px',
                  borderRadius: '16px',
                  border: '2px solid rgba(16, 185, 129, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '16px', textAlign: 'center' }}>
                  Enterprise
                </h3>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div>
                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>R$ 1.999</span>
                    <span style={{ fontSize: '1rem', color: '#9ca3af' }}>,90/mês</span>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
                  {['Tudo ilimitado', 'API dedicada', 'Customizações', 'Gerente de conta', 'Suporte 24/7'].map((item, idx) => (
                    <li key={idx} style={{ padding: '8px 0', color: '#9ca3af', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#10b981' }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '8px',
                  color: '#10b981',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  Clique para selecionar
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default SimpleLanding;
