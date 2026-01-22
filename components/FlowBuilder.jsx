import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, Edit2, Save, X, FileText, Sparkles, ChevronLeft, ChevronRight, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { compilePrompt } from '../hooks/useFlowBuilder';
import TemplateModal from './TemplateModal';
import AIGeneratorModal from './AIGeneratorModal';

// Componente WhatsAppIcon
const WhatsAppIcon = ({ size = 24, color = '#25D366' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill={color}/>
  </svg>
);

/**
 * FlowBuilder - Interface visual para criar fluxo do agente em steps
 * 
 * Permite:
 * - Adicionar, editar, remover steps
 * - Reordenar via drag & drop
 * - Gerar prompt automaticamente
 */
export default function FlowBuilder({ initialSteps = [], catalogItems = [], agendamentos = [], onChange, onPromptChange, onSave }) {
  const [steps, setSteps] = useState(initialSteps);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingStep, setEditingStep] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showDemoConversation, setShowDemoConversation] = useState(false);
  const [demoConversation, setDemoConversation] = useState(null);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [showPromptImprover, setShowPromptImprover] = useState(false);
  const [promptImprovements, setPromptImprovements] = useState('');
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [improvedPrompt, setImprovedPrompt] = useState(null);
  const [showingImproved, setShowingImproved] = useState(false);
  const [selectedStepsForImprovement, setSelectedStepsForImprovement] = useState([]);
  const [improvementTexts, setImprovementTexts] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState('');
  const [promptWasEdited, setPromptWasEdited] = useState(false);

  const greetingExample = 'Olá, me chamo [NOME DO AGENTE] e sou [FUNÇÃO DO AGENTE]. Como posso ajudar?';

  const productCategories = Array.from(
    new Set(
      (catalogItems || [])
        .filter((item) => item?.type === 'product' && item?.category)
        .map((item) => item.category.trim())
        .filter(Boolean)
    )
  );

  const serviceCategories = Array.from(
    new Set(
      (catalogItems || [])
        .filter((item) => item?.type === 'service' && item?.category)
        .map((item) => item.category.trim())
        .filter(Boolean)
    )
  );

  // Tipos de ação disponíveis
  const actionTypes = [
    { value: 'agent_profile', label: '🤖 Perfil do Agente', icon: '🤖' },
    { value: 'audio_config', label: '🎤 Configurações de Áudio', icon: '🎤' },
    { value: 'greeting', label: '👋 Cumprimentar', icon: '👋' },
    { value: 'ask_info', label: '❓ Perguntar Informação', icon: '❓' },
    { value: 'collect_data', label: '📋 Coleta de Dados (CRM)', icon: '📋' },
    { value: 'show_catalog', label: '📦 Mostrar Produtos/Serviços', icon: '📦' },
    { value: 'process_order', label: '🛒 Processar Pedido', icon: '🛒' },
    { value: 'request_payment', label: '💳 Solicitar Pagamento', icon: '💳' },
    { value: 'send_confirmation', label: '✅ Enviar Confirmação', icon: '✅' },
    { value: 'ask_invoice', label: '📄 Perguntar sobre Nota Fiscal', icon: '📄' },
    { value: 'collect_address', label: '📍 Coletar Endereço', icon: '📍' },
    { value: 'create_appointment', label: '📅 Criar Agendamento', icon: '📅' },
    { value: 'free_text', label: '📝 Texto Livre', icon: '📝' },
    { value: 'custom', label: '⚙️ Ação Personalizada', icon: '⚙️' },
  ];

  // Adicionar novo step
  const addStep = () => {
    const newStep = {
      id: Date.now(),
      type: 'greeting',
      title: 'Novo Passo',
      description: greetingExample,
      condition: null, // Condição para executar (opcional)
      actions: [],
      catalogSettings: {
        includeProducts: false,
        includeServices: false,
        selectedProducts: [],
        selectedServices: [],
        selectedProductCategories: [],
        selectedServiceCategories: []
      }
    };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    
    // Calcular a página onde o novo passo estará (2 passos por página)
    const stepsPerPage = 2;
    const newStepIndex = newSteps.length - 1;
    const targetPage = Math.floor(newStepIndex / stepsPerPage);
    
    // Navegar para a página do novo passo
    setCurrentPage(targetPage);
    
    setEditingIndex(newStepIndex);
    setEditingStep(newStep);
  };

  // Remover step
  const removeStep = (index) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
    if (onChange) onChange(newSteps);
  };

  // Iniciar edição
  const startEdit = (index) => {
    setEditingIndex(index);
    const step = { ...steps[index] };
    // Garantir que catalogSettings existe
    if (!step.catalogSettings) {
      step.catalogSettings = {
        includeProducts: false,
        includeServices: false,
        selectedProducts: [],
        selectedServices: [],
        selectedProductCategories: [],
        selectedServiceCategories: []
      };
    } else {
      step.catalogSettings = {
        includeProducts: false,
        includeServices: false,
        selectedProducts: [],
        selectedServices: [],
        selectedProductCategories: [],
        selectedServiceCategories: [],
        ...step.catalogSettings
      };
    }
    setEditingStep(step);
  };

  // Salvar edição
  const saveEdit = () => {
    const newSteps = [...steps];
    newSteps[editingIndex] = editingStep;
    setSteps(newSteps);
    setEditingIndex(null);
    setEditingStep(null);
    if (onChange) onChange(newSteps);
  };

  // Cancelar edição
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingStep(null);
  };

  // Handle drag end
  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(steps);
    // Converter índices da página visível para índices globais
    const stepsPerPage = 2;
    const sourceIndex = (currentPage * stepsPerPage) + result.source.index;
    const destIndex = (currentPage * stepsPerPage) + result.destination.index;
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destIndex, 0, reorderedItem);

    setSteps(items);
    if (onChange) onChange(items);
  };

  // Mover passo para cima
  const moveStepUp = (index) => {
    if (index === 0) return;
    const items = [...steps];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    setSteps(items);
    if (onChange) onChange(items);
    // Ajustar página se necessário
    const stepsPerPage = 2;
    const newPage = Math.floor((index - 1) / stepsPerPage);
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  // Mover passo para baixo
  const moveStepDown = (index) => {
    if (index === steps.length - 1) return;
    const items = [...steps];
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    setSteps(items);
    if (onChange) onChange(items);
    // Ajustar página se necessário
    const stepsPerPage = 2;
    const newPage = Math.floor((index + 1) / stepsPerPage);
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  // Aplicar template selecionado
  const applyTemplate = (template) => {
    // Verificar se o template já tem step de áudio
    const hasAudioStep = template.steps.some(s => s.type === 'audio_config');
    
    // Gerar IDs únicos para os steps do template
    let stepsToAdd = template.steps.map(step => ({
      ...step,
      id: Date.now() + Math.random(), // Garantir IDs únicos
      catalogSettings: step.catalogSettings || {
        includeProducts: false,
        includeServices: false,
        selectedProducts: [],
        selectedServices: []
      }
    }));
    
    // Se não tiver step de áudio, adicionar após agent_profile
    if (!hasAudioStep) {
      const agentProfileIndex = stepsToAdd.findIndex(s => s.type === 'agent_profile');
      const audioStep = {
        id: Date.now() + '-audio',
        type: 'audio_config',
        title: 'Configurações de Áudio',
        description: 'Configure o idioma e voz para respostas de áudio no WhatsApp. Quando o cliente enviar uma mensagem de áudio, o agente responderá também em áudio usando as configurações definidas aqui.',
        audioLanguage: 'pt-BR',
        audioVoice: '',
        condition: '',
        isRequired: true
      };
      
      const insertIndex = agentProfileIndex >= 0 ? agentProfileIndex + 1 : 0;
      stepsToAdd.splice(insertIndex, 0, audioStep);
    }
    
    setSteps(stepsToAdd);
    if (onChange) onChange(stepsToAdd);
  };

  // Aplicar template gerado pela IA
  const applyAITemplate = (template) => {
    // Template vem do backend já formatado
    applyTemplate(template);
  };


  // Gerar conversa demonstração
  const handleGenerateDemo = async () => {
    const currentPrompt = generatePrompt();
    if (!currentPrompt) {
      alert('Configure pelo menos um passo antes de gerar a demonstração!');
      return;
    }

    setGeneratingDemo(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ia-agente-production.up.railway.app'}/api/generate-demo-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt: currentPrompt
        })
      });

      const data = await response.json();
      if (data.conversation) {
        setDemoConversation(data.conversation);
      } else {
        alert('❌ Erro: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('❌ Erro ao conectar: ' + error.message);
    } finally {
      setGeneratingDemo(false);
    }
  };

  // Abrir modal de demonstração
  const openDemoConversation = () => {
    setShowDemoConversation(true);
    if (!demoConversation) {
      handleGenerateDemo();
    }
  };

  // Melhorar prompt com IA
  const handleImprovePrompt = async () => {
    // Gerar texto de melhorias baseado nos steps selecionados
    let improvementsText = '';
    
    if (selectedStepsForImprovement.length > 0) {
      improvementsText = 'MELHORIAS POR PASSO:\n\n';
      selectedStepsForImprovement.forEach(stepId => {
        const step = steps.find(s => s.id === stepId);
        const improvement = improvementTexts[stepId];
        if (step && improvement) {
          improvementsText += `PASSO "${step.title}": ${improvement}\n\n`;
        }
      });
    } else if (promptImprovements.trim()) {
      improvementsText = promptImprovements;
    } else {
      alert('Selecione pelo menos um passo ou digite melhorias gerais!');
      return;
    }

    const currentPrompt = generatePrompt();
    if (!currentPrompt) {
      alert('Configure pelo menos um passo antes de melhorar!');
      return;
    }

    setImprovingPrompt(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ia-agente-production.up.railway.app'}/api/improve-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPrompt: currentPrompt,
          improvements: improvementsText
        })
      });

      const data = await response.json();
      if (data.improvedPrompt) {
        // Aplicar melhorias ao prompt final
        if (onPromptChange) {
          onPromptChange(data.improvedPrompt);
        }
        alert('✅ Prompt melhorado com sucesso!');
        // Fechar modal e limpar estados
        setShowPromptImprover(false);
        setPromptImprovements('');
        setSelectedStepsForImprovement([]);
        setImprovementTexts({});
      } else {
        alert('❌ Erro: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('❌ Erro ao conectar: ' + error.message);
    } finally {
      setImprovingPrompt(false);
    }
  };

  // Toggle step selection for improvement
  const toggleStepSelection = (stepId) => {
    if (selectedStepsForImprovement.includes(stepId)) {
      setSelectedStepsForImprovement(selectedStepsForImprovement.filter(id => id !== stepId));
      // Remover texto de melhoria desse step
      const newTexts = { ...improvementTexts };
      delete newTexts[stepId];
      setImprovementTexts(newTexts);
    } else {
      setSelectedStepsForImprovement([...selectedStepsForImprovement, stepId]);
    }
  };

  // Update improvement text for a specific step
  const updateImprovementText = (stepId, text) => {
    setImprovementTexts({ ...improvementTexts, [stepId]: text });
  };

  // Gerar prompt executável a partir dos steps
  const generatePrompt = () => compilePrompt(steps);

  // Estatísticas do fluxo
  const completedSteps = steps.filter(s => s.title && s.description).length;
  const hasAgentProfile = steps.some(s => s.type === 'agent_profile');
  const hasGreeting = steps.some(s => s.type === 'greeting');
  
  // Paginação - mostrar 2 steps por vez
  const stepsPerPage = 2;
  const totalPages = Math.ceil(steps.length / stepsPerPage);
  const startIndex = currentPage * stepsPerPage;
  const endIndex = startIndex + stepsPerPage;
  const visibleSteps = steps.slice(startIndex, endIndex);
  const visibleStepsWithIndex = visibleSteps.map((step, idx) => ({
    step,
    originalIndex: startIndex + idx
  }));
  
  // Ajustar página atual se necessário
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [steps.length, currentPage, totalPages]);
  
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };
  
  const handleOpenPromptModal = () => {
    setEditablePrompt(generatePrompt());
    setShowPromptModal(true);
  };
  
  const handleSavePrompt = () => {
    // Marcar que o prompt foi editado, permitindo salvar
    setPromptWasEdited(true);
    if (onPromptChange && editablePrompt) {
      onPromptChange(editablePrompt);
    }
    setShowPromptModal(false);
  };
  
  // Dicas contextuais por tipo de step
  const getTipsForStepType = (type) => {
    const tips = {
      'agent_profile': '💡 Defina a personalidade: nome, tom de voz, estilo de comunicação',
      'greeting': '💡 Seja caloroso e acolhedor. Apresente o agente e ofereça ajuda',
      'show_catalog': '💡 Organize produtos por categoria e destaque promoções',
      'process_order': '💡 Confirme itens, quantidades e valores antes de finalizar',
      'request_payment': '💡 Ofereça múltiplas opções (PIX, cartão, boleto)',
      'collect_address': '💡 Solicite dados completos para evitar erros de entrega',
      'ask_info': '💡 Use perguntas abertas para entender a necessidade do cliente',
      'collect_data': '💡 Defina as informações que precisam ser coletadas para o CRM',
      'create_appointment': '💡 Configure os tipos de agendamento permitidos',
      'send_confirmation': '💡 Envie resumo claro com número de pedido para rastreamento'
    };
    return tips[type] || '💡 Seja claro e específico nas instruções para o agente';
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div style={{ backgroundColor: '#1a1f36', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '20px', marginBottom: '16px' }}>
        {/* Título e Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '1.25rem' }}>🎯</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                Fluxo do Agente
              </h2>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 8px 0', paddingLeft: '35px' }}>
              Configure o fluxo de conversa do seu agente em passos
            </p>
            {steps.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '35px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8125rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#10b981' }}>✓</span>
                  {completedSteps}/{steps.length} passos configurados
                </span>
                {!hasAgentProfile && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    ⚠️ Adicione um perfil do agente
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Botões - Layout Compacto */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          {steps.length > 0 && (
            <>
              <button
                type="button"
                onClick={openDemoConversation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#1a1f36',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #10b981',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0f1419';
                  e.currentTarget.style.borderColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1f36';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
              >
                <span style={{ fontSize: '0.875rem' }}>💬</span>
                Demonstração
              </button>
              <button
                type="button"
                onClick={() => setShowPromptImprover(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#1a1f36',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #f59e0b',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0f1419';
                  e.currentTarget.style.borderColor = '#d97706';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1f36';
                  e.currentTarget.style.borderColor = '#f59e0b';
                }}
              >
                <Sparkles size={16} />
                Melhorar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowAIModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1a1f36',
              color: 'white',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.backgroundColor = '#0f1419';
              e.currentTarget.style.borderColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.backgroundColor = '#1a1f36';
              e.currentTarget.style.borderColor = '#10b981';
            }}
          >
            <Sparkles size={16} />
            Criar com IA
          </button>
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1a1f36',
              color: 'white',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0f1419';
              e.currentTarget.style.borderColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1f36';
              e.currentTarget.style.borderColor = '#10b981';
            }}
          >
            <FileText size={16} />
            Template
          </button>
          <button
            type="button"
            onClick={addStep}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1a1f36',
              color: 'white',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0f1419';
              e.currentTarget.style.borderColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1f36';
              e.currentTarget.style.borderColor = '#10b981';
            }}
          >
            <Plus size={16} />
            Adicionar Passo
          </button>
          {steps.length > 0 && (
            <button
              type="button"
              onClick={handleOpenPromptModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#1a1f36',
                color: 'white',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #10b981',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0f1419';
                e.currentTarget.style.borderColor = '#059669';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1f36';
                e.currentTarget.style.borderColor = '#10b981';
              }}
            >
              <Eye size={16} />
              Ver Prompt
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (onSave) {
                  onSave();
                } else {
                  const form = document.getElementById('assistant-form');
                  if (form) {
                    const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
                    form.dispatchEvent(submitEvent);
                  }
                }
              }}
              disabled={steps.length === 0 && !promptWasEdited}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: (steps.length === 0 && !promptWasEdited) ? '#0f1419' : '#1a1f36',
                color: (steps.length === 0 && !promptWasEdited) ? '#6b7280' : 'white',
                padding: '8px 14px',
                borderRadius: '6px',
                border: (steps.length === 0 && !promptWasEdited) ? '1px solid #374151' : '1px solid #10b981',
                cursor: (steps.length === 0 && !promptWasEdited) ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                opacity: (steps.length === 0 && !promptWasEdited) ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (steps.length > 0 || promptWasEdited) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.backgroundColor = '#0f1419';
                  e.currentTarget.style.borderColor = '#059669';
                }
              }}
              onMouseLeave={(e) => {
                if (steps.length > 0 || promptWasEdited) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.backgroundColor = '#1a1f36';
                  e.currentTarget.style.borderColor = '#10b981';
                }
              }}
            >
              <Save size={16} />
              Salvar
            </button>
          )}
        </div>
      </div>

      {/* Steps List */}
      {steps.length > 0 && (
        <>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="steps">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-4"
                >
                  {visibleStepsWithIndex.map(({ step, originalIndex }, localIndex) => (
                <Draggable
                  key={step.id}
                  draggableId={String(step.id)}
                  index={localIndex}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={{
                        backgroundColor: '#1a1f36',
                        borderRadius: '12px',
                        boxShadow: snapshot.isDragging ? '0 8px 24px rgba(16, 185, 129, 0.4)' : '0 4px 12px rgba(0,0,0,0.3)',
                        border: `2px solid ${snapshot.isDragging ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Step Card */}
                      {editingIndex === originalIndex ? (
                        // Edit Mode
                        <div className="p-6">
                          <div className="space-y-4">
                            {/* Tipo de Ação */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                Tipo de Ação
                              </label>
                              <select
                                value={editingStep.type}
                                onChange={(e) => {
                                  const nextType = e.target.value;
                                  setEditingStep({
                                    ...editingStep,
                                    type: nextType,
                                    description: nextType === 'greeting' && !editingStep.description
                                      ? greetingExample
                                      : editingStep.description
                                  });
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  backgroundColor: '#0f1419',
                                  color: '#ffffff',
                                  outline: 'none'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = '#10b981';
                                  e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                  e.target.style.boxShadow = 'none';
                                }}
                              >
                                {actionTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.icon} {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Título */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                Título do Passo
                              </label>
                              <input
                                type="text"
                                value={editingStep.title}
                                onChange={(e) =>
                                  setEditingStep({
                                    ...editingStep,
                                    title: e.target.value,
                                  })
                                }
                                placeholder="Ex: Cumprimentar o cliente"
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  backgroundColor: '#0f1419',
                                  color: '#ffffff',
                                  outline: 'none'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = '#10b981';
                                  e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                  e.target.style.boxShadow = 'none';
                                }}
                              />
                            </div>

                            {/* Descrição/Instruções */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                {editingStep.type === 'free_text' 
                                  ? 'Prompt Livre (Escreva o texto completo)'
                                  : 'Instruções Detalhadas'}
                              </label>
                              
                              {/* Seletor de Variáveis do CRM */}
                              <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981' }}>🔄 Variáveis do CRM:</span>
                                  <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Clique para inserir no texto</span>
                                </div>
                                
                                {/* Variáveis Básicas */}
                                <div style={{ marginBottom: '10px' }}>
                                  <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#10b981', marginBottom: '6px' }}>📋 Dados Básicos:</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {[
                                      { var: '{{nome}}', label: 'Nome', icon: '👤' },
                                      { var: '{{email}}', label: 'Email', icon: '📧' },
                                      { var: '{{telefone}}', label: 'Telefone', icon: '📱' },
                                      { var: '{{cpf}}', label: 'CPF/CNPJ', icon: '🆔' },
                                    ].map((variable) => (
                                      <button
                                        key={variable.var}
                                        type="button"
                                        onClick={() => {
                                          const textarea = document.getElementById(`description-textarea-${editingStep.id}`);
                                          const currentText = editingStep.description || '';
                                          
                                          if (textarea) {
                                            const start = textarea.selectionStart || currentText.length;
                                            const end = textarea.selectionEnd || start;
                                            const newText = currentText.substring(0, start) + variable.var + currentText.substring(end);
                                            
                                            setEditingStep({
                                              ...editingStep,
                                              description: newText,
                                            });
                                            
                                            setTimeout(() => {
                                              textarea.focus();
                                              const newCursorPos = start + variable.var.length;
                                              textarea.setSelectionRange(newCursorPos, newCursorPos);
                                            }, 10);
                                          } else {
                                            setEditingStep({
                                              ...editingStep,
                                              description: currentText + variable.var,
                                            });
                                          }
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '6px 10px',
                                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                          border: '1px solid rgba(16, 185, 129, 0.3)',
                                          borderRadius: '6px',
                                          color: '#10b981',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                                          e.currentTarget.style.borderColor = '#10b981';
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                                          e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                        title={`Inserir ${variable.label} do cliente`}
                                      >
                                        <span>{variable.icon}</span>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{variable.var}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Variáveis de Endereço */}
                                <div>
                                  <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#10b981', marginBottom: '6px' }}>📍 Endereço:</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {[
                                      { var: '{{endereco}}', label: 'Endereço Completo', icon: '📍' },
                                      { var: '{{rua}}', label: 'Rua', icon: '🛣️' },
                                      { var: '{{numero}}', label: 'Número', icon: '🔢' },
                                      { var: '{{complemento}}', label: 'Complemento', icon: '🏠' },
                                      { var: '{{bairro}}', label: 'Bairro', icon: '🏘️' },
                                      { var: '{{cidade}}', label: 'Cidade', icon: '🏙️' },
                                      { var: '{{estado}}', label: 'Estado', icon: '🗺️' },
                                      { var: '{{cep}}', label: 'CEP', icon: '📮' },
                                    ].map((variable) => (
                                      <button
                                        key={variable.var}
                                        type="button"
                                        onClick={() => {
                                          const textarea = document.getElementById(`description-textarea-${editingStep.id}`);
                                          const currentText = editingStep.description || '';
                                          
                                          if (textarea) {
                                            const start = textarea.selectionStart || currentText.length;
                                            const end = textarea.selectionEnd || start;
                                            const newText = currentText.substring(0, start) + variable.var + currentText.substring(end);
                                            
                                            setEditingStep({
                                              ...editingStep,
                                              description: newText,
                                            });
                                            
                                            setTimeout(() => {
                                              textarea.focus();
                                              const newCursorPos = start + variable.var.length;
                                              textarea.setSelectionRange(newCursorPos, newCursorPos);
                                            }, 10);
                                          } else {
                                            setEditingStep({
                                              ...editingStep,
                                              description: currentText + variable.var,
                                            });
                                          }
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '6px 10px',
                                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                          border: '1px solid rgba(16, 185, 129, 0.3)',
                                          borderRadius: '6px',
                                          color: '#10b981',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                                          e.currentTarget.style.borderColor = '#10b981';
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                                          e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                        title={`Inserir ${variable.label} do cliente`}
                                      >
                                        <span>{variable.icon}</span>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{variable.var}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#9ca3af' }}>
                                  💡 As variáveis serão substituídas automaticamente pelos dados do cliente do CRM
                                </div>
                              </div>
                              
                              {editingStep.type === 'greeting' && (
                                <div style={{ marginBottom: '10px' }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingStep({
                                        ...editingStep,
                                        description: greetingExample
                                      })
                                    }
                                    style={{
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid rgba(16, 185, 129, 0.4)',
                                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                      color: '#10b981',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Inserir exemplo de saudação
                                  </button>
                                </div>
                              )}

                              <textarea
                                id={`description-textarea-${editingStep.id}`}
                                value={editingStep.description}
                                onChange={(e) =>
                                  setEditingStep({
                                    ...editingStep,
                                    description: e.target.value,
                                  })
                                }
                                placeholder={editingStep.type === 'free_text'
                                  ? "Ex: Você é um assistente prestativo. Quando o cliente perguntar sobre...\n\nEscreva aqui o prompt completo que deseja usar neste ponto do fluxo."
                                  : (editingStep.type === 'greeting'
                                    ? greetingExample
                                    : "Ex: Olá {{nome}}! Cumprimente o cliente de forma amigável e pergunte como pode ajudar...")}
                                rows={editingStep.type === 'free_text' ? 8 : 4}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  backgroundColor: '#0f1419',
                                  color: '#ffffff',
                                  outline: 'none',
                                  resize: 'vertical'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = '#10b981';
                                  e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                  e.target.style.boxShadow = 'none';
                                }}
                              />
                              <p style={{ fontSize: '0.875rem', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', marginTop: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                {getTipsForStepType(editingStep.type)}
                              </p>
                            </div>

                            {/* Campos específicos para Perfil do Agente */}
                            {editingStep.type === 'agent_profile' && (
                              <div className="border-t pt-4 space-y-4">
                                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                  <p style={{ fontSize: '0.875rem', color: '#f59e0b', fontWeight: '600' }}>
                                    🤖 Configure a personalidade e apresentação do agente
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  {/* Nome do Agente */}
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Nome do Agente *
                                    </label>
                                    <input
                                      type="text"
                                      value={editingStep.agentName || ''}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          agentName: e.target.value,
                                        })
                                      }
                                      placeholder="Ex: Sofia, Pedro, Maria..."
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    />
                                  </div>

                                  {/* Cargo/Função */}
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Cargo/Função
                                    </label>
                                    <input
                                      type="text"
                                      value={editingStep.agentRole || ''}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          agentRole: e.target.value,
                                        })
                                      }
                                      placeholder="Ex: Atendente, Consultor..."
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    />
                                  </div>

                                  {/* Tom de Voz */}
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Tom de Voz
                                    </label>
                                    <select
                                      value={editingStep.agentTone || 'friendly'}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          agentTone: e.target.value,
                                        })
                                      }
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    >
                                      <option value="friendly">😊 Amigável e Caloroso</option>
                                      <option value="professional">👔 Profissional e Formal</option>
                                      <option value="casual">😎 Casual e Descontraído</option>
                                      <option value="enthusiastic">🎉 Entusiasmado</option>
                                      <option value="empathetic">❤️ Empático e Acolhedor</option>
                                    </select>
                                  </div>

                                  {/* Estilo de Comunicação */}
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Estilo de Comunicação
                                    </label>
                                    <select
                                      value={editingStep.agentStyle || 'concise'}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          agentStyle: e.target.value,
                                        })
                                      }
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    >
                                      <option value="concise">📝 Conciso e Direto</option>
                                      <option value="detailed">📚 Detalhado e Explicativo</option>
                                      <option value="consultative">💡 Consultivo</option>
                                      <option value="persuasive">🎯 Persuasivo</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Personalidade */}
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                    Personalidade (use o campo "Instruções" acima)
                                  </label>
                                  <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                                    No campo "Instruções Detalhadas" acima, descreva características como: sempre usa emojis, evita termos técnicos, é paciente, etc.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Campos específicos para Configurações de Áudio */}
                            {editingStep.type === 'audio_config' && (
                              <div className="border-t pt-4 space-y-4">
                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                  <p style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '600' }}>
                                    🎤 Configure o idioma e voz para respostas de áudio no WhatsApp
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  {/* Idioma do Áudio */}
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Idioma do Áudio *
                                    </label>
                                    <select
                                      value={editingStep.audioLanguage || 'pt-BR'}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          audioLanguage: e.target.value,
                                        })
                                      }
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    >
                                      <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                                      <option value="pt-PT">🇵🇹 Português (Portugal)</option>
                                      <option value="en-US">🇺🇸 English (US)</option>
                                      <option value="en-GB">🇬🇧 English (UK)</option>
                                      <option value="es-ES">🇪🇸 Español (España)</option>
                                      <option value="es-MX">🇲🇽 Español (México)</option>
                                      <option value="fr-FR">🇫🇷 Français</option>
                                      <option value="de-DE">🇩🇪 Deutsch</option>
                                      <option value="it-IT">🇮🇹 Italiano</option>
                                    </select>
                                  </div>

                                  {/* Voz */}
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Voz (Opcional)
                                    </label>
                                    <select
                                      value={editingStep.audioVoice || ''}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          audioVoice: e.target.value,
                                        })
                                      }
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    >
                                      <option value="">🔇 Voz Padrão (automática - feminina natural)</option>
                                      <optgroup label="👩 Vozes Femininas">
                                        <option value="nova">✨ Nova - Feminina Natural (Recomendada)</option>
                                        <option value="shimmer">🌟 Shimmer - Feminina Jovem e Energética</option>
                                        <option value="alloy">💎 Alloy - Feminina Neutra e Profissional</option>
                                      </optgroup>
                                      <optgroup label="👨 Vozes Masculinas">
                                        <option value="onyx">🎙️ Onyx - Masculina Profunda e Autoritativa</option>
                                        <option value="echo">🔊 Echo - Masculina Jovem e Vibrante</option>
                                        <option value="fable">📖 Fable - Masculina Narrativa e Expressiva</option>
                                      </optgroup>
                                    </select>
                                  </div>
                                </div>

                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0 }}>
                                    💡 <strong style={{ color: '#10b981' }}>Dica:</strong> Quando o cliente enviar uma mensagem de áudio, o agente responderá automaticamente também em áudio usando essas configurações.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Condição (Opcional) */}
                            {editingStep.type !== 'agent_profile' && editingStep.type !== 'audio_config' && (
                              <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                  Condição (Opcional)
                                </label>
                                <input
                                  type="text"
                                  value={editingStep.condition || ''}
                                  onChange={(e) =>
                                    setEditingStep({
                                      ...editingStep,
                                      condition: e.target.value,
                                    })
                                  }
                                  placeholder="Ex: Se o cliente perguntar sobre produtos..."
                                  style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    backgroundColor: '#0f1419',
                                    color: '#ffffff',
                                    outline: 'none'
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = '#10b981';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                />
                              </div>
                            )}

                            {/* Configurações de Catálogo (só para show_catalog) */}
                            {editingStep.type === 'show_catalog' && (
                              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                                  🛍️ Contexto de Catálogo
                                </h4>
                                
                                {/* Incluir Produtos */}
                                <div style={{ marginBottom: '16px' }}>
                                  <label style={{ display: 'flex', alignItems: 'start', gap: '12px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editingStep.catalogSettings?.includeProducts || false}
                                    onChange={(e) => {
                                        setEditingStep({
                                          ...editingStep,
                                          catalogSettings: {
                                            ...editingStep.catalogSettings,
                                            includeProducts: e.target.checked,
                                            selectedProducts: e.target.checked 
                                              ? catalogItems.filter(i => i && i.type === 'product').map(i => i.id)
                                              : [],
                                            selectedProductCategories: e.target.checked
                                              ? (editingStep.catalogSettings?.selectedProductCategories || [])
                                              : []
                                          }
                                        });
                                      }}
                                      className="mt-1"
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.9375rem' }}>
                                        📦 Incluir Produtos do Catálogo
                                      </div>
                                      <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                                        A IA poderá oferecê-los aos clientes
                                      </div>
                                      {catalogItems.filter(i => i && i.type === 'product').length > 0 && (
                                        <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                                          ✓ {catalogItems.filter(i => i && i.type === 'product').length} produto(s) disponível(is)
                                        </div>
                                      )}
                                    </div>
                                  </label>

                                  {/* Lista de Produtos com Checkboxes Individuais */}
                                  {editingStep.catalogSettings?.includeProducts && (
                                    <div style={{ marginTop: '12px', marginLeft: '24px' }}>
                                      {productCategories.length > 0 && (
                                        <div style={{ marginBottom: '12px' }}>
                                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', marginBottom: '6px' }}>
                                            Categorias de produtos (opcional)
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {productCategories.map((category) => {
                                              const selectedCategories = editingStep.catalogSettings?.selectedProductCategories || [];
                                              const isSelected = selectedCategories.includes(category);
                                              return (
                                                <button
                                                  key={category}
                                                  type="button"
                                                  onClick={() => {
                                                    const next = isSelected
                                                      ? selectedCategories.filter((item) => item !== category)
                                                      : [...selectedCategories, category];
                                                    setEditingStep({
                                                      ...editingStep,
                                                      catalogSettings: {
                                                        ...editingStep.catalogSettings,
                                                        selectedProductCategories: next
                                                      }
                                                    });
                                                  }}
                                                  style={{
                                                    border: '1px solid',
                                                    borderColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                                                    background: isSelected ? 'rgba(16, 185, 129, 0.2)' : '#0f1419',
                                                    borderRadius: '999px',
                                                    padding: '6px 12px',
                                                    color: isSelected ? '#10b981' : '#9ca3af',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  {category}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                                      {catalogItems.filter(i => i && i.type === 'product').map(product => (
                                        <label key={product.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#0f1419', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1f36'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f1419'}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={editingStep.catalogSettings?.selectedProducts?.includes(product.id) || false}
                                            onChange={(e) => {
                                              const selected = editingStep.catalogSettings?.selectedProducts || [];
                                              setEditingStep({
                                                ...editingStep,
                                                catalogSettings: {
                                                  ...editingStep.catalogSettings,
                                                  selectedProducts: e.target.checked
                                                    ? [...selected, product.id]
                                                    : selected.filter(id => id !== product.id)
                                                }
                                              });
                                            }}
                                          />
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '500', fontSize: '0.875rem', color: '#ffffff' }}>{product.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>R$ {product.price}</div>
                                          </div>
                                        </label>
                                      ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Incluir Serviços */}
                                <div>
                                  <label style={{ display: 'flex', alignItems: 'start', gap: '12px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editingStep.catalogSettings?.includeServices || false}
                                      onChange={(e) => {
                                        setEditingStep({
                                          ...editingStep,
                                          catalogSettings: {
                                            ...editingStep.catalogSettings,
                                            includeServices: e.target.checked,
                                            selectedServices: e.target.checked 
                                              ? catalogItems.filter(i => i && i.type === 'service').map(i => i.id)
                                              : [],
                                            selectedServiceCategories: e.target.checked
                                              ? (editingStep.catalogSettings?.selectedServiceCategories || [])
                                              : []
                                          }
                                        });
                                      }}
                                      style={{ marginTop: '4px' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.9375rem' }}>
                                        🛠️ Incluir Serviços do Catálogo
                                      </div>
                                      <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                                        A IA poderá oferecê-los aos clientes
                                      </div>
                                      {catalogItems.filter(i => i && i.type === 'service').length > 0 && (
                                        <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                                          ✓ {catalogItems.filter(i => i && i.type === 'service').length} serviço(s) disponível(is)
                                        </div>
                                      )}
                                    </div>
                                  </label>

                                  {/* Lista de Serviços com Checkboxes Individuais */}
                                  {editingStep.catalogSettings?.includeServices && (
                                    <div style={{ marginTop: '12px', marginLeft: '24px' }}>
                                      {serviceCategories.length > 0 && (
                                        <div style={{ marginBottom: '12px' }}>
                                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', marginBottom: '6px' }}>
                                            Categorias de serviços (opcional)
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {serviceCategories.map((category) => {
                                              const selectedCategories = editingStep.catalogSettings?.selectedServiceCategories || [];
                                              const isSelected = selectedCategories.includes(category);
                                              return (
                                                <button
                                                  key={category}
                                                  type="button"
                                                  onClick={() => {
                                                    const next = isSelected
                                                      ? selectedCategories.filter((item) => item !== category)
                                                      : [...selectedCategories, category];
                                                    setEditingStep({
                                                      ...editingStep,
                                                      catalogSettings: {
                                                        ...editingStep.catalogSettings,
                                                        selectedServiceCategories: next
                                                      }
                                                    });
                                                  }}
                                                  style={{
                                                    border: '1px solid',
                                                    borderColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                                                    background: isSelected ? 'rgba(16, 185, 129, 0.2)' : '#0f1419',
                                                    borderRadius: '999px',
                                                    padding: '6px 12px',
                                                    color: isSelected ? '#10b981' : '#9ca3af',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  {category}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                                      {catalogItems.filter(i => i && i.type === 'service').map(service => (
                                        <label key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#0f1419', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1f36'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f1419'}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={editingStep.catalogSettings?.selectedServices?.includes(service.id) || false}
                                            onChange={(e) => {
                                              const selected = editingStep.catalogSettings?.selectedServices || [];
                                              setEditingStep({
                                                ...editingStep,
                                                catalogSettings: {
                                                  ...editingStep.catalogSettings,
                                                  selectedServices: e.target.checked
                                                    ? [...selected, service.id]
                                                    : selected.filter(id => id !== service.id)
                                                }
                                              });
                                            }}
                                          />
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '500', fontSize: '0.875rem', color: '#ffffff' }}>{service.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>R$ {service.price}</div>
                                          </div>
                                        </label>
                                      ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Configurações de Pagamento (só para process_order) */}
                            {editingStep.type === 'process_order' && (
                              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                                  💳 Integração de Pagamento
                                </h4>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                    Provedor de Pagamento
                                  </label>
                                  <select
                                    value={editingStep.paymentSettings?.provider || 'asaas'}
                                    onChange={(e) =>
                                      setEditingStep({
                                        ...editingStep,
                                        paymentSettings: {
                                          ...editingStep.paymentSettings,
                                          provider: e.target.value
                                        }
                                      })
                                    }
                                    style={{
                                      width: '100%',
                                      padding: '10px 16px',
                                      border: '1px solid rgba(255, 255, 255, 0.1)',
                                      borderRadius: '8px',
                                      backgroundColor: '#0f1419',
                                      color: '#ffffff',
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="asaas">Asaas (automático)</option>
                                    <option value="manual">Manual (sem API)</option>
                                    <option value="stripe">Stripe (futuro)</option>
                                    <option value="custom">Outro (futuro)</option>
                                  </select>
                                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px', marginBottom: 0 }}>
                                    O backend só gera link automático quando o provedor é Asaas.
                                  </p>
                                </div>
                                {editingStep.paymentSettings?.provider === 'manual' && (
                                  <div style={{ marginTop: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Mensagem de Pagamento Manual
                                    </label>
                                    <textarea
                                      value={editingStep.paymentSettings?.manualMessage || ''}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          paymentSettings: {
                                            ...editingStep.paymentSettings,
                                            manualMessage: e.target.value
                                          }
                                        })
                                      }
                                      rows={3}
                                      placeholder="Ex: Vou enviar o link de pagamento manualmente em instantes."
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                    />
                                  </div>
                                )}
                                {editingStep.paymentSettings?.provider === 'stripe' && (
                                  <div style={{ marginTop: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                                      Mensagem do Stripe
                                    </label>
                                    <textarea
                                      value={editingStep.paymentSettings?.stripeMessage || ''}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          paymentSettings: {
                                            ...editingStep.paymentSettings,
                                            stripeMessage: e.target.value
                                          }
                                        })
                                      }
                                      rows={3}
                                      placeholder="Ex: Integração Stripe selecionada. Aguarde o link."
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        backgroundColor: '#0f1419',
                                        color: '#ffffff',
                                        outline: 'none'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Configurações de Coleta de Dados para CRM (só para collect_data) */}
                            {editingStep.type === 'collect_data' && (
                              <div className="border-t pt-4 mt-4 space-y-4">
                                {/* Opção de Salvamento Automático no CRM */}
                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '16px' }}>
                                  <label style={{ display: 'flex', alignItems: 'start', gap: '12px', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={editingStep.crmAutoSave || false}
                                      onChange={(e) => setEditingStep({ 
                                        ...editingStep, 
                                        crmAutoSave: e.target.checked,
                                        crmFields: e.target.checked ? (editingStep.crmFields || ['name', 'phone']) : []
                                      })}
                                      style={{ marginTop: '4px' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.9375rem', marginBottom: '4px' }}>
                                        💾 Salvar Automaticamente no CRM
                                      </div>
                                      <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                                        Todos os clientes que entrarem em contato serão salvos automaticamente no CRM com os dados selecionados abaixo.
                                      </div>
                                    </div>
                                  </label>

                                  {editingStep.crmAutoSave && (
                                    <div style={{ marginTop: '16px' }}>
                                      <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', color: '#ffffff', marginBottom: '12px' }}>
                                        Dados a serem salvos no CRM: *
                                      </label>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                        {[
                                          { value: 'name', label: '👤 Nome', required: true },
                                          { value: 'phone', label: '📱 Telefone', required: true },
                                          { value: 'product', label: '📦 Produto ou Serviço', required: false },
                                          { value: 'email', label: '📧 Email', required: false }
                                        ].map((field) => (
                                          <label
                                            key={field.value}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              padding: '10px',
                                              backgroundColor: '#0f1419',
                                              border: field.required 
                                                ? '2px solid rgba(16, 185, 129, 0.5)' 
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                              borderRadius: '8px',
                                              cursor: field.required ? 'default' : 'pointer',
                                              transition: 'all 0.2s',
                                              opacity: field.required ? 0.7 : 1
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!field.required) {
                                                e.currentTarget.style.backgroundColor = '#1a1f36';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!field.required) {
                                                e.currentTarget.style.backgroundColor = '#0f1419';
                                              }
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={editingStep.crmFields?.includes(field.value) || field.required}
                                              disabled={field.required}
                                              onChange={(e) => {
                                                if (field.required) return;
                                                const currentFields = editingStep.crmFields || [];
                                                const newFields = e.target.checked
                                                  ? [...currentFields, field.value]
                                                  : currentFields.filter(f => f !== field.value);
                                                setEditingStep({ ...editingStep, crmFields: newFields });
                                              }}
                                            />
                                            <span style={{ fontSize: '0.875rem', color: '#ffffff' }}>
                                              {field.label}
                                              {field.required && <span style={{ color: '#10b981', marginLeft: '4px' }}>*</span>}
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#10b981' }}>
                                          💡 <strong>Como funciona:</strong> Quando um cliente entrar em contato via WhatsApp, o agente coletará automaticamente os dados selecionados acima e salvará no CRM. Nome e Telefone são sempre salvos (obrigatórios).
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Editor de Perguntas Customizadas */}
                                <div style={{ marginTop: '16px' }}>
                                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                                    📋 Perguntas Personalizadas (Opcional)
                                  </div>
                                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '12px' }}>
                                    Adicione perguntas adicionais para coletar dados extras além dos campos do CRM.
                                  </p>
                                  <CustomQuestionsEditor
                                    questions={editingStep.customQuestions || []}
                                    onChange={(questions) => setEditingStep({ ...editingStep, customQuestions: questions })}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Configurações de Agendamento (só para create_appointment) */}
                            {editingStep.type === 'create_appointment' && (
                              <div className="border-t pt-4 mt-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff' }}>
                                    📅 Configurações de Agendamento
                                  </h4>
                                </div>

                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '16px' }}>
                                  <label style={{ display: 'flex', alignItems: 'start', gap: '12px', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={editingStep.appointmentEnabled || false}
                                      onChange={(e) => setEditingStep({ 
                                        ...editingStep, 
                                        appointmentEnabled: e.target.checked,
                                        appointmentTypes: e.target.checked ? (editingStep.appointmentTypes || []) : []
                                      })}
                                      style={{ marginTop: '4px' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.9375rem' }}>
                                        📅 Habilitar Sistema de Agendamentos
                                      </div>
                                      <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                                        O agente poderá criar agendamentos durante a conversa
                                      </div>
                                    </div>
                                  </label>

                                  {editingStep.appointmentEnabled && (
                                    <div style={{ marginTop: '16px' }}>
                                      <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', color: '#ffffff', marginBottom: '12px' }}>
                                        Tipos de Agendamento Permitidos:
                                      </label>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                        {[
                                          { value: 'retirada', label: '📦 Retirada' },
                                          { value: 'servico', label: '🔧 Serviço' },
                                          { value: 'visita', label: '🏢 Visita' },
                                          { value: 'entrega', label: '🚚 Entrega' },
                                          { value: 'ligacao', label: '📞 Ligação' },
                                          { value: 'consulta', label: '🩺 Consulta' },
                                          { value: 'reuniao', label: '👥 Reunião' }
                                        ].map((type) => (
                                          <label
                                            key={type.value}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              padding: '8px',
                                              backgroundColor: '#0f1419',
                                              border: '1px solid rgba(255, 255, 255, 0.1)',
                                              borderRadius: '8px',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1f36'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f1419'}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={editingStep.appointmentTypes?.includes(type.value) || false}
                                              onChange={(e) => {
                                                const currentTypes = editingStep.appointmentTypes || [];
                                                const newTypes = e.target.checked
                                                  ? [...currentTypes, type.value]
                                                  : currentTypes.filter(t => t !== type.value);
                                                setEditingStep({ ...editingStep, appointmentTypes: newTypes });
                                              }}
                                            />
                                            <span style={{ fontSize: '0.875rem', color: '#ffffff' }}>{type.label}</span>
                                          </label>
                                        ))}
                                      </div>
                                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                                          💡 <strong>Dica:</strong> Agendamentos criados durante a conversa aparecerão automaticamente na seção Agendamentos.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Botões */}
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '10px 16px',
                                  color: '#ffffff',
                                  backgroundColor: '#0f1419',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1f36'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f1419'}
                              >
                                <X size={16} />
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={saveEdit}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '10px 16px',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                              >
                                <Save size={16} />
                                Salvar
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="p-6">
                          <div className="flex items-start gap-4">
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-move mt-1"
                            >
                              <GripVertical className="text-gray-400" size={20} />
                            </div>

                            {/* Step Content */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">
                                  {
                                    actionTypes.find((t) => t.value === step.type)
                                      ?.icon
                                  }
                                </span>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#ffffff' }}>
                                  Passo {originalIndex + 1}: {step.title}
                                </h3>
                                {(!step.title || !step.description) && (
                                  <span style={{ fontSize: '0.75rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                    ⚠️ Incompleto
                                  </span>
                                )}
                              </div>

                              {step.description && (
                                <p style={{ color: '#9ca3af', marginBottom: '8px' }}>
                                  {step.description}
                                </p>
                              )}

                              {step.condition && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex' }}>
                                  ⚠️ Condição: {step.condition}
                                </div>
                              )}

                              {/* Mostrar configurações de catálogo se houver */}
                              {step.type === 'show_catalog' && step.catalogSettings && (
                                <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>
                                  {step.catalogSettings.includeProducts && (
                                    <div style={{ marginBottom: '8px' }}>
                                      <span style={{ fontWeight: '600', color: '#10b981' }}>
                                        📦 Produtos: 
                                      </span>
                                      <span style={{ color: '#9ca3af', marginLeft: '8px' }}>
                                        {step.catalogSettings.selectedProducts?.length || 0} selecionado(s)
                                      </span>
                                    </div>
                                  )}
                                  {step.catalogSettings.includeServices && (
                                    <div>
                                      <span style={{ fontWeight: '600', color: '#10b981' }}>
                                        🛠️ Serviços: 
                                      </span>
                                      <span style={{ color: '#9ca3af', marginLeft: '8px' }}>
                                        {step.catalogSettings.selectedServices?.length || 0} selecionado(s)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Mostrar configurações de CRM se houver */}
                              {step.type === 'collect_data' && step.crmAutoSave && (
                                <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>
                                  <div style={{ fontWeight: '600', color: '#10b981', marginBottom: '8px' }}>
                                    💾 Salvamento Automático no CRM Habilitado
                                  </div>
                                  <div style={{ color: '#9ca3af', marginBottom: '8px' }}>
                                    Dados a serem salvos:
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {step.crmFields?.map((field) => {
                                      const fieldLabels = {
                                        'name': '👤 Nome',
                                        'phone': '📱 Telefone',
                                        'product': '📦 Produto/Serviço',
                                        'email': '📧 Email'
                                      };
                                      return (
                                        <span
                                          key={field}
                                          style={{
                                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                            color: '#10b981',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            border: '1px solid rgba(16, 185, 129, 0.3)'
                                          }}
                                        >
                                          {fieldLabels[field] || field}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Mostrar perguntas customizadas se houver */}
                              {step.type === 'collect_data' && step.customQuestions && step.customQuestions.length > 0 && (
                                <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>
                                  <div style={{ fontWeight: '600', color: '#10b981', marginBottom: '8px' }}>
                                    📋 {step.customQuestions.length} Pergunta(s) Personalizada(s):
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {step.customQuestions.map((q, idx) => (
                                      <div key={q.id} style={{ color: '#9ca3af', paddingLeft: '16px', borderLeft: '2px solid rgba(16, 185, 129, 0.3)' }}>
                                        {idx + 1}. {q.question || 'Pergunta sem texto'} 
                                        <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '8px' }}>
                                          ({q.field || 'sem campo'})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Mostrar configurações de agendamento se houver */}
                              {step.type === 'create_appointment' && step.appointmentEnabled && (
                                <div style={{ marginTop: '12px', fontSize: '0.875rem' }}>
                                  <div style={{ fontWeight: '600', color: '#10b981', marginBottom: '8px' }}>
                                    📅 Sistema de Agendamentos Habilitado
                                  </div>
                                  {step.appointmentTypes && step.appointmentTypes.length > 0 && (
                                    <div style={{ color: '#9ca3af' }}>
                                      Tipos permitidos: {step.appointmentTypes.map(t => {
                                        const labels = {
                                          'retirada': '📦 Retirada',
                                          'servico': '🔧 Serviço',
                                          'visita': '🏢 Visita',
                                          'entrega': '🚚 Entrega',
                                          'ligacao': '📞 Ligação',
                                          'consulta': '🩺 Consulta',
                                          'reuniao': '👥 Reunião'
                                        };
                                        return labels[t] || t;
                                      }).join(', ')}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => moveStepUp(originalIndex)}
                                disabled={originalIndex === 0}
                                style={{
                                  padding: '8px',
                                  color: originalIndex === 0 ? '#6b7280' : '#10b981',
                                  backgroundColor: 'transparent',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: originalIndex === 0 ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: originalIndex === 0 ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                  if (originalIndex !== 0) {
                                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Mover para cima"
                              >
                                <ChevronUp size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveStepDown(originalIndex)}
                                disabled={originalIndex === steps.length - 1}
                                style={{
                                  padding: '8px',
                                  color: originalIndex === steps.length - 1 ? '#6b7280' : '#10b981',
                                  backgroundColor: 'transparent',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: originalIndex === steps.length - 1 ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: originalIndex === steps.length - 1 ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                  if (originalIndex !== steps.length - 1) {
                                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Mover para baixo"
                              >
                                <ChevronDown size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(originalIndex)}
                                style={{
                                  padding: '8px',
                                  color: '#10b981',
                                  backgroundColor: 'transparent',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                title="Editar"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeStep(originalIndex)}
                                style={{
                                  padding: '8px',
                                  color: '#ef4444',
                                  backgroundColor: 'transparent',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                title="Remover"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      {/* Navegação de Páginas */}
      {steps.length > stepsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#1a1f36',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <button
            type="button"
            onClick={handlePreviousPage}
            disabled={currentPage === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: currentPage === 0 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
              border: currentPage === 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
              color: 'white',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: currentPage === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (currentPage > 0) {
                e.currentTarget.style.backgroundColor = '#0f1419';
                e.currentTarget.style.borderColor = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage > 0) {
                e.currentTarget.style.backgroundColor = '#1a1f36';
                e.currentTarget.style.borderColor = '#10b981';
              }
            }}
          >
            <ChevronLeft size={20} />
            Anterior
          </button>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#ffffff',
            fontSize: '0.875rem'
          }}>
            <span>Página</span>
            <span style={{
              fontWeight: '600',
              color: '#10b981'
            }}>{currentPage + 1}</span>
            <span>de</span>
            <span style={{
              fontWeight: '600',
              color: '#10b981'
            }}>{totalPages}</span>
            <span style={{ color: '#9ca3af' }}>({steps.length} passos)</span>
          </div>
          
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: currentPage >= totalPages - 1 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #10b981',
              backgroundColor: currentPage >= totalPages - 1 ? 'rgba(16, 185, 129, 0.2)' : '#1a1f36',
              color: 'white',
              cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: currentPage >= totalPages - 1 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (currentPage < totalPages - 1) {
                e.currentTarget.style.backgroundColor = '#0f1419';
                e.currentTarget.style.borderColor = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage < totalPages - 1) {
                e.currentTarget.style.backgroundColor = '#1a1f36';
                e.currentTarget.style.borderColor = '#10b981';
              }
            }}
          >
            Próxima
            <ChevronRight size={20} />
          </button>
        </div>
      )}
        </>
      )}

      {/* Empty State */}
      {steps.length === 0 && (
        <div style={{ backgroundColor: '#1a1f36', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '48px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '4rem' }}>🤖</div>
            <WhatsAppIcon size={64} color="#25D366" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
            Nenhum passo configurado
          </h3>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
            Adicione passos para definir o fluxo de conversa do seu agente
          </p>
        </div>
      )}

      {/* Template Modal */}
      <TemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={applyTemplate}
      />

      {/* AI Generator Modal */}
      <AIGeneratorModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onGenerate={applyAITemplate}
        catalogItems={catalogItems}
        agendamentos={agendamentos}
      />

      {/* Modal de Conversa Demonstração */}
      {showDemoConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div style={{ backgroundColor: '#1a1f36', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', padding: '24px', width: '100%', maxWidth: '48rem', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                💬 Conversa Demonstração
              </h3>
              <button
                onClick={() => setShowDemoConversation(false)}
                style={{ color: '#9ca3af', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {generatingDemo ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Gerando conversa demonstração...</p>
                  </div>
                </div>
              ) : demoConversation ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Conversa Completa:</strong> Simulação baseada no seu fluxo configurado
                    </p>
                  </div>

                  {/* Conversa gerada */}
                  <div className="space-y-3">
                    <div className="flex flex-col space-y-2">
                      {demoConversation.map((msg, idx) => (
                        <div
                          key={idx}
                          className={msg.sender === 'user' 
                            ? 'self-end bg-green-500 text-white rounded-lg p-3 max-w-[80%]'
                            : 'self-start bg-gray-200 text-gray-800 rounded-lg p-3 max-w-[80%]'}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                    <p className="text-sm text-green-800">
                      ✅ <strong>Gerado com sucesso!</strong>
                    </p>
                    <button
                      onClick={handleGenerateDemo}
                      className="text-sm text-green-700 hover:text-green-900 underline"
                    >
                      🔄 Gerar Novamente
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs text-amber-800">
                    ⚠️ Erro ao gerar conversa demonstração
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualizar/Editar Prompt Final */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div style={{ backgroundColor: '#1a1f36', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)', padding: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📝 Prompt Final Gerado
              </h3>
              <button
                onClick={() => setShowPromptModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
              >
                <X size={24} color="#9ca3af" />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', marginBottom: '20px' }}>
              <textarea
                value={editablePrompt}
                onChange={(e) => {
                  setEditablePrompt(e.target.value);
                  // Marcar que o prompt está sendo editado
                  if (e.target.value.trim().length > 0) {
                    setPromptWasEdited(true);
                  }
                }}
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: '#0f1419',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  lineHeight: '1.6',
                  outline: 'none',
                  resize: 'vertical'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#10b981';
                  e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="O prompt será gerado automaticamente..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                onClick={() => setShowPromptModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: '#0f1419',
                  color: '#ffffff',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#1a1f36'}
                onMouseLeave={(e) => e.target.style.background = '#0f1419'}
              >
                Fechar
              </button>
              <button
                onClick={handleSavePrompt}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#1a1f36',
                  border: '1px solid #10b981',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#0f1419';
                  e.target.style.borderColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#1a1f36';
                  e.target.style.borderColor = '#10b981';
                }}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Melhorar Prompt */}
      {showPromptImprover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                ✨ Melhorar Prompt com IA
              </h3>
              <button
                onClick={() => {
                  setShowPromptImprover(false);
                  setPromptImprovements('');
                  setSelectedStepsForImprovement([]);
                  setImprovementTexts({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Prompt atual (somente leitura) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt Atual (gerado dos seus steps):
                </label>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 max-h-[150px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-xs text-gray-700">
                    {generatePrompt()}
                  </pre>
                </div>
              </div>

              {/* Seleção de Steps para melhorar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Selecione os passos que deseja melhorar: *
                </label>
                <div className="max-h-[200px] overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                  {steps.map((step, idx) => {
                    const isSelected = selectedStepsForImprovement.includes(step.id);
                    const actionType = actionTypes.find(t => t.value === step.type);
                    return (
                      <div key={step.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStepSelection(step.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{actionType?.icon || '📌'}</span>
                              <span className="font-semibold text-sm text-gray-800">
                                Passo {idx + 1}: {step.title}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {step.description || '(Sem descrição)'}
                            </p>
                          </div>
                        </label>
                        
                        {/* Campo de texto para melhorias específicas desse step */}
                        {isSelected && (
                          <div className="px-3 pb-3 bg-gray-50 border-t border-gray-200">
                            <textarea
                              value={improvementTexts[step.id] || ''}
                              onChange={(e) => updateImprovementText(step.id, e.target.value)}
                              placeholder={`O que melhorar neste passo? (ex: "Use emojis", "Seja mais formal", "Adicione confirmação")`}
                              rows={2}
                              className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ou melhorias gerais */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ou melhorias gerais (opcional):
                </label>
                <textarea
                  value={promptImprovements}
                  onChange={(e) => setPromptImprovements(e.target.value)}
                  placeholder="Ex: Quero que o agente seja mais formal, use emojis moderadamente..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Botão melhorar */}
              <button
                onClick={handleImprovePrompt}
                disabled={improvingPrompt || (selectedStepsForImprovement.length === 0 && !promptImprovements.trim())}
                className="w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {improvingPrompt ? '⏳ Melhorando...' : '✨ Melhorar Prompt com IA'}
              </button>

              {/* Dicas */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 mb-2">
                  💡 <strong>Dicas para melhorias:</strong>
                </p>
                <ul className="text-xs text-blue-700 space-y-1 ml-4">
                  <li>• Especifique o tom de voz (formal, informal, amigável)</li>
                  <li>• Defina quando usar emojis</li>
                  <li>• Adicione etapas de confirmação</li>
                  <li>• Especifique como lidar com objeções</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Editor de Perguntas Customizadas para Coleta de Dados
 */
function CustomQuestionsEditor({ questions, onChange }) {
  const addQuestion = () => {
    const newQuestions = [...(questions || []), {
      id: Date.now(),
      field: '', // nome do campo no CRM (ex: 'idade', 'ocupacao', 'empresa')
      question: '', // texto da pergunta
      type: 'text', // text, number, email, phone, date
      required: false
    }];
    onChange(newQuestions);
  };

  const removeQuestion = (id) => {
    const newQuestions = (questions || []).filter(q => q.id !== id);
    onChange(newQuestions);
  };

  const updateQuestion = (id, field, value) => {
    const newQuestions = (questions || []).map(q => 
      q.id === id ? { ...q, [field]: value } : q
    );
    onChange(newQuestions);
  };

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-800">
          📋 Perguntas Personalizadas
        </h4>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Adicionar Pergunta
        </button>
      </div>

      {(questions && questions.length > 0) ? (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  Pergunta {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Campo ID (nome no banco) */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Nome do Campo (sem espaços)*
                  </label>
                  <input
                    type="text"
                    value={q.field}
                    onChange={(e) => updateQuestion(q.id, 'field', e.target.value.replace(/\s/g, '_').toLowerCase())}
                    placeholder="Ex: idade, ocupacao, empresa"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Este será o nome do campo salvo no CRM
                  </p>
                </div>

                {/* Texto da Pergunta */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Texto da Pergunta*
                  </label>
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                    placeholder="Ex: Qual a sua idade?"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Tipo de Resposta */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tipo de Resposta
                  </label>
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="text">📝 Texto Livre</option>
                    <option value="number">🔢 Número</option>
                    <option value="email">📧 Email</option>
                    <option value="phone">📱 Telefone</option>
                    <option value="date">📅 Data</option>
                  </select>
                </div>

                {/* Obrigatório */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(q.id, 'required', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-gray-600">Obrigatório</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500 mb-3">
            Nenhuma pergunta configurada
          </p>
          <button
            type="button"
            onClick={addQuestion}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clique para adicionar a primeira pergunta
          </button>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          💡 <strong>Dica:</strong> As respostas serão salvas automaticamente no CRM do cliente quando o agente fizer essas perguntas.
        </p>
      </div>
    </div>
  );
}

