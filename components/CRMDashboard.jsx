'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag,
  Phone,
  Mail,
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronRight,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const CRMDashboard = ({ user, database, showToast }) => {
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [conversas, setConversas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dateFilter, setDateFilter] = useState('todos'); // hoje, semana, mes, todos
  
  // Estados para modais
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState(null);
  
  // Carregar dados do CRM
  useEffect(() => {
    if (user?.uid && database) {
      loadCRMData();
    }
  }, [user, database]);
  
  const loadCRMData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClientes(),
        loadPedidos(),
        loadConversas()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do CRM:', error);
      showToast('Erro ao carregar dados do CRM', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const loadClientes = async () => {
    const { ref, onValue } = await import('firebase/database');
    const customerDataRef = ref(database, `customerData/${user.uid}`);
    
    return new Promise((resolve) => {
      onValue(customerDataRef, (snapshot) => {
        const clientesList = [];
        if (snapshot.exists()) {
          const data = snapshot.val();
          Object.keys(data).forEach(phone => {
            const cliente = data[phone];
            clientesList.push({
              id: phone,
              phone: phone,
              name: cliente.name || 'Sem nome',
              email: cliente.email || '',
              cpfCnpj: cliente.cpfCnpj || '',
              updatedAt: cliente.updatedAt || new Date().toISOString(),
              status: 'lead' // lead, cliente, inativo
            });
          });
        }
        setClientes(clientesList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        resolve();
      }, { onlyOnce: true });
    });
  };
  
  const loadPedidos = async () => {
    const { ref, onValue } = await import('firebase/database');
    const ordersRef = ref(database, `orders/${user.uid}`);
    
    return new Promise((resolve) => {
      onValue(ordersRef, (snapshot) => {
        const pedidosList = [];
        if (snapshot.exists()) {
          const data = snapshot.val();
          Object.keys(data).forEach(orderId => {
            const pedido = data[orderId];
            pedidosList.push({
              id: orderId,
              ...pedido
            });
          });
        }
        setPedidos(pedidosList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        resolve();
      }, { onlyOnce: true });
    });
  };
  
  const loadConversas = async () => {
    const { ref, onValue } = await import('firebase/database');
    const conversationsRef = ref(database, `conversations/${user.uid}`);
    
    return new Promise((resolve) => {
      onValue(conversationsRef, (snapshot) => {
        const conversasList = [];
        if (snapshot.exists()) {
          const data = snapshot.val();
          Object.keys(data).forEach(contactNumber => {
            const messages = data[contactNumber]?.messages || {};
            const messageArray = Object.values(messages);
            
            conversasList.push({
              id: contactNumber,
              phone: contactNumber,
              messageCount: messageArray.length,
              lastMessage: messageArray[messageArray.length - 1],
              firstMessage: messageArray[0]
            });
          });
        }
        setConversas(conversasList);
        resolve();
      }, { onlyOnce: true });
    });
  };
  
  // Calcular métricas
  const calcularMetricas = () => {
    const totalClientes = clientes.length;
    const totalPedidos = pedidos.length;
    const totalFaturamento = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
    const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
    
    // Novos clientes (últimos 7 dias)
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const novosClientes = clientes.filter(c => new Date(c.updatedAt) >= seteDiasAtras).length;
    
    // Pedidos pendentes
    const pedidosPendentes = pedidos.filter(p => p.status === 'PENDING').length;
    
    // Taxa de conversão
    const taxaConversao = totalClientes > 0 ? (totalPedidos / totalClientes * 100) : 0;
    
    return {
      totalClientes,
      novosClientes,
      totalPedidos,
      pedidosPendentes,
      totalFaturamento,
      ticketMedio,
      taxaConversao
    };
  };
  
  const metricas = calcularMetricas();
  
  // Filtrar clientes
  const clientesFiltrados = clientes.filter(cliente => {
    const matchSearch = searchQuery === '' || 
      cliente.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cliente.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cliente.phone.includes(searchQuery);
    
    const matchStatus = statusFilter === 'todos' || cliente.status === statusFilter;
    
    return matchSearch && matchStatus;
  });
  
  // Componente: Visão Geral
  const VisaoGeral = () => (
    <div className="crm-visao-geral">
      {/* Cards de Métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Total de Clientes */}
        <div style={{
          backgroundColor: '#1a1f36',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          transition: 'all 0.3s ease'
        }}
        className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={24} color="#fff" />
            </div>
            <span style={{ 
              fontSize: '0.875rem', 
              color: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontWeight: '600'
            }}>
              +{metricas.novosClientes} novos
            </span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
            {metricas.totalClientes}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Total de Clientes
          </div>
        </div>
        
        {/* Total de Pedidos */}
        <div style={{
          backgroundColor: '#1a1f36',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          transition: 'all 0.3s ease'
        }}
        className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShoppingBag size={24} color="#fff" />
            </div>
            <span style={{ 
              fontSize: '0.875rem', 
              color: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontWeight: '600'
            }}>
              {metricas.pedidosPendentes} pendentes
            </span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
            {metricas.totalPedidos}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Total de Pedidos
          </div>
        </div>
        
        {/* Faturamento Total */}
        <div style={{
          backgroundColor: '#1a1f36',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          transition: 'all 0.3s ease'
        }}
        className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DollarSign size={24} color="#fff" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
            R$ {metricas.totalFaturamento.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Faturamento Total
          </div>
        </div>
        
        {/* Ticket Médio */}
        <div style={{
          backgroundColor: '#1a1f36',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          transition: 'all 0.3s ease'
        }}
        className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={24} color="#fff" />
            </div>
            <span style={{ 
              fontSize: '0.875rem', 
              color: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontWeight: '600'
            }}>
              {metricas.taxaConversao.toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
            R$ {metricas.ticketMedio.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Ticket Médio
          </div>
        </div>
      </div>
      
      {/* Últimos Clientes e Últimos Pedidos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px'
      }}>
        {/* Últimos Clientes */}
        <div style={{
          backgroundColor: '#1a1f36',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700', 
            color: '#ffffff', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Users size={20} />
            Últimos Clientes
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clientes.slice(0, 5).map(cliente => (
              <div key={cliente.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: '#0f1419',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
              onClick={() => {
                setSelectedCliente(cliente);
                setActiveTab('clientes');
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: '#ffffff'
                  }}>
                    {cliente.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff' }}>
                      {cliente.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {cliente.phone.replace('@c.us', '')}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="#9ca3af" />
              </div>
            ))}
          </div>
          
          {clientes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
              Nenhum cliente cadastrado ainda
            </div>
          )}
        </div>
        
        {/* Últimos Pedidos */}
        <div style={{
          backgroundColor: '#1a1f36',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700', 
            color: '#ffffff', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShoppingBag size={20} />
            Últimos Pedidos
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pedidos.slice(0, 5).map(pedido => (
              <div key={pedido.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: '#0f1419',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                    {pedido.customer?.name || 'Cliente sem nome'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {new Date(pedido.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#10b981', marginBottom: '4px' }}>
                    R$ {pedido.total?.toFixed(2) || '0.00'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {pedido.status === 'PENDING' && '⏳ Pendente'}
                    {pedido.status === 'RECEIVED' && '✅ Recebido'}
                    {pedido.status === 'CONFIRMED' && '✅ Confirmado'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {pedidos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
              Nenhum pedido realizado ainda
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .metric-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
          border-color: #10b981;
        }
      `}</style>
    </div>
  );
  
  // Componente: Lista de Clientes
  const ClientesTab = () => (
    <div className="crm-clientes">
      {/* Header com busca e filtros */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af'
            }} />
            <input
              type="text"
              placeholder="Buscar clientes por nome, email ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                backgroundColor: '#1a1f36',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowClienteModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <Plus size={18} />
            Novo Cliente
          </button>
          
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              color: '#10b981',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
              e.target.style.borderColor = '#10b981';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            }}
          >
            <Download size={18} />
            Exportar
          </button>
        </div>
      </div>
      
      {/* Filtros */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        {['todos', 'lead', 'cliente', 'inativo'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: '8px 16px',
              backgroundColor: statusFilter === status ? '#10b981' : 'transparent',
              border: `2px solid ${statusFilter === status ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '20px',
              color: statusFilter === status ? '#ffffff' : '#9ca3af',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'capitalize'
            }}
            onMouseEnter={(e) => {
              if (statusFilter !== status) {
                e.target.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                e.target.style.color = '#10b981';
              }
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== status) {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.color = '#9ca3af';
              }
            }}
          >
            {status === 'todos' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Tabela de Clientes */}
      <div style={{
        backgroundColor: '#1a1f36',
        borderRadius: '16px',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f1419' }}>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'left', 
                  color: '#9ca3af', 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Cliente
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'left', 
                  color: '#9ca3af', 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Contato
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'left', 
                  color: '#9ca3af', 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  CPF/CNPJ
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'left', 
                  color: '#9ca3af', 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Última Atualização
                </th>
                <th style={{ 
                  padding: '16px', 
                  textAlign: 'center', 
                  color: '#9ca3af', 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((cliente, index) => (
                <tr key={cliente.id} style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        flexShrink: 0
                      }}>
                        {cliente.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '2px' }}>
                          {cliente.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {cliente.status.charAt(0).toUpperCase() + cliente.status.slice(1)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#ffffff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} color="#9ca3af" />
                        {cliente.phone.replace('@c.us', '')}
                      </div>
                      {cliente.email && (
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={14} color="#9ca3af" />
                          {cliente.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.875rem', color: '#ffffff', fontFamily: 'monospace' }}>
                      {cliente.cpfCnpj || '-'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      {new Date(cliente.updatedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setEditingCliente(cliente);
                          setShowClienteModal(true);
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '8px',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                          e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedCliente(cliente);
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '8px',
                          color: '#10b981',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                          e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="Ver detalhes"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {clientesFiltrados.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '48px',
            color: '#9ca3af'
          }}>
            <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
              Nenhum cliente encontrado
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {searchQuery ? 'Tente ajustar os filtros de busca' : 'Comece adicionando seu primeiro cliente'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        color: '#9ca3af'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
          <div>Carregando CRM...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="crm-dashboard" style={{
      padding: '32px',
      maxWidth: '1600px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Target size={32} color="#10b981" />
          CRM - Customer Relationship Management
        </h1>
        <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
          Gerencie seus clientes, pedidos e oportunidades de vendas
        </p>
      </div>
      
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '32px',
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        overflowX: 'auto',
        paddingBottom: '0'
      }}>
        {[
          { id: 'visao-geral', label: 'Visão Geral', icon: Activity },
          { id: 'clientes', label: 'Clientes', icon: Users },
          { id: 'pipeline', label: 'Pipeline', icon: Target },
          { id: 'relatorios', label: 'Relatórios', icon: BarChart3 }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                backgroundColor: activeTab === tab.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                border: 'none',
                borderBottom: `3px solid ${activeTab === tab.id ? '#10b981' : 'transparent'}`,
                color: activeTab === tab.id ? '#10b981' : '#9ca3af',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.color = '#ffffff';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.color = '#9ca3af';
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>
      
      {/* Conteúdo das Tabs */}
      {activeTab === 'visao-geral' && <VisaoGeral />}
      {activeTab === 'clientes' && <ClientesTab />}
      {activeTab === 'pipeline' && (
        <div style={{
          textAlign: 'center',
          padding: '64px',
          backgroundColor: '#1a1f36',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <Target size={64} style={{ margin: '0 auto 24px', color: '#10b981', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
            Pipeline em Desenvolvimento
          </h3>
          <p style={{ color: '#9ca3af' }}>
            Funcionalidade de funil de vendas será adicionada em breve
          </p>
        </div>
      )}
      {activeTab === 'relatorios' && (
        <div style={{
          textAlign: 'center',
          padding: '64px',
          backgroundColor: '#1a1f36',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <BarChart3 size={64} style={{ margin: '0 auto 24px', color: '#10b981', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
            Relatórios em Desenvolvimento
          </h3>
          <p style={{ color: '#9ca3af' }}>
            Análises avançadas e gráficos serão adicionados em breve
          </p>
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;

