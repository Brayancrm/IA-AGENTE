# 📋 Configuração do Webhook Asaas - Guia Completo

## ✅ URL do Webhook

```
https://ia-agente-production.up.railway.app/api/asaas/webhook
```

**IMPORTANTE:** 
- ✅ Use HTTPS (não HTTP)
- ✅ Inclua o caminho completo `/api/asaas/webhook`
- ✅ Não adicione `/` no final

---

## 📌 Eventos Necessários

Marque os seguintes eventos:

### 🟢 Seção "Assinaturas" (SUBSCRIPTION Events):

Marque TODOS os eventos disponíveis nesta seção:

1. ✅ **`SUBSCRIPTION_CREATED`** - Quando uma nova assinatura é criada
2. ✅ **`SUBSCRIPTION_UPDATED`** - Quando a assinatura é atualizada
3. ✅ **`SUBSCRIPTION_DELETED`** - Quando a assinatura é removida
4. ✅ **`SUBSCRIPTION_INACTIVATED`** - Quando a assinatura é inativada (se disponível)
5. ✅ **`SUBSCRIPTION_SPLIT_*`** - Qualquer evento relacionado a split (se disponível)

**NOTA:** O Asaas pode não ter eventos como `SUBSCRIPTION_ACTIVATED` ou `SUBSCRIPTION_PAYMENT` na interface. Isso é normal!

### 🔴 Seção "Cobranças" (PAYMENT Events) - OBRIGATÓRIO!

**MUITO IMPORTANTE:** Você DEVE marcar os eventos de pagamento também:

1. ✅ **`PAYMENT_CREATED`** - Geração de nova cobrança
2. ✅ **`PAYMENT_CONFIRMED`** - Cobrança confirmada
3. ✅ **`PAYMENT_RECEIVED`** - Cobrança recebida
4. ✅ **`PAYMENT_OVERDUE`** - Pagamento vencido
5. ✅ **`PAYMENT_DELETED`** - Pagamento excluído
6. ✅ **`PAYMENT_UPDATED`** - Alteração no pagamento

**Por quê?** Os pagamentos de assinatura são enviados como eventos de `PAYMENT`, não `SUBSCRIPTION_PAYMENT`!

### 🟡 OPCIONAIS (recomendados):

7. ✅ **`INVOICE_*`** - Eventos de nota fiscal, se você quiser emitir NFs automaticamente

---

## 🔧 Como Configurar

### Passo 1: URL do Webhook

1. No campo **"URL do Webhook"**, cole:
   ```
   https://ia-agente-production.up.railway.app/api/asaas/webhook
   ```

### Passo 2: Eventos de Assinatura

1. Na seção **"Adicionar Eventos"** → **"Assinaturas"**
2. Marque TODOS os eventos listados acima (obrigatórios)
3. Clique em "Selecionar Todos" se disponível

### Passo 3: Outras Configurações

- **Este Webhook ficará ativo?** → ✅ Sim
- **Versão da API** → v3 (ou a mais recente)
- **Fila de sincronização ativada?** → ✅ Sim (recomendado)
- **Tipo de envio** → Sequencial (recomendado)

### Passo 4: Salvar

1. Clique em **"Salvar"** ou **"Criar Webhook"**
2. O Asaas irá testar a URL automaticamente

---

## ✅ Checklist Final

Antes de salvar, verifique:

- [ ] URL completa: `https://ia-agente-production.up.railway.app/api/asaas/webhook`
- [ ] SUBSCRIPTION_CREATED marcado
- [ ] SUBSCRIPTION_UPDATED marcado
- [ ] SUBSCRIPTION_DELETED marcado
- [ ] SUBSCRIPTION_ACTIVATED marcado (se disponível)
- [ ] SUBSCRIPTION_CANCELLED/CANCELED marcado (se disponível)
- [ ] SUBSCRIPTION_PAYMENT marcado (se disponível)
- [ ] Webhook está ativo (Sim)
- [ ] Fila de sincronização ativada (Sim)

---

## 🧪 Como Testar

Após configurar:

1. **Crie uma assinatura de teste** no sistema
2. **Verifique os logs do Railway:**
   - Acesse: https://railway.app
   - Vá em seu projeto → Deployments → Logs
   - Procure por: `📬 Webhook Asaas recebido`
   - Ou: `💎 Evento de ASSINATURA recebido`

3. **Verifique no Firebase:**
   - A assinatura deve aparecer em `subscriptions/{userId}`
   - O `activePlan` deve ser atualizado em `users/data/{userId}/activePlan`

---

## ⚠️ Problemas Comuns

### Webhook não recebe eventos

**Solução:**
1. Verifique se a URL está correta (sem espaços, com HTTPS)
2. Verifique se o backend está rodando (https://ia-agente-production.up.railway.app)
3. Verifique os logs do Railway para ver se há erros

### Eventos não estão sendo processados

**Solução:**
1. Verifique se todos os eventos obrigatórios estão marcados
2. Verifique os logs do backend para ver qual evento chegou
3. Certifique-se de que o `externalReference` está no formato correto: `subscription_{userId}_{planId}`

---

## 📞 Suporte

Se algo não funcionar:
1. Verifique os logs do Railway
2. Verifique os logs do Firebase Console
3. Teste manualmente fazendo uma assinatura

