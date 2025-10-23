import { useState, useEffect } from 'react';

/**
 * Hook para gerenciar o Flow Builder
 * 
 * Converte entre:
 * - Steps (array de objetos estruturados) ↔ Prompt (string de texto)
 * - Sincroniza com backend/Firebase
 */
export function useFlowBuilder(userId) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar steps do backend
  useEffect(() => {
    if (!userId) return;

    const loadSteps = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/ai-config/${userId}`);
        const data = await response.json();

        if (data.success) {
          // Se já existem steps estruturados, usar
          if (data.config.flowSteps) {
            setSteps(data.config.flowSteps);
          } 
          // Se só tem o prompt antigo, tentar converter
          else if (data.config.systemPrompt) {
            const convertedSteps = convertPromptToSteps(data.config.systemPrompt);
            setSteps(convertedSteps);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSteps();
  }, [userId]);

  // Salvar steps no backend
  const saveSteps = async (newSteps) => {
    try {
      setSteps(newSteps);

      // Gerar prompt a partir dos steps
      const generatedPrompt = convertStepsToPrompt(newSteps);

      const response = await fetch(`/api/ai-config/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowSteps: newSteps, // Salvar steps estruturados
          systemPrompt: generatedPrompt, // Salvar prompt gerado
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao salvar');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  return {
    steps,
    setSteps: saveSteps,
    loading,
    error,
  };
}

/**
 * Converte array de steps em prompt de texto
 * EXPORTADA para usar em outros componentes
 */
export function convertStepsToPrompt(steps) {
  if (!steps || steps.length === 0) {
    return 'Você é um assistente virtual prestativo.';
  }

  let prompt = '# FLUXO DE ATENDIMENTO\n\nSiga este fluxo de atendimento na ordem especificada:\n\n';

  const actionDescriptions = {
    greeting: 'Cumprimente o cliente de forma amigável.',
    ask_info: 'Pergunte as informações necessárias ao cliente.',
    show_catalog: 'Apresente os produtos/serviços disponíveis.',
    process_order: 'Processe o pedido do cliente, confirmando itens e quantidades.',
    request_payment: 'Solicite o pagamento e forneça instruções.',
    send_confirmation: 'Envie uma mensagem de confirmação com os detalhes.',
    ask_invoice: 'Pergunte se o cliente deseja nota fiscal.',
    collect_address: 'Colete o endereço completo do cliente.',
    custom: 'Execute a ação personalizada conforme descrito.',
  };

  steps.forEach((step, index) => {
    prompt += `## ${index + 1}. ${step.title}\n\n`;
    
    const actionDesc = actionDescriptions[step.type] || '';
    if (actionDesc) {
      prompt += `**Ação:** ${actionDesc}\n\n`;
    }
    
    if (step.description) {
      prompt += `**Instruções:**\n${step.description}\n\n`;
    }
    
    if (step.condition) {
      prompt += `**Condição:** ${step.condition}\n\n`;
    }
    
    prompt += '---\n\n';
  });

  prompt += '\n## REGRAS IMPORTANTES\n\n';
  prompt += '- Siga os passos na ordem especificada\n';
  prompt += '- Se o cliente fizer uma pergunta fora do fluxo, responda e retorne ao passo atual\n';
  prompt += '- Seja sempre educado e profissional\n';
  prompt += '- Confirme as informações importantes antes de prosseguir\n';

  return prompt;
}

/**
 * Converte prompt de texto em array de steps
 * (Tentativa de parse - pode não ser 100% preciso)
 */
function convertPromptToSteps(prompt) {
  const steps = [];
  
  // Regex para detectar seções ## N. Título
  const sectionRegex = /##\s*(\d+)\.\s*(.+?)(?=\n\n|##|$)/gs;
  const matches = [...prompt.matchAll(sectionRegex)];

  matches.forEach((match, index) => {
    const title = match[2].trim();
    const fullText = match[0];

    // Extrair descrição
    const descMatch = fullText.match(/\*\*Instruções:\*\*\n(.+?)(?=\n\n|\*\*|---|$)/s);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extrair condição
    const condMatch = fullText.match(/\*\*Condição:\*\*\s*(.+?)(?=\n|$)/);
    const condition = condMatch ? condMatch[1].trim() : null;

    // Tentar detectar tipo
    let type = 'custom';
    if (title.toLowerCase().includes('cumpriment') || title.toLowerCase().includes('boas-vind')) {
      type = 'greeting';
    } else if (title.toLowerCase().includes('pergunt') || title.toLowerCase().includes('informaç')) {
      type = 'ask_info';
    } else if (title.toLowerCase().includes('produto') || title.toLowerCase().includes('catálogo')) {
      type = 'show_catalog';
    } else if (title.toLowerCase().includes('pedido') || title.toLowerCase().includes('carrinho')) {
      type = 'process_order';
    } else if (title.toLowerCase().includes('pagamento') || title.toLowerCase().includes('pagar')) {
      type = 'request_payment';
    } else if (title.toLowerCase().includes('confirmação') || title.toLowerCase().includes('confirmar')) {
      type = 'send_confirmation';
    } else if (title.toLowerCase().includes('nota fiscal') || title.toLowerCase().includes('nf')) {
      type = 'ask_invoice';
    } else if (title.toLowerCase().includes('endereço') || title.toLowerCase().includes('endereco')) {
      type = 'collect_address';
    }

    steps.push({
      id: Date.now() + index,
      type,
      title,
      description,
      condition,
      actions: [],
    });
  });

  // Se não conseguiu detectar steps, criar um step genérico
  if (steps.length === 0) {
    steps.push({
      id: Date.now(),
      type: 'custom',
      title: 'Fluxo Importado',
      description: prompt,
      condition: null,
      actions: [],
    });
  }

  return steps;
}

