'use client';

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import BeefreeSDK from '@beefree.io/sdk';

/**
 * BeefreeEditor - Componente para o editor visual de emails do Beefree SDK
 * 
 * Documentação: https://docs.beefree.io/beefree-sdk/visual-builders/email-builder
 * 
 * Requer:
 * - NEXT_PUBLIC_BEEFREE_CLIENT_ID
 * - NEXT_PUBLIC_BEEFREE_CLIENT_SECRET (ou token gerado no servidor)
 */
const BeefreeEditor = React.forwardRef(function BeefreeEditor({ 
  clientId,
  clientSecret,
  token, // Token gerado no servidor (recomendado para produção)
  initialContent, 
  onSave,
  onReady,
  height = '600px' 
}, ref) {
  const containerRef = useRef(null);
  const beeInstanceRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Expor métodos via ref
  useImperativeHandle(ref, () => ({
    save: async () => {
      if (beeInstanceRef.current) {
        try {
          const result = await beeInstanceRef.current.save();
          return result;
        } catch (err) {
          console.error('Erro ao salvar:', err);
          return null;
        }
      }
      return null;
    },
    exportHtml: (callback) => {
      if (beeInstanceRef.current) {
        beeInstanceRef.current.save().then((result) => {
          if (result && callback) {
            callback({
              html: result.data.html,
              design: JSON.parse(result.data.json),
              json: result.data.json
            });
          } else if (callback) {
            callback(null);
          }
        }).catch((err) => {
          console.error('Erro ao exportar:', err);
          if (callback) callback(null);
        });
      } else if (callback) {
        callback(null);
      }
    },
    load: (template) => {
      if (beeInstanceRef.current && template) {
        beeInstanceRef.current.load(template);
      }
    }
  }));

  // Inicializar editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Verificar se já foi inicializado
    if (beeInstanceRef.current) {
      return;
    }

    // Verificar credenciais
    if (!token && (!clientId || !clientSecret)) {
      setError('Credenciais do Beefree não configuradas. Configure NEXT_PUBLIC_BEEFREE_CLIENT_ID e NEXT_PUBLIC_BEEFREE_CLIENT_SECRET, ou forneça um token.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const initEditor = async () => {
      try {
        // Criar instância do SDK
        let beeToken = token;
        
        // Se não tiver token, gerar usando UNSAFE_getToken (apenas para desenvolvimento)
        if (!beeToken && clientId && clientSecret) {
          const beeSDK = new BeefreeSDK();
          console.log('🔑 Gerando token do Beefree...');
          // UNSAFE_getToken requer: clientId, clientSecret, uid
          // uid é um identificador único do usuário (pode ser qualquer string única)
          const uid = typeof window !== 'undefined' && window.localStorage 
            ? localStorage.getItem('beefree_uid') || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            : `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Salvar uid no localStorage para reutilizar
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('beefree_uid', uid);
          }
          
          beeToken = await beeSDK.UNSAFE_getToken(clientId, clientSecret, uid);
          console.log('✅ Token gerado com sucesso');
        }

        if (!beeToken) {
          throw new Error('Não foi possível obter token de autenticação');
        }

        // Criar instância do editor
        const bee = new BeefreeSDK(beeToken);
        beeInstanceRef.current = bee;

        // Ref para controlar timeout do onReady
        const onReadyTimeoutRef = { current: null };

        // Configuração do editor
        const beeConfig = {
          container: containerRef.current.id,
          language: 'pt-BR',
          onReady: (args) => {
            // Limpar timeout se onReady for chamado
            if (onReadyTimeoutRef.current) {
              clearTimeout(onReadyTimeoutRef.current);
              onReadyTimeoutRef.current = null;
              console.log('✅ onReady chamado - timeout cancelado');
            }
            
            console.log('✅ Editor Beefree pronto:', args);
            console.log('🔄 Atualizando estado: isReady=true, isLoading=false');
            setIsReady(true);
            setIsLoading(false);
            // Forçar atualização do container
            if (containerRef.current) {
              containerRef.current.style.display = 'block';
              console.log('✅ Container do editor exibido');
            }
            if (onReady) {
              onReady(bee);
            }
          },
          onSave: (pageJson, pageHtml, ampHtml, templateVersion, language) => {
            console.log('💾 Conteúdo salvo do Beefree');
            if (onSave) {
              onSave({
                html: pageHtml,
                design: JSON.parse(pageJson),
                json: pageJson,
                ampHtml: ampHtml,
                version: templateVersion,
                language: language
              });
            }
          },
          onError: (error) => {
            console.error('❌ Erro do editor Beefree:', error);
            setError(error.message || 'Erro no editor Beefree');
            setIsLoading(false);
          },
          onStart: () => {
            console.log('🚀 Editor Beefree iniciado');
            // O onStart é chamado antes do onReady, então ainda está carregando
            // Mas podemos garantir que o container está pronto
            if (containerRef.current) {
              console.log('📦 Container ID:', containerRef.current.id);
            }
          }
        };

        // Template inicial (vazio ou carregado)
        const initialTemplate = initialContent || {
          page: {
            body: {
              type: 'email',
              container: {
                style: {
                  'background-color': '#ffffff'
                }
              },
              content: {
                style: {
                  'font-family': 'Arial, sans-serif',
                  color: '#000000'
                }
              }
            },
            rows: [],
            template: {
              name: 'Novo Template',
              type: 'email',
              version: '1.0.0'
            },
            title: 'Novo Email',
            description: ''
          }
        };

        // Verificar se container existe antes de iniciar
        if (!containerRef.current) {
          throw new Error('Container do editor não encontrado');
        }
        
        // Garantir que o container está visível ANTES de iniciar
        containerRef.current.style.display = 'block';
        containerRef.current.style.visibility = 'visible';
        containerRef.current.style.opacity = '1';
        
        // Aguardar um frame para garantir que o DOM está atualizado
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        console.log('🔄 Iniciando editor Beefree...');
        console.log('📦 Container existe:', !!containerRef.current);
        console.log('📦 Container ID:', containerRef.current.id);
        console.log('📦 Container visível:', containerRef.current.offsetWidth > 0 && containerRef.current.offsetHeight > 0);
        
        // Fallback: se onReady não for chamado em 10 segundos, remover loading
        // (Reduzido de 15s para 10s para melhor UX)
        onReadyTimeoutRef.current = setTimeout(() => {
          console.warn('⚠️ onReady não foi chamado após 10s, removendo loading manualmente');
          console.log('ℹ️ O editor pode estar funcionando mesmo sem onReady');
          setIsLoading(false);
          setIsReady(true);
          if (containerRef.current) {
            containerRef.current.style.display = 'block';
          }
        }, 10000);
        
        // Iniciar editor
        await bee.start(beeConfig, initialTemplate);
        
      } catch (err) {
        console.error('❌ Erro ao inicializar editor Beefree:', err);
        setError(err.message || 'Erro ao inicializar editor. Verifique as credenciais.');
        setIsLoading(false);
      }
    };

    initEditor();

    // Cleanup
    return () => {
      // O SDK não tem método de destruição explícito
      // O container será limpo quando o componente desmontar
    };
  }, [clientId, clientSecret, token, initialContent, onReady, onSave]);

  // Carregar conteúdo quando mudar
  useEffect(() => {
    if (isReady && initialContent && beeInstanceRef.current) {
      try {
        beeInstanceRef.current.load(initialContent);
      } catch (err) {
        console.error('Erro ao carregar conteúdo:', err);
      }
    }
  }, [isReady, initialContent]);

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#fee2e2', 
        color: '#991b1b', 
        borderRadius: '8px',
        border: '1px solid #fca5a5'
      }}>
        <strong>Erro:</strong> {error}
        <br />
        <small>
          Para usar o Beefree SDK, você precisa:
          <br />
          1. Criar conta em <a href="https://developers.beefree.io" target="_blank" rel="noopener">developers.beefree.io</a>
          <br />
          2. Criar uma aplicação e obter Client ID e Client Secret
          <br />
          3. Configurar NEXT_PUBLIC_BEEFREE_CLIENT_ID e NEXT_PUBLIC_BEEFREE_CLIENT_SECRET no .env.local
          <br />
          <br />
          <strong>Nota:</strong> Para produção, gere o token no servidor e passe via prop `token`.
        </small>
      </div>
    );
  }

  // Gerar ID único para o container (gerar uma vez e manter estável)
  const containerIdRef = useRef(null);
  if (!containerIdRef.current) {
    containerIdRef.current = `beefree-editor-${Math.random().toString(36).substr(2, 9)}`;
  }
  const containerId = containerIdRef.current;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f1419',
          color: '#ffffff',
          zIndex: 10,
          borderRadius: '12px',
          pointerEvents: 'none' // Permitir interação com o editor mesmo durante loading
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <div>Carregando editor Beefree...</div>
          </div>
        </div>
      )}
      <div
        id={containerId}
        ref={containerRef}
        style={{
          width: '100%',
          height: height,
          minHeight: '500px',
          borderRadius: '12px',
          overflow: 'hidden',
          display: isLoading ? 'none' : 'block',
          position: 'relative',
          zIndex: 1
        }}
      />
    </div>
  );
});

export default BeefreeEditor;
