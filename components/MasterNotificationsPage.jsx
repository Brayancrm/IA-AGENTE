'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ref, onValue, off, update, push, get, set } from 'firebase/database';
import { useFirebase } from '../hooks/useFirebase';
import { useI18n } from '../contexts/I18nContext';
import { Bell } from 'lucide-react';

const PREFS_PATH = 'master_notification_prefs';
const TOKENS_PATH = 'fcm_tokens';

export default function MasterNotificationsPage({ user, isMobile, showToast }) {
  const { app, database, isReady } = useFirebase();
  const { t } = useI18n();
  const [prefs, setPrefs] = useState({ panelTestCreated: true, tvLoginSold: true });
  const [tokenStatus, setTokenStatus] = useState('idle');
  const [hasToken, setHasToken] = useState(false);
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

  useEffect(() => {
    if (!database || !user?.uid) return;
    const r = ref(database, `users/data/${user.uid}/${PREFS_PATH}`);
    const cb = (snap) => {
      const v = snap.val();
      setPrefs({
        panelTestCreated: v?.panelTestCreated !== false,
        tvLoginSold: v?.tvLoginSold !== false
      });
    };
    onValue(r, cb);
    return () => off(r, 'value', cb);
  }, [database, user?.uid]);

  useEffect(() => {
    if (!database || !user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await get(ref(database, `users/data/${user.uid}/${TOKENS_PATH}`));
        if (cancelled) return;
        setHasToken(snap.exists() && Object.keys(snap.val()).length > 0);
      } catch {
        if (!cancelled) setHasToken(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [database, user?.uid, tokenStatus]);

  const setPref = useCallback(
    async (key, value) => {
      if (!database || !user?.uid) return;
      try {
        await update(ref(database, `users/data/${user.uid}/${PREFS_PATH}`), { [key]: value });
        showToast(t('notificationsPage.prefSaved'), 'success');
      } catch (e) {
        showToast(e.message || t('notificationsPage.prefError'), 'error');
      }
    },
    [database, user?.uid, showToast, t]
  );

  const saveFcmToken = useCallback(
    async (token) => {
      if (!database || !user?.uid || !token) return;
      const base = ref(database, `users/data/${user.uid}/${TOKENS_PATH}`);
      const snap = await get(base);
      if (snap.exists()) {
        const entries = Object.entries(snap.val());
        const existing = entries.find(([, v]) => v && v.token === token);
        if (existing) {
          await update(ref(database, `users/data/${user.uid}/${TOKENS_PATH}/${existing[0]}`), {
            token,
            updatedAt: new Date().toISOString()
          });
          return;
        }
      }
      const newRef = push(base);
      await set(newRef, {
        token,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      });
    },
    [database, user?.uid]
  );

  const enablePush = useCallback(async () => {
    if (!app || !isReady) {
      showToast(t('notificationsPage.waitFirebase'), 'error');
      return;
    }
    if (!vapidKey) {
      showToast(t('notificationsPage.missingVapid'), 'error');
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast(t('notificationsPage.notSupported'), 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      showToast(t('notificationsPage.permissionDenied'), 'error');
      return;
    }
    setTokenStatus('loading');
    try {
      const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
      const ok = await isSupported();
      if (!ok) {
        showToast(t('notificationsPage.messagingUnsupported'), 'error');
        setTokenStatus('idle');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration
      });
      if (!token) {
        showToast(t('notificationsPage.noToken'), 'error');
        setTokenStatus('idle');
        return;
      }
      await saveFcmToken(token);
      setHasToken(true);
      setTokenStatus('done');
      showToast(t('notificationsPage.enabledOk'), 'success');
    } catch (e) {
      console.error(e);
      showToast(e.message || t('notificationsPage.enableError'), 'error');
      setTokenStatus('idle');
    }
  }, [app, isReady, vapidKey, saveFcmToken, showToast, t]);

  const pad = isMobile ? '16px' : '24px';

  return (
    <div style={{ padding: pad, maxWidth: '720px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Bell size={isMobile ? 28 : 32} color="#10b981" />
        <div>
          <h2
            style={{
              fontSize: isMobile ? '1.5rem' : '2rem',
              fontWeight: 700,
              color: '#fff',
              margin: 0
            }}
          >
            {t('notificationsPage.title')}
          </h2>
          <p style={{ color: '#9ca3af', margin: '6px 0 0', fontSize: '0.95rem' }}>
            {t('notificationsPage.subtitle')}
          </p>
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#1a1f36',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          marginBottom: '20px'
        }}
      >
        <p style={{ color: '#d1d5db', marginBottom: '16px', lineHeight: 1.5 }}>
          {t('notificationsPage.deviceHint')}
        </p>
        <button
          type="button"
          onClick={enablePush}
          disabled={tokenStatus === 'loading'}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '12px 22px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 600,
            cursor: tokenStatus === 'loading' ? 'wait' : 'pointer',
            opacity: tokenStatus === 'loading' ? 0.85 : 1
          }}
        >
          {tokenStatus === 'loading' ? '…' : t('notificationsPage.enableButton')}
        </button>
        {hasToken && (
          <p style={{ color: '#6ee7b7', marginTop: '12px', fontSize: '0.875rem' }}>
            {t('notificationsPage.tokenRegistered')}
          </p>
        )}
      </div>

      <div
        style={{
          backgroundColor: '#1a1f36',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(16, 185, 129, 0.25)'
        }}
      >
        <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '16px' }}>
          {t('notificationsPage.typesTitle')}
        </h3>

        {[
          { key: 'panelTestCreated', label: t('notificationsPage.typePanelTest') },
          { key: 'tvLoginSold', label: t('notificationsPage.typeTvSold') }
        ].map((row) => (
          <label
            key={row.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 0',
              borderBottom: '1px solid rgba(55, 65, 81, 0.6)',
              cursor: 'pointer',
              color: '#e5e7eb'
            }}
          >
            <span>{row.label}</span>
            <input
              type="checkbox"
              checked={prefs[row.key] !== false}
              onChange={(e) => setPref(row.key, e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
            />
          </label>
        ))}
      </div>

      <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '20px', lineHeight: 1.5 }}>
        {t('notificationsPage.footerNote')}
      </p>
    </div>
  );
}
