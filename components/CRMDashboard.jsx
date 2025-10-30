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
  AlertCircle,
  Package,
  ShoppingCart,
  Minus,
  X
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
  
  // Estados para Pipeline
  const [draggedCliente, setDraggedCliente] = useState(null);
  const [pipelineStages, setPipelineStages] = useState({
    lead: [],
    qualificado: [],
    proposta: [],
    negociacao: [],
    fechado: [],
    perdido: []
  });
  
  // Estados para Produtos
  const [produtos, setProdutos] = useState([]);
  const [showProdutoModal, setShowProdutoModal] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [searchProduto, setSearchProduto] = useState('');
  
  // Estados para Vendas
  const [vendas, setVendas] = useState([]);
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [editingVenda, setEditingVenda] = useState(null);
  const [carrinhoVenda, setCarrinhoVenda] = useState([]);
  const [clienteVenda, setClienteVenda] = useState(null);
  const [searchVenda, setSearchVenda] = useState('');
  
  // Carregar dados do CRM
  useEffect(() => {
    if (user?.uid && database) {
      loadCRMData();
    }
  }, [user, database]);
  
  // Organizar clientes por estágio do pipeline
  useEffect(() => {
    const stages = {
      lead: [],
      qualificado: [],
      proposta: [],
      negociacao: [],
      fechado: [],
      perdido: []
    };
    
    clientes.forEach(cliente => {
      const stage = cliente.pipelineStage || 'lead';
      if (stages[stage]) {
        stages[stage].push(cliente);
      }
    });
    
    setPipelineStages(stages);
  }, [clientes]);
  
  const loadCRMData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClientes(),
        loadPedidos(),
        loadConversas(),
        loadProdutos(),
        loadVendas()
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
              status: cliente.status || 'lead', // lead, cliente, inativo
              pipelineStage: cliente.pipelineStage || 'lead' // Estágio no funil
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
  
  const loadProdutos = async () => {
    const { ref, onValue } = await import('firebase/database');
    const produtosRef = ref(database, `products/${user.uid}`);
    
    return new Promise((resolve) => {
      onValue(produtosRef, (snapshot) => {
        const produtosList = [];
        if (snapshot.exists()) {
          const data = snapshot.val();
          Object.keys(data).forEach(produtoId => {
            const produto = data[produtoId];
            produtosList.push({
              id: produtoId,
              name: produto.name || '',
              description: produto.description || '',
              price: produto.price || 0,
              category: produto.category || 'Geral',
              stock: produto.stock || 0,
              sku: produto.sku || '',
              status: produto.status || 'active',
              createdAt: produto.createdAt || new Date().toISOString(),
              updatedAt: produto.updatedAt || new Date().toISOString()
            });
          });
        }
        setProdutos(produtosList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        resolve();
      }, { onlyOnce: true });
    });
  };
  
  const loadVendas = async () => {
    const { ref, onValue } = await import('firebase/database');
    const vendasRef = ref(database, `sales/${user.uid}`);
    
    return new Promise((resolve) => {
      onValue(vendasRef, (snapshot) => {
        const vendasList = [];
        if (snapshot.exists()) {
          const data = snapshot.val();
          Object.keys(data).forEach(vendaId => {
            const venda = data[vendaId];
            vendasList.push({
              id: vendaId,
              clientId: venda.clientId || '',
              clientName: venda.clientName || '',
              items: venda.items || [],
              subtotal: venda.subtotal || 0,
              discount: venda.discount || 0,
              total: venda.total || 0,
              paymentMethod: venda.paymentMethod || '',
              status: venda.status || 'pending',
              notes: venda.notes || '',
              createdAt: venda.createdAt || new Date().toISOString(),
              updatedAt: venda.updatedAt || new Date().toISOString()
            });
          });
        }
        setVendas(vendasList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        resolve();
      }, { onlyOnce: true });
    });
  };
  
  // Calcular métricas
  const calcularMetricas = () => {
    const totalClientes = clientes.length;
    
    // Usar vendas do CRM (prioritário) ou pedidos do WhatsApp como fallback
    const totalVendas = vendas.length;
    const totalPedidos = totalVendas || pedidos.length;
    const totalFaturamento = vendas.length > 0 
      ? vendas.reduce((sum, v) => sum + (v.total || 0), 0)
      : pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
    const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
    
    // Novos clientes (últimos 7 dias)
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const novosClientes = clientes.filter(c => new Date(c.updatedAt) >= seteDiasAtras).length;
    
    // Vendas pendentes
    const vendasPendentes = vendas.filter(v => v.status === 'pending').length;
    const pedidosPendentes = vendasPendentes || pedidos.filter(p => p.status === 'PENDING').length;
    
    // Taxa de conversão
    const taxaConversao = totalClientes > 0 ? (totalPedidos / totalClientes * 100) : 0;
    
    // Produtos
    const totalProdutos = produtos.length;
    const produtosAtivos = produtos.filter(p => p.status === 'active').length;
    
    return {
      totalClientes,
      novosClientes,
      totalPedidos,
      pedidosPendentes,
      totalFaturamento,
      ticketMedio,
      taxaConversao,
      totalProdutos,
      produtosAtivos,
      totalVendas
    };
  };
  
  const metricas = calcularMetricas();
  
  // Funções do Pipeline
  const handleDragStart = (cliente) => {
    setDraggedCliente(cliente);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  
  const handleDrop = async (targetStage) => {
    if (!draggedCliente) return;
    
    try {
      const { ref, update } = await import('firebase/database');
      const clienteRef = ref(database, `customerData/${user.uid}/${draggedCliente.phone}`);
      
      await update(clienteRef, {
        pipelineStage: targetStage,
        updatedAt: new Date().toISOString()
      });
      
      showToast(`Cliente movido para ${getStageLabel(targetStage)}`, 'success');
      loadCRMData();
    } catch (error) {
      console.error('Erro ao mover cliente:', error);
      showToast('Erro ao mover cliente', 'error');
    }
    
    setDraggedCliente(null);
  };
  
  const getStageLabel = (stage) => {
    const labels = {
      lead: 'Lead',
      qualificado: 'Qualificado',
      proposta: 'Proposta',
      negociacao: 'Negociação',
      fechado: 'Fechado',
      perdido: 'Perdido'
    };
    return labels[stage] || stage;
  };
  
  const getStageColor = (stage) => {
    const colors = {
      lead: { bg: 'rgba(156, 163, 175, 0.1)', border: 'rgba(156, 163, 175, 0.3)', text: '#9ca3af' },
      qualificado: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
      proposta: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
      negociacao: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)', text: '#8b5cf6' },
      fechado: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
      perdido: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' }
    };
    return colors[stage] || colors.lead;
  };
  
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
            onClick={() => {
              setEditingCliente(null);
              setShowClienteModal(true);
            }}
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
              transition: 'all 0.2s ease',
              boxShadow: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
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
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
              e.currentTarget.style.borderColor = '#10b981';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            }}
            onClick={() => {
              // Exportar lista de clientes para CSV
              const csv = [
                ['Nome', 'Telefone', 'Email', 'CPF/CNPJ', 'Status', 'Última Atualização'].join(','),
                ...filteredClientes.map(c => [
                  c.name,
                  c.phone.replace('@c.us', ''),
                  c.email || '',
                  c.cpfCnpj || '',
                  c.status,
                  new Date(c.updatedAt).toLocaleDateString('pt-BR')
                ].join(','))
              ].join('\n');
              
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
              showToast('Lista de clientes exportada!', 'success');
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
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                          e.currentTarget.style.transform = 'scale(1)';
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
                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                          e.currentTarget.style.transform = 'scale(1)';
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
          { id: 'produtos', label: 'Produtos', icon: Package },
          { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
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
      
      {/* Tab PRODUTOS */}
      {activeTab === 'produtos' && (
        <div style={{ padding: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                🛍️ Produtos e Serviços
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                Gerencie seu catálogo de produtos e serviços
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProduto(null);
                setShowProdutoModal(true);
              }}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
              <Plus size={18} />
              Novo Produto
            </button>
          </div>
          
          {/* Lista de Produtos */}
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#0f1419' }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Produto</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Categoria</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Preço</th>
                    <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Estoque</th>
                    <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>
                        <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <div style={{ fontSize: '1rem', marginBottom: '8px' }}>Nenhum produto cadastrado</div>
                        <div style={{ fontSize: '0.875rem' }}>Clique em "Novo Produto" para começar</div>
                      </td>
                    </tr>
                  ) : (
                    produtos.filter(p => searchProduto === '' || p.name.toLowerCase().includes(searchProduto.toLowerCase()) || p.category.toLowerCase().includes(searchProduto.toLowerCase())).map(produto => (
                      <tr key={produto.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>{produto.name}</div>
                          {produto.description && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{produto.description}</div>}
                        </td>
                        <td style={{ padding: '16px', color: '#9ca3af' }}>{produto.category}</td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                          R$ {produto.price.toFixed(2)}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: produto.stock > 10 ? 'rgba(16, 185, 129, 0.1)' : produto.stock > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: produto.stock > 10 ? '#10b981' : produto.stock > 0 ? '#f59e0b' : '#ef4444'
                          }}>
                            {produto.stock}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: produto.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                            color: produto.status === 'active' ? '#10b981' : '#9ca3af'
                          }}>
                            {produto.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setEditingProduto(produto);
                                setShowProdutoModal(true);
                              }}
                              style={{
                                padding: '8px',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '8px',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}>
                              <Edit size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Tab VENDAS */}
      {activeTab === 'vendas' && (
        <div style={{ padding: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                🛒 Vendas e Pedidos
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                Gerencie todas as suas vendas
              </p>
            </div>
            <button
              onClick={() => {
                setCarrinhoVenda([]);
                setClienteVenda(null);
                setShowVendaModal(true);
              }}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
              <Plus size={18} />
              Nova Venda
            </button>
          </div>
          
          {/* Lista de Vendas */}
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#0f1419' }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Cliente</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Itens</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Total</th>
                    <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Pagamento</th>
                    <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {vendas.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>
                        <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <div style={{ fontSize: '1rem', marginBottom: '8px' }}>Nenhuma venda realizada</div>
                        <div style={{ fontSize: '0.875rem' }}>Clique em "Nova Venda" para registrar</div>
                      </td>
                    </tr>
                  ) : (
                    vendas.map(venda => (
                      <tr key={venda.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: '600', color: '#ffffff' }}>{venda.clientName}</div>
                        </td>
                        <td style={{ padding: '16px', color: '#9ca3af' }}>
                          {venda.items.length} {venda.items.length === 1 ? 'item' : 'itens'}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                          R$ {venda.total.toFixed(2)}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center', fontSize: '0.875rem', color: '#9ca3af' }}>
                          {venda.paymentMethod}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: venda.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : venda.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: venda.status === 'paid' ? '#10b981' : venda.status === 'pending' ? '#f59e0b' : '#ef4444'
                          }}>
                            {venda.status === 'paid' ? 'Pago' : venda.status === 'pending' ? 'Pendente' : venda.status === 'cancelled' ? 'Cancelado' : venda.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px', fontSize: '0.875rem', color: '#9ca3af' }}>
                          {new Date(venda.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'pipeline' && (
        <div style={{ padding: '0' }}>
          {/* Header do Pipeline */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Target size={24} color="#10b981" />
              Pipeline de Vendas
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Arraste os cards para mover clientes entre os estágios do funil
            </p>
          </div>
          
          {/* Estágios do Pipeline */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            overflowX: 'auto',
            paddingBottom: '20px'
          }}>
            {Object.keys(pipelineStages).map(stageKey => {
              const stageClients = pipelineStages[stageKey];
              const stageColor = getStageColor(stageKey);
              const stageLabel = getStageLabel(stageKey);
              
              return (
                <div
                  key={stageKey}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(stageKey)}
                  style={{
                    backgroundColor: '#1a1f36',
                    borderRadius: '16px',
                    border: `2px solid ${stageColor.border}`,
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Cabeçalho do Estágio */}
                  <div style={{
                    padding: '20px',
                    borderBottom: `2px solid ${stageColor.border}`,
                    backgroundColor: stageColor.bg
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '700', 
                        color: stageColor.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {stageLabel}
                      </h3>
                      <span style={{
                        backgroundColor: stageColor.bg,
                        color: stageColor.text,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        border: `1px solid ${stageColor.border}`
                      }}>
                        {stageClients.length}
                      </span>
                    </div>
                  </div>
                  
                  {/* Cards dos Clientes */}
                  <div style={{ 
                    padding: '16px', 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    overflowY: 'auto',
                    maxHeight: '600px'
                  }}>
                    {stageClients.length === 0 ? (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '40px 20px', 
                        color: '#6b7280',
                        fontSize: '0.875rem'
                      }}>
                        Arraste clientes aqui
                      </div>
                    ) : (
                      stageClients.map(cliente => (
                        <div
                          key={cliente.id}
                          draggable
                          onDragStart={() => handleDragStart(cliente)}
                          style={{
                            backgroundColor: '#0f1419',
                            padding: '16px',
                            borderRadius: '12px',
                            border: `1px solid ${stageColor.border}`,
                            cursor: 'grab',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = `0 4px 12px ${stageColor.border}`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {/* Avatar + Nome */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${stageColor.text} 0%, ${stageColor.border} 100%)`,
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
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: '600', 
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {cliente.name}
                              </div>
                              <div style={{ 
                                fontSize: '0.75rem', 
                                color: '#9ca3af',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {cliente.phone.replace('@c.us', '')}
                              </div>
                            </div>
                          </div>
                          
                          {/* Info adicional */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {cliente.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9ca3af' }}>
                                <Mail size={12} />
                                <span style={{ 
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {cliente.email}
                                </span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9ca3af' }}>
                              <Clock size={12} />
                              {new Date(cliente.updatedAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          
                          {/* Botão ver detalhes */}
                          <button
                            onClick={() => setSelectedCliente(cliente)}
                            style={{
                              marginTop: '12px',
                              width: '100%',
                              padding: '8px',
                              backgroundColor: stageColor.bg,
                              border: `1px solid ${stageColor.border}`,
                              borderRadius: '8px',
                              color: stageColor.text,
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = stageColor.border;
                              e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = stageColor.bg;
                              e.currentTarget.style.color = stageColor.text;
                            }}
                          >
                            <Eye size={14} />
                            Ver detalhes
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {activeTab === 'relatorios' && (
        <div style={{ padding: '0' }}>
          {/* Header dos Relatórios */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BarChart3 size={24} color="#10b981" />
              Relatórios e Análises
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Acompanhe o desempenho e resultados do seu negócio
            </p>
          </div>
          
          {/* Cards de Métricas Principais */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {/* Taxa de Conversão */}
            <div style={{
              backgroundColor: '#1a1f36',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Target size={24} color="#fff" />
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af' }}>
                  Taxa de Conversão
                </div>
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>
                {metricas.taxaConversao.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {metricas.totalPedidos} vendas de {metricas.totalClientes} clientes
              </div>
            </div>
            
            {/* Clientes por Estágio */}
            <div style={{
              backgroundColor: '#1a1f36',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Users size={24} color="#fff" />
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af' }}>
                  Clientes Ativos
                </div>
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#3b82f6', marginBottom: '8px' }}>
                {pipelineStages.lead.length + pipelineStages.qualificado.length + pipelineStages.proposta.length + pipelineStages.negociacao.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                No funil de vendas
              </div>
            </div>
            
            {/* Vendas Fechadas */}
            <div style={{
              backgroundColor: '#1a1f36',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={24} color="#fff" />
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af' }}>
                  Vendas Fechadas
                </div>
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>
                {pipelineStages.fechado.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Total de conversões
              </div>
            </div>
            
            {/* Oportunidades Perdidas */}
            <div style={{
              backgroundColor: '#1a1f36',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <XCircle size={24} color="#fff" />
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af' }}>
                  Oportunidades Perdidas
                </div>
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ef4444', marginBottom: '8px' }}>
                {pipelineStages.perdido.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Não converteram
              </div>
            </div>
          </div>
          
          {/* Gráfico de Funil */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px',
            marginBottom: '32px'
          }}>
            {/* Funil de Conversão */}
            <div style={{
              backgroundColor: '#1a1f36',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#ffffff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="#10b981" />
                Funil de Conversão
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Lead */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af' }}>Lead</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#ffffff' }}>{pipelineStages.lead.length}</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '12px', 
                    backgroundColor: '#0f1419', 
                    borderRadius: '6px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(pipelineStages.lead.length / metricas.totalClientes * 100) || 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #9ca3af 0%, #6b7280 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
                
                {/* Qualificado */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6' }}>Qualificado</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#ffffff' }}>{pipelineStages.qualificado.length}</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '12px', 
                    backgroundColor: '#0f1419', 
                    borderRadius: '6px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(pipelineStages.qualificado.length / metricas.totalClientes * 100) || 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
                
                {/* Proposta */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#f59e0b' }}>Proposta</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#ffffff' }}>{pipelineStages.proposta.length}</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '12px', 
                    backgroundColor: '#0f1419', 
                    borderRadius: '6px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(pipelineStages.proposta.length / metricas.totalClientes * 100) || 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
                
                {/* Negociação */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#8b5cf6' }}>Negociação</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#ffffff' }}>{pipelineStages.negociacao.length}</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '12px', 
                    backgroundColor: '#0f1419', 
                    borderRadius: '6px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(pipelineStages.negociacao.length / metricas.totalClientes * 100) || 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
                
                {/* Fechado */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>Fechado ✓</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#10b981' }}>{pipelineStages.fechado.length}</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '12px', 
                    backgroundColor: '#0f1419', 
                    borderRadius: '6px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(pipelineStages.fechado.length / metricas.totalClientes * 100) || 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Distribuição por Estágio */}
            <div style={{
              backgroundColor: '#1a1f36',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#ffffff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={20} color="#10b981" />
                Distribuição de Clientes
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { key: 'lead', label: 'Lead', color: '#9ca3af' },
                  { key: 'qualificado', label: 'Qualificado', color: '#3b82f6' },
                  { key: 'proposta', label: 'Proposta', color: '#f59e0b' },
                  { key: 'negociacao', label: 'Negociação', color: '#8b5cf6' },
                  { key: 'fechado', label: 'Fechado', color: '#10b981' },
                  { key: 'perdido', label: 'Perdido', color: '#ef4444' }
                ].map(stage => {
                  const count = pipelineStages[stage.key].length;
                  const percentage = metricas.totalClientes > 0 ? (count / metricas.totalClientes * 100) : 0;
                  
                  return (
                    <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        backgroundColor: stage.color,
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: '600' }}>{stage.label}</span>
                          <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{count} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '4px',
                          backgroundColor: '#0f1419',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: stage.color,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Top Clientes */}
          <div style={{
            backgroundColor: '#1a1f36',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} color="#10b981" />
              Top 10 Clientes Recentes
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Cliente</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Contato</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Estágio</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.slice(0, 10).map(cliente => (
                    <tr key={cliente.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '700',
                            color: '#ffffff'
                          }}>
                            {cliente.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff' }}>{cliente.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{cliente.phone.replace('@c.us', '')}</div>
                        {cliente.email && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{cliente.email}</div>}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: getStageColor(cliente.pipelineStage).bg,
                          color: getStageColor(cliente.pipelineStage).text,
                          border: `1px solid ${getStageColor(cliente.pipelineStage).border}`
                        }}>
                          {getStageLabel(cliente.pipelineStage)}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: '0.875rem', color: '#9ca3af' }}>
                        {new Date(cliente.updatedAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Editar/Novo Cliente */}
      {showClienteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={() => {
          setShowClienteModal(false);
          setEditingCliente(null);
        }}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}>
            {/* Fechar */}
            <button
              onClick={() => {
                setShowClienteModal(false);
                setEditingCliente(null);
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
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
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}>
              ✕
            </button>
            
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '24px'
            }}>
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  defaultValue={editingCliente?.name || ''}
                  id="cliente-nome"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Telefone *
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 5511999999999"
                  defaultValue={editingCliente?.phone?.replace('@c.us', '') || ''}
                  id="cliente-telefone"
                  disabled={!!editingCliente}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: editingCliente ? '#0a0e14' : '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: editingCliente ? '#6b7280' : '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    cursor: editingCliente ? 'not-allowed' : 'text'
                  }}
                  onFocus={(e) => !editingCliente && (e.target.style.borderColor = '#10b981')}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
                {editingCliente && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                    O telefone não pode ser alterado
                  </div>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Ex: joao@email.com"
                  defaultValue={editingCliente?.email || ''}
                  id="cliente-email"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  CPF/CNPJ
                </label>
                <input
                  type="text"
                  placeholder="Ex: 12345678900"
                  defaultValue={editingCliente?.cpfCnpj || ''}
                  id="cliente-cpfcnpj"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Status
                </label>
                <select
                  defaultValue={editingCliente?.status || 'lead'}
                  id="cliente-status"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
                  <option value="lead">Lead</option>
                  <option value="cliente">Cliente</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  setShowClienteModal(false);
                  setEditingCliente(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}>
                Cancelar
              </button>
              
              <button
                onClick={async () => {
                  const nome = document.getElementById('cliente-nome').value;
                  const telefone = document.getElementById('cliente-telefone').value;
                  const email = document.getElementById('cliente-email').value;
                  const cpfCnpj = document.getElementById('cliente-cpfcnpj').value;
                  const status = document.getElementById('cliente-status').value;
                  
                  if (!nome || !telefone) {
                    showToast('Nome e telefone são obrigatórios', 'error');
                    return;
                  }
                  
                  try {
                    const { ref, set, update } = await import('firebase/database');
                    const phoneKey = telefone.includes('@c.us') ? telefone : `${telefone}@c.us`;
                    const clienteRef = ref(database, `customerData/${user.uid}/${phoneKey}`);
                    
                    const clienteData = {
                      name: nome,
                      email: email || '',
                      cpfCnpj: cpfCnpj || '',
                      status: status,
                      phone: phoneKey,
                      updatedAt: new Date().toISOString()
                    };
                    
                    if (editingCliente) {
                      await update(clienteRef, clienteData);
                      showToast('Cliente atualizado com sucesso!', 'success');
                    } else {
                      await set(clienteRef, {
                        ...clienteData,
                        createdAt: new Date().toISOString()
                      });
                      showToast('Cliente adicionado com sucesso!', 'success');
                    }
                    
                    setShowClienteModal(false);
                    setEditingCliente(null);
                    loadCRMData();
                  } catch (error) {
                    console.error('Erro ao salvar cliente:', error);
                    showToast('Erro ao salvar cliente', 'error');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                {editingCliente ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Detalhes do Cliente */}
      {selectedCliente && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={() => setSelectedCliente(null)}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}>
            {/* Fechar */}
            <button
              onClick={() => setSelectedCliente(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
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
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}>
              ✕
            </button>
            
            {/* Avatar e Nome */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '16px',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
              }}>
                {selectedCliente.name.charAt(0).toUpperCase()}
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '8px'
              }}>
                {selectedCliente.name}
              </h3>
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#10b981',
                textTransform: 'uppercase'
              }}>
                {selectedCliente.status}
              </div>
            </div>
            
            {/* Informações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#0f1419',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Phone size={16} color="#10b981" />
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' }}>
                    Telefone
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#ffffff', fontFamily: 'monospace' }}>
                  {selectedCliente.phone.replace('@c.us', '')}
                </div>
              </div>
              
              {selectedCliente.email && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#0f1419',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Mail size={16} color="#10b981" />
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' }}>
                      Email
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#ffffff' }}>
                    {selectedCliente.email}
                  </div>
                </div>
              )}
              
              {selectedCliente.cpfCnpj && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#0f1419',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <AlertCircle size={16} color="#10b981" />
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' }}>
                      CPF/CNPJ
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#ffffff', fontFamily: 'monospace' }}>
                    {selectedCliente.cpfCnpj}
                  </div>
                </div>
              )}
              
              <div style={{
                padding: '16px',
                backgroundColor: '#0f1419',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Calendar size={16} color="#10b981" />
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' }}>
                    Última Atualização
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#ffffff' }}>
                  {new Date(selectedCliente.updatedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
            
            {/* Ações */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setSelectedCliente(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}>
                Fechar
              </button>
              
              <button
                onClick={() => {
                  setEditingCliente(selectedCliente);
                  setSelectedCliente(null);
                  setShowClienteModal(true);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                Editar Cliente
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Produto */}
      {showProdutoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={() => {
          setShowProdutoModal(false);
          setEditingProduto(null);
        }}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '24px'
            }}>
              {editingProduto ? '✏️ Editar Produto' : '➕ Novo Produto'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Camiseta Básica"
                  defaultValue={editingProduto?.name || ''}
                  id="produto-nome"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Descrição
                </label>
                <textarea
                  placeholder="Descrição do produto..."
                  defaultValue={editingProduto?.description || ''}
                  id="produto-descricao"
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue={editingProduto?.price || ''}
                    id="produto-preco"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#0f1419',
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                    Estoque
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    defaultValue={editingProduto?.stock || 0}
                    id="produto-estoque"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#0f1419',
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Categoria
                </label>
                <input
                  type="text"
                  placeholder="Ex: Roupas, Eletrônicos..."
                  defaultValue={editingProduto?.category || ''}
                  id="produto-categoria"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>
                  Status
                </label>
                <select
                  defaultValue={editingProduto?.status || 'active'}
                  id="produto-status"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#0f1419',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  setShowProdutoModal(false);
                  setEditingProduto(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                Cancelar
              </button>
              
              <button
                onClick={async () => {
                  const nome = document.getElementById('produto-nome').value;
                  const descricao = document.getElementById('produto-descricao').value;
                  const preco = parseFloat(document.getElementById('produto-preco').value);
                  const estoque = parseInt(document.getElementById('produto-estoque').value) || 0;
                  const categoria = document.getElementById('produto-categoria').value || 'Geral';
                  const status = document.getElementById('produto-status').value;
                  
                  if (!nome || !preco) {
                    showToast('Nome e preço são obrigatórios', 'error');
                    return;
                  }
                  
                  try {
                    const { ref, push, set, update } = await import('firebase/database');
                    
                    const produtoData = {
                      name: nome,
                      description: descricao,
                      price: preco,
                      stock: estoque,
                      category: categoria,
                      status: status,
                      updatedAt: new Date().toISOString()
                    };
                    
                    if (editingProduto) {
                      const produtoRef = ref(database, `products/${user.uid}/${editingProduto.id}`);
                      await update(produtoRef, produtoData);
                      showToast('Produto atualizado!', 'success');
                    } else {
                      const produtosRef = ref(database, `products/${user.uid}`);
                      const newProdutoRef = push(produtosRef);
                      await set(newProdutoRef, {
                        ...produtoData,
                        createdAt: new Date().toISOString()
                      });
                      showToast('Produto cadastrado!', 'success');
                    }
                    
                    setShowProdutoModal(false);
                    setEditingProduto(null);
                    loadCRMData();
                  } catch (error) {
                    console.error('Erro ao salvar produto:', error);
                    showToast('Erro ao salvar produto', 'error');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                {editingProduto ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Nova Venda - SIMPLIFICADO por enquanto */}
      {showVendaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={() => {
          setShowVendaModal(false);
          setCarrinhoVenda([]);
          setClienteVenda(null);
        }}>
          <div style={{
            backgroundColor: '#1a1f36',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '800px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '24px'
            }}>
              🛒 Nova Venda
            </h3>
            
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <div style={{ fontSize: '1rem', marginBottom: '8px' }}>Sistema de carrinho em desenvolvimento</div>
              <div style={{ fontSize: '0.875rem' }}>
                Por enquanto, vendas são registradas automaticamente via WhatsApp
              </div>
            </div>
            
            <button
              onClick={() => {
                setShowVendaModal(false);
                setCarrinhoVenda([]);
                setClienteVenda(null);
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;

