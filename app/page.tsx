'use client';

import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          WhatsApp Sales Agent
        </h1>
        <p className="text-gray-600 mb-8">
          Sistema de gestão de vendas via WhatsApp
        </p>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <p className="text-green-600 font-semibold">
            ✅ Aplicação funcionando corretamente!
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Sistema básico carregado com sucesso.
          </p>
        </div>
      </div>
    </div>
  );
}