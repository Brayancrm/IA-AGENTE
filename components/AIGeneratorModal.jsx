import { useMemo, useState } from 'react';
import { X, Sparkles, Loader } from 'lucide-react';

const getInitialGuidedAnswers = () => ({
  segment: '',
  audience: '',
  mainGoal: '',
  offerings: [],
  workflows: [],
  tone: 'Amigável e profissional',
  integrations: [],
  extras: '',
  schedulingNeed: '',
  schedulingTypes: [],
  schedulingNotes: ''
});

export default function AIGeneratorModal({ isOpen, onClose, onGenerate, catalogItems = [], agendamentos = [] }) {
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('guided');
  const [guidedAnswers, setGuidedAnswers] = useState(getInitialGuidedAnswers);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [customOptionDrafts, setCustomOptionDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
        title: 'Qual é o objetivo principal?',
        description: 'Informe o resultado que o agente deve buscar em cada conversa.',
        placeholder: 'Ex: qualificar leads e marcar consultas',
        suggestions: [
          'Qualificar leads e agendar uma visita',
          'Vender planos mensais do serviço',
          'Fechar pedidos e emitir cobranças',
          'Direcionar clientes para o time humano'
        ],
        required: true
      },
      {
        id: 'offerings',
        type: 'multi_select',
        title: 'Quais produtos ou serviços o agente deve oferecer?',
        description: 'Selecione itens diretamente do seu catálogo ou escreva manualmente.',
        options: offerOptions,
        emptyState: catalogOptions.length === 0 ? 'Cadastre produtos e serviços no catálogo para facilitar.' : '',
        required: false
      },
      {
        id: 'workflows',
        type: 'multi_select',
        title: 'Quais etapas o agente deve seguir?',
        description: 'Escolha o fluxo desejado para cada atendimento.',
        options: [
          { value: 'Qualificar leads e identificar necessidades', label: 'Qualificar leads' },
          { value: 'Apresentar catálogo com produtos/serviços', label: 'Mostrar catálogo' },
          { value: 'Criar pedidos completos', label: 'Montar pedido' },
          { value: 'Enviar orçamentos e propostas', label: 'Enviar orçamento' },
          { value: 'Coletar dados para nota fiscal', label: 'Coletar dados fiscais' },
          { value: 'Registrar agendamentos confirmados', label: 'Registrar agendamentos' }
        ]
      },
      {
        id: 'integrations',
        type: 'multi_select',
        title: 'Quais recursos extra devem ser utilizados?',
        description: 'Selecione integrações e automações suportadas pelo sistema.',
        options: [
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
        title: 'Quais tipos de compromisso devem ser agendados?',
        description: 'Selecione os serviços que viram compromissos no calendário.',
        options: appointmentOptions,
        shouldShow: (answers) => answers.schedulingNeed === 'yes'
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
      {
        id: 'extras',
        type: 'text',
        title: 'Existe alguma regra ou observação final?',
        description: 'Políticas de atendimento, gatilhos ou instruções específicas.',
        placeholder: 'Ex: sempre confirmar endereço completo antes de finalizar.'
      }
    ];
  }, [appointmentTypeOptions, catalogOptions]);

  const visibleQuestions = useMemo(
    () => guidedQuestions.filter((question) => !question.shouldShow || question.shouldShow(guidedAnswers)),
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

  const requiredGuidedMissing = ['segment', 'mainGoal'].filter((field) => {
    const value = guidedAnswers[field];
    return !value || (typeof value === 'string' && !value.trim());
  });

  const guidedPrompt = useMemo(() => {
    const parts = [];

    if (guidedAnswers.segment.trim()) {
      parts.push(`Quero um agente para ${guidedAnswers.segment.trim()}.`);
    }

    if (guidedAnswers.audience.trim()) {
      parts.push(`Ele deve priorizar ${guidedAnswers.audience.trim()}.`);
    }

    if (guidedAnswers.mainGoal.trim()) {
      parts.push(`O objetivo principal do atendimento é ${guidedAnswers.mainGoal.trim()}.`);
    }

    if (guidedAnswers.offerings.length > 0) {
      parts.push(`Apresente e recomende estes produtos/serviços do catálogo: ${guidedAnswers.offerings.join(', ')}.`);
    }

    if (guidedAnswers.workflows.length > 0) {
      parts.push(`Siga este fluxo de etapas: ${guidedAnswers.workflows.join(', ')}.`);
    }

    if (guidedAnswers.integrations.length > 0) {
      parts.push(`Use os seguintes recursos e integrações: ${guidedAnswers.integrations.join(', ')}.`);
    }

    if (guidedAnswers.schedulingNeed === 'yes') {
      const types = guidedAnswers.schedulingTypes.length > 0
        ? ` para ${guidedAnswers.schedulingTypes.join(', ')}`
        : '';
      parts.push(
        `Crie e confirme agendamentos${types}. Registre cada compromisso imediatamente no calendário oficial da agenda do usuário (tabela de agendamentos), incluindo data, horário, status e lembretes.`
      );
      if (guidedAnswers.schedulingNotes.trim()) {
        parts.push(guidedAnswers.schedulingNotes.trim());
      }
    }

    if (guidedAnswers.tone.trim()) {
      parts.push(`Mantenha um tom ${guidedAnswers.tone.trim()}.`);
    }

    if (guidedAnswers.extras.trim()) {
      parts.push(`Observações adicionais: ${guidedAnswers.extras.trim()}.`);
    }

    return parts.join('\n\n');
  }, [guidedAnswers]);

  const isQuestionAnswered = (question) => {
    const value = guidedAnswers[question.id];
    if (question.type === 'multi_select') {
      return Array.isArray(value) && value.length > 0;
    }
    if (question.type === 'single_select') {
      return Boolean(value);
    }
    if (question.type === 'text') {
      return Boolean(value && value.trim());
    }
    return false;
  };

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
    if (question.type === 'multi_select') {
      setGuidedAnswers((prev) => {
        const current = Array.isArray(prev[question.id]) ? prev[question.id] : [];
        const exists = current.includes(optionValue);
        const next = exists ? current.filter((item) => item !== optionValue) : [...current, optionValue];
        return { ...prev, [question.id]: next };
      });
    } else {
      updateGuidedAnswers(question.id, optionValue);
    }
  };

  const handleCustomAnswer = (question) => {
    const value = (customOptionDrafts[question.id] || '').trim();
    if (!value) return;
    if (question.type === 'multi_select') {
      setGuidedAnswers((prev) => {
        const current = Array.isArray(prev[question.id]) ? prev[question.id] : [];
        if (current.includes(value)) {
          return prev;
        }
        return { ...prev, [question.id]: [...current, value] };
      });
    } else {
      updateGuidedAnswers(question.id, value);
    }
    setCustomOptionDrafts((prev) => ({ ...prev, [question.id]: '' }));
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    if (currentQuestion.required && !isQuestionAnswered(currentQuestion)) {
      setError('Responda esta pergunta para continuar.');
      return;
    }
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
  const canGenerate = mode === 'guided'
    ? Boolean(promptToSend && requiredGuidedMissing.length === 0)
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
    'Quero um agente que atenda clientes de uma clínica odontológica, agende consultas e confirme horários',
    'Preciso de um assistente para restaurante delivery que receba pedidos, colete endereço e processe pagamento',
    'Quero um bot para escola de inglês que qualifique leads, ofereça aula experimental e faça matrícula',
    'Preciso atender clientes de pet shop, vender produtos, agendar banho e tosa'
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
          const isSelected = question.type === 'multi_select'
            ? (guidedAnswers[question.id] || []).includes(option.value)
            : guidedAnswers[question.id] === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleOptionSelect(question, option.value)}
              style={{
                border: '1px solid',
                borderColor: isSelected ? '#6366f1' : '#e5e7eb',
                background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'white',
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
              <span style={{ fontWeight: 600, color: '#111827' }}>{option.label}</span>
              {option.description && (
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{option.description}</span>
              )}
              {option.meta && (
                <span style={{ fontSize: '12px', color: '#4338ca' }}>{option.meta}</span>
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
              border: '1px solid #d1d5db',
              borderRadius: '999px',
              padding: '6px 12px',
              fontSize: '12px',
              background: 'white',
              color: '#4b5563',
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
                border: '1px solid #d1d5db',
                padding: '12px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
            {renderSuggestions(currentQuestion)}
          </>
        ) : (
          <>
            {renderOptions(currentQuestion)}
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
                  border: '1px solid #d1d5db',
                  fontSize: '13px'
                }}
              />
              <button
                type="button"
                onClick={() => handleCustomAnswer(currentQuestion)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#6366f1',
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
            {currentQuestion.type === 'multi_select' && (guidedAnswers[currentQuestion.id] || []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '12px' }}>
                {(guidedAnswers[currentQuestion.id] || []).map((item) => (
                  <span key={item} style={{ background: '#eef2ff', color: '#4338ca', padding: '4px 10px', borderRadius: '999px' }}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {currentQuestion.helperText && (
          <p style={{ fontSize: '12px', color: '#0f172a', marginTop: '12px' }}>
            {currentQuestion.helperText}
          </p>
        )}
      </>
    );
  };

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
          backgroundColor: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
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
                borderColor: mode === 'guided' ? '#6366f1' : '#d1d5db',
                background: mode === 'guided' ? 'rgba(99, 102, 241, 0.12)' : 'white',
                color: mode === 'guided' ? '#4338ca' : '#374151',
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
                borderColor: mode === 'manual' ? '#6366f1' : '#d1d5db',
                background: mode === 'manual' ? 'rgba(99, 102, 241, 0.12)' : 'white',
                color: mode === 'manual' ? '#4338ca' : '#374151',
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
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#eef2ff',
                color: '#4338ca',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px'
              }}>
                <span>Pergunta {currentQuestionIndex + 1} de {visibleQuestions.length}</span>
                <span>Monte o prompt passo a passo</span>
              </div>

              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '20px',
                background: '#fff'
              }}>
                {currentQuestion && (
                  <>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#111827' }}>
                      {currentQuestion.title}
                    </h3>
                    {currentQuestion.description && (
                      <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
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
                    border: '1px solid #d1d5db',
                    background: 'white',
                    color: '#374151',
                    cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentQuestionIndex === 0 ? 0.6 : 1,
                    fontWeight: 600
                  }}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex === visibleQuestions.length - 1 && isQuestionAnswered(currentQuestion)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: currentQuestionIndex === visibleQuestions.length - 1 ? '#c7d2fe' : '#6366f1',
                    color: 'white',
                    cursor: currentQuestionIndex === visibleQuestions.length - 1 ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  Próxima pergunta
                </button>
              </div>

              <div style={{
                background: '#f9fafb',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    Prompt sendo montado
                  </h4>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
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
                    border: '1px dashed #94a3b8',
                    padding: '12px',
                    fontSize: '13px',
                    color: guidedPrompt ? '#111827' : '#94a3b8',
                    background: '#fff'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
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
                  color: '#374151',
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
                    border: error ? '2px solid #ef4444' : '1px solid #d1d5db',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    background: loading ? '#f9fafb' : 'white',
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
                background: '#f9fafb',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151',
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
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: '#6b7280',
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
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#f9fafb'
        }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#374151',
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
              border: 'none',
              background: loading || !canGenerate ? '#d1d5db' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
