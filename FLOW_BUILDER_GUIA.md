# 🎯 Flow Builder - Guia Completo

## O Que É?

O **Flow Builder** é uma interface visual para criar o fluxo de conversa do agente de IA, substituindo o campo de texto livre por uma experiência **step-by-step** intuitiva.

---

## 🎨 Como Funciona

### Antes (Campo de Texto):
```
┌─────────────────────────────────┐
│ Prompt do Sistema:              │
│                                  │
│ Você é a Eduarda Giralde.       │
│ Cumprimente o cliente...        │
│ Pergunte o nome...              │
│ Mostre os produtos...           │
│ ... (texto longo difícil)       │
└─────────────────────────────────┘
```

### Depois (Interface Visual):
```
┌─────────────────────────────────┐
│ 👋 Passo 1: Cumprimentar        │
│ ↕️ [Arraste para reordenar]     │
│ [Editar] [Remover]              │
├─────────────────────────────────┤
│ ❓ Passo 2: Perguntar Nome      │
│ ↕️ [Arraste para reordenar]     │
│ [Editar] [Remover]              │
├─────────────────────────────────┤
│ 📦 Passo 3: Mostrar Produtos    │
│ ↕️ [Arraste para reordenar]     │
│ [Editar] [Remover]              │
├─────────────────────────────────┤
│ [+ Adicionar Novo Passo]        │
└─────────────────────────────────┘
```

---

## 📦 Componentes

### 1. `FlowBuilder.jsx`
Componente principal da interface visual.

**Funcionalidades:**
- ✅ Adicionar novos passos
- ✅ Editar passos existentes
- ✅ Remover passos
- ✅ Reordenar via drag & drop
- ✅ Preview do prompt gerado

### 2. `useFlowBuilder.js`
Hook para gerenciar estado e sincronização.

**Funcionalidades:**
- ✅ Carregar steps do backend
- ✅ Salvar steps no backend
- ✅ Converter steps ↔ prompt
- ✅ Sincronização automática

---

## 🚀 Como Usar

### Passo 1: Instalar Dependências

```bash
npm install @hello-pangea/dnd lucide-react
```

### Passo 2: Importar Componentes

```jsx
import FlowBuilder from '@/components/FlowBuilder';
import { useFlowBuilder } from '@/hooks/useFlowBuilder';
```

### Passo 3: Usar na Página

```jsx
export default function ConfigPage() {
  const { steps, setSteps, loading } = useFlowBuilder(userId);

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      <h1>Configuração do Agente</h1>
      <FlowBuilder 
        initialSteps={steps} 
        onChange={setSteps}
      />
    </div>
  );
}
```

---

## 🎯 Tipos de Ação Disponíveis

| Tipo | Ícone | Descrição |
|------|-------|-----------|
| `greeting` | 👋 | Cumprimentar o cliente |
| `ask_info` | ❓ | Perguntar informações |
| `show_catalog` | 📦 | Mostrar produtos/serviços |
| `process_order` | 🛒 | Processar pedido |
| `request_payment` | 💳 | Solicitar pagamento |
| `send_confirmation` | ✅ | Enviar confirmação |
| `ask_invoice` | 📄 | Perguntar sobre nota fiscal |
| `collect_address` | 📍 | Coletar endereço |
| `custom` | ⚙️ | Ação personalizada |

---

## 📊 Estrutura de Dados

### Step Object

```typescript
interface Step {
  id: number;                    // ID único
  type: string;                  // Tipo da ação
  title: string;                 // Título do passo
  description: string;           // Instruções detalhadas
  condition: string | null;      // Condição para executar
  actions: any[];                // Ações adicionais
}
```

### Exemplo

```javascript
const step = {
  id: 1234567890,
  type: 'greeting',
  title: 'Cumprimentar Cliente',
  description: 'Cumprimente o cliente de forma amigável e pergunte como pode ajudar.',
  condition: null,
  actions: []
};
```

---

## 🔄 Conversão Steps ↔ Prompt

### Steps → Prompt

O hook `useFlowBuilder` converte automaticamente os steps em um prompt estruturado:

```
# FLUXO DE ATENDIMENTO

## 1. Cumprimentar Cliente

**Ação:** Cumprimente o cliente de forma amigável.

**Instruções:**
Cumprimente o cliente de forma amigável e pergunte como pode ajudar.

---

## 2. Perguntar Nome

**Ação:** Pergunte as informações necessárias ao cliente.

**Instruções:**
Pergunte o nome completo do cliente para personalizar o atendimento.

---
```

### Prompt → Steps

O hook também tenta converter prompts antigos em steps:

```javascript
const prompt = "## 1. Cumprimentar\nSeja amigável...";
const steps = convertPromptToSteps(prompt);
// Resultado: [{ id: ..., type: 'greeting', title: 'Cumprimentar', ... }]
```

---

## 🔧 Backend (Endpoints Necessários)

### GET `/api/ai-config/:userId`

Retorna a configuração atual:

```javascript
{
  "success": true,
  "config": {
    "flowSteps": [...],      // Steps estruturados
    "systemPrompt": "..."    // Prompt gerado
  }
}
```

### PUT `/api/ai-config/:userId`

Salva nova configuração:

```javascript
{
  "flowSteps": [...],      // Steps estruturados
  "systemPrompt": "..."    // Prompt gerado
}
```

---

## 📝 Exemplo Completo

### 1. Página de Configuração

```jsx
// pages/config.jsx
import { useState } from 'react';
import FlowBuilder from '@/components/FlowBuilder';
import { useFlowBuilder } from '@/hooks/useFlowBuilder';
import { useAuth } from '@/hooks/useAuth';

export default function ConfigPage() {
  const { user } = useAuth();
  const { steps, setSteps, loading, error } = useFlowBuilder(user?.uid);

  const handleChange = async (newSteps) => {
    const result = await setSteps(newSteps);
    if (result.success) {
      alert('✅ Fluxo salvo com sucesso!');
    } else {
      alert('❌ Erro ao salvar: ' + result.error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div>Carregando configuração...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        ❌ Erro: {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuração do Agente</h1>
        <p className="text-gray-600 mt-2">
          Configure o fluxo de conversa do seu agente de forma visual
        </p>
      </div>

      <FlowBuilder 
        initialSteps={steps} 
        onChange={handleChange}
      />
    </div>
  );
}
```

### 2. Endpoints do Backend

```javascript
// backend/server.js

// Buscar configuração
app.get('/api/ai-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const configRef = db.ref(`users/data/${userId}/ai_config`);
    const snapshot = await configRef.once('value');
    const config = snapshot.val() || {};

    res.json({
      success: true,
      config: {
        flowSteps: config.flowSteps || [],
        systemPrompt: config.systemPrompt || '',
        // ... outras configs
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Salvar configuração
app.put('/api/ai-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { flowSteps, systemPrompt } = req.body;

    const configRef = db.ref(`users/data/${userId}/ai_config`);
    await configRef.update({
      flowSteps,
      systemPrompt,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Configuração salva com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## 🎨 Personalização

### Adicionar Novos Tipos de Ação

No arquivo `FlowBuilder.jsx`, adicione ao array `actionTypes`:

```javascript
const actionTypes = [
  // ... tipos existentes ...
  { 
    value: 'send_file', 
    label: '📎 Enviar Arquivo', 
    icon: '📎' 
  },
];
```

### Customizar Aparência

Modifique as classes Tailwind no componente:

```jsx
<div className="bg-blue-600">  {/* Mude para sua cor */}
```

---

## 🐛 Troubleshooting

### Steps não estão salvando

1. Verifique se os endpoints `/api/ai-config/...` existem
2. Verifique permissões do Firebase
3. Veja o console do navegador para erros

### Drag & Drop não funciona

1. Certifique-se que instalou `@hello-pangea/dnd`
2. Verifique se há conflitos de CSS
3. Teste em navegador diferente

### Prompt não está sendo gerado corretamente

1. Verifique a função `convertStepsToPrompt`
2. Adicione logs para debugar
3. Teste com steps simples primeiro

---

## 📚 Próximos Passos

1. ✅ Implementar componente FlowBuilder
2. ✅ Criar hook useFlowBuilder
3. ⏳ Criar endpoints no backend
4. ⏳ Integrar na página de configurações
5. ⏳ Testar em produção

---

## 🆘 Suporte

Se tiver dúvidas:
1. Veja os comentários no código
2. Consulte este guia
3. Teste com exemplos simples primeiro

---

**Pronto para transformar a experiência do usuário!** 🚀

