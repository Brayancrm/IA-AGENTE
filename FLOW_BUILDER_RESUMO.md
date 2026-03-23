# 🎯 Flow Builder - Resumo Executivo

## ✅ O Que Foi Criado

Solução em duas camadas:

1. **Assistente guiado** (`AssistantSetupWizard.jsx` + `utils/assistantWizardHelpers.js`) — modelos de jornada (vendas completas, agendamentos, catálogo+leads, mínimo), separação **Negócio / CRM / Tom**, resumo e **botão “Gerar fluxo e aplicar”**.
2. **Flow Builder** (`FlowBuilder.jsx`) — modo avançado com passos editáveis, drag-and-drop e tipos de ação alinhados ao código (ver `FLOW_BUILDER_GUIA.md`).

A preferência **Assistente guiado** vs **Modo avançado** fica em `assistant_settings.configUiMode` (`simple` | `advanced`).

---

## 📦 Arquivos principais

### 1. **`components/AssistantSetupWizard.jsx`**
Wizard em 5 passos; gera `flowSteps` compatíveis com o Flow Builder.

### 2. **`utils/assistantWizardHelpers.js`**
Templates, `buildFlowStepsFromWizardState`, `parseFlowStepsToWizardState`, `mergeFlowStepsIntoAssistantForm`.

### 3. **`components/FlowBuilder.jsx`**
Interface visual com drag & drop para criar o fluxo.

**Funcionalidades:**
- ✅ Adicionar novos passos
- ✅ Editar passos existentes  
- ✅ Remover passos
- ✅ Reordenar via arrastar e soltar
- ✅ Tipos de ação: `agent_profile`, `audio_config`, `collect_data`, `show_catalog`, `process_order`, `send_confirmation`, `create_appointment`, `custom`
- ✅ Compilação do prompt via `convertStepsToPrompt`

### 4. **`hooks/useFlowBuilder.js`**
Hook / utilitários: `compilePrompt`, `convertStepsToPrompt` (e hook opcional para APIs REST).

**Funcionalidades:**
- ✅ Converter steps → prompt automaticamente (`compilePrompt`)
- ✅ Conversão prompt → steps (heurística, legado)

### 5. **`FLOW_BUILDER_GUIA.md`**
Guia atualizado com tipos de ação reais e fluxo do assistente guiado.

### 6. **`backend/ENDPOINTS_FLOW_BUILDER.md`** (Código Backend)
Endpoints prontos para copiar e colar no backend.

**Endpoints:**
- `GET /api/ai-config/:userId` - Buscar configuração
- `PUT /api/ai-config/:userId` - Salvar configuração
- `POST /api/ai-config/:userId/convert-prompt` - Converter prompt → steps
- `POST /api/ai-config/:userId/generate-prompt` - Converter steps → prompt

---

## 🎨 Como Fica a Interface

### Antes (Atual):
```
┌──────────────────────────────────────┐
│ Prompt do Sistema:                   │
│ ┌──────────────────────────────────┐ │
│ │ Você é a Eduarda Giralde.        │ │
│ │ Cumprimente o cliente...         │ │
│ │ Pergunte o nome...               │ │
│ │ Mostre os produtos...            │ │
│ │ ... (50 linhas de texto)         │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
   ❌ Difícil de entender
   ❌ Difícil de editar
   ❌ Difícil de reordenar
```

### Depois (Flow Builder):
```
┌──────────────────────────────────────┐
│ 🎯 Fluxo do Agente                   │
│                [+ Adicionar Passo]   │
├──────────────────────────────────────┤
│ ┌─────────┬──────────────────┬─────┐ │
│ │ ⋮⋮ │ 👋 Passo 1: Cumprimentar  │ [✏️][🗑️]│ │
│ │    │ Cumprimente o cliente...  │     │ │
│ └─────────┴──────────────────┴─────┘ │
├──────────────────────────────────────┤
│ ┌─────────┬──────────────────┬─────┐ │
│ │ ⋮⋮ │ ❓ Passo 2: Perguntar Nome │ [✏️][🗑️]│ │
│ │    │ Pergunte o nome completo  │     │ │
│ └─────────┴──────────────────┴─────┘ │
├──────────────────────────────────────┤
│ ┌─────────┬──────────────────┬─────┐ │
│ │ ⋮⋮ │ 📦 Passo 3: Mostrar Produtos│[✏️][🗑️]│ │
│ │    │ Apresente o catálogo...   │     │ │
│ └─────────┴──────────────────┴─────┘ │
└──────────────────────────────────────┘
   ✅ Visual e intuitivo
   ✅ Fácil de editar
   ✅ Arrastar para reordenar
```

---

## 🚀 Como Implementar (5 Passos)

### Passo 1: Instalar Dependências

```bash
npm install @hello-pangea/dnd lucide-react
```

### Passo 2: Copiar Componentes

Copie os arquivos:
- ✅ `components/FlowBuilder.jsx`
- ✅ `hooks/useFlowBuilder.js`

### Passo 3: Adicionar Endpoints no Backend

Abra `backend/server.js` e cole o código de `backend/ENDPOINTS_FLOW_BUILDER.md`

### Passo 4: Usar na Página de Configuração

```jsx
import FlowBuilder from '@/components/FlowBuilder';
import { useFlowBuilder } from '@/hooks/useFlowBuilder';

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

### Passo 5: Testar!

1. Reinicie o backend
2. Abra a página de configuração
3. Adicione alguns passos
4. Arraste para reordenar
5. Veja o prompt sendo gerado automaticamente

---

## 🎯 Tipos de ação (editor atual)

Ver tabela completa em **`FLOW_BUILDER_GUIA.md`**. Resumo: `agent_profile`, `audio_config`, `collect_data`, `show_catalog`, `process_order`, `send_confirmation`, `create_appointment`, `custom`.

---

## 💡 Exemplo de fluxo (vendas)

Ordem típica gerada pelo **assistente guiado** “Vendas completas”:

1. **Perfil do agente** — identidade e tom  
2. *(Opcional)* **Áudio** — respostas em áudio  
3. **Catálogo** — produtos/serviços  
4. **Pedido e pagamento** — Stripe ou manual  
5. **CRM** — dados do cliente  
6. **Confirmação** — resumo final  

---

## 📊 Estrutura de dados (Step)

```typescript
{
  id: number;
  type: string; // ex.: 'show_catalog', 'process_order'
  title: string;
  description?: string;
  condition?: string | null;
  actions?: any[];
  // campos extra conforme o tipo (catalogSettings, paymentSettings, etc.)
}
```

### Exemplo (`agent_profile`)

```javascript
{
  id: 1698765432,
  type: 'agent_profile',
  title: 'Perfil do Agente',
  description: 'Regras extras de personalidade.',
  agentName: 'Sofia',
  agentRole: 'Consultora',
  agentTone: 'friendly',
  agentStyle: 'concise',
  condition: null,
  actions: []
}
```

---

## 🔄 Conversão automática (Steps → Prompt)

`convertStepsToPrompt` / `compilePrompt` geram um **prompt executável** em texto (seções IDENTIDADE, REGRAS ABSOLUTAS, PASSOS, PROIBIÇÕES), não o formato antigo em Markdown com `## 1.`.

### Prompt → Steps

Também converte prompts antigos em steps (importação automática)!

---

## 🎨 Benefícios

### Para o Usuário:

- ✅ **Interface Visual:** Muito mais fácil de entender
- ✅ **Drag & Drop:** Reordenar com um arrastar
- ✅ **Tipos Pré-definidos:** Ações comuns prontas
- ✅ **Preview em Tempo Real:** Vê o prompt sendo gerado
- ✅ **Sem Erros de Sintaxe:** Interface previne erros

### Para o Desenvolvedor:

- ✅ **Código Organizado:** Steps estruturados
- ✅ **Fácil de Validar:** Dados tipados
- ✅ **Fácil de Estender:** Adicionar novos tipos
- ✅ **Conversão Bidirecional:** Steps ↔ Prompt
- ✅ **Retrocompatível:** Importa prompts antigos

---

## 📚 Documentação

### Guia Completo
Veja `FLOW_BUILDER_GUIA.md` para:
- Exemplos detalhados
- Como personalizar
- Troubleshooting
- API completa

### Código Backend
Veja `backend/ENDPOINTS_FLOW_BUILDER.md` para:
- Endpoints prontos
- Como testar
- Funções auxiliares

---

## 🎯 Próximos Passos

1. **Implementar os 5 passos acima**
2. **Testar localmente**
3. **Migrar prompts antigos para steps**
4. **Fazer deploy**
5. **Colher feedback dos usuários**

---

## 💪 Melhorias Futuras (Opcional)

- 🔄 Adicionar condicionais visuais (if/else)
- 🔗 Adicionar conexões entre steps
- 📊 Adicionar analytics de uso
- 🎨 Adicionar templates prontos
- 🌐 Adicionar internacionalização
- 💾 Adicionar versionamento de fluxos

---

## ✅ Checklist de Implementação

- [ ] Instalar dependências (`@hello-pangea/dnd`, `lucide-react`)
- [ ] Copiar `FlowBuilder.jsx` para `components/`
- [ ] Copiar `useFlowBuilder.js` para `hooks/`
- [ ] Adicionar endpoints no `backend/server.js`
- [ ] Reiniciar backend
- [ ] Integrar na página de configuração
- [ ] Testar adicionando steps
- [ ] Testar reordenação
- [ ] Testar edição
- [ ] Testar remoção
- [ ] Testar preview do prompt
- [ ] Testar salvamento
- [ ] Testar carregamento
- [ ] Deploy em produção

---

## 🎉 Resultado Final

Você terá uma interface visual moderna e intuitiva que:

1. ✅ **Facilita a configuração** do agente para usuários não técnicos
2. ✅ **Reduz erros** de sintaxe no prompt
3. ✅ **Aumenta produtividade** na criação de fluxos
4. ✅ **Melhora a experiência** do usuário
5. ✅ **Mantém flexibilidade** para casos personalizados

---

**Pronto para revolucionar a experiência de configuração do seu sistema! 🚀**

Se precisar de ajuda na implementação, consulte:
- 📖 `FLOW_BUILDER_GUIA.md` - Guia completo
- 🔧 `backend/ENDPOINTS_FLOW_BUILDER.md` - Código backend
- 💻 Comentários nos arquivos de código

