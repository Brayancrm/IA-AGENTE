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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f1419',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2rem' }}>💬</span>
          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
            WhatsApp Sales Agent
          </span>
        </div>
        <button
          onClick={() => openModal('login')}
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
      <section style={{
        paddingTop: '140px',
        paddingBottom: '80px',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '140px 40px 80px'
      }}>
        <div style={{ fontSize: '5rem', marginBottom: '24px' }}>💬</div>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #ffffff 0%, #10b981 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: '1.2'
        }}>
          Transforme seu WhatsApp em<br />uma Máquina de Vendas
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: '#9ca3af',
          marginBottom: '40px',
          maxWidth: '700px',
          margin: '0 auto 40px',
          lineHeight: '1.6'
        }}>
          Automatize atendimentos, gerencie conversas e venda mais com inteligência artificial integrada ao seu WhatsApp
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => openModal('register')}
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
      <section style={{
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
      <section style={{
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

      {/* Stats Section */}
      <section style={{
        padding: '80px 40px',
        backgroundColor: '#1a1f36',
        borderTop: '1px solid rgba(16, 185, 129, 0.2)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          textAlign: 'center'
        }}>
          {[
            { number: '10k+', label: 'Mensagens/dia' },
            { number: '500+', label: 'Empresas' },
            { number: '95%', label: 'Satisfação' },
            { number: '24/7', label: 'Atendimento' }
          ].map((stat, index) => (
            <div key={index}>
              <div style={{
                fontSize: '3rem',
                fontWeight: '800',
                color: '#10b981',
                marginBottom: '8px'
              }}>
                {stat.number}
              </div>
              <div style={{ fontSize: '1.125rem', color: '#9ca3af' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final Section */}
      <section style={{
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
          onClick={() => openModal('register')}
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
                fontSize: '4rem', 
                marginBottom: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                💬
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
    </div>
  );
};

export default SimpleLanding;
