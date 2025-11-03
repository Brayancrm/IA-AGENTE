# 🎉 Sistema de Assinaturas - Resumo Completo

## ✅ Status: IMPLEMENTADO E PRONTO PARA USO!

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                         │
│  https://ia-agente.vercel.app                                │
│                                                              │
│  - React + Next.js                                          │
│  - Firebase Auth + Realtime Database                        │
│  - Interface de gerenciamento de planos                     │
│  - Interface de assinatura para usuários                    │
│  - Dashboard mostrando uso em tempo real                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ fetch(BACKEND_URL)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Railway)                          │
│  https://ia-agente-production.up.railway.app                │
│                                                              │
│  - Node.js + Express                                        │
│  - WhatsApp Integration (WPPConnect)                        │
│  - Asaas API Integration                                    │
│  - Webhook endpoint: /api/asaas/webhook                    │
│  - Controle de limites em tempo real                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ API Calls / Webhook
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     Asaas (Pagamentos)                       │
│  https://asaas.com                                           │
│                                                              │
│  - Gestão de clientes                                       │
│  - Assinaturas recorrentes                                  │
│  - Webhook para notificações                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              FIREBASE REALTIME DATABASE                      │
│  https://ia-agente-b2f46.firebaseio.com                     │
│                                                              │
│  Estrutura:                                                 │
│  ├── plans/                    # Planos disponíveis        │
│  ├── subscriptions/            # Assinaturas ativas         │
│  ├── users/data/{userId}/      # Dados dos usuários        │
│  │   ├── activePlan            # Plano ativo               │
│  │   └── messagesUsage/        # Contadores de uso         │
│  └── whatsapp_sessions/        # Sessões WhatsApp          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Estrutura de Dados

### Planos (`plans/{planId}`)
```json
{
  "name": "Plano Básico",
  "description": "Ideal para pequenas empresas",
  "price": 99.90,
  "billingCycle": "monthly",
  "active": true,
  "limits": {
    "messagesPerMonth": 1000,
    "conversations": null,
    "catalogItems": null,
    "integrations": []
  },
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### Assinaturas (`subscriptions/{userId}/{subscriptionId}`)
```json
{
  "subscriptionId": "abc123",
  "asaasSubscriptionId": "sub_xyz789",
  "planId": "planId123",
  "planName": "Plano Básico",
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "+5511999999999"
  },
  "value": 99.90,
  "cycle": "MONTHLY",
  "status": "ACTIVE",
  "nextDueDate": "2024-02-15",
  "lastPayment": "pay_123",
  "lastPaymentDate": "2024-01-15T00:00:00Z",
  "paymentUrl": "https://www.asaas.com/pay/...",
  "limits": {
    "messagesPerMonth": 1000,
    "conversations": null,
    "catalogItems": null
  },
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### Plano Ativo do Usuário (`users/data/{userId}/activePlan`)
```json
{
  "planId": "planId123",
  "planName": "Plano Básico",
  "subscriptionId": "abc123",
  "asaasSubscriptionId": "sub_xyz789",
  "startedAt": "2024-01-15T10:00:00Z",
  "nextDueDate": "2024-02-15",
  "limits": {
    "messagesPerMonth": 1000,
    "conversations": null,
    "catalogItems": null
  }
}
```

### Uso de Mensagens (`users/data/{userId}/messagesUsage/{monthKey}`)
```json
{
  "2024-01": 450,
  "2024-02": 0
}
```

---

## 🔄 Fluxos Principais

### 1. Criação de Plano (Admin)

```
Admin → Acessa "Planos e Assinaturas"
      → Clica "Criar Novo Plano"
      → Preenche dados (nome, preço, limites)
      → Salva
      
Backend → Recebe dados
         → Salva em `plans/{planId}`
         → Retorna sucesso

Frontend → Mostra toast "Plano criado com sucesso"
         → Atualiza lista de planos
```

### 2. Assinatura de Plano (Usuário)

```
Usuário → Acessa "Planos e Assinaturas"
        → Vê apenas planos ativos
        → Clica "Assinar Plano"
        
Frontend → Chama `/api/asaas/create-subscription`
        
Backend → Busca/busca cliente no Asaas
         → Cria assinatura no Asaas
         → Salva em `subscriptions/{userId}`
         → Atualiza `users/data/{userId}/activePlan`
         
Asaas → Retorna link de pagamento

Frontend → Mostra toast "Assinatura criada"
         → Usuário pode clicar no link para pagar
```

### 3. Renovação Automática (Webhook)

```
Cliente → Paga assinatura mensal no Asaas

Asaas → Envia webhook PAYMENT_RECEIVED
      → Endpoint: /api/asaas/webhook

Backend → Detecta `payment.subscription`
         → Busca assinatura no Firebase
         → Atualiza `lastPayment`, `lastPaymentDate`
         → Calcula novo `nextDueDate`
         → Atualiza `activePlan`
         
Frontend → (Automaticamente) Usuário vê nova data
         → Contador de uso é resetado
```

### 4. Bloqueio por Limite

```
Cliente → Envia mensagem via WhatsApp

Backend → `handleIncomingMessage()` executado
         → Verifica `checkPlanLimits(userId, 'messagesPerMonth')`
         
CheckLimits → Busca `activePlan`
             → Calcula uso atual
             → Compara com limite
             → Retorna: allowed: true/false

Se NÃO permitido:
  Backend → Envia mensagem de bloqueio
           → Registra no log
           → Retorna sem processar

Se permitido:
  Backend → Gera resposta com IA
           → Envia mensagem
           → `incrementMessageUsage(userId)`
           → Registra uso no Firebase
```

---

## 🌐 Endpoints do Backend

### GET `/api/user/plan/:userId`
Retorna plano ativo e uso atual do usuário.

**Resposta:**
```json
{
  "plan": {
    "planId": "planId123",
    "planName": "Plano Básico",
    "nextDueDate": "2024-02-15",
    "limits": {
      "messagesPerMonth": 1000
    }
  },
  "usage": {
    "messagesPerMonth": {
      "used": 450,
      "limit": 1000,
      "percentage": 45
    }
  }
}
```

### POST `/api/asaas/create-subscription`
Cria assinatura no Asaas e no Firebase.

**Request:**
```json
{
  "userId": "user123",
  "customerData": {
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "+5511999999999"
  },
  "planData": {
    "id": "planId123",
    "name": "Plano Básico",
    "price": 99.90,
    "billingCycle": "monthly",
    "limits": {
      "messagesPerMonth": 1000
    }
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "subscriptionId": "abc123",
  "invoiceUrl": "https://www.asaas.com/pay/...",
  "value": 99.90,
  "cycle": "MONTHLY",
  "nextDueDate": "2024-02-15"
}
```

### POST `/api/asaas/webhook`
Recebe notificações do Asaas.

**Eventos de Assinatura:**
- `SUBSCRIPTION_CREATED`
- `SUBSCRIPTION_UPDATED`
- `SUBSCRIPTION_DELETED`
- `SUBSCRIPTION_CANCELLED`
- Outros...

**Eventos de Pagamento (Assinaturas):**
- `PAYMENT_RECEIVED` (com `payment.subscription`)
- `PAYMENT_CONFIRMED`

---

## 🔒 Controle de Acesso

### Master (`brayan@master.com`)
- ✅ Pode criar/editar/excluir planos
- ✅ Vê TODOS os planos (ativos e inativos)
- ✅ Acesso ilimitado (sem verificação de limites)
- ✅ Acesso completo ao sistema

### Usuários Normais
- ❌ Não pode criar/editar planos
- ✅ Vê APENAS planos ativos
- ✅ Pode assinar planos
- ❌ Bloqueado quando atingir limite
- ❌ Sistema bloqueado se não tiver plano ativo

---

## 📱 Interface do Usuário

### Dashboard
```
┌─────────────────────────────────────────┐
│  💎 Meu Plano Ativo                     │
│  Plano Básico                           │
│                                         │
│  Uso Mensal: 450 / 1000                │
│  Próxima cobrança: 15/02/2024          │
└─────────────────────────────────────────┘
```

### Lista de Planos (Não-Master)
```
┌─────────────────────────────────────────┐
│  💎 Plano Básico                        │
│  Ideal para pequenas empresas           │
│                                         │
│  R$ 99,90 / mês                        │
│                                         │
│  📨 1000 mensagens/mês                │
│  💬 Conversas ilimitadas               │
│  📦 Catálogo ilimitado                 │
│                                         │
│  [Assinar Plano]                       │
└─────────────────────────────────────────┘
```

---

## 🧪 Como Testar

1. **Criar plano de teste**
2. **Assinar com usuário não-master**
3. **Simular pagamento no Asaas**
4. **Verificar renovação automática**
5. **Testar bloqueio por limite**

📖 Guia completo: `TESTE_ASSINATURA.md`

---

## 📚 Documentação

- **`CONFIGURACAO_WEBHOOK_ASAAS.md`** - Como configurar webhook
- **`TESTE_ASSINATURA.md`** - Passo a passo para testar
- **`DEPLOY_BACKEND.md`** - Como fazer deploy do backend
- **`CONFIGURACAO_VERCEL.md`** - Como configurar frontend

---

## 🚀 URLs de Produção

| Serviço | URL |
|---------|-----|
| **Frontend** | https://ia-agente.vercel.app |
| **Backend** | https://ia-agente-production.up.railway.app |
| **Webhook** | https://ia-agente-production.up.railway.app/api/asaas/webhook |
| **Firebase** | https://console.firebase.google.com/project/ia-agente-b2f46 |
| **Asaas** | https://asaas.com |

---

## ⚙️ Variáveis de Ambiente

### Frontend (Vercel)
```
NEXT_PUBLIC_BACKEND_URL=https://ia-agente-production.up.railway.app
```

### Backend (Railway)
```
PORT=3001
NODE_ENV=production
SERVICE_ACCOUNT_KEY={firebase service account JSON}
ASAAS_API_KEY={sua chave do Asaas}
```

---

## 🎯 Próximos Passos (Opcional)

- [ ] Notificações por email de renovação
- [ ] Histórico de pagamentos no dashboard
- [ ] Relatórios de uso por período
- [ ] Upgrades/Downgrades de planos
- [ ] Trial gratuito
- [ ] Cupons de desconto
- [ ] Pagamento via cartão direto no sistema

---

## ✅ Status Final

**Sistema 100% funcional e pronto para produção!**

🎉 Todas as funcionalidades implementadas, testadas e documentadas!

