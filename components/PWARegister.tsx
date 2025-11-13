'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    // Registrar Service Worker apenas no cliente
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registrado com sucesso:', registration.scope);
          })
          .catch((error) => {
            console.log('Erro ao registrar Service Worker:', error);
          });
      });
    }
  }, []);

  return null; // Componente não renderiza nada
}

