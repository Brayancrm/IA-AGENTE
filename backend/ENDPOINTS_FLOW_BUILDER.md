# 🔧 Endpoints para Flow Builder

## Endpoints a Adicionar no `backend/server.js`

Cole estes endpoints no seu arquivo `server.js`:

```javascript
// ============================================
// FLOW BUILDER - Configuração Visual de Fluxo
// ============================================

/**
 * GET /api/ai-config/:userId
 * Buscar configuração de IA (incluindo flow steps)
 */
app.get('/api/ai-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('📖 [FlowBuilder] Buscando configuração para userId:', userId);
    
    // Buscar configuração no Firebase
    const configRef = db.ref(`users/data/${userId}/ai_config`);
    const snapshot = await configRef.once('value');
    const config = snapshot.val();

    if (!config) {
      console.log('⚠️ [FlowBuilder] Configuração não encontrada, retornando padrão');
      return res.json({
        success: true,
        config: {
          flowSteps: [],
          systemPrompt: 'Você é um assistente virtual prestativo.',
          model: 'gpt-4',
          welcomeMessage: 'Olá! Como posso ajudar?',
          enabledFeatures: []
        }
      });
    }

    console.log('✅ [FlowBuilder] Configuração encontrada');
    console.log('   - Flow Steps:', config.flowSteps?.length || 0);
    console.log('   - System Prompt:', config.systemPrompt ? 'Sim' : 'Não');

    res.json({
      success: true,
      config: {
        flowSteps: config.flowSteps || [],
        systemPrompt: config.systemPrompt || '',
        model: config.model || 'gpt-4',
        welcomeMessage: config.welcomeMessage || '',
        enabledFeatures: config.enabledFeatures || []
      }
    });

  } catch (error) {
    console.error('❌ [FlowBuilder] Erro ao buscar configuração:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/ai-config/:userId
 * Salvar configuração de IA (incluindo flow steps)
 */
app.put('/api/ai-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { flowSteps, systemPrompt, model, welcomeMessage, enabledFeatures } = req.body;

    console.log('💾 [FlowBuilder] Salvando configuração para userId:', userId);
    console.log('   - Flow Steps:', flowSteps?.length || 0);
    console.log('   - System Prompt:', systemPrompt ? `${systemPrompt.substring(0, 50)}...` : 'Vazio');

    // Validações básicas
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    // Preparar dados para salvar
    const configData = {
      updatedAt: new Date().toISOString()
    };

    if (flowSteps !== undefined) {
      configData.flowSteps = flowSteps;
    }

    if (systemPrompt !== undefined) {
      configData.systemPrompt = systemPrompt;
    }

    if (model !== undefined) {
      configData.model = model;
    }

    if (welcomeMessage !== undefined) {
      configData.welcomeMessage = welcomeMessage;
    }

    if (enabledFeatures !== undefined) {
      configData.enabledFeatures = enabledFeatures;
    }

    // Salvar no Firebase
    const configRef = db.ref(`users/data/${userId}/ai_config`);
    await configRef.update(configData);

    console.log('✅ [FlowBuilder] Configuração salva com sucesso');

    res.json({
      success: true,
      message: 'Configuração salva com sucesso',
      config: configData
    });

  } catch (error) {
    console.error('❌ [FlowBuilder] Erro ao salvar configuração:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-config/:userId/convert-prompt
 * Converter prompt antigo em flow steps
 */
app.post('/api/ai-config/:userId/convert-prompt', async (req, res) => {
  try {
    const { userId } = req.params;
    const { prompt } = req.body;

    console.log('🔄 [FlowBuilder] Convertendo prompt para steps');
    console.log('   - userId:', userId);
    console.log('   - Prompt length:', prompt?.length || 0);

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt é obrigatório'
      });
    }

    // Função auxiliar para converter (mesma do hook)
    const steps = convertPromptToSteps(prompt);

    console.log('✅ [FlowBuilder] Conversão concluída');
    console.log('   - Steps gerados:', steps.length);

    res.json({
      success: true,
      steps
    });

  } catch (error) {
    console.error('❌ [FlowBuilder] Erro ao converter prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-config/:userId/generate-prompt
 * Gerar prompt a partir de flow steps
 */
app.post('/api/ai-config/:userId/generate-prompt', async (req, res) => {
  try {
    const { userId } = req.params;
    const { steps } = req.body;

    console.log('🔄 [FlowBuilder] Gerando prompt a partir de steps');
    console.log('   - userId:', userId);
    console.log('   - Steps:', steps?.length || 0);

    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'Steps é obrigatório e deve ser um array'
      });
    }

    // Função auxiliar para gerar prompt (mesma do hook)
    const prompt = convertStepsToPrompt(steps);

    console.log('✅ [FlowBuilder] Prompt gerado');
    console.log('   - Prompt length:', prompt.length);

    res.json({
      success: true,
      prompt
    });

  } catch (error) {
    console.error('❌ [FlowBuilder] Erro ao gerar prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Funções Auxiliares para Conversão
// ============================================

/**
 * Converte array de steps em prompt de texto
 */
function convertStepsToPrompt(steps) {
  if (!steps || steps.length === 0) {
    return 'Você é um assistente virtual prestativo.';
  }

  let prompt = '# FLUXO DE ATENDIMENTO\n\n';
  prompt += 'Siga este fluxo de atendimento na ordem especificada:\n\n';

  steps.forEach((step, index) => {
    prompt += `## ${index + 1}. ${step.title}\n\n`;

    // Adicionar tipo de ação
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

    const actionDesc = actionDescriptions[step.type] || '';
    if (actionDesc) {
      prompt += `**Ação:** ${actionDesc}\n\n`;
    }

    // Adicionar descrição detalhada
    if (step.description) {
      prompt += `**Instruções:**\n${step.description}\n\n`;
    }

    // Adicionar condição
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
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('cumpriment') || lowerTitle.includes('boas-vind')) {
      type = 'greeting';
    } else if (lowerTitle.includes('pergunt') || lowerTitle.includes('informaç')) {
      type = 'ask_info';
    } else if (lowerTitle.includes('produto') || lowerTitle.includes('catálogo')) {
      type = 'show_catalog';
    } else if (lowerTitle.includes('pedido') || lowerTitle.includes('carrinho')) {
      type = 'process_order';
    } else if (lowerTitle.includes('pagamento') || lowerTitle.includes('pagar')) {
      type = 'request_payment';
    } else if (lowerTitle.includes('confirmação') || lowerTitle.includes('confirmar')) {
      type = 'send_confirmation';
    } else if (lowerTitle.includes('nota fiscal') || lowerTitle.includes('nf')) {
      type = 'ask_invoice';
    } else if (lowerTitle.includes('endereço') || lowerTitle.includes('endereco')) {
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
```

## Como Integrar

1. Copie o código acima
2. Cole no final do arquivo `backend/server.js` (antes do `app.listen`)
3. Reinicie o backend
4. Teste os endpoints

## Testar Endpoints

```bash
# 1. Buscar configuração
curl http://localhost:3001/api/ai-config/SEU_USER_ID

# 2. Salvar steps
curl -X PUT http://localhost:3001/api/ai-config/SEU_USER_ID \
  -H "Content-Type: application/json" \
  -d '{"flowSteps": [{"id": 1, "type": "greeting", "title": "Cumprimentar"}]}'

# 3. Gerar prompt
curl -X POST http://localhost:3001/api/ai-config/SEU_USER_ID/generate-prompt \
  -H "Content-Type: application/json" \
  -d '{"steps": [{"id": 1, "type": "greeting", "title": "Cumprimentar", "description": "Seja amigável"}]}'
```

## ✅ Pronto!

Agora você tem:
- ✅ Componente FlowBuilder
- ✅ Hook useFlowBuilder
- ✅ Endpoints no backend
- ✅ Conversão steps ↔ prompt

**Próximo passo:** Integrar na sua página de configurações!

