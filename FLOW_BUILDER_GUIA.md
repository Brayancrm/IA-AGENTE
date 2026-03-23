# 🎯 Flow Builder & Assistente guiado — Guia

## O que mudou?

1. **Assistente guiado** (`AssistantSetupWizard.jsx`): modo recomendado para a maioria dos clientes — modelos de jornada (vendas, agendamentos, catálogo+leads, mínimo), passos separados por **Negócio**, **CRM** e **Tom de voz**, e **resumo** antes de aplicar o fluxo.
2. **Modo avançado**: o **Flow Builder** completo (`FlowBuilder.jsx`) — arrastar passos, condições, editor detalhado por tipo de ação.

A preferência de interface (`configUiMode`: `simple` | `advanced`) é guardada em `assistant_settings` no Firebase.

### Abordagens fixas (modo guiado)

- Campo `fixedApproaches` (array) em `assistant_settings`: cada item tem `placement` (tipo de passo alvo, ex. `show_catalog`) e `instruction` (texto obrigatório).
- Ao **Gerar fluxo e aplicar**, o sistema chama `applyFixedApproachesToSteps` e injeta blocos `--- ABORDAGEM FIXA (NÃO ALTERAR) ---` nas `description` dos passos correspondentes, para o `compilePrompt` tratar como regra fixa.

---

## Tipos de ação (fonte de verdade: `FlowBuilder.jsx`)

| Valor `type` | Ícone | Descrição |
|--------------|-------|-----------|
| `agent_profile` | 🤖 | Nome, função, tom e estilo do agente |
| `audio_config` | 🎤 | Respostas em áudio (idioma/voz) |
| `collect_data` | 📋 | Coleta de dados para CRM |
| `show_catalog` | 📦 | Mostrar produtos/serviços do catálogo |
| `process_order` | 🛒 | Pedido e integração de pagamento |
| `send_confirmation` | ✅ | Mensagem de confirmação final |
| `create_appointment` | 📅 | Criar agendamentos |
| `custom` | ⚙️ | Instruções personalizadas |

> **Nota:** tipos antigos como `greeting`, `ask_info`, `request_payment` podem aparecer em documentação legada ou em prompts importados; o editor visual atual usa apenas os tipos da tabela acima.

---

## Componentes

### `AssistantSetupWizard.jsx`
- Passos: **Modelo** → **Negócio** → **CRM** → **Tom de voz** → **Resumo**
- Gera `flowSteps` via `buildFlowStepsFromWizardState` em `utils/assistantWizardHelpers.js`
- **Gerar fluxo e aplicar ao rascunho** atualiza o formulário; **Salvar configurações do assistente** persiste no Firebase

### `FlowBuilder.jsx`
- Lista visual de passos, drag-and-drop, edição por tipo de ação, melhoria de prompt com IA (quando disponível)

### `hooks/useFlowBuilder.js`
- `compilePrompt` / `convertStepsToPrompt`: compilam os steps num prompt executável para o modelo de IA

---

## Estrutura mínima de um `step`

```typescript
interface Step {
  id: number;
  type: string; // ver tabela acima
  title: string;
  description?: string;
  condition?: string | null;
  actions?: any[];
  catalogSettings?: object;      // show_catalog
  paymentSettings?: object;      // process_order
  appointmentEnabled?: boolean;  // create_appointment
  appointmentTypes?: string[];
  crmAutoSave?: boolean;         // collect_data
  crmFields?: string[];
  customQuestions?: Array<{ question: string; required?: boolean }>;
  // agent_profile: agentName, agentRole, agentTone, agentStyle
  // audio_config: audioLanguage, audioVoice
}
```

---

## Dependências

```bash
npm install @hello-pangea/dnd lucide-react
```

---

## Exemplo de uso do Flow Builder (modo avançado)

```jsx
import FlowBuilder from '@/components/FlowBuilder';

<FlowBuilder
  initialSteps={flowSteps}
  catalogItems={catalogItems}
  agendamentos={agendamentos}
  onChange={setSteps}
  onSave={handleSave}
/>
```

---

## Fluxo típico para o utilizador final

1. Abrir **Configuração do Assistente**
2. Escolher **Assistente guiado** e um **modelo**
3. Preencher negócio (catálogo, pagamento, áudio…) e CRM
4. No **Resumo**, clicar em **Gerar fluxo e aplicar ao rascunho**
5. Clicar em **Salvar configurações do assistente**
6. (Opcional) mudar para **Modo avançado** para afinar passos ou condições
