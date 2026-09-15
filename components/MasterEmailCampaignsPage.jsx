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
    ready: 'Pronta',
    writing: 'A gravar',
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
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [audienceMode, setAudienceMode] = useState('list'); // list | crm | users | all
  const [selectedListId, setSelectedListId] = useState('');
  const [counts, setCounts] = useState({ sendable: 0, total: 0, unsubscribed: 0 });
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [listName, setListName] = useState('');

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

  const loadLists = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/email/lists/${user.uid}`);
      const data = await r.json();
      if (data.success) {
        setLists(data.lists || []);
        if (!selectedListId && data.lists?.length) {
          setSelectedListId(data.lists[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [user?.uid, selectedListId]);

  const loadCounts = useCallback(async () => {
    if (!user?.uid) return;
    try {
      let url = `${BACKEND_URL}/api/email/audience-count/${user.uid}?audience=${encodeURIComponent(audienceMode)}`;
      if (audienceMode === 'list' && selectedListId) {
        url = `${BACKEND_URL}/api/email/audience-count/${user.uid}?listId=${encodeURIComponent(selectedListId)}`;
      }
      const r = await fetch(url);
      const data = await r.json();
      if (data.success) setCounts(data);
    } catch (_) {
      /* ignore */
    }
  }, [user?.uid, audienceMode, selectedListId]);

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
    loadLists();
  }, [loadCampaigns, loadLists]);

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

  const onImportFile = async (file) => {
    if (!file || !user?.uid) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.ods')) {
      showToast?.('Use ficheiro .csv, .xlsx ou .ods', 'error');
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userId', user.uid);
      fd.append('name', listName.trim() || file.name.replace(/\.(csv|xlsx|xls)$/i, ''));

      const r = await fetch(`${BACKEND_URL}/api/email/lists/import`, {
        method: 'POST',
        body: fd
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Falha no import');
      showToast?.(
        `Lista importada: ${data.count.toLocaleString('pt-PT')} emails` +
          (data.skipped ? ` (${data.skipped} ignorados)` : '') +
          (data.truncated ? ' — atingiu o limite máximo' : ''),
        'success'
      );
      setListName('');
      await loadLists();
      setSelectedListId(data.listId);
      setAudienceMode('list');
    } catch (e) {
      showToast?.(e.message || 'Erro no import', 'error');
    } finally {
      setImporting(false);
    }
  };

  const deleteList = async (listId) => {
    if (!window.confirm('Apagar esta lista permanentemente?')) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/email/lists/${user.uid}/${listId}`, {
        method: 'DELETE'
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Erro');
      showToast?.('Lista apagada', 'success');
      if (selectedListId === listId) setSelectedListId('');
      loadLists();
    } catch (e) {
      showToast?.(e.message, 'error');
    }
  };

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
    if (audienceMode === 'list' && !selectedListId) {
      showToast?.('Selecione ou importe uma lista', 'error');
      return;
    }
    if (!counts.sendable) {
      showToast?.('Nenhum destinatário enviável nesta audiência', 'error');
      return;
    }
    const label =
      audienceMode === 'list'
        ? 'lista importada'
        : audienceMode === 'crm'
          ? 'CRM'
          : audienceMode === 'users'
            ? 'Utilizadores'
            : 'Todos';
    if (
      !window.confirm(
        `Enviar campanha para ~${Number(counts.sendable).toLocaleString('pt-PT')} emails (${label})?\n\nListas grandes são enviadas em fila (pode demorar).`
      )
    ) {
      return;
    }

    setCreating(true);
    try {
      const body = {
        userId: user.uid,
        templateId: selectedTemplate.id,
        name: name.trim() || selectedTemplate.name,
        subject: subject.trim(),
        html: selectedTemplate.html,
        audience: audienceMode === 'list' ? `list:${selectedListId}` : audienceMode,
        listId: audienceMode === 'list' ? selectedListId : null
      };
      const r = await fetch(`${BACKEND_URL}/api/email/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Falha ao criar campanha');
      showToast?.(`Campanha na fila: ${Number(data.total).toLocaleString('pt-PT')} emails`, 'success');
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

  const downloadListTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = [
        { email: 'joao@email.com', nome: 'João Silva' },
        { email: 'maria@email.com', nome: 'Maria Santos' },
        { email: 'cliente@empresa.com', nome: 'Carlos' }
      ];
      const ws = XLSX.utils.json_to_sheet(rows, { header: ['email', 'nome'] });
      ws['!cols'] = [{ wch: 28 }, { wch: 22 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lista');
      XLSX.writeFile(wb, 'modelo-lista-emails.xlsx');
      showToast?.('Modelo Excel: coluna A = email, coluna B = nome', 'success');
    } catch (e) {
      console.error(e);
      showToast?.(e.message || 'Erro ao gerar modelo', 'error');
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      {/* Importação */}
      <div
        style={{
          backgroundColor: '#1a1f36',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: 16,
          padding: isMobile ? 16 : 24,
          marginBottom: 24
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
            marginBottom: 8
          }}
        >
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>
            Importar lista (CSV / Excel / ODS)
          </h3>
          <button
            type="button"
            onClick={() => downloadListTemplate()}
            style={{
              background: 'transparent',
              border: '1px solid rgba(96,165,250,0.5)',
              color: '#93c5fd',
              borderRadius: 10,
              padding: '8px 14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Baixar modelo da planilha
          </button>
        </div>

        <p style={{ margin: '0 0 12px', color: '#9ca3af', fontSize: '0.875rem' }}>
          Até ~100 mil emails. Cada linha = 1 pessoa: a coluna{' '}
          <code style={{ color: '#93c5fd' }}>nome</code> da mesma linha é usada em{' '}
          <code style={{ color: '#6ee7b7' }}>{'{{clientName}}'}</code> no template.
          Duplicados são removidos. Aceita .csv, .xlsx, .xls e .ods.
        </p>

        <div
          style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            overflowX: 'auto'
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 8 }}>
            Exemplo (nome e email na mesma linha):
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#e5e7eb' }}>
            <thead>
              <tr style={{ color: '#93c5fd', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>email</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>nome</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '6px 8px' }}>joao@email.com</td>
                <td style={{ padding: '6px 8px' }}>João Silva</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>maria@email.com</td>
                <td style={{ padding: '6px 8px' }}>Maria Santos</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: '0.75rem', color: '#6ee7b7', marginTop: 8 }}>
            No email: Olá {'{{clientName}}'} → “Olá João Silva” / “Olá Maria Santos”
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
            gap: 12,
            alignItems: 'end',
            marginBottom: 16
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Nome da lista</span>
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              style={inputStyle}
              placeholder="Ex: Leads março 2026"
            />
          </label>
          <label
            style={{
              background: importing ? '#374151' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
              color: '#fff',
              borderRadius: 10,
              padding: '12px 18px',
              fontWeight: 600,
              cursor: importing ? 'wait' : 'pointer',
              textAlign: 'center'
            }}
          >
            {importing ? 'A importar…' : 'Escolher ficheiro'}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet"
              style={{ display: 'none' }}
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) onImportFile(f);
              }}
            />
          </label>
        </div>

        {lists.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lists.map((L) => (
              <div
                key={L.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  alignItems: 'center',
                  background: selectedListId === L.id ? '#0f1c33' : '#12182b',
                  border:
                    selectedListId === L.id
                      ? '1px solid rgba(96,165,250,0.5)'
                      : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '10px 12px'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedListId(L.id);
                    setAudienceMode('list');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e5e7eb',
                    textAlign: 'left',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{L.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    {Number(L.count || 0).toLocaleString('pt-PT')} emails · {statusLabel(L.status)}
                    {L.fileName ? ` · ${L.fileName}` : ''}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteList(L.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '1.1rem'
                  }}
                  title="Apagar lista"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campanha */}
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
          Listas grandes usam fila com cursor (não carregam 50k de uma vez). Tracking: aberturas/cliques;
          delivery/bounce via SNS → <code style={{ color: '#6ee7b7' }}>/api/email/ses-sns</code>.
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
            <select
              value={audienceMode}
              onChange={(e) => setAudienceMode(e.target.value)}
              style={selectStyle}
            >
              <option value="list">Lista importada (CSV/Excel)</option>
              <option value="crm">Clientes CRM com email</option>
              <option value="users">Utilizadores registados</option>
              <option value="all">CRM + Utilizadores</option>
            </select>
          </label>

          {audienceMode === 'list' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Lista</span>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                style={selectStyle}
              >
                <option value="">Selecionar lista…</option>
                {lists.map((L) => (
                  <option key={L.id} value={L.id}>
                    {L.name} ({Number(L.count || 0).toLocaleString('pt-PT')})
                  </option>
                ))}
              </select>
            </label>
          )}

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
            Enviáveis: <strong style={{ color: '#34d399' }}>{Number(counts.sendable || 0).toLocaleString('pt-PT')}</strong>
            {' · '}Total: {Number(counts.total || 0).toLocaleString('pt-PT')}
            {counts.unsubscribed != null ? ` · Unsub: ${counts.unsubscribed}` : ''}
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
