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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f1419',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1f36',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
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
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            marginBottom: '12px',
            color: '#ffffff'
          }}>
            WhatsApp Sales Agent
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#9ca3af',
            lineHeight: '1.6'
          }}>
            Sistema completo de gestão de vendas via WhatsApp
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
                placeholder="Nome da empresa"
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
            {loading ? 'Carregando...' : (mode === 'login' ? '🚀 Entrar' : '✨ Criar Conta')}
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
  );
};

export default SimpleLanding;
