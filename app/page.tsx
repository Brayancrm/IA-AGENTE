'use client';

import React from 'react';
import FirebaseApp from '../components/FirebaseApp';
import { I18nProvider } from '../contexts/I18nContext';

export default function Home() {
  return (
    <I18nProvider>
      <FirebaseApp />
    </I18nProvider>
  );
}