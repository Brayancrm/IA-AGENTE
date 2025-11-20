'use client';

import Script from 'next/script';
import { useEffect } from 'react';

// Declaração de tipo para window.unlayer
declare global {
  interface Window {
    unlayer?: any;
  }
}

export function UnlayerScript() {
  useEffect(() => {
    // Log quando o script carregar
    const handleLoad = () => {
      if (typeof window !== 'undefined' && window.unlayer) {
        console.log('✅ Unlayer script carregado no head');
      }
    };

    // Verificar se já está carregado
    if (typeof window !== 'undefined' && window.unlayer) {
      handleLoad();
    }

    // Adicionar listener para quando o script carregar
    window.addEventListener('unlayer-loaded', handleLoad);

    return () => {
      window.removeEventListener('unlayer-loaded', handleLoad);
    };
  }, []);

  return (
    <Script
      src="https://editor.unlayer.com/embed.js"
      strategy="lazyOnload"
      onLoad={() => {
        if (typeof window !== 'undefined') {
          console.log('✅ Unlayer script carregado no head');
          // Disparar evento customizado
          window.dispatchEvent(new Event('unlayer-loaded'));
        }
      }}
      onError={(e) => {
        console.error('❌ Erro ao carregar script do Unlayer no head:', e);
      }}
    />
  );
}

