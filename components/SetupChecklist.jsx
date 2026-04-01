'use client';

import { useMemo, useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';

function hasStripeSecret(integrationsConfig) {
  const k = integrationsConfig?.stripeApiKey;
  return typeof k === 'string' && k.startsWith('sk_');
}

function hasTvCatalog(catalogItems) {
  return (catalogItems || []).some((c) => c?.tvLoginProduct && String(c?.tvPlanKey || '').trim());
}

function tvLoginEffectivelyAvailable(l, nowMs = Date.now()) {
  if (l?.status === 'sold') return false;
  if (l?.status === 'reserved') {
    const until = l.reservedUntil ? new Date(l.reservedUntil).getTime() : 0;
    if (until && until > nowMs) return false;
  }
  return true;
}

function hasTvStock(tvLogins) {
  const nowMs = Date.now();
  return (tvLogins || []).some((l) => tvLoginEffectivelyAvailable(l, nowMs));
}

export default function SetupChecklist({
  integrationsConfig,
  catalogItems,
  assistantSettings,
  tvLogins,
  whatsappStatus
}) {
  const { t } = useI18n();
  const [reservedTick, setReservedTick] = useState(0);

  useEffect(() => {
    const hasReserved = (tvLogins || []).some((l) => l?.status === 'reserved');
    if (!hasReserved) return undefined;
    const id = setInterval(() => setReservedTick((n) => n + 1), 8000);
    return () => clearInterval(id);
  }, [tvLogins]);

  const steps = useMemo(
    () => [
      {
        id: 'stripe',
        label: t('setupChecklist.stepStripe'),
        ok: hasStripeSecret(integrationsConfig)
      },
      {
        id: 'whatsapp',
        label: t('setupChecklist.stepWhatsapp'),
        ok: (whatsappStatus || '') === 'connected'
      },
      {
        id: 'catalogTv',
        label: t('setupChecklist.stepCatalogTv'),
        ok: hasTvCatalog(catalogItems)
      },
      {
        id: 'stock',
        label: t('setupChecklist.stepStock'),
        ok: hasTvStock(tvLogins)
      },
      {
        id: 'assistant',
        label: t('setupChecklist.stepAssistant'),
        ok: !!(assistantSettings?.systemPrompt && String(assistantSettings.systemPrompt).trim().length > 20)
      }
    ],
    [integrationsConfig, catalogItems, tvLogins, assistantSettings, whatsappStatus, t, reservedTick]
  );

  const doneCount = steps.filter((s) => s.ok).length;

  return (
    <div
      role="region"
      aria-label={t('setupChecklist.title')}
      style={{
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid rgba(16, 185, 129, 0.35)'
      }}
    >
      <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1.1rem' }}>{t('setupChecklist.title')}</h3>
      <p style={{ margin: '0 0 8px 0', color: '#9ca3af', fontSize: '0.875rem' }}>
        {t('setupChecklist.subtitle', { done: doneCount, total: steps.length })}
      </p>
      <ol style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', lineHeight: 1.7, fontSize: '0.9rem' }}>
        {steps.map((s) => (
          <li key={s.id} style={{ marginBottom: '4px' }}>
            <span style={{ color: s.ok ? '#34d399' : '#9ca3af' }}>{s.ok ? '✓ ' : '○ '}</span>
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
