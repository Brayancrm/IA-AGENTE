import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { useFirebase } from '../hooks/useFirebase';

/**
 * Componente SUPER SIMPLES para exibir conversas WhatsApp
 * SEM complexidade desnecessária - foco em FUNCIONAR
 */
export default function ConversasSimples({ userId, backendUrl }) {
  const { database, auth, isReady } = useFirebase();
  const [conversas, setConversas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [mensagemInput, setMensagemInput] = useState('');
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState('checking'); // checking, connected, disconnected
  const [isMobile, setIsMobile] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);

  // Detectar se está em mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Em mobile, mostrar lista por padrão se não houver conversa selecionada
      if (mobile && !conversaSelecionada) {
        setShowConversationList(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [conversaSelecionada]);

  // Quando selecionar uma conversa em mobile, esconder a lista
  useEffect(() => {
    if (isMobile && conversaSelecionada) {
      setShowConversationList(false);
    }
  }, [conversaSelecionada, isMobile]);

  // Esperar o Firebase Auth estar REALMENTE pronto
  useEffect(() => {
    if (!auth) return;

    console.log('🔐 Configurando listener de autenticação...');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.uid === userId) {
        console.log('✅ Firebase Auth CONFIRMADO e sincronizado!', {
          uid: user.uid,
          email: user.email
        });
        setAuthReady(true);
      } else {
        console.warn('⚠️ Auth state mudou, mas usuário não corresponde', {
          user: user?.uid,
          expectedUserId: userId
        });
        setAuthReady(false);
      }
    });

    return () => unsubscribe();
  }, [auth, userId]);

  // Debug: Verificar estado do Firebase
  useEffect(() => {
    console.log('🔍 [DEBUG] Firebase State:', {
      hasDatabase: !!database,
      hasAuth: !!auth,
      isReady,
      authReady,
      currentUser: auth?.currentUser?.uid,
      expectedUserId: userId
    });
  }, [database, auth, isReady, authReady, userId]);

  // Monitorar status do WhatsApp no Firebase
  useEffect(() => {
    if (!database || !userId) return;

    console.log('🔍 [Conversas] Monitorando status do WhatsApp...');
    const sessionRef = ref(database, `whatsapp_sessions/${userId}`);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const session = snapshot.val();
        const newStatus = session.status || 'disconnected';
        console.log('📱 [Conversas] Status WhatsApp:', newStatus);
        setWhatsappStatus(newStatus);
      } else {
        console.log('⚠️ [Conversas] Nenhum dado encontrado no Firebase');
        setWhatsappStatus('disconnected');
      }
    }, (error) => {
      console.error('❌ [Conversas] Erro ao monitorar status:', error);
      setWhatsappStatus('disconnected');
    });

    return () => off(sessionRef);
  }, [database, userId]);

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

  // Buscar mensagens da conversa selecionada do Firebase
  useEffect(() => {
    // Verificações de segurança
    if (!conversaSelecionada || !database || !userId || !auth || !isReady) {
      setMensagens([]);
      return;
    }

    // 🔥 CRÍTICO: Aguardar o Firebase Auth confirmar via onAuthStateChanged
    if (!authReady) {
      console.warn('⏳ Aguardando Firebase Auth sincronizar com Realtime Database...');
      setMensagens([]);
      return;
    }

    // Verificar se o usuário está autenticado
    if (!auth.currentUser) {
      console.warn('⚠️ Usuário não autenticado, aguardando...');
      setMensagens([]);
      return;
    }

    // Verificar se o userId corresponde ao usuário autenticado
    if (auth.currentUser.uid !== userId) {
      console.error('❌ Inconsistência: auth.uid !== userId', {
        authUid: auth.currentUser.uid,
        userId: userId
      });
      setMensagens([]);
      return;
    }

    setCarregandoMensagens(true);
    console.log('💬 Buscando mensagens da conversa:', conversaSelecionada);
    console.log('✅ Auth verificado:', {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email
    });
    console.log('🔥 authReady = true - Firebase Auth SINCRONIZADO com Realtime Database!');

    // NÃO remover o _c_us! O Firebase usa ele no caminho
    const phoneNumber = conversaSelecionada; // Manter o formato original: 393883477676_c_us
    
    // CAMINHO CORRETO: /conversations/{userId}/{phoneNumber}/messages
    const messagesRef = ref(database, `conversations/${userId}/${phoneNumber}/messages`);

    // Aguardar um pouco antes de configurar o listener
    const timer = setTimeout(() => {
      // Debug detalhado do Firebase Auth antes de tentar acessar
      console.log('🔍 [TENTATIVA DE ACESSO] Detalhes completos:', {
        path: `conversations/${userId}/${phoneNumber}/messages`,
        authCurrentUser: auth.currentUser ? {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          emailVerified: auth.currentUser.emailVerified,
          isAnonymous: auth.currentUser.isAnonymous,
          metadata: {
            creationTime: auth.currentUser.metadata.creationTime,
            lastSignInTime: auth.currentUser.metadata.lastSignInTime
          }
        } : null,
        databaseConnected: !!database,
        messagesRefPath: messagesRef.toString()
      });
      
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
          // Converter objeto em array e ordenar por timestamp
          const messagesArray = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...value
          })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          
          console.log('✅ Mensagens carregadas:', messagesArray.length);
          setMensagens(messagesArray);
        } else {
          console.log('ℹ️ Nenhuma mensagem encontrada (snapshot vazio)');
          setMensagens([]);
        }
        
        setCarregandoMensagens(false);
      }, (error) => {
        console.error('❌ Erro ao buscar mensagens:', error);
        console.error('❌ Detalhes do erro:', {
          code: error.code,
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n')[0]
        });
        
        // Verificar se é realmente um erro de permissão
        if (error.code === 'PERMISSION_DENIED') {
          console.error('🚨 CONFIRMADO: Erro de permissão do Firebase!');
          console.error('🔍 Verifique no Firebase Console:');
          console.error(`   Path: conversations/${userId}/${phoneNumber}/messages`);
          console.error(`   UID autenticado: ${auth.currentUser?.uid}`);
        }
        
        setCarregandoMensagens(false);
        setMensagens([]);
      });

      // Salvar o unsubscribe para cleanup
      return unsubscribe;
    }, 500); // Aguardar 500ms para garantir autenticação

    // Cleanup
    return () => {
      clearTimeout(timer);
      // Se o timer já executou, off será chamado quando o componente desmontar
      off(messagesRef);
    };
  }, [conversaSelecionada, database, userId, auth, isReady, authReady]);

  // Enviar mensagem
  const enviarMensagem = async () => {
    if (!mensagemInput.trim() || !conversaSelecionada || enviandoMensagem) return;

    setEnviandoMensagem(true);
    try {
      console.log('📤 Enviando mensagem:', mensagemInput);
      
      // Formatar o número para o backend (adicionar @c.us se necessário)
      const phoneForBackend = conversaSelecionada.includes('@c.us') 
        ? conversaSelecionada.replace('_c_us', '@c.us')
        : conversaSelecionada.replace('_c_us', '') + '@c.us';

      const response = await fetch(`${backendUrl}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          to: phoneForBackend,
          message: mensagemInput.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem');
      }

      console.log('✅ Mensagem enviada com sucesso!');
      setMensagemInput(''); // Limpar input
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setEnviandoMensagem(false);
    }
  };

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
    <div style={{ padding: isMobile ? '16px' : '40px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: isMobile ? '1.5rem' : '2.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
          💬 Conversas WhatsApp ({conversas.length})
        </h2>
        <p style={{ fontSize: isMobile ? '0.875rem' : '1rem', color: '#9ca3af' }}>
          Acompanhe todas as conversas do WhatsApp em tempo real
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        gap: '16px', 
        height: isMobile ? 'auto' : 'calc(100% - 80px)', 
        backgroundColor: '#1a1f36', 
        borderRadius: '16px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)', 
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        minHeight: isMobile ? '500px' : '600px'
      }}>
        {/* Lista de Conversas - Esquerda (ou em cima no mobile) */}
        <div style={{ 
          width: isMobile ? '100%' : '350px',
          display: isMobile && !showConversationList ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
          borderBottom: isMobile && showConversationList ? '1px solid rgba(255,255,255,0.1)' : 'none',
          maxHeight: isMobile ? '400px' : 'none'
        }}>
          {/* Header da lista */}
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid rgba(255,255,255,0.1)', 
            backgroundColor: '#0f1419' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff' }}>Conversas</span>
                <span style={{ 
                  backgroundColor: '#10b981', 
                  color: 'white', 
                  fontSize: '0.75rem', 
                  fontWeight: 'bold', 
                  padding: '2px 8px', 
                  borderRadius: '12px',
                  border: '1px solid #059669'
                }}>
                  {conversas.length}
                </span>
              </div>
              
              {/* Status do WhatsApp */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: whatsappStatus === 'connected' ? 'rgba(16, 185, 129, 0.1)' : whatsappStatus === 'disconnected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                border: `1px solid ${whatsappStatus === 'connected' ? 'rgba(16, 185, 129, 0.3)' : whatsappStatus === 'disconnected' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: whatsappStatus === 'connected' ? '#10b981' : whatsappStatus === 'disconnected' ? '#ef4444' : '#9ca3af'
                }}></div>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  color: '#ffffff'
                }}>
                  {whatsappStatus === 'connected' ? 'Conectado' : whatsappStatus === 'disconnected' ? 'Desconectado' : 'Verificando...'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Lista */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversas.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
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
                    onClick={() => {
                      setConversaSelecionada(conv.contactNumber);
                      if (isMobile) {
                        setShowConversationList(false);
                      }
                    }}
                    onTouchStart={(e) => {
                      // Adicionar feedback visual no touch
                      e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                    }}
                    onTouchEnd={(e) => {
                      setTimeout(() => {
                        e.currentTarget.style.backgroundColor = selecionada ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                      }, 150);
                    }}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      backgroundColor: selecionada ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      transition: 'background-color 0.2s',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!selecionada) e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!selecionada) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600', color: '#ffffff' }}>
                        📱 {telefone}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {tempo}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: '#9ca3af',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conv.lastMessage || 'Nova conversa'}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
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

        {/* Área de Mensagens - Direita (ou embaixo no mobile) */}
        <div style={{ 
          flex: 1, 
          display: isMobile && showConversationList ? 'none' : 'flex', 
          flexDirection: 'column',
          backgroundColor: '#0f1419',
          minHeight: isMobile ? '500px' : 'auto'
        }}>
          {!conversaSelecionada ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              padding: '24px'
            }}>
              <div style={{ fontSize: isMobile ? '3rem' : '4rem', marginBottom: '16px' }}>💬</div>
              <h3 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
                Nenhuma conversa selecionada
              </h3>
              <p style={{ fontSize: isMobile ? '0.875rem' : '1rem', textAlign: 'center' }}>Clique em uma conversa para ver as mensagens</p>
            </div>
          ) : (
            <>
              {/* Header da conversa com botão voltar em mobile */}
              <div style={{ 
                padding: '16px', 
                borderBottom: '1px solid rgba(255,255,255,0.1)', 
                backgroundColor: '#1a1f36',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                {isMobile && (
                  <button
                    onClick={() => {
                      setShowConversationList(true);
                      setConversaSelecionada(null);
                    }}
                    style={{
                      padding: '8px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '36px',
                      minHeight: '36px'
                    }}
                  >
                    ←
                  </button>
                )}
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1.25rem'
                }}>
                  {formatarTelefone(conversaSelecionada).substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#ffffff', fontSize: isMobile ? '0.9rem' : '1rem' }}>
                    {formatarTelefone(conversaSelecionada)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {mensagens.length} mensagens
                  </div>
                </div>
              </div>

              {/* Área de mensagens */}
              <div style={{ 
                flex: 1, 
                padding: '24px', 
                overflowY: 'auto',
                backgroundColor: '#0f1419',
                position: 'relative'
              }}>
                {/* Background da conversa - você pode alterar aqui */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  // Usar imagem de background
                  backgroundImage: 'url(/whatsapp-bg.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: 0.3,
                  pointerEvents: 'none',
                  zIndex: 0
                }}></div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                {carregandoMensagens ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
                    <p>Carregando mensagens...</p>
                  </div>
                ) : mensagens.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💬</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px', color: '#ffffff' }}>
                      Nenhuma mensagem ainda
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>
                      As mensagens aparecerão aqui
                    </div>
                  </div>
                ) : (
                  mensagens.map((msg) => {
                    const isFromMe = msg.isFromMe;
                    const msgTime = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                    
                    return (
                      <div 
                        key={msg.id} 
                        style={{ 
                          marginBottom: '16px', 
                          display: 'flex', 
                          justifyContent: isFromMe ? 'flex-end' : 'flex-start',
                          animation: 'fadeIn 0.3s ease-in'
                        }}
                      >
                        <div style={{ maxWidth: '70%' }}>
                          <div style={{ 
                            backgroundColor: isFromMe ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36', 
                            padding: '12px 16px', 
                            borderRadius: '12px',
                            borderTopLeftRadius: isFromMe ? '12px' : '4px',
                            borderTopRightRadius: isFromMe ? '4px' : '12px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            border: isFromMe ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                            wordBreak: 'break-word'
                          }}>
                            <p style={{ 
                              margin: 0, 
                              color: '#ffffff', 
                              fontSize: '0.9rem', 
                              whiteSpace: 'pre-wrap' 
                            }}>
                              {msg.body || ''}
                            </p>
                            {msg.aiGenerated && (
                              <span style={{ 
                                fontSize: '0.7rem', 
                                color: '#10b981', 
                                marginTop: '4px', 
                                display: 'block',
                                fontWeight: 'bold'
                              }}>
                                🤖 IA
                              </span>
                            )}
                            <span style={{ 
                              fontSize: '0.7rem', 
                              color: '#9ca3af', 
                              marginTop: '4px', 
                              display: 'block', 
                              textAlign: 'right' 
                            }}>
                              {msgTime} {isFromMe ? '✓✓' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>

              {/* Input de mensagem */}
              <div style={{ 
                padding: '16px', 
                borderTop: '1px solid rgba(255,255,255,0.1)', 
                backgroundColor: '#1a1f36',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Digite uma mensagem..."
                  value={mensagemInput}
                  onChange={(e) => setMensagemInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !enviandoMensagem) {
                      enviarMensagem();
                    }
                  }}
                  disabled={enviandoMensagem}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #374151',
                    borderRadius: '24px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    backgroundColor: '#0f1419',
                    color: '#ffffff'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#374151'}
                />
                <button 
                  onClick={enviarMensagem}
                  disabled={!mensagemInput.trim() || enviandoMensagem}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: mensagemInput.trim() && !enviandoMensagem ? '#10b981' : '#374151',
                    border: mensagemInput.trim() && !enviandoMensagem ? '1px solid #059669' : '1px solid #4b5563',
                    borderRadius: '24px',
                    cursor: mensagemInput.trim() && !enviandoMensagem ? 'pointer' : 'not-allowed',
                    color: 'white',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    minWidth: '100px',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (mensagemInput.trim() && !enviandoMensagem) {
                      e.currentTarget.style.backgroundColor = '#059669';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (mensagemInput.trim() && !enviandoMensagem) {
                      e.currentTarget.style.backgroundColor = '#10b981';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  {enviandoMensagem ? 'Enviando...' : 'Enviar 📤'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

