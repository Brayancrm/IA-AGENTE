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

const toneRules = {
  friendly: 'SEMPRE MANTENHA TOM AMIGÁVEL, CALOROSO E ACOLHEDOR.',
  professional: 'SEMPRE MANTENHA TOM PROFISSIONAL, FORMAL E RESPEITOSO.',
  casual: 'SEMPRE MANTENHA TOM CASUAL E NATURAL.',
  enthusiastic: 'SEMPRE MANTENHA TOM ENTUSIASMADO E ENERGÉTICO.',
  empathetic: 'SEMPRE MANTENHA TOM EMPÁTICO E ACOLHEDOR.'
};

const styleRules = {
  concise: 'SEMPRE MANTENHA RESPOSTAS CONCISAS E DIRETAS.',
  detailed: 'SEMPRE FORNEÇA RESPOSTAS DETALHADAS E COMPLETAS.',
  consultative: 'SEMPRE ADOTE ABORDAGEM CONSULTIVA E OBJETIVA.',
  persuasive: 'SEMPRE ADOTE ABORDAGEM PERSUASIVA, DESTACANDO BENEFÍCIOS.'
};

const actionRules = {
  greeting: 'CUMPRIMENTE O CLIENTE.',
  ask_info: 'PERGUNTE AS INFORMAÇÕES NECESSÁRIAS.',
  collect_data: 'COLETE DADOS DO CLIENTE.',
  show_catalog: 'APRESENTE PRODUTOS E SERVIÇOS DISPONÍVEIS.',
  process_order: 'CONFIRME ITENS E QUANTIDADES ANTES DE FINALIZAR.',
  request_payment: 'SOLICITE O PAGAMENTO E FORNEÇA INSTRUÇÕES.',
  send_confirmation: 'ENVIE CONFIRMAÇÃO COM DETALHES.',
  ask_invoice: 'PERGUNTE SOBRE NOTA FISCAL.',
  collect_address: 'COLETE ENDEREÇO COMPLETO.',
  create_appointment: 'CRIE AGENDAMENTOS CONFORME CONFIGURADO.',
  free_text: 'EXECUTE A INSTRUÇÃO DEFINIDA.',
  custom: 'EXECUTE A AÇÃO PERSONALIZADA DEFINIDA.'
};

function normalizeCondition(condition) {
  if (!condition) return null;
  return condition
    .trim()
    .replace(/quando o cliente/gi, 'SE O CLIENTE')
    .replace(/quando o usuário/gi, 'SE O USUÁRIO')
    .replace(/quando a cliente/gi, 'SE A CLIENTE')
    .replace(/\bquando\b/gi, 'SE');
}

function buildDeterministicCondition(condition, step, stepNumber) {
  if (!condition) return null;
  const normalized = normalizeCondition(condition);
  const hasSystemVar = /{{[^}]+}}/.test(normalized);
  if (hasSystemVar) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  if (lower.includes('cadastro')) {
    return '{{exigir_cadastro}} == true';
  }
  if (lower.includes('pagamento')) {
    return '{{exigir_pagamento}} == true';
  }
  if (lower.includes('agendamento')) {
    return '{{exigir_agendamento}} == true';
  }
  if (lower.includes('nota fiscal') || lower.includes('nf')) {
    return '{{exigir_nota_fiscal}} == true';
  }
  if (lower.includes('endereço') || lower.includes('endereco')) {
    return '{{exigir_endereco}} == true';
  }
  if (lower.includes('catálogo') || lower.includes('catalogo')) {
    return '{{exigir_catalogo}} == true';
  }
  if (lower.includes('pedido') || lower.includes('carrinho')) {
    return '{{exigir_pedido}} == true';
  }

  const fallbackKey = step?.title
    ? step.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    : `passo_${stepNumber}`;

  return `{{condicao_${fallbackKey || `passo_${stepNumber}`}}} == true`;
}

function normalizeRuleText(text, defaultPrefix = 'SEMPRE') {
  if (!text) return null;
  let rule = text.trim().replace(/\s+/g, ' ');

  rule = rule
    .replace(/não esqueça/gi, 'SEMPRE')
    .replace(/explique que/gi, 'SEMPRE INFORME:')
    .replace(/quando o cliente/gi, 'SE O CLIENTE')
    .replace(/quando o usuário/gi, 'SE O USUÁRIO')
    .replace(/quando a cliente/gi, 'SE A CLIENTE')
    .replace(/\bquando\b/gi, 'SE')
    .replace(/^você deve/gi, 'DEVE')
    .replace(/^por favor[, ]*/gi, '');

  const hasImperativePrefix = /^(SEMPRE|NUNCA|APENAS|EXATAMENTE)/i.test(rule);
  if (!hasImperativePrefix) {
    rule = `${defaultPrefix} ${rule}`;
  }
  if (/^SE /i.test(rule)) {
    rule = `SEMPRE ${rule}`;
  }
  rule = rule.replace(/^DEVE /i, 'SEMPRE ');
  return rule;
}

/**
 * Compila os steps em um prompt autoritário e executável.
 */
export function compilePrompt(steps = []) {
  if (!steps || steps.length === 0) {
    return [
      'SYSTEM PROMPT EXECUTÁVEL',
      '',
      'IDENTIDADE DO ASSISTENTE',
      'NOME: ASSISTENTE VIRTUAL',
      'FUNÇÃO: ATENDIMENTO',
      '',
      'REGRAS ABSOLUTAS (NUMERADAS)',
      '1. SEMPRE SIGA AS REGRAS ABSOLUTAS.',
      '',
      'COMPORTAMENTO EXECUTÁVEL (PASSOS)',
      'PASSOS DEFINIDOS: NENHUM.',
      '',
      'PROIBIÇÕES ABSOLUTAS',
      '1. NUNCA IGNORE AS REGRAS ABSOLUTAS.'
    ].join('\n');
  }

  const identityLines = [];
  const absoluteRules = [];
  const behaviorLines = [];
  const prohibitions = [];

  const agentProfileStep = steps.find(step => step.type === 'agent_profile');
  const agentName = agentProfileStep?.agentName || 'ASSISTENTE VIRTUAL';
  const agentRole = agentProfileStep?.agentRole || 'ATENDIMENTO';

  identityLines.push(`NOME: ${agentName.toUpperCase()}`);
  identityLines.push(`FUNÇÃO: ${agentRole.toUpperCase()}`);

  if (agentProfileStep?.agentTone && toneRules[agentProfileStep.agentTone]) {
    absoluteRules.push(toneRules[agentProfileStep.agentTone]);
  }
  if (agentProfileStep?.agentStyle && styleRules[agentProfileStep.agentStyle]) {
    absoluteRules.push(styleRules[agentProfileStep.agentStyle]);
  }
  if (agentProfileStep?.description) {
    const rule = normalizeRuleText(agentProfileStep.description);
    if (rule) absoluteRules.push(rule);
  }

  absoluteRules.push('SEMPRE SIGA OS PASSOS NA ORDEM DEFINIDA.');
  absoluteRules.push('SEMPRE CONFIRME INFORMAÇÕES CRÍTICAS ANTES DE PROSSEGUIR.');
  absoluteRules.push('SEMPRE USE VARIÁVEIS DE SISTEMA PARA DECISÕES CRÍTICAS.');

  let stepNumber = 0;
  steps.forEach((step) => {
    if (step.type === 'agent_profile') return;

    stepNumber += 1;
    const stepHeader = `PASSO ${stepNumber}: ${step.title?.toUpperCase() || 'SEM TÍTULO'}.`;
    behaviorLines.push(stepHeader);

    if (step.condition) {
      const condition = buildDeterministicCondition(step.condition, step, stepNumber);
      if (condition) {
        absoluteRules.push(`SEMPRE EXECUTE O PASSO ${stepNumber} APENAS SE: ${condition.toUpperCase()}.`);
      }
    }

    if (step.description) {
      const hasVariables = /{{[^}]+}}/.test(step.description);
      if (hasVariables) {
        absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} USE EXATAMENTE O TEXTO LITERAL: "${step.description}".`);
        prohibitions.push('NUNCA ALTERE OU SUBSTITUA VARIÁVEIS DE TEMPLATE ({{...}}).');
      } else {
        const rule = normalizeRuleText(step.description);
        if (rule) absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} ${rule.replace(/^(SEMPRE|NUNCA|APENAS|EXATAMENTE)\s+/i, '')}`);
      }
    }

    if (step.type === 'collect_data') {
      if (step.crmAutoSave) {
        absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} COLETE NOME E TELEFONE.`);
        const crmFields = step.crmFields || ['name', 'phone'];
        if (crmFields.includes('product')) {
          absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} IDENTIFIQUE O PRODUTO OU SERVIÇO DE INTERESSE.`);
        }
        if (crmFields.includes('email')) {
          absoluteRules.push(`SEMPRE NO PASSO ${stepNumber}, SE O CLIENTE INFORMAR EMAIL, REGISTRE A INTENÇÃO DE SALVAR O EMAIL.`);
        }
        absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} REGISTRE A INTENÇÃO DE SALVAR DADOS NO CRM.`);
      }

      if (step.customQuestions && step.customQuestions.length > 0) {
        step.customQuestions.forEach((q) => {
          absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} PERGUNTE EXATAMENTE: "${q.question}".`);
          if (q.required) {
            prohibitions.push(`NUNCA PROSSIGA SEM RESPOSTA PARA: "${q.question}".`);
          }
          prohibitions.push(`NUNCA REPITA A PERGUNTA "${q.question}" APÓS RESPOSTA VÁLIDA.`);
        });
      }
    }

    if (step.type === 'create_appointment' && step.appointmentEnabled) {
      if (step.appointmentTypes && step.appointmentTypes.length > 0) {
        absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} CRIE AGENDAMENTOS APENAS DOS TIPOS: ${step.appointmentTypes.join(', ').toUpperCase()}.`);
      }
      absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} INCLUA DATA, HORÁRIO, TIPO E DESCRIÇÃO.`);
    }

    if (step.type === 'audio_config') {
      const audioLanguage = (step.audioLanguage || 'pt-BR').toUpperCase();
      const audioVoice = step.audioVoice ? step.audioVoice.toUpperCase() : 'PADRÃO';
      absoluteRules.push(`SEMPRE NO PASSO ${stepNumber}, SE RECEBER ÁUDIO, RESPONDA APENAS EM ÁUDIO.`);
      absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} USE IDIOMA DE ÁUDIO: ${audioLanguage}.`);
      absoluteRules.push(`SEMPRE NO PASSO ${stepNumber} USE VOZ DE ÁUDIO: ${audioVoice}.`);
    }
  });

  prohibitions.push('NUNCA IGNORE AS REGRAS ABSOLUTAS.');
  prohibitions.push('NUNCA INVENTE DADOS DO CLIENTE.');
  prohibitions.push('NUNCA DECLARE AÇÕES TÉCNICAS EXECUTADAS; APENAS REGISTRE INTENÇÃO.');
  prohibitions.push('NUNCA DECIDA FLUXO CRÍTICO SEM VARIÁVEL DE SISTEMA.');

  return [
    'SYSTEM PROMPT EXECUTÁVEL',
    '',
    'IDENTIDADE DO ASSISTENTE',
    ...identityLines,
    '',
    'REGRAS ABSOLUTAS (NUMERADAS)',
    ...absoluteRules.map((rule, index) => `${index + 1}. ${rule}`),
    '',
    'COMPORTAMENTO EXECUTÁVEL (PASSOS)',
    ...behaviorLines,
    '',
    'PROIBIÇÕES ABSOLUTAS',
    ...prohibitions.map((rule, index) => `${index + 1}. ${rule}`)
  ].join('\n');
}

/**
 * Converte array de steps em prompt de texto
 * EXPORTADA para usar em outros componentes
 */
export function convertStepsToPrompt(steps) {
  return compilePrompt(steps);
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

