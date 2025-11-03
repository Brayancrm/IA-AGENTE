# 🧪 Como Testar o Sistema de Assinaturas

## ✅ O Que Foi Implementado

1. ✅ **Gerenciamento de Planos** - Criar, editar, excluir planos
2. ✅ **Interface de Assinatura** - Usuários podem assinar planos
3. ✅ **Integração com Asaas** - Criação automática de assinaturas
4. ✅ **Webhook Configurado** - Renovação automática de pagamentos
5. ✅ **Controle de Limites** - Bloqueio quando excede limite
6. ✅ **Dashboard de Uso** - Visualização em tempo real

---

## 🧪 Teste Completo

### 1️⃣ **Criar um Plano de Teste**

1. Acesse: https://ia-agente.vercel.app
2. Faça login como master
3. Vá em **"💎 Planos e Assinaturas"**
4. Clique em **"Criar Novo Plano"**
5. Preencha:
   - Nome: `Plano Teste`
   - Descrição: `Plano para testes`
   - Preço: `29.90`
   - Periodicidade: `Mensal`
   - Ativo: ✅ Marcado
   - Limites:
     - Mensagens/mês: `1000`
     - Conversas: `Ilimitado`
     - Catálogo: `Ilimitado`
6. Clique em **"Salvar"**

---

### 2️⃣ **Assinar o Plano (Usuário Não-Master)**

**Opção A: Criar novo usuário**
1. Faça logout
2. Crie uma conta nova (email diferente)
3. Faça login

**Opção B: Testar com usuário existente (sem ser master)**
1. Use um email que NÃO seja `brayan@master.com`
2. Faça login

3. Vá em **"💎 Planos e Assinaturas"**
4. Você verá apenas planos ativos
5. Clique em **"Assinar Plano"** no "Plano Teste"
6. O sistema vai:
   - Buscar/criar cliente no Asaas
   - Criar assinatura no Asaas
   - Salvar no Firebase
   - Mostrar toast de sucesso

---

### 3️⃣ **Verificar Assinatura Criada**

**No Asaas:**
1. Acesse: https://asaas.com
2. Vá em **Clientes** → Procure pelo email do usuário
3. Vá em **Assinaturas** → Você verá a assinatura criada

**No Firebase:**
1. Acesse: https://console.firebase.google.com
2. Vá em **Realtime Database**
3. Navegue: `subscriptions/{userId}`
4. Verifique:
   - `planId`, `planName`
   - `asaasSubscriptionId`
   - `status: 'active'`
   - `value`, `cycle`

**No Sistema:**
1. Dashboard → Card "💎 Meu Plano Ativo"
2. Você verá:
   - Nome do plano
   - Uso atual: `0 / 1000`
   - Próxima cobrança

---

### 4️⃣ **Simular Pagamento (Ambiente Sandbox)**

**IMPORTANTE:** Use ambiente sandbox do Asaas para testes!

1. No Asaas, vá na assinatura criada
2. Clique em **"Simular Pagamento"** ou **"Pagar"**
3. Use cartão de teste:
   - Número: `4111111111111111`
   - CVV: `123`
   - Validade: qualquer data futura
4. Confirme o pagamento

---

### 5️⃣ **Verificar Webhook Recebido**

**No Railway:**
1. Acesse: https://railway.app
2. Vá em seu projeto → **Deployments** → **Logs**
3. Procure por:
   ```
   📬 Webhook Asaas recebido
   💎 Pagamento relacionado a assinatura detectado!
   ✅ Assinatura renovada! Próxima cobrança: ...
   ```

**No Firebase:**
1. Verifique `subscriptions/{userId}/{key}`:
   - `lastPayment`, `lastPaymentDate` atualizados
   - `nextDueDate` atualizado (30 dias à frente)
   - `status: 'ACTIVE'`

2. Verifique `users/data/{userId}/activePlan`:
   - `nextDueDate` atualizado

---

### 6️⃣ **Testar Limite de Mensagens**

**Bloqueio por Limite:**
1. Faça login como usuário não-master com plano ativo
2. Vá em **WhatsApp** → Conecte (se não estiver)
3. Envie mensagens pelo WhatsApp até atingir o limite
4. Ao enviar mensagem que ultrapassa o limite:
   - ❌ Mensagem será bloqueada
   - 📢 Receberá notificação: "Seu plano atingiu o limite..."

**Dashboard mostra uso:**
1. Verifique card "💎 Meu Plano Ativo"
2. Uso deve mostrar: `1000 / 1000`
3. Quando limite atingido, barra vermelha

---

### 7️⃣ **Testar Cancelamento**

**No Asaas:**
1. Vá em **Assinaturas**
2. Selecione a assinatura de teste
3. Clique em **"Cancelar"**
4. Confirme

**Webhook será disparado:**
1. Verifique logs do Railway
2. Procure por:
   ```
   💎 Evento de ASSINATURA recebido: SUBSCRIPTION_CANCELLED
   ⚠️ Assinatura cancelada. Desativando plano do usuário...
   ✅ Plano desativado
   ```

**No Firebase:**
1. Verifique `users/data/{userId}/activePlan`:
   - Deve ser `null`

**No Sistema:**
1. Dashboard mostra card:
   ```
   ⚠️ Nenhum Plano Ativo
   Contrate um plano para usar todas as funcionalidades
   ```

---

## 🎯 Checklist de Funcionalidades

### Para Admin (Master):
- [ ] Criar plano
- [ ] Editar plano
- [ ] Excluir plano
- [ ] Ver todos os planos (ativos e inativos)
- [ ] Marcar plano como ativo/inativo

### Para Usuário:
- [ ] Ver apenas planos ativos
- [ ] Assinar plano
- [ ] Ver card "Meu Plano Ativo" no dashboard
- [ ] Ver uso em tempo real
- [ ] Bloquear quando atingir limite

### Webhook:
- [ ] Evento de assinatura criada chega no backend
- [ ] Evento de pagamento renovando assinatura
- [ ] Evento de cancelamento desativando plano
- [ ] Próxima cobrança sendo atualizada automaticamente

### Limites:
- [ ] Mensagens bloqueadas quando limite atingido
- [ ] Contador incrementando a cada mensagem
- [ ] Dashboard mostrando uso atual

---

## ⚠️ Problemas Comuns

### Webhook não recebe eventos

**Verificar:**
1. URL correta: `https://ia-agente-production.up.railway.app/api/asaas/webhook`
2. Backend rodando
3. Eventos marcados no Asaas
4. Logs do Railway

### Assinatura não renova automaticamente

**Verificar:**
1. Webhook configurado corretamente
2. Eventos de PAYMENT marcados
3. `payment.subscription` está chegando no webhook
4. Logs mostram "Pagamento relacionado a assinatura detectado"

### Limite não funciona

**Verificar:**
1. Plano tem limites definidos
2. `activePlan` existe no Firebase
3. Backend está verificando limites em `handleIncomingMessage`
4. Logs mostram "Mensagem bloqueada por limite do plano"

---

## 📊 Onde Ver os Dados

| Onde | O Que Ver |
|------|-----------|
| **Firebase → Realtime Database** | `plans/`, `subscriptions/`, `users/data/{userId}/activePlan` |
| **Firebase → Realtime Database** | `users/data/{userId}/messagesUsage/` |
| **Asaas → Clientes** | Clientes criados automaticamente |
| **Asaas → Assinaturas** | Assinaturas ativas |
| **Railway → Logs** | Webhooks recebidos, renovações |
| **Sistema → Dashboard** | Card "Meu Plano Ativo" |

---

## ✅ Pronto!

Agora seu sistema de assinaturas está completo e funcional!

Se algo não funcionar, verifique os logs do Railway primeiro. Eles mostram o que está acontecendo em tempo real.

