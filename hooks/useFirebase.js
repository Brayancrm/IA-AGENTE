'use client';

import { useState, useEffect } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: 'https://ia-agente-b2f46.firebaseio.com',
  ...(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    ? { measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID }
    : {})
};

const EMPTY = {
  app: null,
  db: null,
  auth: null,
  database: null,
  storage: null,
  isReady: false,
  error: null
};

/** Estado único do cliente; vários `useFirebase()` partilham a mesma instância. */
let clientSnapshot = { ...EMPTY };
let clientInitDone = false;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function bootstrapFirebaseClient() {
  if (typeof window === 'undefined') return;
  if (clientInitDone) {
    notifyListeners();
    return;
  }
  clientInitDone = true;

  try {
    console.log('Inicializando Firebase com Realtime Database...');
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
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

    clientSnapshot = {
      app,
      db,
      auth,
      database,
      storage,
      isReady: true,
      error: null
    };
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
    clientSnapshot = {
      ...EMPTY,
      error: error.message,
      isReady: false
    };
  }
  notifyListeners();
}

/**
 * Cliente Firebase partilhado. Pode ser chamado em vários componentes (ex.: FirebaseApp).
 * sem duplicar `initializeApp` nem estado desincronizado.
 */
export const useFirebase = () => {
  const [firebase, setFirebase] = useState(() => ({ ...clientSnapshot }));

  useEffect(() => {
    const onChange = () => {
      setFirebase({ ...clientSnapshot });
    };
    listeners.add(onChange);
    bootstrapFirebaseClient();
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return firebase;
};
