'use client';

import React, { useState } from 'react';

const SimpleApp = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div className="p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h2>
            <div className="bg-white rounded-2xl p-6 shadow-lg border">
              <p className="text-gray-600">Sistema funcionando corretamente!</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Página {currentPage}</h2>
            <div className="bg-white rounded-2xl p-6 shadow-lg border">
              <p className="text-gray-600">Conteúdo da página {currentPage}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-indigo-900 text-white p-6">
          <h1 className="text-xl font-bold mb-6">WhatsApp Sales Agent</h1>
          <nav className="space-y-2">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="w-full text-left px-4 py-2 rounded hover:bg-indigo-800"
            >
              Dashboard
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SimpleApp;
