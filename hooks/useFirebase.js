'use client';

import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: 'https://ia-agente-b2f46.firebaseio.com'
};

export const useFirebase = () => {
  const [firebase, setFirebase] = useState({
    app: null,
    db: null,
    auth: null,
    database: null,
    storage: null,
    isReady: false,
    error: null
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      console.log('Inicializando Firebase com Realtime Database...');
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const auth = getAuth(app);
      const database = getDatabase(app);
      const storage = getStorage(app);
      
      console.log('Firebase inicializado com sucesso!', {
        hasApp: !!app,
        hasDb: !!db,
        hasAuth: !!auth,
        hasDatabase: !!database,
        hasStorage: !!storage
      });

      setFirebase({
        app,
        db,
        auth,
        database,
        storage,
        isReady: true,
        error: null
      });
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
      setFirebase(prev => ({
        ...prev,
        error: error.message,
        isReady: false
      }));
    }
  }, []);

  return firebase;
};
