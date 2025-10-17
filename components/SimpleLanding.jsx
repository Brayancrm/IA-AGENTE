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
          
          const usersRef = ref(database, `artifacts/${APP_ID}/registered_users`);
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

  const handleDemoLogin = () => {
    // Para teste rápido - simular login como master
    onLoginSuccess();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #ec4899 100%)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            marginBottom: '16px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>
            WhatsApp Sales Agent
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: '#d1d5db',
            lineHeight: '1.6'
          }}>
            Sistema completo de gestão de vendas via WhatsApp
          </p>
        </div>

        {/* Botão de Demo */}
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={handleDemoLogin}
            style={{
              width: '100%',
              backgroundColor: 'white',
              color: '#1e3a8a',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '1.125rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            🚀 Acessar Demo (Master)
          </button>
        </div>

        {/* Divisor */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '32px 0',
          color: '#d1d5db'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }}></div>
          <span style={{ margin: '0 16px', fontSize: '0.875rem' }}>OU</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }}></div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Nome completo"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.3)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              placeholder="Senha"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              required
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.3)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Nome da empresa"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
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
              backgroundColor: '#4f46e5',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '1.125rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            {loading ? 'Carregando...' : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        {/* Toggle entre Login/Register */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{
              backgroundColor: 'transparent',
              color: '#d1d5db',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              textDecoration: 'underline'
            }}
          >
            {mode === 'login' 
              ? 'Não tem conta? Criar conta' 
              : 'Já tem conta? Fazer login'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimpleLanding;
