'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { useFirebase } from '../hooks/useFirebase';

function getBackendUrl() {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

/**
 * URL Android + upload de APK. O ficheiro vai pelo backend (Firebase Admin → Storage)
 * para não depender de CORS no browser para firebasestorage.googleapis.com.
 */
export default function PanelAndroidApkField({
  userId,
  sectionEnabled,
  androidLink,
  onAndroidLinkChange,
  showToast
}) {
  const { app, auth } = useFirebase();
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const canInteract = Boolean(sectionEnabled && app && userId && auth?.currentUser && !uploading);

  const pickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    async (e) => {
      const inputEl = e.target;
      const file = inputEl.files?.[0];
      inputEl.value = '';
      if (!file || !app || !userId || !auth?.currentUser) return;
      if (!file.name.toLowerCase().endsWith('.apk')) {
        showToast(t('assistantConfig.panelTestAndroidUploadInvalid'), 'error');
        return;
      }
      setUploading(true);
      try {
        const idToken = await auth.currentUser.getIdToken();
        const fd = new FormData();
        fd.append('file', file, file.name);
        const res = await fetch(`${getBackendUrl()}/api/storage/upload-assistant-apk`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
          body: fd
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data.error || t('assistantConfig.panelTestAndroidUploadError'), 'error');
          return;
        }
        if (data.downloadUrl) {
          onAndroidLinkChange(data.downloadUrl);
          showToast(t('assistantConfig.panelTestAndroidUploadDone'), 'success');
        } else {
          showToast(t('assistantConfig.panelTestAndroidUploadError'), 'error');
        }
      } catch (err) {
        console.error(err);
        showToast(err?.message || t('assistantConfig.panelTestAndroidUploadError'), 'error');
      } finally {
        setUploading(false);
      }
    },
    [app, auth, userId, onAndroidLinkChange, showToast, t]
  );

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontWeight: 600,
          color: '#e5e7eb',
          marginBottom: '6px',
          fontSize: '0.8125rem'
        }}
      >
        {t('assistantConfig.panelTestAndroidLinkLabel')}
      </label>
      <input
        type="text"
        disabled={!sectionEnabled}
        value={androidLink || ''}
        onChange={(e) => onAndroidLinkChange(e.target.value)}
        placeholder="https://... ou carregue um .apk abaixo"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: '#0f1419',
          color: '#fff',
          fontSize: '0.875rem',
          opacity: sectionEnabled ? 1 : 0.7
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".apk,application/vnd.android.package-archive"
        style={{ display: 'none' }}
        disabled={!canInteract}
        onChange={onFileChange}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
        <button
          type="button"
          disabled={!canInteract}
          onClick={pickFile}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#a7f3d0',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: canInteract ? 'pointer' : 'not-allowed',
            opacity: sectionEnabled && app && userId && auth?.currentUser ? 1 : 0.5
          }}
        >
          <Upload size={16} />
          {uploading
            ? t('assistantConfig.panelTestAndroidUploading')
            : t('assistantConfig.panelTestAndroidUploadButton')}
        </button>
        {!app && (
          <span style={{ fontSize: '0.72rem', color: '#f87171', alignSelf: 'center' }}>
            {t('assistantConfig.panelTestAndroidStorageMissing')}
          </span>
        )}
      </div>
      <p style={{ margin: '6px 0 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
        {t('assistantConfig.panelTestAndroidLinkHint')}
      </p>
      <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: '#52525b' }}>
        {t('assistantConfig.panelTestAndroidUploadSubhint')}
      </p>
    </div>
  );
}
