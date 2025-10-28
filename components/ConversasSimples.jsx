import { useState, useEffect } from 'react';

/**
 * Componente SUPER SIMPLES para exibir conversas WhatsApp
 * SEM complexidade desnecessária - foco em FUNCIONAR
 */
export default function ConversasSimples({ userId, backendUrl }) {
  const [conversas, setConversas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [conversaSelecionada, setConversaSelecionada] = useState(null);

  // Buscar conversas do backend
  useEffect(() => {
    if (!userId) return;

    const buscarConversas = async () => {
      try {
        console.log('📱 Buscando conversas...');
        const response = await fetch(`${backendUrl}/api/conversations/${userId}`);
        const data = await response.json();
        
        if (data.conversations) {
          console.log('✅ Conversas recebidas:', data.conversations.length);
          setConversas(data.conversations);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar conversas:', error);
      } finally {
        setCarregando(false);
      }
    };

    buscarConversas();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(buscarConversas, 30000);
    return () => clearInterval(interval);
  }, [userId, backendUrl]);

  // Formatar telefone para exibição
  const formatarTelefone = (contactNumber) => {
    if (!contactNumber) return 'Desconhecido';
    return contactNumber.replace('_c_us', '').replace('@c.us', '');
  };

  // Formatar tempo
  const formatarTempo = (timestamp) => {
    if (!timestamp) return '';
    const data = new Date(timestamp);
    const agora = new Date();
    const diffHoras = Math.floor((agora - data) / (1000 * 60 * 60));
    
    if (diffHoras < 1) return 'Agora';
    if (diffHoras < 24) return `${diffHoras}h atrás`;
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (carregando) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
        <p>Carregando conversas...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>
        💬 Conversas WhatsApp ({conversas.length})
      </h2>

      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        height: 'calc(100% - 80px)', 
        backgroundColor: 'white', 
        borderRadius: '16px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
        overflow: 'hidden' 
      }}>
        {/* Lista de Conversas - Esquerda */}
        <div style={{ 
          width: '350px', 
          borderRight: '1px solid #e5e7eb', 
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          {/* Header da lista */}
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid #e5e7eb', 
            backgroundColor: '#f9fafb' 
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
              Conversas
              <span style={{ 
                backgroundColor: '#10b981', 
                color: 'white', 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                marginLeft: '8px' 
              }}>
                {conversas.length}
              </span>
            </div>
          </div>
          
          {/* Lista */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversas.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
                Nenhuma conversa ainda
              </div>
            ) : (
              conversas.map((conv) => {
                const telefone = formatarTelefone(conv.contactNumber);
                const tempo = formatarTempo(conv.lastMessageTime);
                const selecionada = conversaSelecionada === conv.contactNumber;
                
                return (
                  <div
                    key={conv.contactNumber}
                    onClick={() => setConversaSelecionada(conv.contactNumber)}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      backgroundColor: selecionada ? '#eff6ff' : 'white',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!selecionada) e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      if (!selecionada) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600', color: '#1f2937' }}>
                        📱 {telefone}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {tempo}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conv.lastMessage || 'Nova conversa'}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#9ca3af',
                      marginTop: '4px'
                    }}>
                      💬 {conv.messageCount || 0} mensagens
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Área de Mensagens - Direita */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280'
        }}>
          {!conversaSelecionada ? (
            <>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>💬</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '8px' }}>
                Nenhuma conversa selecionada
              </h3>
              <p>Clique em uma conversa para ver os detalhes</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✉️</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '8px' }}>
                Conversa com {formatarTelefone(conversaSelecionada)}
              </h3>
              <p>Visualização de mensagens em desenvolvimento</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

