/**
 * Assistente guiado: templates, construção de steps e merge com assistantForm.
 */
import { convertStepsToPrompt } from '../hooks/useFlowBuilder';

/** Onde injetar texto de abordagem “congelada” (mapa → type do passo) */
export const FIXED_APPROACH_PLACEMENTS = [
  { value: 'agent_profile', label: '🤖 Perfil / primeira impressão' },
  { value: 'show_catalog', label: '📦 Catálogo' },
  { value: 'process_order', label: '🛒 Pedido e pagamento' },
  { value: 'create_appointment', label: '📅 Agendamento' },
  { value: 'collect_data', label: '📋 CRM (coleta de dados)' },
  { value: 'send_confirmation', label: '✅ Confirmação final' }
];

export function getPlacementsForTemplate(templateId) {
  const all = FIXED_APPROACH_PLACEMENTS;
  if (templateId === 'minimal') {
    return all.filter((p) => ['agent_profile', 'send_confirmation'].includes(p.value));
  }
  if (templateId === 'appointments') {
    return all.filter((p) => !['show_catalog', 'process_order'].includes(p.value));
  }
  if (templateId === 'full_sales' || templateId === 'catalog_leads') {
    return all;
  }
  return all;
}

export const WIZARD_TEMPLATES = [
  {
    id: 'full_sales',
    name: 'Vendas completas',
    description: 'Catálogo → pedido e pagamento → dados no CRM → confirmação.',
    icon: '🛒',
    order: ['profile', 'audio?', 'catalog', 'order', 'crm', 'confirm']
  },
  {
    id: 'appointments',
    name: 'Agendamentos',
    description: 'Foco em marcar horários; depois CRM e confirmação.',
    icon: '📅',
    order: ['profile', 'audio?', 'appointment', 'crm', 'confirm']
  },
  {
    id: 'catalog_leads',
    name: 'Catálogo + leads',
    description: 'Mostrar ofertas, capturar dados no CRM antes do pagamento.',
    icon: '📇',
    order: ['profile', 'audio?', 'catalog', 'crm', 'order', 'confirm']
  },
  {
    id: 'minimal',
    name: 'Mínimo',
    description: 'Só perfil do agente e confirmação (para mensagens simples).',
    icon: '✨',
    order: ['profile', 'audio?', 'confirm']
  }
];

const uid = () => Date.now() + Math.floor(Math.random() * 10000);

const emptyCatalogSettings = () => ({
  includeProducts: false,
  includeServices: false,
  selectedProducts: [],
  selectedServices: [],
  selectedProductCategories: [],
  selectedServiceCategories: []
});

export function getDefaultWizardState(catalogItems = []) {
  const products = (catalogItems || []).filter((i) => i?.type === 'product');
  const services = (catalogItems || []).filter((i) => i?.type === 'service');
  return {
    templateId: 'full_sales',
    business: {
      enableAudio: false,
      audioLanguage: 'pt-BR',
      audioVoice: '',
      includeProducts: products.length > 0,
      includeServices: services.length > 0,
      productCategories: [],
      serviceCategories: [],
      enableAppointments: true,
      appointmentTypes: ['servico', 'consulta', 'visita'],
      paymentProvider: 'stripe',
      paymentManualMessage: '',
      paymentStripeMessage: '',
      catalogInstructions:
        'Liste produtos e serviços com nome, preço e uma linha de benefício. Ofereça ajuda para escolher.'
    },
    crm: {
      crmAutoSave: true,
      // campos opcionais além de nome e telefone (sempre obrigatórios no CRM)
      crmFields: ['product', 'email']
    },
    tone: {
      agentName: 'Assistente',
      agentRole: 'Atendimento',
      agentTone: 'friendly',
      agentStyle: 'concise',
      personality:
        'Seja cordial, use emojis com moderação e confirme dados importantes antes de fechar.'
    },
    /** { id, placement: step type, instruction } — injetadas no passo correspondente ao gerar fluxo */
    fixedApproaches: []
  };
}

const FIXED_BLOCK = '\n\n--- ABORDAGEM FIXA (NÃO ALTERAR) ---\n';

/**
 * Injeta abordagens fixas nas descrições dos passos (compatível com compilePrompt).
 */
export function applyFixedApproachesToSteps(steps, fixedApproaches = []) {
  if (!steps?.length || !fixedApproaches?.length) return steps;

  const byType = {};
  fixedApproaches.forEach((fa) => {
    if (!fa?.instruction?.trim() || !fa?.placement) return;
    const t = fa.placement;
    if (!byType[t]) byType[t] = [];
    byType[t].push(fa.instruction.trim());
  });

  const out = steps.map((s) => ({ ...s }));
  Object.keys(byType).forEach((type) => {
    const idx = out.findIndex((s) => s.type === type);
    if (idx === -1) return;
    const combined = byType[type].map((text) => `${FIXED_BLOCK}${text}`).join('');
    const step = { ...out[idx] };
    const raw = step.description || '';
    const base = raw.split('\n\n--- ABORDAGEM FIXA')[0].trim();
    step.description = base ? `${base}${combined}` : combined.replace(/^\n+/, '').trim();
    out[idx] = step;
  });
  return out;
}

/**
 * Ajustes automáticos sugeridos para passar nas validações do modo guiado.
 */
export function autoFixWizardDraft(draft, catalogItems = []) {
  const next = JSON.parse(JSON.stringify(draft || {}));
  if (!next.tone) next.tone = {};
  if (!next.business) next.business = {};
  if (!next.crm) next.crm = {};

  const totalP = (catalogItems || []).filter((i) => i?.type === 'product').length;
  const totalS = (catalogItems || []).filter((i) => i?.type === 'service').length;
  const tid = next.templateId || 'full_sales';

  if (!next.tone.agentName?.trim()) next.tone.agentName = 'Assistente Virtual';
  if (!next.tone.agentRole?.trim()) next.tone.agentRole = 'Atendimento';

  if (['full_sales', 'catalog_leads'].includes(tid)) {
    if (!next.business.includeProducts && !next.business.includeServices) {
      if (totalP > 0) next.business.includeProducts = true;
      else if (totalS > 0) next.business.includeServices = true;
    }
  }

  if (tid === 'appointments' && next.business.enableAppointments && !(next.business.appointmentTypes || []).length) {
    next.business.appointmentTypes = ['servico', 'consulta', 'visita'];
  }

  if (['full_sales', 'catalog_leads'].includes(tid) && next.business.paymentProvider === 'manual') {
    if (!next.business.paymentManualMessage?.trim()) {
      next.business.paymentManualMessage =
        'Pagamento via PIX ou transferência. Envie o comprovante aqui no WhatsApp para confirmarmos.';
    }
  }

  if (!next.crm.crmAutoSave && !(next.crm.crmFields || []).length) {
    next.crm.crmAutoSave = true;
    next.crm.crmFields = ['product', 'email'];
  }

  return next;
}

function createAgentProfile(tone) {
  return {
    id: uid(),
    type: 'agent_profile',
    title: 'Perfil do Agente',
    description: tone.personality || '',
    agentName: tone.agentName || 'Assistente',
    agentRole: tone.agentRole || 'Atendimento',
    agentTone: tone.agentTone || 'friendly',
    agentStyle: tone.agentStyle || 'concise',
    condition: null,
    actions: []
  };
}

function createAudio(business) {
  return {
    id: uid(),
    type: 'audio_config',
    title: 'Respostas em áudio',
    description:
      'Quando o cliente enviar mensagem de áudio, responda também em áudio, no idioma configurado.',
    audioLanguage: business.audioLanguage || 'pt-BR',
    audioVoice: business.audioVoice || '',
    condition: null,
    actions: []
  };
}

function createShowCatalog(business, catalogItems) {
  const items = catalogItems || [];
  const allP = items.filter((i) => i?.type === 'product').map((i) => i.id);
  const allS = items.filter((i) => i?.type === 'service').map((i) => i.id);
  const cs = emptyCatalogSettings();
  cs.includeProducts = !!business.includeProducts && allP.length > 0;
  cs.includeServices = !!business.includeServices && allS.length > 0;
  cs.selectedProducts = cs.includeProducts ? allP : [];
  cs.selectedServices = cs.includeServices ? allS : [];
  cs.selectedProductCategories = business.productCategories || [];
  cs.selectedServiceCategories = business.serviceCategories || [];

  return {
    id: uid(),
    type: 'show_catalog',
    title: 'Apresentar catálogo',
    description: business.catalogInstructions || '',
    catalogSettings: cs,
    condition: null,
    actions: []
  };
}

function createProcessOrder(business) {
  return {
    id: uid(),
    type: 'process_order',
    title: 'Processar pedido e pagamento',
    description:
      'Confirme itens, valores e envie o link ou instruções de pagamento pelo WhatsApp.',
    paymentSettings: {
      provider: business.paymentProvider || 'stripe',
      manualMessage: business.paymentManualMessage || '',
      stripeMessage: business.paymentStripeMessage || ''
    },
    condition: null,
    actions: []
  };
}

function createCollectData(crm) {
  const fields = crm.crmFields?.length ? [...new Set(['name', 'phone', ...crm.crmFields])] : ['name', 'phone'];
  return {
    id: uid(),
    type: 'collect_data',
    title: 'Dados para o CRM',
    description:
      'Colete um dado por vez, de forma natural na conversa. Salve no CRM quando o cliente autorizar.',
    crmAutoSave: !!crm.crmAutoSave,
    crmFields: fields,
    customQuestions: [],
    condition: null,
    actions: []
  };
}

function createAppointment(business) {
  return {
    id: uid(),
    type: 'create_appointment',
    title: 'Agendamentos',
    description:
      'Ofereça horários, confirme data e tipo de atendimento. Use apenas os tipos permitidos abaixo.',
    appointmentEnabled: !!business.enableAppointments,
    appointmentTypes: business.appointmentTypes?.length
      ? business.appointmentTypes
      : ['servico', 'consulta'],
    condition: null,
    actions: []
  };
}

function createConfirmation() {
  return {
    id: uid(),
    type: 'send_confirmation',
    title: 'Confirmação final',
    description:
      'Envie um resumo do que foi combinado (pedido, pagamento ou agendamento) e próximos passos.',
    condition: null,
    actions: []
  };
}

/**
 * Monta flowSteps[] a partir do estado do assistente guiado.
 */
export function buildFlowStepsFromWizardState(state, catalogItems = []) {
  const tone = state.tone || {};
  const business = state.business || {};
  const crm = state.crm || {};
  const tid = state.templateId || 'full_sales';

  const steps = [];
  const pushAudio = () => {
    if (business.enableAudio) steps.push(createAudio(business));
  };

  steps.push(createAgentProfile(tone));
  pushAudio();

  if (tid === 'full_sales') {
    steps.push(createShowCatalog(business, catalogItems));
    steps.push(createProcessOrder(business));
    steps.push(createCollectData(crm));
    steps.push(createConfirmation());
  } else if (tid === 'appointments') {
    steps.push(createAppointment(business));
    steps.push(createCollectData(crm));
    steps.push(createConfirmation());
  } else if (tid === 'catalog_leads') {
    steps.push(createShowCatalog(business, catalogItems));
    steps.push(createCollectData(crm));
    steps.push(createProcessOrder(business));
    steps.push(createConfirmation());
  } else {
    // minimal
    steps.push(createConfirmation());
  }

  return steps;
}

function guessTemplateFromSteps(steps) {
  const types = steps.map((s) => s.type);
  const has = (t) => types.includes(t);
  if (!has('show_catalog') && has('create_appointment')) return 'appointments';
  if (has('collect_data') && has('process_order') && has('show_catalog')) {
    const iCrm = types.indexOf('collect_data');
    const iOrder = types.indexOf('process_order');
    if (iCrm !== -1 && iOrder !== -1 && iCrm < iOrder) return 'catalog_leads';
  }
  if (has('show_catalog') && has('process_order')) return 'full_sales';
  if (types.filter((t) => t !== 'agent_profile' && t !== 'audio_config').length <= 2) return 'minimal';
  return 'full_sales';
}

/**
 * Tenta reconstruir o estado do wizard a partir de flowSteps existentes (modo edição).
 */
export function parseFlowStepsToWizardState(steps = [], catalogItems = []) {
  const base = getDefaultWizardState(catalogItems);
  if (!steps?.length) return { ...base, templateId: 'full_sales' };

  const profile = steps.find((s) => s.type === 'agent_profile');
  if (profile) {
    base.tone = {
      agentName: profile.agentName || base.tone.agentName,
      agentRole: profile.agentRole || base.tone.agentRole,
      agentTone: profile.agentTone || 'friendly',
      agentStyle: profile.agentStyle || 'concise',
      personality: profile.description || base.tone.personality
    };
  }

  const audio = steps.find((s) => s.type === 'audio_config');
  base.business.enableAudio = !!audio;
  if (audio) {
    base.business.audioLanguage = audio.audioLanguage || 'pt-BR';
    base.business.audioVoice = audio.audioVoice || '';
  }

  const cat = steps.find((s) => s.type === 'show_catalog');
  if (cat?.catalogSettings) {
    const cs = cat.catalogSettings;
    base.business.includeProducts = !!cs.includeProducts;
    base.business.includeServices = !!cs.includeServices;
    base.business.productCategories = cs.selectedProductCategories || [];
    base.business.serviceCategories = cs.selectedServiceCategories || [];
    base.business.catalogInstructions = cat.description || base.business.catalogInstructions;
  }

  const order = steps.find((s) => s.type === 'process_order');
  if (order?.paymentSettings) {
    base.business.paymentProvider = order.paymentSettings.provider || 'stripe';
    base.business.paymentManualMessage = order.paymentSettings.manualMessage || '';
    base.business.paymentStripeMessage = order.paymentSettings.stripeMessage || '';
  }

  const ap = steps.find((s) => s.type === 'create_appointment');
  if (ap) {
    base.business.enableAppointments = !!ap.appointmentEnabled;
    base.business.appointmentTypes = ap.appointmentTypes?.length
      ? ap.appointmentTypes
      : base.business.appointmentTypes;
  }

  const crmStep = steps.find((s) => s.type === 'collect_data');
  if (crmStep) {
    base.crm.crmAutoSave = !!crmStep.crmAutoSave;
    base.crm.crmFields =
      crmStep.crmFields?.filter((f) => f !== 'name' && f !== 'phone') || ['product', 'email'];
  }

  base.templateId = guessTemplateFromSteps(steps);
  base.fixedApproaches = base.fixedApproaches || [];
  return base;
}

/**
 * Mescla novos passos no formulário do assistente (mesma lógica do FlowBuilder em FirebaseApp).
 */
export function mergeFlowStepsIntoAssistantForm(prevForm, newSteps) {
  const appointmentStep = newSteps.find(
    (step) => step.type === 'create_appointment' && step.appointmentEnabled
  );
  const hasEnabledAppointment = !!appointmentStep;
  const appointmentTypes = appointmentStep?.appointmentTypes || [];

  const catalogStep = newSteps.find((step) => step.type === 'show_catalog');
  const hasProducts = catalogStep?.catalogSettings?.includeProducts || false;
  const hasServices = catalogStep?.catalogSettings?.includeServices || false;
  const productCategories = catalogStep?.catalogSettings?.selectedProductCategories || [];
  const serviceCategories = catalogStep?.catalogSettings?.selectedServiceCategories || [];

  const audioStep = newSteps.find((step) => step.type === 'audio_config');
  const audioLanguage = audioStep?.audioLanguage || 'pt-BR';
  const audioVoice = audioStep?.audioVoice || '';

  const paymentStep = newSteps.find((step) => step.type === 'process_order');
  const paymentProvider = paymentStep?.paymentSettings?.provider || 'stripe';
  const paymentManualMessage = paymentStep?.paymentSettings?.manualMessage || '';
  const paymentStripeMessage = paymentStep?.paymentSettings?.stripeMessage || '';

  return {
    ...prevForm,
    flowSteps: newSteps,
    flowMode: 'visual',
    systemPrompt: convertStepsToPrompt(newSteps),
    // fixedApproaches permanece em prevForm (salvo em assistant_settings)
    enableAppointments: hasEnabledAppointment,
    appointmentTypes,
    includeCatalogProducts: hasProducts,
    includeCatalogServices: hasServices,
    catalogProductCategories: productCategories,
    catalogServiceCategories: serviceCategories,
    audioLanguage,
    audioVoice,
    paymentProvider,
    paymentManualMessage,
    paymentStripeMessage
  };
}
