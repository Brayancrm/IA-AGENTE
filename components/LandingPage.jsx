'use client';

import React, { useState } from 'react';
import { LoginForm, RegisterForm } from './AuthComponents';
import { 
  Bot, 
  MessageSquare, 
  Users, 
  Zap,
  ArrowRight,
  CheckCircle,
  Star
} from 'lucide-react';

export const LandingPage = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState('login'); // 'login' ou 'register'

  const features = [
    {
      icon: <Bot className="w-8 h-8" />,
      title: "Assistente Inteligente",
      description: "IA avançada para atendimento automático no WhatsApp"
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Vendas Automáticas",
      description: "Processe pedidos e vendas diretamente pelo WhatsApp"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Gestão de Clientes",
      description: "Organize e acompanhe todos os seus clientes"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Integrações",
      description: "Conecte com sistemas de pagamento e estoque"
    }
  ];

  const benefits = [
    "Atendimento 24/7 automatizado",
    "Aumento de vendas em até 300%",
    "Redução de 80% no tempo de resposta",
    "Gestão completa de clientes",
    "Relatórios detalhados de performance"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">dadosIA</h1>
                <p className="text-sm text-gray-600">Inteligência Artificial para Vendas</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setAuthMode('login')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  authMode === 'login'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  authMode === 'register'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                Criar Conta
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <div className="flex -space-x-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Star className="w-4 h-4 text-indigo-600" />
                    </div>
                  ))}
                </div>
                <span className="text-sm text-gray-600">+1000 empresas já usam</span>
              </div>

              <h1 className="text-5xl font-bold text-gray-800 leading-tight">
                Revolucione suas{' '}
                <span className="text-indigo-600">vendas no WhatsApp</span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed">
                Transforme seu WhatsApp em uma máquina de vendas com inteligência artificial. 
                Atenda clientes 24/7, processe pedidos automaticamente e aumente suas vendas.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">O que você ganha:</h3>
              <ul className="space-y-3">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setAuthMode('register')}
                className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center space-x-2"
              >
                <span>Começar Grátis</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setAuthMode('login')}
                className="border-2 border-indigo-600 text-indigo-600 px-8 py-4 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
              >
                Já tenho conta
              </button>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="flex justify-center">
            {authMode === 'login' ? (
              <LoginForm 
                onLoginSuccess={onLoginSuccess}
                onSwitchToRegister={() => setAuthMode('register')}
              />
            ) : (
              <RegisterForm 
                onRegisterSuccess={onLoginSuccess}
                onSwitchToLogin={() => setAuthMode('login')}
              />
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Tudo que você precisa para vender mais
            </h2>
            <p className="text-lg text-gray-600">
              Recursos avançados para automatizar e otimizar suas vendas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para revolucionar suas vendas?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Junte-se a milhares de empresas que já aumentaram suas vendas com nossa IA
          </p>
          <button
            onClick={() => setAuthMode('register')}
            className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-colors flex items-center space-x-2 mx-auto"
          >
            <span>Começar Agora</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold">dadosIA</span>
          </div>
          <p className="text-gray-400">
            © 2024 dadosIA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};
