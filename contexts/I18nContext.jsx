'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { messages, SUPPORTED_LOCALES } from '../locales';

const STORAGE_KEY = 'dadosia_ui_locale';

const I18nContext = createContext(null);

function resolveMessage(locale, key) {
  const parts = key.split('.');
  const walk = (root) => {
    let o = root;
    for (const p of parts) {
      o = o?.[p];
    }
    return typeof o === 'string' ? o : null;
  };
  return walk(messages[locale]) || walk(messages.pt) || key;
}

function langAttr(loc) {
  if (loc === 'pt') return 'pt-BR';
  if (loc === 'it') return 'it-IT';
  if (loc === 'es') return 'es-ES';
  if (loc === 'en') return 'en-US';
  return 'pt-BR';
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState('pt');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LOCALES.includes(stored)) {
        setLocaleState(stored);
        setReady(true);
        return;
      }
      const nav = typeof navigator !== 'undefined' ? navigator.language || 'pt' : 'pt';
      const lower = nav.toLowerCase();
      let guess = 'pt';
      if (lower.startsWith('it')) guess = 'it';
      else if (lower.startsWith('es')) guess = 'es';
      else if (lower.startsWith('en')) guess = 'en';
      setLocaleState(SUPPORTED_LOCALES.includes(guess) ? guess : 'pt');
    } catch {
      setLocaleState('pt');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      document.documentElement.lang = langAttr(locale);
    } catch {
      /* ignore */
    }
  }, [locale, ready]);

  const setLocale = useCallback((loc) => {
    if (!SUPPORTED_LOCALES.includes(loc)) return;
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch {
      /* ignore */
    }
    try {
      document.documentElement.lang = langAttr(loc);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key) => resolveMessage(locale, key),
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales: SUPPORTED_LOCALES,
      ready
    }),
    [locale, setLocale, t, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n deve ser usado dentro de I18nProvider');
  }
  return ctx;
}
