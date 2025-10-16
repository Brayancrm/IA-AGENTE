'use client';

import React, { useState } from 'react';

const LandingPageSimple = ({ onLoginSuccess }) => {
  const [showLogin, setShowLogin] = useState(true);

  const handleDemoLogin = () => {
    // Simular login para teste
    onLoginSuccess();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #ec4899 100%)',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: 'bold',
            marginBottom: '24px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>
            WhatsApp Sales Agent
          </h1>
          <p style={{
            fontSize: '1.25rem',
            color: '#d1d5db',
            marginBottom: '32px',
            maxWidth: '800px',
            margin: '0 auto 32px auto',
            lineHeight: '1.6'
          }}>
            Sistema completo de gestão de vendas via WhatsApp com IA integrada. 
            Automatize seu atendimento e maximize suas vendas.
          </p>
          
          <div style={{ marginBottom: '48px' }}>
            <button
              onClick={handleDemoLogin}
              style={{
                backgroundColor: 'white',
                color: '#1e3a8a',
                padding: '16px 32px',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '1.125rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'white'}
            >
              🚀 Testar Sistema
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          maxWidth: '1000px',
          margin: '0 auto'
        }}>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🤖</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>IA Integrada</h3>
            <p style={{ color: '#d1d5db', lineHeight: '1.5' }}>
              Assistentes inteligentes que respondem automaticamente e qualificam leads
            </p>
          </div>
          
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📊</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>Dashboard Completo</h3>
            <p style={{ color: '#d1d5db', lineHeight: '1.5' }}>
              Acompanhe vendas, leads e performance em tempo real
            </p>
          </div>
          
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚡</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>Automação Total</h3>
            <p style={{ color: '#d1d5db', lineHeight: '1.5' }}>
              Fluxos automatizados para todo o funil de vendas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPageSimple;
