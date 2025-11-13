'use client';

import React, { useState } from 'react';
import LandingPageSimple from './LandingPageSimple';
import SimpleApp from './SimpleApp';

const MainAppSimple = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LandingPageSimple onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div>
      <div className="bg-indigo-900 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">dadosIA</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Sair
        </button>
      </div>
      <SimpleApp />
    </div>
  );
};

export default MainAppSimple;
