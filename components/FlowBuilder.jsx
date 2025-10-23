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
    { value: 'greeting', label: '👋 Cumprimentar', icon: '👋' },
    { value: 'ask_info', label: '❓ Perguntar Informação', icon: '❓' },
    { value: 'show_catalog', label: '📦 Mostrar Produtos/Serviços', icon: '📦' },
    { value: 'process_order', label: '🛒 Processar Pedido', icon: '🛒' },
    { value: 'request_payment', label: '💳 Solicitar Pagamento', icon: '💳' },
    { value: 'send_confirmation', label: '✅ Enviar Confirmação', icon: '✅' },
    { value: 'ask_invoice', label: '📄 Perguntar sobre Nota Fiscal', icon: '📄' },
    { value: 'collect_address', label: '📍 Coletar Endereço', icon: '📍' },
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
      prompt += '\n';
    });

    return prompt;
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
                              {editingStep.type === 'free_text' && (
                                <p className="text-sm text-amber-600 mt-2">
                                  💡 Use "Texto Livre" para inserir instruções específicas que não se encaixam nos tipos padrão.
                                </p>
                              )}
                            </div>

                            {/* Condição (Opcional) */}
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
                                              ? catalogItems.filter(i => i.type === 'product').map(i => i.id)
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
                                      {catalogItems.filter(i => i.type === 'product').length > 0 && (
                                        <div className="text-xs text-green-700 mt-1">
                                          ✓ {catalogItems.filter(i => i.type === 'product').length} produto(s) disponível(is)
                                        </div>
                                      )}
                                    </div>
                                  </label>

                                  {/* Lista de Produtos com Checkboxes Individuais */}
                                  {editingStep.catalogSettings?.includeProducts && (
                                    <div className="mt-3 ml-6 space-y-2 max-h-60 overflow-y-auto">
                                      {catalogItems.filter(i => i.type === 'product').map(product => (
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
                                              ? catalogItems.filter(i => i.type === 'service').map(i => i.id)
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
                                      {catalogItems.filter(i => i.type === 'service').length > 0 && (
                                        <div className="text-xs text-blue-700 mt-1">
                                          ✓ {catalogItems.filter(i => i.type === 'service').length} serviço(s) disponível(is)
                                        </div>
                                      )}
                                    </div>
                                  </label>

                                  {/* Lista de Serviços com Checkboxes Individuais */}
                                  {editingStep.catalogSettings?.includeServices && (
                                    <div className="mt-3 ml-6 space-y-2 max-h-60 overflow-y-auto">
                                      {catalogItems.filter(i => i.type === 'service').map(service => (
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

