'use client';

import React, { useState } from 'react';

const LandingPageSimple = ({ onLoginSuccess }) => {
  const [showLogin, setShowLogin] = useState(true);

  const handleDemoLogin = () => {
    // Simular login para teste
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-6">
            WhatsApp Sales Agent
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Sistema completo de gestão de vendas via WhatsApp com IA integrada. 
            Automatize seu atendimento e maximize suas vendas.
          </p>
          
          <div className="flex justify-center space-x-4 mb-12">
            <button
              onClick={handleDemoLogin}
              className="bg-white text-indigo-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
            >
              🚀 Testar Sistema
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-white mb-3">IA Integrada</h3>
            <p className="text-gray-300">
              Assistentes inteligentes que respondem automaticamente e qualificam leads
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-3">Dashboard Completo</h3>
            <p className="text-gray-300">
              Acompanhe vendas, leads e performance em tempo real
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-white mb-3">Automação Total</h3>
            <p className="text-gray-300">
              Fluxos automatizados para todo o funil de vendas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPageSimple;
