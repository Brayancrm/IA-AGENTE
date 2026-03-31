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
const COUNTRY_TO_LOCALE = {
  BR: 'pt',
  PT: 'pt',
  AO: 'pt',
  MZ: 'pt',
  IT: 'it',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  UY: 'es',
  PY: 'es',
  BO: 'es',
  EC: 'es',
  VE: 'es',
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  IE: 'en',
  NZ: 'en'
};

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

function guessLocaleFromNavigator() {
  const nav = typeof navigator !== 'undefined' ? navigator.language || 'pt' : 'pt';
  const lower = nav.toLowerCase();
  if (lower.startsWith('it')) return 'it';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('en')) return 'en';
  return 'pt';
}

async function guessLocaleFromIp() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    const country = String(data?.country_code || '').toUpperCase();
    const guessed = COUNTRY_TO_LOCALE[country];
    return SUPPORTED_LOCALES.includes(guessed) ? guessed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState('pt');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initLocale = async () => {
      try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LOCALES.includes(stored)) {
        if (!cancelled) {
          setLocaleState(stored);
          setReady(true);
        }
        return;
      }
        const byIp = await guessLocaleFromIp();
        const byNav = guessLocaleFromNavigator();
        const guess = byIp || byNav || 'pt';
        if (!cancelled) {
          setLocaleState(SUPPORTED_LOCALES.includes(guess) ? guess : 'pt');
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setLocaleState('pt');
          setReady(true);
        }
      }
    };
    initLocale();
    return () => {
      cancelled = true;
    };
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
