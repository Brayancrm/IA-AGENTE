import { useMemo, useState } from 'react';
import { X, Sparkles, Loader } from 'lucide-react';

const getInitialGuidedAnswers = () => ({
  agentType: 'sales',
  agentName: '',
  agentTone: 'Amigável e profissional',
  segment: '',
  mainGoal: '',
  offerings: [],
  paymentProvider: 'stripe',
  schedulingTypes: []
});

export default function AIGeneratorModal({ isOpen, onClose, onGenerate, catalogItems = [], agendamentos = [] }) {
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('guided');
  const [guidedAnswers, setGuidedAnswers] = useState(getInitialGuidedAnswers);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [customOptionDrafts, setCustomOptionDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const catalogOptions = useMemo(() => {
    if (!catalogItems || catalogItems.length === 0) return [];
    return catalogItems
      .filter((item) => item && item.name)
      .map((item) => ({
        value: item.name,
        label: `${item.type === 'service' ? '🛠️' : '📦'} ${item.name}`,
        description: item.description || '',
        meta: item.type === 'service' ? 'Serviço' : 'Produto',
        price: item.price
      }));
  }, [catalogItems]);

  const appointmentTypeOptions = useMemo(() => {
    const set = new Set();
    (agendamentos || []).forEach((ag) => {
      if (ag?.tipo) {
        set.add(ag.tipo);
      }
    });
    return Array.from(set).map((tipo) => ({
      value: tipo,
      label: tipo.charAt(0).toUpperCase() + tipo.slice(1)
    }));
  }, [agendamentos]);

  const guidedQuestions = useMemo(() => {
    const defaultOfferingOptions = [
      { value: 'Consultas iniciais', label: '🩺 Consultas iniciais' },
      { value: 'Planos mensais', label: '📅 Planos mensais' },
      { value: 'Serviços premium', label: '💎 Serviços premium' },
      { value: 'Produtos do catálogo', label: '📦 Produtos do catálogo' }
    ];

    const defaultAppointmentTypes = [
      { value: 'consultas presenciais', label: 'Consultas presenciais' },
      { value: 'visitas técnicas', label: 'Visitas técnicas' },
      { value: 'demonstrações online', label: 'Demonstrações online' }
    ];

    const offerOptions = catalogOptions.length > 0 ? catalogOptions : defaultOfferingOptions;
    const appointmentOptions = appointmentTypeOptions.length > 0 ? appointmentTypeOptions : defaultAppointmentTypes;

    return [
      {
        id: 'agentType',
        type: 'single_select',
        title: 'Qual tipo de agente você quer criar?',
        description: 'Escolha um modelo direto e objetivo.',
        options: [
          { value: 'sales', label: '💳 Vendas' },
          { value: 'sales_appointment', label: '💳 Vendas + Agendamento' },
          { value: 'appointment', label: '📅 Agendamento de Serviço' },
          { value: 'other', label: '⚙️ Outro (fluxo simples)' }
        ],
        allowCustom: false,
        required: true
      },
      {
        id: 'agentName',
        type: 'text',
        title: 'Nome do assistente (opcional)',
        description: 'Se quiser, defina um nome curto.',
        placeholder: 'Ex: Sofi, Vetra, Atendente IA',
        suggestions: [
          'Sofi',
          'Vetra',
          'Atendente IA',
          'Consultor Digital'
        ],
        required: false
      },
      {
        id: 'agentRole',
        type: 'text',
        title: 'Qual é o papel/função do assistente?',
        description: 'Descreva a função ou cargo que o assistente representa (ex: Vendedor, Consultor, Atendente).',
        placeholder: 'Ex: Vendedor especializado, Consultor de vendas',
        suggestions: [
          'Vendedor especializado',
          'Consultor de vendas',
          'Atendente de suporte',
          'Assistente comercial',
          'Especialista em produtos'
        ],
        required: false
      },
      {
        id: 'agentTone',
        type: 'single_select',
        title: 'Tom de voz',
        description: 'Escolha um tom simples e direto.',
        options: [
          { value: 'Amigável e profissional', label: 'Amigável e profissional' },
          { value: 'Direto e objetivo', label: 'Direto e objetivo' }
        ],
        allowCustom: false,
        required: false
      },
      {
        id: 'agentStyle',
        type: 'text',
        title: 'Como o assistente deve se comunicar?',
        description: 'Descreva o estilo de comunicação específico (ex: usa emojis, formal, técnico, simples).',
        placeholder: 'Ex: Comunicação clara e objetiva, sempre educado',
        suggestions: [
          'Comunicação clara e objetiva',
          'Usa emojis para ser mais amigável',
          'Linguagem técnica quando necessário',
          'Sempre educado e prestativo',
          'Foco em resolver problemas rapidamente'
        ],
        required: false
      },
      {
        id: 'segment',
        type: 'text',
        title: 'Qual é o negócio/segmento?',
        description: 'Ajuda a IA a entender o contexto do seu agente.',
        placeholder: 'Ex: clínica odontológica em SP',
        suggestions: [
          'Clínica odontológica em SP',
          'Restaurante delivery em bairro residencial',
          'Pet shop especializado em banho e tosa',
          'Imobiliária focada em locação de temporada',
          'Consultoria financeira para MEIs'
        ],
        required: true
      },
      {
        id: 'audience',
        type: 'text',
        title: 'Quem o agente atende?',
        description: 'Defina o público principal para personalizar a conversa.',
        placeholder: 'Ex: pacientes novos e recorrentes',
        suggestions: [
          'Clientes que chegam pelo WhatsApp',
          'Leads vindos de anúncios pagos',
          'Clientes VIP que já compraram antes',
          'Alunos interessados em cursos online'
        ]
      },
      {
        id: 'mainGoal',
        type: 'text',
        title: 'Objetivo único do agente',
        description: 'Apenas um objetivo principal.',
        placeholder: 'Ex: vender produtos e fechar o pedido',
        suggestions: [
          'Vender produtos e fechar o pedido',
          'Agendar serviço com data e horário',
          'Vender e agendar após o pagamento'
        ],
        required: true
      },
      {
        id: 'offerings',
        type: 'multi_select',
        title: 'Quais produtos ou serviços deve oferecer? (até 3)',
        description: 'Selecione do catálogo para manter o foco.',
        options: offerOptions,
        emptyState: catalogOptions.length === 0 ? 'Cadastre produtos e serviços no catálogo para facilitar.' : '',
        maxSelections: 3,
        allowCustom: false,
        required: true,
        shouldShow: (answers) => ['sales', 'sales_appointment'].includes(answers.agentType)
      },
      {
        id: 'paymentProvider',
        type: 'single_select',
        title: 'Qual provedor de pagamento?',
        description: 'Escolha apenas um.',
        options: [
          { value: 'stripe', label: 'Stripe (automático)' },
          { value: 'asaas', label: 'Asaas (legado)' },
          { value: 'manual', label: 'Manual (sem API)' }
        ],
        allowCustom: false,
        required: true,
        shouldShow: (answers) => ['sales', 'sales_appointment'].includes(answers.agentType)
      },
      {
        id: 'workflows',
        type: 'multi_select',
        title: 'Quais etapas o agente deve seguir?',
        description: 'Escolha o fluxo desejado para cada atendimento.',
        options: [
          { value: 'NÃO_APLICA_WORKFLOWS', label: '❌ Não há etapas específicas a seguir', isNegative: true },
          { value: 'Qualificar leads e identificar necessidades', label: 'Qualificar leads' },
          { value: 'Apresentar catálogo com produtos/serviços', label: 'Mostrar catálogo' },
          { value: 'Criar pedidos completos', label: 'Montar pedido' },
          { value: 'Enviar orçamentos e propostas', label: 'Enviar orçamento' },
          { value: 'Coletar dados para nota fiscal', label: 'Coletar dados fiscais' },
          { value: 'Registrar agendamentos confirmados', label: 'Registrar agendamentos' }
        ]
      },
      {
        id: 'crmAutoSave',
        type: 'single_select',
        title: '💾 Salvar clientes automaticamente no CRM?',
        description: 'Todos os clientes que entrarem em contato serão salvos automaticamente no CRM com os dados selecionados.',
        options: [
          { value: 'yes', label: 'Sim, salvar automaticamente no CRM' },
          { value: 'no', label: 'Não, não é necessário salvar no CRM' }
        ],
        required: false
      },
      {
        id: 'crmFields',
        type: 'multi_select',
        title: 'Quais dados devem ser salvos no CRM?',
        description: 'Selecione os campos que o agente deve coletar e salvar automaticamente para cada cliente.',
        options: [
          { value: 'name', label: '👤 Nome (obrigatório)', description: 'Nome completo do cliente' },
          { value: 'phone', label: '📱 Telefone (obrigatório)', description: 'Número de WhatsApp do cliente' },
          { value: 'product', label: '📦 Produto ou Serviço', description: 'Produto/serviço de interesse mencionado' },
          { value: 'email', label: '📧 Email', description: 'Endereço de email do cliente' }
        ],
        shouldShow: (answers) => {
          const crmAutoSaveArray = Array.isArray(answers.crmAutoSave) ? answers.crmAutoSave : (answers.crmAutoSave ? [answers.crmAutoSave] : []);
          return crmAutoSaveArray.includes('yes');
        }
      },
      {
        id: 'integrations',
        type: 'multi_select',
        title: 'Quais recursos extra devem ser utilizados?',
        description: 'Selecione integrações e automações suportadas pelo sistema.',
        options: [
          { value: 'NÃO_APLICA_INTEGRATIONS', label: '❌ Não há recursos extras necessários', isNegative: true },
          { value: 'Consultar estoque e disponibilidade em tempo real', label: 'Consultar estoque' },
          { value: 'Registrar pedidos no CRM e pipeline', label: 'Atualizar CRM' },
          { value: 'Gerar boletos e cobranças pelo Asaas', label: 'Emitir cobrança Asaas' },
          { value: 'Enviar e-mail ou SMS com resumo do atendimento', label: 'Enviar resumo' },
          { value: 'Atualizar planilha/Google Sheets com novos leads', label: 'Atualizar planilha' }
        ]
      },
      {
        id: 'schedulingNeed',
        type: 'single_select',
        title: 'O agente precisa criar agendamentos?',
        description: 'Caso sim, cada compromisso será salvo automaticamente na agenda.',
        options: [
          { value: 'yes', label: 'Sim, quero registrar compromissos' },
          { value: 'no', label: 'Não, não é necessário agendar' }
        ],
        helperText: 'Todos os agendamentos gerados aqui serão salvos no calendário oficial da agenda do usuário.'
      },
      {
        id: 'schedulingTypes',
        type: 'multi_select',
        title: 'Quais tipos de agendamento? (até 3)',
        description: 'Selecione os tipos disponíveis.',
        options: appointmentOptions,
        maxSelections: 3,
        allowCustom: true,
        required: true,
        shouldShow: (answers) => ['sales_appointment', 'appointment'].includes(answers.agentType)
      },
      {
        id: 'audioLanguage',
        type: 'single_select',
        title: '🎤 Qual idioma usar para respostas de áudio?',
        description: 'Quando o cliente enviar uma mensagem de áudio, o agente responderá também em áudio neste idioma.',
        options: [
          { value: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
          { value: 'pt-PT', label: '🇵🇹 Português (Portugal)' },
          { value: 'en-US', label: '🇺🇸 English (US)' },
          { value: 'en-GB', label: '🇬🇧 English (UK)' },
          { value: 'es-ES', label: '🇪🇸 Español (España)' },
          { value: 'es-MX', label: '🇲🇽 Español (México)' },
          { value: 'fr-FR', label: '🇫🇷 Français' },
          { value: 'de-DE', label: '🇩🇪 Deutsch' },
          { value: 'it-IT', label: '🇮🇹 Italiano' }
        ],
        required: true
      },
      {
        id: 'audioVoice',
        type: 'single_select',
        title: '🎙️ Qual voz usar para respostas de áudio?',
        description: 'Escolha o tom e gênero da voz que o agente usará ao responder em áudio.',
        options: [
          { value: '', label: '🔇 Voz Padrão (automática - feminina natural)' },
          { value: 'nova', label: '✨ Nova - Feminina Natural (Recomendada)' },
          { value: 'shimmer', label: '🌟 Shimmer - Feminina Jovem e Energética' },
          { value: 'alloy', label: '💎 Alloy - Feminina Neutra e Profissional' },
          { value: 'onyx', label: '🎙️ Onyx - Masculina Profunda e Autoritativa' },
          { value: 'echo', label: '🔊 Echo - Masculina Jovem e Vibrante' },
          { value: 'fable', label: '📖 Fable - Masculina Narrativa e Expressiva' }
        ],
        required: false
      },
      {
        id: 'tone',
        type: 'single_select',
        title: 'Qual tom de conversa o agente deve usar?',
        options: [
          { value: 'Amigável e profissional', label: 'Amigável e profissional' },
          { value: 'Consultivo e educativo', label: 'Consultivo e educativo' },
          { value: 'Informal e descontraído', label: 'Informal e descontraído' },
          { value: 'Direto e objetivo', label: 'Direto e objetivo' }
        ],
        allowCustom: true
      },
      // ========== ALTA PRIORIDADE ==========
      {
        id: 'businessHours',
        type: 'text',
        title: 'Quais são os horários de atendimento?',
        description: 'Informe quando o assistente está disponível e como responder fora do horário.',
        placeholder: 'Ex: Segunda a Sexta, 9h às 18h. Fora do horário, informar que responderá no próximo dia útil.',
        suggestions: [
          'Segunda a Sexta, 9h às 18h',
          'Segunda a Sábado, 8h às 20h',
          '24 horas por dia, 7 dias por semana',
          'Segunda a Sexta, 8h às 17h. Fins de semana apenas emergências'
        ],
        required: false
      },
      {
        id: 'escalateToHuman',
        type: 'text',
        title: 'Quando escalar para atendimento humano?',
        description: 'Defina situações que exigem transferência para um atendente humano.',
        placeholder: 'Ex: Se o cliente pedir cancelamento, reclamar de produto ou solicitar reembolso.',
        suggestions: [
          'Quando cliente pedir cancelamento ou reembolso',
          'Em caso de reclamações ou problemas com produtos',
          'Para negociações de valores ou descontos especiais',
          'Quando cliente solicitar explicitamente falar com humano',
          'Em situações complexas que o assistente não consegue resolver'
        ],
        required: false
      },
      {
        id: 'paymentMethods',
        type: 'multi_select',
        title: 'Quais formas de pagamento são aceitas?',
        description: 'Selecione os métodos de pagamento disponíveis.',
        options: [
          { value: 'NÃO_APLICA_PAYMENT', label: '❌ Não há formas de pagamento específicas', isNegative: true },
          { value: 'PIX', label: '💳 PIX' },
          { value: 'Cartão de Crédito', label: '💳 Cartão de Crédito' },
          { value: 'Cartão de Débito', label: '💳 Cartão de Débito' },
          { value: 'Boleto Bancário', label: '📄 Boleto Bancário' },
          { value: 'Transferência Bancária', label: '🏦 Transferência Bancária' },
          { value: 'Dinheiro na entrega', label: '💵 Dinheiro na entrega' }
        ],
        required: false
      },
      {
        id: 'deliveryPolicy',
        type: 'text',
        title: 'Qual é a política de entrega/frete?',
        description: 'Informe prazos, valores e áreas de cobertura para entrega.',
        placeholder: 'Ex: Entrega em 2-5 dias úteis. Frete grátis acima de R$ 100. Atendemos Grande São Paulo.',
        suggestions: [
          'Entrega em 2-5 dias úteis. Frete grátis acima de R$ 100',
          'Entrega expressa em 24h para região metropolitana',
          'Retirada no local disponível. Entrega com taxa fixa de R$ 15',
          'Entrega apenas na cidade. Frete calculado por distância',
          'Sem entrega. Apenas retirada no local'
        ],
        required: false
      },
      // ========== MÉDIA PRIORIDADE ==========
      {
        id: 'limitsRestrictions',
        type: 'text',
        title: 'Existem limites ou restrições importantes?',
        description: 'Valores mínimos/máximos, descontos permitidos, condições especiais.',
        placeholder: 'Ex: Não oferecer desconto acima de 10% sem autorização. Pedido mínimo de R$ 50.',
        suggestions: [
          'Não oferecer desconto acima de 10% sem autorização',
          'Pedido mínimo de R$ 50 para entrega',
          'Limite de crédito de R$ 5.000 por cliente',
          'Não vender para menores de 18 anos',
          'Apenas uma unidade por cliente em promoções'
        ],
        required: false
      },
      {
        id: 'companyInfo',
        type: 'text',
        title: 'Informações sobre a empresa/marca',
        description: 'Nome da empresa, valores, diferenciais, história. Como apresentar a empresa.',
        placeholder: 'Ex: Somos especialistas em X há 10 anos. Nossa missão é...',
        suggestions: [
          'Somos especialistas em X há 10 anos',
          'Empresa familiar com tradição e qualidade',
          'Líderes de mercado em nossa região',
          'Comprometidos com sustentabilidade e qualidade',
          'Empresa jovem e inovadora focada em tecnologia'
        ],
        required: false
      },
      {
        id: 'handleObjections',
        type: 'text',
        title: 'Como lidar com objeções comuns?',
        description: 'Respostas para objeções frequentes dos clientes.',
        placeholder: 'Ex: Se cliente disser que está caro, destacar benefícios e qualidade.',
        suggestions: [
          'Se disser que está caro, destacar benefícios e qualidade',
          'Se questionar prazo, explicar processo e garantir qualidade',
          'Se comparar com concorrente, destacar diferenciais únicos',
          'Se hesitar, oferecer garantia ou período de teste',
          'Se pedir desconto, oferecer condições de pagamento'
        ],
        required: false
      },
      {
        id: 'returnPolicy',
        type: 'text',
        title: 'Qual é a política de devolução/troca?',
        description: 'Prazos, condições e procedimentos para devoluções e trocas.',
        placeholder: 'Ex: Aceitamos devolução em até 7 dias após a compra, com produto em perfeito estado.',
        suggestions: [
          '❌ Não há necessidade de devolução ou troca para meus serviços',
          'Aceitamos devolução em até 7 dias após a compra',
          'Troca em até 30 dias se produto estiver lacrado',
          'Sem devolução, apenas troca por defeito de fabricação',
          'Devolução em até 15 dias com nota fiscal',
          'Política de satisfação garantida ou devolvemos o dinheiro'
        ],
        required: false
      },
      // ========== BAIXA PRIORIDADE ==========
      {
        id: 'coverageArea',
        type: 'text',
        title: 'Qual é a área de cobertura/atuação?',
        description: 'Regiões, cidades ou áreas geográficas atendidas.',
        placeholder: 'Ex: Atendemos toda a Grande São Paulo e região metropolitana.',
        suggestions: [
          'Atendemos toda a Grande São Paulo',
          'Cobertura nacional com entrega pelos Correios',
          'Apenas região metropolitana da capital',
          'Atendimento em todo o estado',
          'Apenas na cidade sede'
        ],
        required: false
      },
      {
        id: 'urgencyPriority',
        type: 'text',
        title: 'Como tratar urgências e prioridades?',
        description: 'Como identificar e tratar casos urgentes ou com prioridade.',
        placeholder: 'Ex: Pedidos com "urgente" no nome têm prioridade. Clientes VIP atendidos primeiro.',
        suggestions: [
          'Pedidos com "urgente" no nome têm prioridade',
          'Clientes VIP atendidos primeiro',
          'Emergências médicas têm prioridade absoluta',
          'Pedidos pagos têm prioridade sobre orçamentos',
          'Primeiro a chegar, primeiro a ser atendido'
        ],
        required: false
      },
      {
        id: 'languageStyle',
        type: 'text',
        title: 'Qual estilo de linguagem usar?',
        description: 'Idioma, regionalização, formalidade, uso de gírias ou termos técnicos.',
        placeholder: 'Ex: Use linguagem do dia a dia, sem muito formalismo. Evite termos técnicos.',
        suggestions: [
          'Use linguagem do dia a dia, sem muito formalismo',
          'Linguagem técnica quando necessário, mas sempre explicando',
          'Formal e respeitoso, mas acessível',
          'Use gírias regionais para criar proximidade',
          'Linguagem simples e direta, sem rodeios'
        ],
        required: false
      },
      {
        id: 'personalizationHistory',
        type: 'text',
        title: 'Como usar histórico do cliente?',
        description: 'Como personalizar atendimento baseado em compras anteriores ou histórico.',
        placeholder: 'Ex: Se for cliente recorrente, oferecer desconto fidelidade. Lembrar preferências.',
        suggestions: [
          'Se for cliente recorrente, oferecer desconto fidelidade',
          'Lembrar preferências e produtos anteriores',
          'Sugerir produtos similares aos já comprados',
          'Parabenizar aniversário e oferecer presente',
          'Personalizar ofertas baseado em histórico de compras'
        ],
        required: false
      },
      {
        id: 'extras',
        type: 'multi_select',
        title: 'Existe alguma regra ou observação final?',
        description: 'Políticas de atendimento, gatilhos ou instruções específicas adicionais.',
        options: [
          { value: 'Sempre confirmar endereço completo antes de finalizar', label: '✅ Confirmar endereço antes de finalizar' },
          { value: 'Validar dados do cliente antes de processar pedido', label: '✅ Validar dados do cliente' },
          { value: 'Solicitar confirmação explícita antes de cobrar', label: '✅ Confirmar antes de cobrar' },
          { value: 'Informar prazo de entrega sempre que mencionar produto', label: '✅ Informar prazo de entrega' },
          { value: 'Oferecer desconto apenas com autorização prévia', label: '✅ Desconto apenas com autorização' },
          { value: 'Sempre agradecer ao final da conversa', label: '✅ Agradecer ao final' },
          { value: 'Confirmar horário de funcionamento antes de agendar', label: '✅ Confirmar horário de funcionamento' },
          { value: 'Verificar disponibilidade antes de confirmar pedido', label: '✅ Verificar disponibilidade' },
          { value: 'NÃO_APLICA_EXTRAS', label: '❌ Não há regras ou observações adicionais', isNegative: true }
        ],
        allowCustom: true
      }
    ];
  }, [appointmentTypeOptions, catalogOptions]);

  const allowedQuestionIds = [
    'agentType',
    'agentName',
    'segment',
    'mainGoal',
    'offerings',
    'paymentProvider',
    'schedulingTypes',
    'agentTone'
  ];

  const visibleQuestions = useMemo(
    () =>
      guidedQuestions
        .filter((question) => allowedQuestionIds.includes(question.id))
        .filter((question) => !question.shouldShow || question.shouldShow(guidedAnswers)),
    [guidedQuestions, guidedAnswers]
  );

  const questionMap = useMemo(() => {
    const map = {};
    guidedQuestions.forEach((question) => {
      map[question.id] = question.title;
    });
    return map;
  }, [guidedQuestions]);

  const currentQuestion = visibleQuestions[currentQuestionIndex] || null;

  const isQuestionAnswered = (question) => {
    const value = guidedAnswers[question.id];
    if (question.type === 'multi_select') {
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }
    if (question.type === 'single_select') {
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  };

  const requiredGuidedMissing = visibleQuestions
    .filter((question) => question.required)
    .filter((question) => !isQuestionAnswered(question))
    .map((question) => question.id);

  const guidedPrompt = useMemo(() => {
    const parts = [];
    const agentName = guidedAnswers.agentName.trim();
    const agentTone = guidedAnswers.agentTone;
    const segment = guidedAnswers.segment.trim();
    const mainGoal = guidedAnswers.mainGoal.trim();
    const offerings = Array.isArray(guidedAnswers.offerings) ? guidedAnswers.offerings : (guidedAnswers.offerings ? [guidedAnswers.offerings] : []);
    const schedulingTypes = Array.isArray(guidedAnswers.schedulingTypes) ? guidedAnswers.schedulingTypes : (guidedAnswers.schedulingTypes ? [guidedAnswers.schedulingTypes] : []);
    const paymentProvider = guidedAnswers.paymentProvider || 'stripe';
    const agentType = guidedAnswers.agentType;

    const flow = [];
    flow.push('1) Perfil do agente (nome e função).');
    flow.push('2) Coleta no CRM: nome e CPF/CNPJ (telefone capturado automaticamente do WhatsApp).');

    if (agentType === 'sales' || agentType === 'sales_appointment') {
      flow.push('3) Mostrar catálogo de forma objetiva (lista curta).');
      flow.push('4) Confirmar itens e quantidades.');
      flow.push('5) Gerar/enviar link de pagamento (WhatsApp).');
      flow.push('6) Após pagamento confirmado, enviar confirmação.');
      if (agentType === 'sales_appointment') {
        flow.push('7) Criar agendamento no sistema.');
        flow.push('8) Responder ao cliente e encerrar.');
      } else {
        flow.push('7) Responder ao cliente e encerrar.');
      }
    } else if (agentType === 'appointment') {
      flow.push('3) Criar agendamento no sistema.');
      flow.push('4) Responder ao cliente e encerrar com despedida.');
    } else {
      flow.push('3) Executar o objetivo único e encerrar com despedida.');
    }

    parts.push('CRIE UM FLUXO COM 5 A 7 PASSOS, DESCRIÇÕES CURTAS E OBJETIVAS.');
    parts.push(`TIPO DE AGENTE: ${agentType}.`);
    if (agentName) {
      parts.push(`NOME DO ASSISTENTE: ${agentName}.`);
    }
    if (agentTone) {
      parts.push(`TOM DE VOZ: ${agentTone}.`);
    }
    parts.push(`SEGMENTO: ${segment}.`);
    parts.push(`OBJETIVO ÚNICO: ${mainGoal}.`);

    if (offerings.length > 0) {
      parts.push(`ITENS DO CATÁLOGO (ATÉ 3): ${offerings.slice(0, 3).join(', ')}.`);
    }
    if (agentType === 'sales' || agentType === 'sales_appointment') {
      parts.push(`PROVEDOR DE PAGAMENTO: ${paymentProvider}.`);
    }
    if (schedulingTypes.length > 0) {
      parts.push(`TIPOS DE AGENDAMENTO: ${schedulingTypes.slice(0, 3).join(', ')}.`);
    }

    parts.push('FLUXO OBRIGATÓRIO:');
    parts.push(flow.join('\n'));
    parts.push('NÃO CRIE ETAPAS FORA DO OBJETIVO ÚNICO.');

    return parts.join('\n\n');
  }, [guidedAnswers]);

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError('');
    if (nextMode === 'manual' && !description.trim() && guidedPrompt.trim()) {
      setDescription(guidedPrompt.trim());
    }
    if (nextMode === 'guided') {
      setCurrentQuestionIndex(0);
    }
  };

  const updateGuidedAnswers = (field, value) => {
    setGuidedAnswers((prev) => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleOptionSelect = (question, optionValue) => {
    if (!question.options || question.options.length === 0) {
      updateGuidedAnswers(question.id, optionValue);
      return;
    }

    if (question.type === 'single_select') {
      updateGuidedAnswers(question.id, optionValue);
      return;
    }

    setGuidedAnswers((prev) => {
      const current = Array.isArray(prev[question.id]) ? prev[question.id] : (prev[question.id] ? [prev[question.id]] : []);
      const exists = current.includes(optionValue);
      let next = exists ? current.filter((item) => item !== optionValue) : [...current, optionValue];
      if (question.maxSelections && next.length > question.maxSelections) {
        next = next.slice(0, question.maxSelections);
      }
      return { ...prev, [question.id]: next };
    });
  };

  const handleCustomAnswer = (question) => {
    const value = (customOptionDrafts[question.id] || '').trim();
    if (!value) return;
    if (question.options && question.options.length > 0 && question.type !== 'single_select') {
      setGuidedAnswers((prev) => {
        const current = Array.isArray(prev[question.id]) ? prev[question.id] : (prev[question.id] ? [prev[question.id]] : []);
        if (current.includes(value)) {
          return prev;
        }
        const next = question.maxSelections ? [...current, value].slice(0, question.maxSelections) : [...current, value];
        return { ...prev, [question.id]: next };
      });
    } else {
      updateGuidedAnswers(question.id, value);
    }
    setCustomOptionDrafts((prev) => ({ ...prev, [question.id]: '' }));
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    // Permite pular perguntas mesmo se não estiverem respondidas
    setError('');
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, visibleQuestions.length - 1));
  };

  const handlePreviousQuestion = () => {
    setError('');
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  };

  const resetGuidedState = () => {
    setGuidedAnswers(getInitialGuidedAnswers());
    setCurrentQuestionIndex(0);
    setCustomOptionDrafts({});
  };

  const promptToSend = mode === 'guided' ? guidedPrompt.trim() : description.trim();
  const isLastQuestion = mode === 'guided' && currentQuestionIndex === visibleQuestions.length - 1;
  const canGenerate = mode === 'guided'
    ? Boolean(isLastQuestion && promptToSend.length > 0)
    : Boolean(promptToSend);

  const handleGenerate = async () => {
    if (!promptToSend) {
      setError(
        mode === 'guided'
          ? 'Complete as perguntas obrigatórias para gerar o fluxo.'
          : 'Por favor, descreva o que você quer que o agente faça.'
      );
      return;
    }

    if (mode === 'guided' && requiredGuidedMissing.length > 0) {
      const field = requiredGuidedMissing[0];
      setError(`Responda a pergunta "${questionMap[field] || field}" antes de gerar o fluxo.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ia-agente-production.up.railway.app';
      console.log('🤖 Chamando backend:', `${backendUrl}/api/generate-flow`);

      const response = await fetch(`${backendUrl}/api/generate-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: promptToSend
        })
      });

      console.log('📡 Status da resposta:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro da API:', errorText);
        throw new Error(`Erro ${response.status}: ${errorText || 'Falha ao gerar template'}`);
      }

      const data = await response.json();
      console.log('📦 Dados recebidos:', data);

      if (!data.success || !data.template) {
        throw new Error(data.error || 'Template inválido retornado pela IA');
      }

      console.log('✅ Template gerado com sucesso!');
      console.log('📊 Steps:', data.template.steps?.length || 0);

      onGenerate(data.template);

      setDescription('');
      resetGuidedState();
      setMode('guided');
      onClose();
    } catch (err) {
      console.error('❌ Erro completo:', err);
      let errorMessage = 'Erro ao gerar template. ';

      if (err.message.includes('Failed to fetch')) {
        errorMessage += 'Não foi possível conectar ao backend. Verifique se o servidor está rodando.';
      } else if (err.message.includes('OPENAI_API_KEY')) {
        errorMessage += 'Chave da OpenAI não configurada. Configure OPENAI_API_KEY no backend (Railway).';
      } else if (err.message.includes('429')) {
        errorMessage += 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.';
      } else if (err.message.includes('401')) {
        errorMessage += 'Chave da OpenAI inválida. Verifique a configuração no Railway.';
      } else {
        errorMessage += err.message || 'Tente novamente.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setDescription('');
    setError('');
    resetGuidedState();
    setMode('guided');
    onClose();
  };

  const examples = [
    'Quero um agente de vendas para loja de joias que feche pedidos e envie pagamento',
    'Preciso de um agente para agendar serviços de ar-condicionado',
    'Quero um agente de vendas + agendamento para clínica estética'
  ];

  const renderOptions = (question) => {
    if (!question.options || question.options.length === 0) {
      if (question.emptyState) {
        return (
          <div style={{
            padding: '16px',
            border: '1px dashed #cbd5f5',
            borderRadius: '10px',
            background: '#f8fafc',
            color: '#475569',
            fontSize: '13px',
            marginBottom: '12px'
          }}>
            {question.emptyState}
          </div>
        );
      }
      return null;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto', marginBottom: '12px' }}>
        {question.options.map((option) => {
          // Sempre tratar como array quando houver opções
          const currentValue = guidedAnswers[question.id];
          const valueArray = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
          const isSelected = valueArray.includes(option.value);
          const isNegative = option.isNegative === true;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleOptionSelect(question, option.value)}
              style={{
                border: '1px solid',
                borderColor: isSelected 
                  ? (isNegative ? '#ef4444' : '#10b981')
                  : (isNegative ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'),
                background: isSelected 
                  ? (isNegative ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)')
                  : (isNegative ? 'rgba(239, 68, 68, 0.05)' : '#0f1419'),
                borderRadius: '10px',
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ 
                fontWeight: 600, 
                color: isNegative && isSelected ? '#ef4444' : '#ffffff' 
              }}>
                {option.label}
              </span>
              {option.description && (
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{option.description}</span>
              )}
              {option.meta && (
                <span style={{ fontSize: '12px', color: '#10b981' }}>{option.meta}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderSuggestions = (question) => {
    if (!question.suggestions || question.suggestions.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
        {question.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => updateGuidedAnswers(question.id, suggestion)}
            style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '999px',
              padding: '6px 12px',
              fontSize: '12px',
              background: '#0f1419',
              color: '#9ca3af',
              cursor: 'pointer'
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    );
  };

  const renderQuestionContent = () => {
    if (!currentQuestion) return null;

    const customValue = customOptionDrafts[currentQuestion.id] || '';

    return (
      <>
        {currentQuestion.type === 'text' ? (
          <>
            <textarea
              value={guidedAnswers[currentQuestion.id]}
              onChange={(e) => updateGuidedAnswers(currentQuestion.id, e.target.value)}
              placeholder={currentQuestion.placeholder}
              style={{
                width: '100%',
                minHeight: '100px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px',
                fontSize: '14px',
                resize: 'vertical',
                backgroundColor: '#0f1419',
                color: '#ffffff'
              }}
            />
            {renderSuggestions(currentQuestion)}
          </>
        ) : (
          <>
            {renderOptions(currentQuestion)}
            {currentQuestion.allowCustom !== false && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomOptionDrafts((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                  placeholder="Escreva sua própria opção"
                  style={{
                    flex: '1 1 200px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '13px',
                    backgroundColor: '#0f1419',
                    color: '#ffffff'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleCustomAnswer(currentQuestion)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
                    color: 'white',
                    fontWeight: 600,
                    cursor: customValue.trim() ? 'pointer' : 'not-allowed',
                    opacity: customValue.trim() ? 1 : 0.6
                  }}
                  disabled={!customValue.trim()}
                >
                  Usar resposta
                </button>
              </div>
            )}
            {currentQuestion.options && currentQuestion.options.length > 0 && (() => {
              const currentValue = guidedAnswers[currentQuestion.id];
              const valueArray = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
              return valueArray.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '12px', marginTop: '8px' }}>
                  {valueArray.map((item) => (
                    <span key={item} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 10px', borderRadius: '999px' }}>
                      {item}
                    </span>
                  ))}
                </div>
              );
            })()}
          </>
        )}
        {currentQuestion.helperText && (
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
            {currentQuestion.helperText}
          </p>
        )}
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#1a1f36',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#1a1f36',
          border: '1px solid #10b981'
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Sparkles size={24} />
              Criar Fluxo com IA
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: 0 }}>
              Descreva o que você quer e a IA criará o fluxo para você
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s',
              opacity: loading ? 0.5 : 1
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={(e) => (e.target.style.background = 'rgba(255, 255, 255, 0.2)')}
          >
            <X size={24} color="white" />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button
              onClick={() => handleModeChange('guided')}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: mode === 'guided' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                background: mode === 'guided' ? 'rgba(16, 185, 129, 0.2)' : '#0f1419',
                color: mode === 'guided' ? '#10b981' : '#ffffff',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Modo guiado
            </button>
            <button
              onClick={() => handleModeChange('manual')}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: mode === 'manual' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                background: mode === 'manual' ? 'rgba(16, 185, 129, 0.2)' : '#0f1419',
                color: mode === 'manual' ? '#10b981' : '#ffffff',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Modo livre
            </button>
          </div>

          {mode === 'guided' ? (
            <>
              <div style={{
                marginBottom: '20px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)',
                border: '2px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '0.5px'
                  }}>
                    Pergunta {currentQuestionIndex + 1} de {visibleQuestions.length}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: '500'
                  }}>
                    Monte o prompt passo a passo
                  </span>
                </div>
                <div style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#10b981'
                }}>
                  {Math.round(((currentQuestionIndex + 1) / visibleQuestions.length) * 100)}%
                </div>
              </div>

              <div style={{
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '20px',
                background: '#0f1419'
              }}>
                {currentQuestion && (
                  <>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#ffffff' }}>
                      {currentQuestion.title}
                    </h3>
                    {currentQuestion.description && (
                      <p style={{ margin: '0 0 16px 0', color: '#9ca3af', fontSize: '14px' }}>
                        {currentQuestion.description}
                      </p>
                    )}
                    {renderQuestionContent()}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: '#0f1419',
                    color: '#ffffff',
                    cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentQuestionIndex === 0 ? 0.6 : 1,
                    fontWeight: 600
                  }}
                >
                  Voltar
                </button>
                {currentQuestionIndex < visibleQuestions.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: '#1a1f36',
                      border: '1px solid #10b981',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Próxima pergunta
                  </button>
                )}
              </div>

              <div style={{
                background: '#0f1419',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>
                    Prompt sendo montado
                  </h4>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    Atualizado conforme você responde
                  </span>
                </div>
                <textarea
                  value={guidedPrompt}
                  readOnly
                  placeholder="Responda às perguntas e veja aqui o prompt completo..."
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    borderRadius: '10px',
                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                    padding: '12px',
                    fontSize: '13px',
                    color: guidedPrompt ? '#ffffff' : '#9ca3af',
                    background: '#1a1f36'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                  Este texto será enviado para a IA. Você pode alternar para o modo livre se quiser editar manualmente.
                </p>
              </div>
              {error && (
                <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>
                  ⚠️ {error}
                </p>
              )}
            </>
          ) : (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#ffffff',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Descreva o que você quer que o agente faça:
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  placeholder="Ex: Quero um agente que atenda clientes de uma loja de roupas, mostre produtos, processe pedidos e solicite pagamento..."
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: error ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    background: loading ? '#0f1419' : '#0f1419',
                    color: '#ffffff',
                    cursor: loading ? 'not-allowed' : 'text'
                  }}
                />
                {error && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>
                    ⚠️ {error}
                  </p>
                )}
              </div>

              <div style={{
                background: '#0f1419',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <h4 style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#ffffff',
                  margin: '0 0 12px 0'
                }}>
                  💡 Exemplos de descrições:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {examples.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => !loading && setDescription(example)}
                      disabled={loading}
                      style={{
                        background: '#1a1f36',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: '#9ca3af',
                        textAlign: 'left',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: loading ? 0.5 : 1
                      }}
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {loading && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Loader size={20} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
              <div>
                <p style={{ margin: 0, fontWeight: '600', color: '#1e40af', fontSize: '14px' }}>
                  Gerando seu fluxo...
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                  A IA está criando os passos do seu agente. Isso pode levar alguns segundos.
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#1a1f36'
        }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#0f1419',
              color: '#ffffff',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '14px',
              opacity: loading ? 0.5 : 1
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !canGenerate}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              backgroundColor: loading || !canGenerate ? 'rgba(255, 255, 255, 0.1)' : '#1a1f36',
              border: loading || !canGenerate ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #10b981',
              color: 'white',
              fontWeight: '600',
              cursor: loading || !canGenerate ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Gerar Fluxo
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
