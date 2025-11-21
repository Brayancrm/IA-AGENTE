'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Extensão do window para unlayer (TypeScript não é necessário aqui)
if (typeof window !== 'undefined' && !window.unlayer) {
  window.unlayer = undefined;
}

/**
 * UnlayerEditor - Componente isolado para o editor Unlayer
 * Implementação correta que evita problemas de reinicialização
 */
export default function UnlayerEditor({ 
  projectId, 
  apiKey, 
  initialDesign, 
  onReady,
  onDesignLoad,
  containerId 
}) {
  const containerRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const isInitializedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  // Função para inicializar o editor (só executa uma vez)
  const initializeEditor = useCallback(() => {
    // Proteção: não inicializar se já foi inicializado
    if (isInitializedRef.current || editorInstanceRef.current) {
      console.log('⚠️ Editor já inicializado, ignorando');
      return;
    }

    if (!containerRef.current || !window.unlayer) {
      console.log('⏳ Aguardando container ou script do Unlayer...');
      return;
    }

    if (!projectId) {
      setError('Project ID do Unlayer não está configurado');
      return;
    }

    try {
      console.log('🔄 Inicializando editor Unlayer...');
      
      const editorId = containerId || `unlayer-editor-${Date.now()}`;
      if (containerRef.current) {
        containerRef.current.id = editorId;
      }

      const config = {
        id: editorId,
        projectId: parseInt(projectId),
        displayMode: 'email',
        appearance: {
          theme: 'dark'
        },
        locale: 'pt-BR'
      };

      if (apiKey) {
        config.apiKey = apiKey;
      }

      editorInstanceRef.current = window.unlayer.init(config);
      isInitializedRef.current = true;

      // Listener para quando editor estiver pronto
      if (editorInstanceRef.current) {
        editorInstanceRef.current.addEventListener('editor:ready', () => {
          console.log('✅ Editor Unlayer pronto');
          setIsReady(true);
          
          // Carregar design inicial se fornecido
          if (initialDesign && editorInstanceRef.current.loadDesign) {
            setTimeout(() => {
              try {
                editorInstanceRef.current.loadDesign(initialDesign);
                if (onDesignLoad) {
                  onDesignLoad();
                }
              } catch (loadError) {
                console.error('Erro ao carregar design:', loadError);
              }
            }, 300);
          }

          if (onReady) {
            onReady(editorInstanceRef.current);
          }
        });
      }

      console.log('✅ Editor Unlayer inicializado (ID:', editorId, ')');
    } catch (err) {
      console.error('❌ Erro ao inicializar editor:', err);
      setError(err.message || 'Erro ao inicializar editor');
      isInitializedRef.current = false;
    }
  }, [projectId, apiKey, initialDesign, containerId, onReady, onDesignLoad]);

  // Aguardar script do Unlayer carregar
  useEffect(() => {
    if (!window.unlayer) {
      // Verificar se script já está carregando
      const checkInterval = setInterval(() => {
        if (window.unlayer) {
          clearInterval(checkInterval);
          initializeEditor();
        }
      }, 100);

      // Timeout após 10 segundos
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.unlayer) {
          setError('Timeout: Script do Unlayer não carregou. Verifique sua conexão.');
        }
      }, 10000);

      return () => clearInterval(checkInterval);
    } else {
      // Script já está carregado
      initializeEditor();
    }
  }, [initializeEditor]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (editorInstanceRef.current) {
        try {
          editorInstanceRef.current.destroy();
          isInitializedRef.current = false;
          editorInstanceRef.current = null;
        } catch (e) {
          console.error('Erro ao destruir editor:', e);
        }
      }
    };
  }, []);

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
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!isReady && (
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
          borderRadius: '12px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <div>Carregando editor...</div>
          </div>
        </div>
      )}
      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: '500px',
          display: isReady ? 'block' : 'none'
        }}
      />
    </div>
  );
}

// Função auxiliar para exportar conteúdo
export const exportUnlayerContent = (editorInstance, callback) => {
  if (!editorInstance) {
    if (callback) callback(null);
    return;
  }

  try {
    editorInstance.exportHtml((data) => {
      if (callback) {
        callback({
          html: data.html,
          design: data.design
        });
      }
    });
  } catch (err) {
    console.error('Erro ao exportar:', err);
    if (callback) callback(null);
  }
};

