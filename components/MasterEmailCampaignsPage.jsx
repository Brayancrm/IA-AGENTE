'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

const BACKEND_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BACKEND_URL) ||
  'https://ia-agente-production.up.railway.app';

function Stat({ label, value, color }) {
  return (
    <div
      style={{
        backgroundColor: '#12182b',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 12,
        padding: '14px 16px',
        minWidth: 110
      }}
    >
      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: color || '#fff' }}>{value ?? 0}</div>
    </div>
  );
}

function statusLabel(s) {
  const map = {
    queued: 'Na fila',
    sending: 'A enviar',
    completed: 'Concluída',
    cancelled: 'Cancelada',
    draft: 'Rascunho',
    sent: 'Enviado',
    delivered: 'Entregue',
    opened: 'Aberto',
    bounced: 'Bounce',
    failed: 'Falhou',
    complained: 'Complaint',
    unsubscribed: 'Unsub'
  };
  return map[s] || s || '—';
}

export default function MasterEmailCampaignsPage({
  user,
  isMobile,
  showToast,
  emailTemplates = []
}) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [audience, setAudience] = useState('crm');
  const [counts, setCounts] = useState({ sendable: 0, total: 0, unsubscribed: 0 });
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');

  const selectedTemplate = useMemo(
    () => emailTemplates.find((t) => t.id === templateId) || null,
    [emailTemplates, templateId]
  );

  const loadCampaigns = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/email/campaigns/${user.uid}`);
      const data = await r.json();
      if (data.success) setCampaigns(data.campaigns || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const loadCounts = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const r = await fetch(
        `${BACKEND_URL}/api/email/audience-count/${user.uid}?audience=${encodeURIComponent(audience)}`
      );
      const data = await r.json();
      if (data.success) setCounts(data);
    } catch (_) {
      /* ignore */
    }
  }, [user?.uid, audience]);

  const loadDetail = useCallback(
    async (campaignId) => {
      if (!user?.uid || !campaignId) return;
      try {
        const r = await fetch(`${BACKEND_URL}/api/email/campaigns/${user.uid}/${campaignId}`);
        const data = await r.json();
        if (data.success) {
          setDetail(data);
          setSelectedId(campaignId);
        }
      } catch (e) {
        showToast?.(e.message || 'Erro ao carregar campanha', 'error');
      }
    },
    [user?.uid, showToast]
  );

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject || '');
    if (!name) setName(selectedTemplate.name || '');
  }, [selectedTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return;
    const id = setInterval(() => {
      loadCampaigns();
      loadDetail(selectedId);
    }, 8000);
    return () => clearInterval(id);
  }, [selectedId, loadCampaigns, loadDetail]);

  const launch = async () => {
    if (!user?.uid) return;
    if (!selectedTemplate?.html) {
      showToast?.('Escolha um template com HTML exportado (guarde o template no editor).', 'error');
      return;
    }
    if (!subject.trim()) {
      showToast?.('Assunto obrigatório', 'error');
      return;
    }
    if (!counts.sendable) {
      showToast?.('Nenhum destinatário enviável nesta audiência', 'error');
      return;
    }
    if (
      !window.confirm(
        `Enviar campanha para ~${counts.sendable} emails (${audience === 'crm' ? 'CRM' : audience === 'users' ? 'Utilizadores' : 'Todos'})?`
      )
    ) {
      return;
    }

    setCreating(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/email/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          templateId: selectedTemplate.id,
          name: name.trim() || selectedTemplate.name,
          subject: subject.trim(),
          html: selectedTemplate.html,
          audience
        })
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Falha ao criar campanha');
      showToast?.(`Campanha na fila: ${data.total} emails`, 'success');
      await loadCampaigns();
      if (data.campaignId) await loadDetail(data.campaignId);
    } catch (e) {
      showToast?.(e.message || 'Erro', 'error');
    } finally {
      setCreating(false);
    }
  };

  const cancel = async (campaignId) => {
    if (!window.confirm('Cancelar o envio desta campanha?')) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/email/campaigns/${campaignId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Erro');
      showToast?.('Campanha cancelada', 'success');
      loadCampaigns();
      if (selectedId === campaignId) loadDetail(campaignId);
    } catch (e) {
      showToast?.(e.message, 'error');
    }
  };

  const stats = detail?.campaign?.stats || {};

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          backgroundColor: '#1a1f36',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 16,
          padding: isMobile ? 16 : 24,
          marginBottom: 24
        }}
      >
        <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.25rem' }}>
          Campanhas em massa (Master)
        </h3>
        <p style={{ margin: '0 0 20px', color: '#9ca3af', fontSize: '0.9rem' }}>
          Envio via AWS SES com fila, métricas de entrega/abertura/clique e link de cancelamento.
          Configure SNS → <code style={{ color: '#6ee7b7' }}>/api/email/ses-sns</code> para delivery/bounce.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12,
            marginBottom: 16
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Template</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Selecionar…</option>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.subject || t.id}
                  {!t.html ? ' (sem HTML)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Audiência</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} style={selectStyle}>
              <option value="crm">Clientes CRM com email</option>
              <option value="users">Utilizadores registados</option>
              <option value="all">CRM + Utilizadores</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Nome da campanha</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Ex: Promo março" />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Assunto</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} placeholder="Assunto do email" />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ color: '#d1d5db', fontSize: '0.9rem' }}>
            Enviáveis: <strong style={{ color: '#34d399' }}>{counts.sendable}</strong>
            {' · '}Total: {counts.total}
            {' · '}Unsub: {counts.unsubscribed}
          </div>
          <button
            type="button"
            onClick={launch}
            disabled={creating}
            style={{
              background: creating ? '#374151' : 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontWeight: 600,
              cursor: creating ? 'wait' : 'pointer'
            }}
          >
            {creating ? 'A enfileirar…' : 'Lançar campanha'}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : selectedId ? '1fr 1.2fr' : '1fr',
          gap: 20
        }}
      >
        <div>
          <h4 style={{ color: '#fff', margin: '0 0 12px' }}>Histórico</h4>
          {loading ? (
            <p style={{ color: '#9ca3af' }}>A carregar…</p>
          ) : campaigns.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>Ainda sem campanhas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadDetail(c.id)}
                  style={{
                    textAlign: 'left',
                    background: selectedId === c.id ? '#12261f' : '#12182b',
                    border:
                      selectedId === c.id
                        ? '1px solid rgba(16,185,129,0.5)'
                        : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: 14,
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.name || c.subject}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    {statusLabel(c.status)} · {c.stats?.sent || 0}/{c.stats?.total || 0} enviados ·{' '}
                    {c.createdAt ? new Date(c.createdAt).toLocaleString('pt-PT') : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {detail?.campaign && (
          <div
            style={{
              backgroundColor: '#1a1f36',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 16,
              padding: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, color: '#fff' }}>{detail.campaign.name}</h4>
                <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: 4 }}>
                  {statusLabel(detail.campaign.status)} · {detail.campaign.subject}
                </div>
              </div>
              {(detail.campaign.status === 'queued' || detail.campaign.status === 'sending') && (
                <button
                  type="button"
                  onClick={() => cancel(detail.campaign.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    height: 'fit-content'
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Stat label="Total" value={stats.total} />
              <Stat label="Enviados" value={stats.sent} color="#34d399" />
              <Stat label="Entregues" value={stats.delivered} color="#60a5fa" />
              <Stat label="Abertos" value={stats.opened} color="#fbbf24" />
              <Stat label="Cliques" value={stats.clicked} color="#a78bfa" />
              <Stat label="Bounces" value={stats.bounced} color="#f87171" />
              <Stat label="Falhas" value={stats.failed} color="#fb7185" />
              <Stat label="Unsub" value={stats.unsubscribed} />
            </div>

            <h5 style={{ color: '#d1d5db', margin: '0 0 8px' }}>Destinatários (últimos)</h5>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>Email</th>
                    <th style={{ padding: '6px 4px' }}>Estado</th>
                    <th style={{ padding: '6px 4px' }}>Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.recipients || []).slice(0, 100).map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#e5e7eb' }}>
                      <td style={{ padding: '6px 4px' }}>{r.email}</td>
                      <td style={{ padding: '6px 4px' }}>{statusLabel(r.status)}</td>
                      <td style={{ padding: '6px 4px', color: '#9ca3af' }}>
                        {r.sentAt ? new Date(r.sentAt).toLocaleString('pt-PT') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  background: '#0f172a',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#fff',
  fontSize: '0.95rem'
};

const selectStyle = { ...inputStyle };
