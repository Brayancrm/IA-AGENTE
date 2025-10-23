'use client';

import { useState } from 'react';
import FlowBuilder from '@/components/FlowBuilder';

/**
 * Página de Teste do Flow Builder
 * 
 * Acesse: http://localhost:3000/flow-builder-test
 */
export default function FlowBuilderTestPage() {
  const [steps, setSteps] = useState([
    {
      id: 1,
      type: 'greeting',
      title: 'Cumprimentar Cliente',
      description: 'Cumprimente o cliente de forma amigável e pergunte como pode ajudar.',
      condition: null,
      actions: []
    },
    {
      id: 2,
      type: 'ask_info',
      title: 'Perguntar Nome',
      description: 'Pergunte o nome completo do cliente para personalizar o atendimento.',
      condition: null,
      actions: []
    },
    {
      id: 3,
      type: 'show_catalog',
      title: 'Mostrar Produtos',
      description: 'Apresente o catálogo de produtos disponíveis com preços e descrições.',
      condition: 'Se o cliente demonstrar interesse em comprar',
      actions: []
    }
  ]);

  const [lastSaved, setLastSaved] = useState(null);

  const handleChange = (newSteps) => {
    console.log('📝 Steps atualizados:', newSteps);
    setSteps(newSteps);
    setLastSaved(new Date().toLocaleTimeString());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                🧪 Flow Builder - Teste
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Página de teste para o componente Flow Builder
              </p>
            </div>
            {lastSaved && (
              <div className="text-sm text-green-600">
                ✅ Última atualização: {lastSaved}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <FlowBuilder 
          initialSteps={steps} 
          onChange={handleChange}
        />

        {/* Debug Info */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            🔍 Debug - Estado Atual
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Total de Steps: {steps.length}
              </div>
              <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(steps, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            📚 Como Testar
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>✅ <strong>Adicionar Step:</strong> Clique no botão "Adicionar Passo"</li>
            <li>✅ <strong>Editar Step:</strong> Clique no ícone de lápis (✏️)</li>
            <li>✅ <strong>Remover Step:</strong> Clique no ícone de lixeira (🗑️)</li>
            <li>✅ <strong>Reordenar:</strong> Arraste o ícone ⋮⋮ para mudar a ordem</li>
            <li>✅ <strong>Ver Prompt:</strong> Role até o fim para ver o preview</li>
          </ul>
        </div>

        {/* Links Úteis */}
        <div className="mt-8 bg-gray-800 text-white rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">
            🔗 Links Úteis
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              📖 <strong>Documentação:</strong> Veja <code className="bg-gray-700 px-2 py-1 rounded">FLOW_BUILDER_GUIA.md</code>
            </div>
            <div>
              📝 <strong>Resumo:</strong> Veja <code className="bg-gray-700 px-2 py-1 rounded">FLOW_BUILDER_RESUMO.md</code>
            </div>
            <div>
              🔧 <strong>Backend:</strong> Endpoints em <code className="bg-gray-700 px-2 py-1 rounded">backend/ENDPOINTS_FLOW_BUILDER.md</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

