import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, Edit2, Save, X, FileText, Sparkles } from 'lucide-react';
import TemplateModal from './TemplateModal';
import AIGeneratorModal from './AIGeneratorModal';

/**
 * FlowBuilder - Interface visual para criar fluxo do agente em steps
 * 
 * Permite:
 * - Adicionar, editar, remover steps
 * - Reordenar via drag & drop
 * - Gerar prompt automaticamente
 */
export default function FlowBuilder({ initialSteps = [], catalogItems = [], onChange }) {
  const [steps, setSteps] = useState(initialSteps);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingStep, setEditingStep] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // Tipos de ação disponíveis
  const actionTypes = [
    { value: 'agent_profile', label: '🤖 Perfil do Agente', icon: '🤖' },
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
      description: '',
      condition: null, // Condição para executar (opcional)
      actions: [],
      catalogSettings: {
        includeProducts: false,
        includeServices: false,
        selectedProducts: [],
        selectedServices: []
      }
    };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    setEditingIndex(newSteps.length - 1);
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
        selectedServices: []
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
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSteps(items);
    if (onChange) onChange(items);
  };

  // Aplicar template selecionado
  const applyTemplate = (template) => {
    // Gerar IDs únicos para os steps do template
    const newSteps = template.steps.map(step => ({
      ...step,
      id: Date.now() + Math.random(), // Garantir IDs únicos
      catalogSettings: step.catalogSettings || {
        includeProducts: false,
        includeServices: false,
        selectedProducts: [],
        selectedServices: []
      }
    }));
    
    setSteps(newSteps);
    if (onChange) onChange(newSteps);
  };

  // Aplicar template gerado pela IA
  const applyAITemplate = (template) => {
    // Template vem do backend já formatado
    applyTemplate(template);
  };

  // Gerar prompt a partir dos steps
  const generatePrompt = () => {
    let prompt = '';
    
    steps.forEach((step, index) => {
      const actionType = actionTypes.find(t => t.value === step.type);
      prompt += `\n## Passo ${index + 1}: ${step.title}\n`;
      prompt += `${actionType?.icon} ${actionType?.label}\n`;
      if (step.description) {
        prompt += `${step.description}\n`;
      }
      if (step.condition) {
        prompt += `⚠️ Condição: ${step.condition}\n`;
      }
      
      // Se for coleta de dados customizados, adicionar as perguntas
      if (step.type === 'collect_data' && step.customQuestions && step.customQuestions.length > 0) {
        prompt += `\n📋 PERGUNTAS PERSONALIZADAS PARA COLETAR:\n`;
        step.customQuestions.forEach((q, idx) => {
          prompt += `${idx + 1}. ${q.question}`;
          if (q.type !== 'text') {
            prompt += ` (Tipo: ${q.type})`;
          }
          if (q.required) {
            prompt += ` [OBRIGATÓRIO]`;
          }
          prompt += `\n`;
        });
      }
      
      // Se for criação de agendamento, adicionar as configurações
      if (step.type === 'create_appointment' && step.appointmentEnabled) {
        prompt += `\n📅 SISTEMA DE AGENDAMENTOS HABILITADO:\n`;
        if (step.appointmentTypes && step.appointmentTypes.length > 0) {
          prompt += `Tipos permitidos: ${step.appointmentTypes.join(', ')}\n`;
        }
        prompt += `O agente poderá criar agendamentos durante a conversa que aparecerão na seção Agendamentos.\n`;
      }
      
      prompt += '\n';
    });

    return prompt;
  };

  // Estatísticas do fluxo
  const completedSteps = steps.filter(s => s.title && s.description).length;
  const hasAgentProfile = steps.some(s => s.type === 'agent_profile');
  const hasGreeting = steps.some(s => s.type === 'greeting');
  
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
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              🎯 Fluxo do Agente
            </h2>
            <p className="text-gray-600 mt-1">
              Configure o fluxo de conversa do seu agente em passos
            </p>
            {steps.length > 0 && (
              <div className="flex gap-4 mt-2">
                <span className="text-sm text-gray-600">
                  ✅ {completedSteps}/{steps.length} passos configurados
                </span>
                {!hasAgentProfile && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    ⚠️ Adicione um perfil do agente
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              className="flex items-center gap-2 text-white px-4 py-2 rounded-lg transition"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }}
            >
              <Sparkles size={20} />
              Criar com IA
            </button>
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              <FileText size={20} />
              Usar Template
            </button>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Adicionar Passo
            </button>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="steps">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {steps.map((step, index) => (
                <Draggable
                  key={step.id}
                  draggableId={String(step.id)}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`bg-white rounded-lg shadow-sm border-2 transition ${
                        snapshot.isDragging
                          ? 'border-blue-500 shadow-lg'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Step Card */}
                      {editingIndex === index ? (
                        // Edit Mode
                        <div className="p-6">
                          <div className="space-y-4">
                            {/* Tipo de Ação */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tipo de Ação
                              </label>
                              <select
                                value={editingStep.type}
                                onChange={(e) =>
                                  setEditingStep({
                                    ...editingStep,
                                    type: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            {/* Descrição/Instruções */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {editingStep.type === 'free_text' 
                                  ? 'Prompt Livre (Escreva o texto completo)'
                                  : 'Instruções Detalhadas'}
                              </label>
                              <textarea
                                value={editingStep.description}
                                onChange={(e) =>
                                  setEditingStep({
                                    ...editingStep,
                                    description: e.target.value,
                                  })
                                }
                                placeholder={editingStep.type === 'free_text'
                                  ? "Ex: Você é um assistente prestativo. Quando o cliente perguntar sobre...\n\nEscreva aqui o prompt completo que deseja usar neste ponto do fluxo."
                                  : "Ex: Cumprimente o cliente de forma amigável e pergunte como pode ajudar..."}
                                rows={editingStep.type === 'free_text' ? 8 : 4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <p className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded mt-2">
                                {getTipsForStepType(editingStep.type)}
                              </p>
                            </div>

                            {/* Campos específicos para Perfil do Agente */}
                            {editingStep.type === 'agent_profile' && (
                              <div className="border-t pt-4 space-y-4">
                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                  <p className="text-sm text-amber-800 font-medium">
                                    🤖 Configure a personalidade e apresentação do agente
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  {/* Nome do Agente */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                  </div>

                                  {/* Cargo/Função */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                  </div>

                                  {/* Tom de Voz */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Personalidade (use o campo "Instruções" acima)
                                  </label>
                                  <p className="text-sm text-gray-500">
                                    No campo "Instruções Detalhadas" acima, descreva características como: sempre usa emojis, evita termos técnicos, é paciente, etc.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Condição (Opcional) */}
                            {editingStep.type !== 'agent_profile' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            )}

                            {/* Configurações de Catálogo (só para show_catalog) */}
                            {editingStep.type === 'show_catalog' && (
                              <div className="border-t pt-4">
                                <h4 className="font-semibold text-gray-800 mb-3">
                                  🛍️ Contexto de Catálogo
                                </h4>
                                
                                {/* Incluir Produtos */}
                                <div className="mb-4">
                                  <label className="flex items-start gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition">
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
                                              : []
                                          }
                                        });
                                      }}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="font-bold text-gray-900">
                                        📦 Incluir Produtos do Catálogo
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        A IA poderá oferecê-los aos clientes
                                      </div>
                                      {catalogItems.filter(i => i && i.type === 'product').length > 0 && (
                                        <div className="text-xs text-green-700 mt-1">
                                          ✓ {catalogItems.filter(i => i && i.type === 'product').length} produto(s) disponível(is)
                                        </div>
                                      )}
                                    </div>
                                  </label>

                                  {/* Lista de Produtos com Checkboxes Individuais */}
                                  {editingStep.catalogSettings?.includeProducts && (
                                    <div className="mt-3 ml-6 space-y-2 max-h-60 overflow-y-auto">
                                      {catalogItems.filter(i => i && i.type === 'product').map(product => (
                                        <label key={product.id} className="flex items-center gap-2 p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer">
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
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">{product.name}</div>
                                            <div className="text-xs text-gray-500">R$ {product.price}</div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Incluir Serviços */}
                                <div>
                                  <label className="flex items-start gap-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition">
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
                                              : []
                                          }
                                        });
                                      }}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="font-bold text-gray-900">
                                        🛠️ Incluir Serviços do Catálogo
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        A IA poderá oferecê-los aos clientes
                                      </div>
                                      {catalogItems.filter(i => i && i.type === 'service').length > 0 && (
                                        <div className="text-xs text-blue-700 mt-1">
                                          ✓ {catalogItems.filter(i => i && i.type === 'service').length} serviço(s) disponível(is)
                                        </div>
                                      )}
                                    </div>
                                  </label>

                                  {/* Lista de Serviços com Checkboxes Individuais */}
                                  {editingStep.catalogSettings?.includeServices && (
                                    <div className="mt-3 ml-6 space-y-2 max-h-60 overflow-y-auto">
                                      {catalogItems.filter(i => i && i.type === 'service').map(service => (
                                        <label key={service.id} className="flex items-center gap-2 p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer">
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
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">{service.name}</div>
                                            <div className="text-xs text-gray-500">R$ {service.price}</div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Editor de Perguntas Customizadas (só para collect_data) */}
                            {editingStep.type === 'collect_data' && (
                              <CustomQuestionsEditor
                                questions={editingStep.customQuestions || []}
                                onChange={(questions) => setEditingStep({ ...editingStep, customQuestions: questions })}
                              />
                            )}

                            {/* Configurações de Agendamento (só para create_appointment) */}
                            {editingStep.type === 'create_appointment' && (
                              <div className="border-t pt-4 mt-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-semibold text-gray-800">
                                    📅 Configurações de Agendamento
                                  </h4>
                                </div>

                                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                  <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingStep.appointmentEnabled || false}
                                      onChange={(e) => setEditingStep({ 
                                        ...editingStep, 
                                        appointmentEnabled: e.target.checked,
                                        appointmentTypes: e.target.checked ? (editingStep.appointmentTypes || []) : []
                                      })}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="font-bold text-gray-900">
                                        📅 Habilitar Sistema de Agendamentos
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        O agente poderá criar agendamentos durante a conversa
                                      </div>
                                    </div>
                                  </label>

                                  {editingStep.appointmentEnabled && (
                                    <div className="mt-4">
                                      <label className="block font-semibold text-sm text-gray-700 mb-3">
                                        Tipos de Agendamento Permitidos:
                                      </label>
                                      <div className="grid grid-cols-2 gap-2">
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
                                            className="flex items-center gap-2 p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer"
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
                                            <span className="text-sm">{type.label}</span>
                                          </label>
                                        ))}
                                      </div>
                                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                        <p className="text-xs text-yellow-800">
                                          💡 <strong>Dica:</strong> Agendamentos criados durante a conversa aparecerão automaticamente na seção Agendamentos.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Botões */}
                            <div className="flex gap-2 justify-end pt-4 border-t">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                              >
                                <X size={16} />
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={saveEdit}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
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
                                <h3 className="text-lg font-semibold text-gray-800">
                                  Passo {index + 1}: {step.title}
                                </h3>
                                {(!step.title || !step.description) && (
                                  <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                    ⚠️ Incompleto
                                  </span>
                                )}
                              </div>

                              {step.description && (
                                <p className="text-gray-600 mb-2">
                                  {step.description}
                                </p>
                              )}

                              {step.condition && (
                                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded inline-flex">
                                  ⚠️ Condição: {step.condition}
                                </div>
                              )}

                              {/* Mostrar configurações de catálogo se houver */}
                              {step.type === 'show_catalog' && step.catalogSettings && (
                                <div className="mt-3 text-sm">
                                  {step.catalogSettings.includeProducts && (
                                    <div className="mb-2">
                                      <span className="font-semibold text-green-700">
                                        📦 Produtos: 
                                      </span>
                                      <span className="text-gray-600 ml-2">
                                        {step.catalogSettings.selectedProducts?.length || 0} selecionado(s)
                                      </span>
                                    </div>
                                  )}
                                  {step.catalogSettings.includeServices && (
                                    <div>
                                      <span className="font-semibold text-blue-700">
                                        🛠️ Serviços: 
                                      </span>
                                      <span className="text-gray-600 ml-2">
                                        {step.catalogSettings.selectedServices?.length || 0} selecionado(s)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Mostrar perguntas customizadas se houver */}
                              {step.type === 'collect_data' && step.customQuestions && step.customQuestions.length > 0 && (
                                <div className="mt-3 text-sm">
                                  <div className="font-semibold text-purple-700 mb-2">
                                    📋 {step.customQuestions.length} Pergunta(s) Configurada(s):
                                  </div>
                                  <div className="space-y-1">
                                    {step.customQuestions.map((q, idx) => (
                                      <div key={q.id} className="text-gray-600 pl-4 border-l-2 border-purple-200">
                                        {idx + 1}. {q.question || 'Pergunta sem texto'} 
                                        <span className="text-xs text-gray-500 ml-2">
                                          ({q.field || 'sem campo'})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Mostrar configurações de agendamento se houver */}
                              {step.type === 'create_appointment' && step.appointmentEnabled && (
                                <div className="mt-3 text-sm">
                                  <div className="font-semibold text-blue-700 mb-2">
                                    📅 Sistema de Agendamentos Habilitado
                                  </div>
                                  {step.appointmentTypes && step.appointmentTypes.length > 0 && (
                                    <div className="text-gray-600">
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
                                onClick={() => startEdit(index)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Editar"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeStep(index)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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

      {/* Empty State */}
      {steps.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Nenhum passo configurado
          </h3>
          <p className="text-gray-600 mb-6">
            Adicione passos para definir o fluxo de conversa do seu agente
          </p>
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition mx-auto"
          >
            <Plus size={20} />
            Adicionar Primeiro Passo
          </button>
        </div>
      )}

      {/* Preview do Prompt Gerado */}
      {steps.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            📝 Preview do Prompt Gerado
          </h3>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">
            {generatePrompt()}
          </pre>
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
      />
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

