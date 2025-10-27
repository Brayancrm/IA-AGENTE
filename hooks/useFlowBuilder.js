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

  let prompt = '';
  let agentProfile = null;

  // ============================================
  // BUSCAR PERFIL DO AGENTE DOS STEPS
  // ============================================
  const agentProfileStep = steps.find(step => step.type === 'agent_profile');
  
  if (agentProfileStep && agentProfileStep.agentName) {
    prompt += '# PERFIL DO AGENTE\n\n';
    
    prompt += `Seu nome é **${agentProfileStep.agentName}**`;
    if (agentProfileStep.agentRole) {
      prompt += ` e você é ${agentProfileStep.agentRole}`;
    }
    prompt += '.\n\n';

    // Tom de Voz
    const toneDescriptions = {
      friendly: 'Seja amigável, caloroso e acolhedor. Use uma linguagem leve e simpática.',
      professional: 'Mantenha um tom profissional, formal e respeitoso. Use linguagem técnica quando apropriado.',
      casual: 'Seja casual, descontraído e natural. Converse como um amigo.',
      enthusiastic: 'Seja entusiasmado, energético e motivador. Demonstre empolgação!',
      empathetic: 'Seja empático, compreensivo e acolhedor. Demonstre que você se importa.'
    };
    
    if (agentProfileStep.agentTone && toneDescriptions[agentProfileStep.agentTone]) {
      prompt += `**Tom de Voz:** ${toneDescriptions[agentProfileStep.agentTone]}\n\n`;
    }

    // Estilo de Comunicação
    const styleDescriptions = {
      concise: 'Seja conciso e direto ao ponto. Evite textos longos.',
      detailed: 'Seja detalhado e explicativo. Forneça informações completas.',
      consultative: 'Seja consultivo e educativo. Explique o porquê das coisas.',
      persuasive: 'Seja persuasivo e convincente. Mostre os benefícios claramente.'
    };
    
    if (agentProfileStep.agentStyle && styleDescriptions[agentProfileStep.agentStyle]) {
      prompt += `**Estilo:** ${styleDescriptions[agentProfileStep.agentStyle]}\n\n`;
    }

    // Personalidade (do campo description)
    if (agentProfileStep.description) {
      prompt += `**Personalidade:** ${agentProfileStep.description}\n\n`;
    }

    prompt += '---\n\n';
    
    agentProfile = {
      name: agentProfileStep.agentName,
      role: agentProfileStep.agentRole
    };
  }

  // ============================================
  // FLUXO DE ATENDIMENTO
  // ============================================
  prompt += '# FLUXO DE ATENDIMENTO\n\nSiga este fluxo de atendimento na ordem especificada:\n\n';

  const actionDescriptions = {
    agent_profile: 'Apresente-se com seu nome e função.', // Não aparece no prompt porque já foi processado acima
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

  let stepNumber = 0;
  steps.forEach((step) => {
    // Pular o step de agent_profile no fluxo (já foi processado acima)
    if (step.type === 'agent_profile') {
      return;
    }
    
    stepNumber++;
    prompt += `## ${stepNumber}. ${step.title}\n\n`;
    
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
  if (agentProfile && agentProfile.name) {
    prompt += `- SEMPRE se apresente como ${agentProfile.name}${agentProfile.role ? ` (${agentProfile.role})` : ''} no início da conversa\n`;
  }
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

