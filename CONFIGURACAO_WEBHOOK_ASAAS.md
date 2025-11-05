# 🔧 Configuração de Webhook Asaas - Campos Necessários

## 📋 Eventos que DEVEM estar selecionados no Webhook

### ✅ Eventos de Pagamento (Cobranças) - **CRÍTICOS**

Estes eventos são essenciais para que o sistema ative o plano após o pagamento:

1. **`PAYMENT_RECEIVED`** ✅ **OBRIGATÓRIO**
   - Descrição: "Cobrança recebida"
   - Quando dispara: Quando o pagamento é efetivamente recebido pelo Asaas
   - **Este é o evento mais importante para ativação de planos**

2. **`PAYMENT_CONFIRMED`** ✅ **OBRIGATÓRIO**
   - Descrição: "Cobrança confirmada (pagamento efetuado, porém o saldo ainda não foi disponibilizado)"
   - Quando dispara: Quando o pagamento é confirmado (especialmente para boletos)
   - **Importante para métodos de pagamento que requerem confirmação**

3. **`PAYMENT_CREATED`** ⚠️ **OPCIONAL** (mas recomendado)
   - Descrição: "Geração de nova cobrança"
   - Quando dispara: Quando uma cobrança é criada
   - Útil para rastreamento, mas não ativa o plano

4. **`PAYMENT_UPDATED`** ⚠️ **OPCIONAL** (mas recomendado)
   - Descrição: "Alteração no vencimento ou valor de cobrança existente"
   - Quando dispara: Quando uma cobrança é atualizada
   - Útil para rastreamento, mas não ativa o plano

5. **`PAYMENT_OVERDUE`** ⚠️ **OPCIONAL**
   - Descrição: "Cobrança vencida"
   - Quando dispara: Quando uma cobrança passa do vencimento
   - Útil para gerenciar inadimplência

### ✅ Eventos de Assinatura - **RECOMENDADOS**

Estes eventos ajudam no rastreamento, mas não são críticos para ativação:

1. **`SUBSCRIPTION_CREATED`** ✅ **RECOMENDADO**
   - Descrição: "Geração de nova assinatura"
   - Quando dispara: Quando uma assinatura é criada no Asaas

2. **`SUBSCRIPTION_UPDATED`** ✅ **RECOMENDADO**
   - Descrição: "Alteração na assinatura"
   - Quando dispara: Quando uma assinatura é atualizada

3. **`SUBSCRIPTION_DELETED`** ✅ **RECOMENDADO**
   - Descrição: "Assinatura removida"
   - Quando dispara: Quando uma assinatura é cancelada

---

## 🔑 Campos que DEVEM estar incluídos no Payload do Webhook

Quando você configura o webhook no Asaas, certifique-se de que os seguintes campos estão incluídos no JSON enviado:

### Para eventos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`:

**Objeto `payment` (obrigatório):**
- ✅ `id` - ID único do pagamento no Asaas (usado como `lastPayment`)
- ✅ `status` - Status do pagamento (`RECEIVED`, `CONFIRMED`, `PENDING`, etc.)
- ✅ `value` - Valor total do pagamento
- ✅ `paymentDate` - Data de processamento do pagamento (usado como `lastPaymentDate`)
- ✅ `confirmedDate` - Data de confirmação do pagamento (usado como `lastPaymentDate` se `paymentDate` não estiver disponível)
- ✅ `dateCreated` - Data de criação do pagamento
- ✅ `subscription` - **CRÍTICO**: ID da assinatura vinculada ao pagamento
- ✅ `customer` - ID do cliente
- ✅ `invoiceUrl` - URL da fatura

**Campos do nível superior:**
- ✅ `event` - Tipo do evento (`PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, etc.)

---

## 🚨 IMPORTANTE: Validação no Backend

O backend **só ativa o plano** quando:

1. ✅ O evento é `PAYMENT_RECEIVED` **OU** `PAYMENT_CONFIRMED`
2. ✅ O `payment.status` é `RECEIVED`, `CONFIRMED` ou `RECEIVED_IN_CASH`
3. ✅ O `payment.subscription` existe (vincula o pagamento à assinatura)
4. ✅ O `payment.paymentDate` **OU** `payment.confirmedDate` existe

**Se qualquer uma dessas condições não for atendida, o plano NÃO será ativado.**

---

## 📍 URL do Webhook

Configure o webhook para apontar para:

```
https://seu-backend-url.com/api/asaas/webhook
```

**Exemplo para produção:**
```
https://seu-backend.railway.app/api/asaas/webhook
```

**Exemplo para desenvolvimento local (usando ngrok):**
```
https://seu-ngrok-url.ngrok.io/api/asaas/webhook
```

---

## ✅ Checklist de Configuração

- [ ] `PAYMENT_RECEIVED` está selecionado
- [ ] `PAYMENT_CONFIRMED` está selecionado
- [ ] URL do webhook está configurada corretamente
- [ ] O payload inclui todos os campos obrigatórios (`payment.id`, `payment.subscription`, `payment.paymentDate`, etc.)
- [ ] O webhook está configurado para o ambiente correto (produção ou sandbox)
- [ ] Testou o webhook após fazer um pagamento de teste

---

## 🐛 Troubleshooting

### O plano não está sendo ativado após o pagamento?

1. **Verifique os logs do backend:**
   - Procure por "💎 Pagamento relacionado a assinatura detectado!"
   - Procure por "✅ Pagamento CONFIRMADO! Processando ativação do plano..."
   - Se não aparecer, o webhook pode não estar chegando ou sendo processado

2. **Verifique o Firebase:**
   - Acesse `subscriptions/{userId}/{subscriptionId}`
   - Verifique se `lastPayment` e `lastPaymentDate` foram preenchidos
   - Verifique se `status` está como `ACTIVE`

3. **Verifique o console do navegador:**
   - Procure por "🔍 ========== VERIFICAÇÃO DE PAGAMENTO =========="
   - Veja os valores de `LastPayment` e `LastPaymentDate`
   - Se estiverem `undefined`, o webhook pode não ter processado corretamente

4. **Teste o webhook manualmente:**
   - Use a ferramenta de teste do Asaas
   - Envie um evento `PAYMENT_RECEIVED` simulado
   - Verifique se o backend responde corretamente

---

## 📞 Suporte

Se mesmo após seguir este guia o problema persistir, verifique:
- Logs do backend para erros específicos
- Status do webhook no painel do Asaas
- Configuração da URL do webhook
- Campos incluídos no payload do webhook
