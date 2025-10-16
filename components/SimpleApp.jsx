'use client';

import React, { useState } from 'react';

const SimpleApp = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
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
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>✅ Completa</p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Integrações</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>⚠️ Pendente</p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Catálogo</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>📦 0 itens</p>
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
              <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="Digite o nome da sua empresa"
                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    CNPJ
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Número do WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="+55 11 99999-9999"
                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                  />
                </div>
                <button
                  type="submit"
                  style={{ backgroundColor: '#4f46e5', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Salvar Configurações
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
                style={{ backgroundColor: '#4f46e5', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
              >
                + Adicionar Item
              </button>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📦</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#6b7280', marginBottom: '8px' }}>
                  Nenhum item encontrado
                </h3>
                <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
                  Comece adicionando produtos ou serviços ao seu catálogo
                </p>
                <button
                  style={{ backgroundColor: '#4f46e5', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Criar Primeiro Item
                </button>
              </div>
            </div>
          </div>
        );
      case 'integrations':
        return (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>
              Integrações
            </h2>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⚙️</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#6b7280', marginBottom: '8px' }}>
                  Configurações de Integração
                </h3>
                <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
                  Configure APIs e integrações para automatizar seu sistema
                </p>
                <button
                  style={{ backgroundColor: '#4f46e5', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Configurar Integrações
                </button>
              </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Mensagem de Boas-vindas
                  </label>
                  <textarea
                    placeholder="Digite a mensagem de boas-vindas do seu assistente..."
                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }}
                  />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '500', color: '#374151', marginBottom: '12px' }}>
                    Recursos Habilitados
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['Atendimento Automático', 'Qualificação de Leads', 'Agendamento de Reuniões', 'Vendas por WhatsApp'].map((feature) => (
                      <label key={feature} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" style={{ width: '16px', height: '16px' }} />
                        <span style={{ color: '#374151' }}>{feature}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  style={{ backgroundColor: '#4f46e5', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Salvar Configurações
                </button>
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
                onMouseOver={(e) => {
                  if (currentPage !== item.id) {
                    e.target.style.backgroundColor = '#3730a3';
                  }
                }}
                onMouseOut={(e) => {
                  if (currentPage !== item.id) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SimpleApp;
