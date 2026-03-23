'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Building2,
  Database,
  Mic,
  ClipboardList
} from 'lucide-react';
import {
  WIZARD_TEMPLATES,
  getDefaultWizardState,
  buildFlowStepsFromWizardState,
  parseFlowStepsToWizardState
} from '../utils/assistantWizardHelpers';

const OPTIONAL_CRM_FIELDS = [
  { value: 'product', label: '📦 Produto ou serviço de interesse' },
  { value: 'email', label: '📧 Email' },
  { value: 'cpfCnpj', label: '🆔 CPF ou CNPJ' }
];

const APPOINTMENT_TYPES = [
  { value: 'retirada', label: '📦 Retirada' },
  { value: 'servico', label: '🔧 Serviço' },
  { value: 'visita', label: '🏢 Visita' },
  { value: 'entrega', label: '🚚 Entrega' },
  { value: 'ligacao', label: '📞 Ligação' },
  { value: 'consulta', label: '🩺 Consulta' },
  { value: 'reuniao', label: '👥 Reunião' }
];

const STEP_LABELS = [
  { n: 1, label: 'Modelo', icon: Sparkles },
  { n: 2, label: 'Negócio', icon: Building2 },
  { n: 3, label: 'CRM', icon: Database },
  { n: 4, label: 'Tom de voz', icon: Mic },
  { n: 5, label: 'Resumo', icon: ClipboardList }
];

export default function AssistantSetupWizard({
  catalogItems = [],
  flowSteps = [],
  onApplyFlow,
  resetKey = 0,
  showToast
}) {
  const [draft, setDraft] = useState(() => getDefaultWizardState(catalogItems));
  const [step, setStep] = useState(1);

  const productCategories = useMemo(
    () =>
      Array.from(
        new Set(
          (catalogItems || [])
            .filter((c) => c?.type === 'product' && c?.category)
            .map((c) => c.category.trim())
            .filter(Boolean)
        )
      ),
    [catalogItems]
  );

  const serviceCategories = useMemo(
    () =>
      Array.from(
        new Set(
          (catalogItems || [])
            .filter((c) => c?.type === 'service' && c?.category)
            .map((c) => c.category.trim())
            .filter(Boolean)
        )
      ),
    [catalogItems]
  );

  useEffect(() => {
    setDraft(parseFlowStepsToWizardState(flowSteps, catalogItems));
  }, [flowSteps, catalogItems]);

  useEffect(() => {
    setStep(1);
  }, [resetKey]);

  const template = WIZARD_TEMPLATES.find((t) => t.id === draft.templateId) || WIZARD_TEMPLATES[0];

  const updateBusiness = (patch) =>
    setDraft((d) => ({ ...d, business: { ...d.business, ...patch } }));
  const updateCrm = (patch) => setDraft((d) => ({ ...d, crm: { ...d.crm, ...patch } }));
  const updateTone = (patch) => setDraft((d) => ({ ...d, tone: { ...d.tone, ...patch } }));

  const handleApply = () => {
    const steps = buildFlowStepsFromWizardState(draft, catalogItems);
    onApplyFlow(steps);
    if (showToast) showToast('Fluxo gerado e aplicado ao rascunho. Clique em Salvar para publicar.', 'success');
  };

  const toggleCrmField = (value) => {
    const cur = draft.crm.crmFields || [];
    const next = cur.includes(value) ? cur.filter((f) => f !== value) : [...cur, value];
    updateCrm({ crmFields: next });
  };

  const toggleApptType = (value) => {
    const cur = draft.business.appointmentTypes || [];
    const next = cur.includes(value) ? cur.filter((f) => f !== value) : [...cur, value];
    updateBusiness({ appointmentTypes: next });
  };

  const toggleCat = (kind, cat) => {
    if (kind === 'product') {
      const cur = draft.business.productCategories || [];
      updateBusiness({
        productCategories: cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat]
      });
    } else {
      const cur = draft.business.serviceCategories || [];
      updateBusiness({
        serviceCategories: cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat]
      });
    }
  };

  const cardStyle = (active) => ({
    border: active ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(16, 185, 129, 0.12)' : '#0f1419',
    borderRadius: '16px',
    padding: '18px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease'
  });

  const showCatalog = ['full_sales', 'catalog_leads'].includes(draft.templateId);
  const showOrder = ['full_sales', 'catalog_leads'].includes(draft.templateId);
  const showAppointment = draft.templateId === 'appointments';
  const totalProducts = (catalogItems || []).filter((i) => i?.type === 'product').length;
  const totalServices = (catalogItems || []).filter((i) => i?.type === 'service').length;

  const validationIssues = useMemo(() => {
    const issues = [];
    const hasCatalogEnabled = draft.business.includeProducts || draft.business.includeServices;
    const hasCatalogItems = totalProducts > 0 || totalServices > 0;

    if (!draft.tone.agentName?.trim()) {
      issues.push({ level: 'error', text: 'Defina o nome do agente no passo "Tom de voz".' });
    }

    if (!draft.tone.agentRole?.trim()) {
      issues.push({ level: 'warning', text: 'Defina uma função para o agente (ex.: Consultor, Atendimento).' });
    }

    if (showCatalog && !hasCatalogEnabled) {
      issues.push({
        level: 'error',
        text: 'Ative produtos ou serviços para usar um modelo com catálogo.'
      });
    }

    if (showCatalog && hasCatalogEnabled && !hasCatalogItems) {
      issues.push({
        level: 'error',
        text: 'Não há itens no catálogo. Cadastre produtos/serviços antes de aplicar este fluxo.'
      });
    }

    if (showCatalog && draft.business.includeProducts && totalProducts === 0) {
      issues.push({
        level: 'error',
        text: 'Produtos ativados, mas nenhum produto foi encontrado no catálogo.'
      });
    }

    if (showCatalog && draft.business.includeServices && totalServices === 0) {
      issues.push({
        level: 'error',
        text: 'Serviços ativados, mas nenhum serviço foi encontrado no catálogo.'
      });
    }

    if (showAppointment && draft.business.enableAppointments && !(draft.business.appointmentTypes || []).length) {
      issues.push({
        level: 'error',
        text: 'Selecione ao menos um tipo de agendamento permitido.'
      });
    }

    if (showOrder && draft.business.paymentProvider === 'manual' && !draft.business.paymentManualMessage?.trim()) {
      issues.push({
        level: 'warning',
        text: 'Recomendado: preencher uma mensagem para pagamento manual (PIX/transferência).'
      });
    }

    if (
      showOrder &&
      draft.business.paymentProvider === 'stripe' &&
      draft.business.paymentStripeMessage &&
      draft.business.paymentStripeMessage.length > 240
    ) {
      issues.push({
        level: 'warning',
        text: 'Mensagem de pagamento Stripe está longa. Tente manter objetiva para WhatsApp.'
      });
    }

    if (!draft.crm.crmAutoSave && !(draft.crm.crmFields || []).length) {
      issues.push({
        level: 'warning',
        text: 'Sem auto-save e sem campos extras: você pode perder dados para o CRM.'
      });
    }

    return issues;
  }, [draft, showAppointment, showCatalog, showOrder, totalProducts, totalServices]);

  const hasBlockingIssues = validationIssues.some((issue) => issue.level === 'error');

  const previewConversation = useMemo(() => {
    const lines = [];
    const agentName = draft.tone.agentName?.trim() || 'Assistente';
    const hasCatalogEnabled = draft.business.includeProducts || draft.business.includeServices;

    lines.push({
      from: 'bot',
      text: `Olá! Eu sou ${agentName}. Posso te ajudar com ${showAppointment ? 'agendamentos' : 'produtos e serviços'} hoje?`
    });
    lines.push({ from: 'cliente', text: showAppointment ? 'Quero agendar um horário.' : 'Quero ver opções e preços.' });

    if (showCatalog && hasCatalogEnabled) {
      lines.push({
        from: 'bot',
        text: `Perfeito! Posso te mostrar ${
          draft.business.includeProducts && draft.business.includeServices
            ? 'produtos e serviços'
            : draft.business.includeProducts
              ? 'produtos'
              : 'serviços'
        } com valor e benefício principal.`
      });
      lines.push({ from: 'cliente', text: 'Gostei dessa opção, quero fechar.' });
    }

    if (showAppointment && draft.business.enableAppointments) {
      lines.push({
        from: 'bot',
        text: `Temos estes tipos: ${(draft.business.appointmentTypes || []).join(', ') || 'serviço, consulta'}. Qual você prefere?`
      });
      lines.push({ from: 'cliente', text: 'Consulta, amanhã às 14h.' });
    }

    if (showOrder) {
      lines.push({
        from: 'bot',
        text:
          draft.business.paymentProvider === 'stripe'
            ? 'Perfeito! Vou enviar o link de pagamento via WhatsApp para concluir.'
            : 'Perfeito! Vou te passar os dados para pagamento manual agora.'
      });
    }

    lines.push({
      from: 'bot',
      text: `Para finalizar, confirmo seus dados para o CRM (${[
        'nome',
        'telefone',
        ...(draft.crm.crmFields || [])
      ].join(', ')}).`
    });
    lines.push({
      from: 'bot',
      text: 'Resumo enviado! Se precisar, sigo com os próximos passos aqui no WhatsApp.'
    });

    return lines;
  }, [draft, showAppointment, showCatalog, showOrder]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stepper */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {STEP_LABELS.map(({ n, label, icon: Icon }) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            style={{
              flex: '1 1 120px',
              minWidth: '100px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '12px',
              border: step === n ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
              background: step === n ? 'rgba(16,185,129,0.15)' : '#0f1419',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Icon size={16} color={step === n ? '#34d399' : '#9ca3af'} />
            {n}. {label}
          </button>
        ))}
      </div>

      {/* Step 1 — Template */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {WIZARD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, templateId: t.id }))}
              style={cardStyle(draft.templateId === t.id)}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{t.icon}</div>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: '6px' }}>{t.name}</div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.4 }}>{t.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — Negócio */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
            Modelo: <strong style={{ color: '#fff' }}>{template.name}</strong> — ajuste o que o bot deve oferecer em cada fase.
          </p>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={draft.business.enableAudio}
              onChange={(e) => updateBusiness({ enableAudio: e.target.checked })}
              style={{ marginTop: '4px' }}
            />
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>🎤 Respostas em áudio</div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                Se o cliente mandar áudio, o agente responde em áudio (idioma abaixo).
              </div>
              {draft.business.enableAudio && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Idioma</label>
                    <select
                      value={draft.business.audioLanguage}
                      onChange={(e) => updateBusiness({ audioLanguage: e.target.value })}
                      style={selectStyle}
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="pt-PT">Português (Portugal)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es">Español</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Voz (opcional)</label>
                    <input
                      value={draft.business.audioVoice}
                      onChange={(e) => updateBusiness({ audioVoice: e.target.value })}
                      placeholder="Ex: alloy"
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>
          </label>

          {showCatalog && (
            <div style={sectionBox}>
              <h4 style={sectionTitle}>📦 Catálogo</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={rowCheck}>
                  <input
                    type="checkbox"
                    checked={draft.business.includeProducts}
                    onChange={(e) => updateBusiness({ includeProducts: e.target.checked })}
                  />
                  <span>Incluir produtos</span>
                </label>
                {draft.business.includeProducts && productCategories.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '24px' }}>
                    {productCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCat('product', category)}
                        style={pillBtnStyle(
                          draft.business.productCategories?.includes(category)
                        )}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                <label style={rowCheck}>
                  <input
                    type="checkbox"
                    checked={draft.business.includeServices}
                    onChange={(e) => updateBusiness({ includeServices: e.target.checked })}
                  />
                  <span>Incluir serviços</span>
                </label>
                {draft.business.includeServices && serviceCategories.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '24px' }}>
                    {serviceCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCat('service', category)}
                        style={pillBtnStyle(
                          draft.business.serviceCategories?.includes(category)
                        )}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                <label style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  Instruções para listar o catálogo (opcional)
                  <textarea
                    value={draft.business.catalogInstructions}
                    onChange={(e) => updateBusiness({ catalogInstructions: e.target.value })}
                    rows={3}
                    style={{ ...textareaStyle, marginTop: '6px' }}
                    placeholder="Ex.: sempre mencionar frete e prazo de entrega."
                  />
                </label>
              </div>
            </div>
          )}

          {showAppointment && (
            <div style={sectionBox}>
              <h4 style={sectionTitle}>📅 Agendamentos</h4>
              <label style={rowCheck}>
                <input
                  type="checkbox"
                  checked={draft.business.enableAppointments}
                  onChange={(e) => updateBusiness({ enableAppointments: e.target.checked })}
                />
                <span>Permitir criar agendamentos neste fluxo</span>
              </label>
              {draft.business.enableAppointments && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {APPOINTMENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleApptType(t.value)}
                      style={pillBtnStyle(draft.business.appointmentTypes?.includes(t.value))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showOrder && (
            <div style={sectionBox}>
              <h4 style={sectionTitle}>💳 Pagamento</h4>
              <label style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginBottom: '8px' }}>
                Como cobrar após o pedido
              </label>
              <select
                value={draft.business.paymentProvider}
                onChange={(e) => updateBusiness({ paymentProvider: e.target.value })}
                style={selectStyle}
              >
                <option value="stripe">Stripe (link no WhatsApp)</option>
                <option value="manual">Manual (PIX, transferência etc.)</option>
                <option value="custom">Outro / personalizado</option>
              </select>
              {draft.business.paymentProvider === 'manual' && (
                <textarea
                  value={draft.business.paymentManualMessage}
                  onChange={(e) => updateBusiness({ paymentManualMessage: e.target.value })}
                  rows={2}
                  style={{ ...textareaStyle, marginTop: '10px' }}
                  placeholder="Instruções de pagamento manual para o cliente..."
                />
              )}
              {draft.business.paymentProvider === 'stripe' && (
                <textarea
                  value={draft.business.paymentStripeMessage}
                  onChange={(e) => updateBusiness({ paymentStripeMessage: e.target.value })}
                  rows={2}
                  style={{ ...textareaStyle, marginTop: '10px' }}
                  placeholder="Mensagem extra ao enviar link Stripe (opcional)..."
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — CRM */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
            Nome e telefone são sempre considerados (WhatsApp). Marque dados extras para o CRM.
          </p>
          <label
            style={{
              ...rowCheck,
              padding: '14px',
              background: 'rgba(16,185,129,0.08)',
              borderRadius: '12px',
              border: '1px solid rgba(16,185,129,0.2)'
            }}
          >
            <input
              type="checkbox"
              checked={draft.crm.crmAutoSave}
              onChange={(e) => updateCrm({ crmAutoSave: e.target.checked })}
            />
            <span>
              <strong>Salvar automaticamente no CRM</strong> quando o cliente fornecer os dados
            </span>
          </label>

          <div style={{ fontWeight: 600, color: '#fff', marginTop: '8px' }}>Campos extras</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {OPTIONAL_CRM_FIELDS.map((f) => (
              <label key={f.value} style={rowCheck}>
                <input
                  type="checkbox"
                  checked={draft.crm.crmFields?.includes(f.value)}
                  onChange={() => toggleCrmField(f.value)}
                />
                <span style={{ fontSize: '0.9rem' }}>{f.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 — Tom */}
      {step === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Nome do agente</label>
            <input
              value={draft.tone.agentName}
              onChange={(e) => updateTone({ agentName: e.target.value })}
              style={inputStyle}
              placeholder="Ex.: Sofia"
            />
          </div>
          <div>
            <label style={labelStyle}>Função</label>
            <input
              value={draft.tone.agentRole}
              onChange={(e) => updateTone({ agentRole: e.target.value })}
              style={inputStyle}
              placeholder="Ex.: Consultora de vendas"
            />
          </div>
          <div>
            <label style={labelStyle}>Tom</label>
            <select
              value={draft.tone.agentTone}
              onChange={(e) => updateTone({ agentTone: e.target.value })}
              style={selectStyle}
            >
              <option value="friendly">😊 Amigável</option>
              <option value="professional">👔 Profissional</option>
              <option value="casual">😎 Casual</option>
              <option value="enthusiastic">🎉 Entusiasmado</option>
              <option value="empathetic">❤️ Empático</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Estilo</label>
            <select
              value={draft.tone.agentStyle}
              onChange={(e) => updateTone({ agentStyle: e.target.value })}
              style={selectStyle}
            >
              <option value="concise">Conciso</option>
              <option value="detailed">Detalhado</option>
              <option value="consultative">Consultivo</option>
              <option value="persuasive">Persuasivo</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Personalidade e regras (instruções livres)</label>
            <textarea
              value={draft.tone.personality}
              onChange={(e) => updateTone({ personality: e.target.value })}
              rows={5}
              style={textareaStyle}
              placeholder="Ex.: nunca prometer desconto sem confirmar; usar emojis com moderação..."
            />
          </div>
        </div>
      )}

      {/* Step 5 — Resumo */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...sectionBox, borderColor: 'rgba(16,185,129,0.35)' }}>
            <h4 style={{ ...sectionTitle, marginBottom: '12px' }}>O que o assistente vai fazer</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', lineHeight: 1.7, fontSize: '0.95rem' }}>
              <li>
                <strong style={{ color: '#fff' }}>Identidade:</strong> {draft.tone.agentName} — {draft.tone.agentRole}
              </li>
              {draft.business.enableAudio && (
                <li>
                  <strong style={{ color: '#fff' }}>Áudio:</strong> respostas em áudio ({draft.business.audioLanguage})
                </li>
              )}
              {showCatalog && (
                <li>
                  <strong style={{ color: '#fff' }}>Catálogo:</strong>{' '}
                  {draft.business.includeProducts ? 'produtos' : ''}
                  {draft.business.includeProducts && draft.business.includeServices ? ' e ' : ''}
                  {draft.business.includeServices ? 'serviços' : ''}
                  {!draft.business.includeProducts && !draft.business.includeServices ? 'nenhum (ative acima)' : ''}
                </li>
              )}
              {showAppointment && draft.business.enableAppointments && (
                <li>
                  <strong style={{ color: '#fff' }}>Agendamentos:</strong>{' '}
                  {(draft.business.appointmentTypes || []).join(', ') || 'tipos padrão'}
                </li>
              )}
              {showOrder && (
                <li>
                  <strong style={{ color: '#fff' }}>Pagamento:</strong> {draft.business.paymentProvider}
                </li>
              )}
              {['full_sales', 'appointments', 'catalog_leads'].includes(draft.templateId) && (
                <li>
                  <strong style={{ color: '#fff' }}>CRM:</strong>{' '}
                  {draft.crm.crmAutoSave ? 'salvar dados automaticamente' : 'coleta manual'}{' '}
                  — extras: {(draft.crm.crmFields || []).join(', ') || 'nenhum'}
                </li>
              )}
              <li>
                <strong style={{ color: '#fff' }}>Encerramento:</strong> mensagem de confirmação
              </li>
            </ol>
          </div>

          <div
            style={{
              ...sectionBox,
              borderColor: hasBlockingIssues ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'
            }}
          >
            <h4 style={{ ...sectionTitle, marginBottom: '10px' }}>Validações automáticas</h4>
            {!validationIssues.length ? (
              <p style={{ fontSize: '0.9rem', color: '#10b981', margin: 0 }}>
                ✅ Fluxo coerente. Pronto para aplicar.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
                {validationIssues.map((issue, idx) => (
                  <li
                    key={`${issue.level}-${idx}`}
                    style={{
                      color: issue.level === 'error' ? '#fca5a5' : '#fcd34d',
                      fontSize: '0.9rem'
                    }}
                  >
                    {issue.level === 'error' ? '⛔ ' : '⚠️ '}
                    {issue.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={sectionBox}>
            <h4 style={{ ...sectionTitle, marginBottom: '10px' }}>Preview de conversa</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {previewConversation.map((line, idx) => (
                <div
                  key={`${line.from}-${idx}`}
                  style={{
                    alignSelf: line.from === 'bot' ? 'flex-start' : 'flex-end',
                    maxWidth: '90%',
                    background: line.from === 'bot' ? '#1a1f36' : 'rgba(16,185,129,0.16)',
                    border: `1px solid ${
                      line.from === 'bot' ? 'rgba(255,255,255,0.1)' : 'rgba(16,185,129,0.28)'
                    }`,
                    color: '#e5e7eb',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '0.88rem',
                    lineHeight: 1.45
                  }}
                >
                  <strong style={{ color: '#fff' }}>{line.from === 'bot' ? 'Bot' : 'Cliente'}:</strong>{' '}
                  {line.text}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleApply}
            disabled={hasBlockingIssues}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 22px',
              borderRadius: '14px',
              border: 'none',
              background: hasBlockingIssues
                ? 'linear-gradient(135deg, #9ca3af, #6b7280)'
                : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: hasBlockingIssues ? 'not-allowed' : 'pointer',
              boxShadow: hasBlockingIssues ? 'none' : '0 4px 14px rgba(16,185,129,0.35)'
            }}
          >
            <Check size={20} />
            Gerar fluxo e aplicar ao rascunho
          </button>
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Depois use <strong style={{ color: '#9ca3af' }}>Salvar configurações</strong> no final da página para publicar no Firebase.
          </p>
        </div>
      )}

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <button
          type="button"
          disabled={step <= 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          style={navBtnStyle(step <= 1)}
        >
          <ChevronLeft size={18} /> Anterior
        </button>
        <button
          type="button"
          disabled={step >= 5}
          onClick={() => setStep((s) => Math.min(5, s + 1))}
          style={navBtnStyle(step >= 5)}
        >
          Próximo <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

const sectionBox = {
  background: '#0f1419',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  padding: '16px'
};

const sectionTitle = { fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '6px' };

const rowCheck = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  color: '#e5e7eb',
  fontSize: '0.9rem',
  cursor: 'pointer'
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#0f1419',
  color: '#fff',
  marginTop: '4px'
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer'
};

const textareaStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#0f1419',
  color: '#fff',
  resize: 'vertical'
};

const labelStyle = { fontSize: '0.8rem', color: '#9ca3af', display: 'block', marginBottom: '4px' };

function pillBtnStyle(active) {
  return {
    border: active ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(16,185,129,0.2)' : '#0f1419',
    borderRadius: '999px',
    padding: '6px 12px',
    fontSize: '0.75rem',
    color: active ? '#10b981' : '#9ca3af',
    cursor: 'pointer'
  };
}

function navBtnStyle(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: disabled ? '#1a1f36' : '#1a1f36',
    color: disabled ? '#6b7280' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1
  };
}
