# 🧪 Como Testar o Novo Fluxo de Nota Fiscal

## 📋 Pré-requisitos

✅ Backend rodando (porta 3001)  
✅ WhatsApp conectado  
✅ API Key do Asaas configurada  
✅ Emissão de NF habilitada (`fiscalEnabled: true`)  
✅ Pelo menos 1 produto cadastrado

---

## 🚀 Teste Completo - Passo a Passo

### **1. Reinicie o Backend** 🔄

```bash
cd backend
npm start
```

Ou se estiver rodando com PM2:
```bash
pm2 restart server
pm2 logs server
```

### **2. Faça um Pedido de Teste** 🛒

No WhatsApp, envie para o número conectado:

```
Cliente: Oi
Agente: [responde]

Cliente: Quero comprar TESTE 9
Agente: [confirma produto e pede quantidade]

Cliente: 1
Agente: [pede nome]

Cliente: João Teste
Agente: [pede email]

Cliente: joao@teste.com
Agente: [pede CPF]

Cliente: 12345678900
Agente: [envia link de pagamento]
```

### **3. Pague no Asaas** 💳

1. Abra o link de pagamento
2. Escolha **PIX** (aprovação instantânea)
3. Faça o pagamento
4. Aguarde a confirmação

### **4. Aguarde o Webhook** ⏳

O Asaas vai enviar webhook para o backend:

**Console do Backend deve mostrar:**
```
📬 Webhook Asaas recebido: { event: 'PAYMENT_CONFIRMED', ... }
✅ Pedido xyz123 atualizado para status: paid
✅ Mensagem de confirmação enviada
```

**Cliente recebe no WhatsApp:**
```
✅ Pagamento Confirmado!

Pedido #xyz123
Valor: R$ 5.00

Obrigado pela sua compra! 🎉
Em breve você receberá mais informações sobre a entrega.
```

### **5. Envie Qualquer Mensagem** 📱

**Cliente:**
```
Oi
```

### **6. Agente Pergunta sobre Nota Fiscal** 🤖

**Agente IA deve responder:**
```
Olá! Tudo bem?

Vi que seu pagamento foi confirmado com sucesso!

Você deseja nota fiscal?
```

**⚠️ Se o agente NÃO perguntar automaticamente:**
- Verifique se o pedido tem `paymentConfirmedAt` no Firebase
- Verifique se foi pago há menos de 24 horas
- Veja os logs do backend para debug

### **7. Teste Cenário A - Cliente QUER NF** ✅

**Cliente:**
```
Sim
```

**Agente deve pedir endereço:**
```
Perfeito! Para emitir a nota fiscal, preciso do seu endereço completo.

Por favor, me informe:
📍 Rua
🔢 Número
...
```

**Cliente fornece endereço:**
```
Rua Teste, 100, Centro, São Paulo, SP, 12345-678
```

**Console do Backend deve mostrar:**
```
📝 Processando resposta para: address
📍 Tentando extrair endereço de: Rua Teste, 100, Centro, São Paulo, SP, 12345-678
   CEP encontrado: 12345678
   Estado encontrado: SP
   Rua (alt): Rua Teste
   Número (alt): 100
✅ Endereço detectado e salvo: {...}
💾 Dados do cliente atualizados no Firebase
📄 Cliente quer nota fiscal e forneceu endereço - iniciando emissão...
📄 [INVOICE] Tentando emitir nota fiscal com endereço...
✅ [INVOICE] Pedido encontrado: xyz123
📄 [NF] Iniciando emissão de nota fiscal...
✅ [NF] Nota fiscal criada no Asaas
   ID: inv_123
   Número: 00001
✅ [INVOICE] Nota fiscal enviada para o cliente
```

**Cliente recebe:**
```
📄 Nota Fiscal Emitida!

Número: 00001
Valor: R$ 5.00

🔗 Acesse: https://www.asaas.com/i/nota-fiscal-xyz
```

### **8. Verifique no Firebase** 🔥

Abra o Firebase Console e verifique:

**`customerData/[userId]/[phone]/address`**
```json
{
  "street": "Rua Teste",
  "number": "100",
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "12345678",
  "fullAddress": "..."
}
```

**`orders/[userId]/[orderId]`**
```json
{
  "status": "paid",
  "invoiceId": "inv_123",
  "invoiceNumber": "00001",
  "invoiceStatus": "authorized",
  "customer": {
    "address": { ... }
  }
}
```

**`invoices/[userId]/[orderId]`**
```json
{
  "invoiceId": "inv_123",
  "invoiceNumber": "00001",
  "status": "authorized",
  "pdfUrl": "https://..."
}
```

---

## 🧪 Teste Cenário B - Cliente NÃO Quer NF

### Repita passos 1-6, depois:

**Cliente:**
```
Não preciso
```

**Agente confirma:**
```
Tudo bem! Qualquer dúvida, estou à disposição.
```

**Verifique no Firebase:**
- `customerData/[userId]/[phone]/wantsInvoice` = `false`
- Pedido continua sem `invoiceId`

---

## 🧪 Teste de Parser de Endereço

Teste diferentes formatos:

### **Formato 1: Vírgulas**
```
Rua das Flores, 123, apto 45, Centro, São Paulo, SP, 01234-567
```

### **Formato 2: Tudo junto**
```
Av. Paulista 1000 apto 501 Bela Vista São Paulo SP 01310100
```

### **Formato 3: Quebras de linha**
```
Rua Brasil, 200
Centro
Campinas
SP
13010-100
```

**Todos devem funcionar!**

---

## 🐛 Debug - O que verificar se não funcionar

### **1. Agente não pergunta sobre NF**

**Verifique:**
```javascript
// No console do backend, procure por:
"📄 VERIFICAR SE HÁ PEDIDO PAGO RECENTE SEM NOTA FISCAL"
"Este cliente tem um pedido PAGO RECENTEMENTE"
```

**Checklist:**
- [ ] Pedido tem `status: 'paid'`?
- [ ] Pedido tem `paymentConfirmedAt`?
- [ ] Foi pago há menos de 24h?
- [ ] Pedido NÃO tem `invoiceId`?
- [ ] Telefone do cliente está correto?

### **2. Sistema não detecta endereço**

**Verifique:**
```javascript
// Console deve mostrar:
"📝 Processando resposta para: address"
"📍 Tentando extrair endereço de: ..."
```

**Se não aparecer:**
- Agente perguntou usando palavras-chave? ("endereço completo", "seu endereço")
- Context foi setado? Verifique `collectionContext/[userId]/[phone]`

### **3. Nota fiscal não é emitida**

**Verifique logs:**
```javascript
"❌ [INVOICE] Nenhum pedido pago sem nota fiscal encontrado"
"❌ [NF] Erro ao emitir nota fiscal: ..."
```

**Checklist:**
- [ ] API Key do Asaas está correta?
- [ ] `fiscalEnabled: true` nas integrações?
- [ ] Endereço foi salvo corretamente no Firebase?
- [ ] CEP é válido (8 dígitos)?

### **4. Erro do Asaas**

```
❌ [NF] Erro ao emitir nota fiscal: Endereço do cliente incompleto
```

**Verifique se todos os campos foram enviados:**
- `postalCode` (CEP sem traço)
- `address` (rua)
- `addressNumber` (número)
- `province` (bairro)
- `cityName` (cidade)

---

## 📊 Monitoramento em Tempo Real

Abra 3 terminais:

### **Terminal 1: Backend**
```bash
pm2 logs server --lines 100
```

### **Terminal 2: Firebase (opcional)**
```bash
firebase database:get /orders --project ia-agente-b2f46
```

### **Terminal 3: Teste curl webhook (opcional)**
```bash
curl -X POST http://localhost:3001/api/asaas/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "pay_test123",
      "value": 5.00
    }
  }'
```

---

## ✅ Checklist de Sucesso

- [x] Backend iniciado sem erros
- [x] WhatsApp conectado
- [x] Pedido criado e pago
- [x] Webhook recebido
- [x] Mensagem de confirmação enviada
- [x] Agente pergunta sobre NF automaticamente
- [x] Sistema detecta resposta do cliente
- [x] Sistema pede endereço
- [x] Parser extrai endereço corretamente
- [x] Endereço salvo no Firebase
- [x] Nota fiscal emitida no Asaas
- [x] Cliente recebe nota fiscal no WhatsApp
- [x] Dados completos no Firebase

---

## 🎉 Resultado Esperado

**No WhatsApp:**
```
[Sistema] ✅ Pagamento Confirmado! ...

[Cliente] Oi

[Agente] Você deseja nota fiscal?

[Cliente] Sim

[Agente] Para emitir a nota fiscal, preciso do seu endereço...

[Cliente] Rua Teste, 100, Centro, São Paulo, SP, 12345-678

[Agente] Obrigado! Estou processando sua nota fiscal...

[Sistema] 📄 Nota Fiscal Emitida! Número: 00001 ...
```

**No Asaas:**
- Cliente criado com endereço completo
- Cobrança paga
- Nota fiscal autorizada
- PDF disponível para download

**No Firebase:**
- Endereço salvo em `customerData`
- Pedido com `invoiceId` e `invoiceNumber`
- Histórico completo da conversa

---

## 💡 Dicas

1. **Use ambiente sandbox** do Asaas para testes
2. **Mantenha logs abertos** durante os testes
3. **Teste diferentes formatos** de endereço
4. **Verifique Firebase** após cada passo
5. **Use CPF de teste**: 12345678900

---

## 🆘 Suporte

Se algo não funcionar:
1. Confira os logs do backend
2. Verifique dados no Firebase Console
3. Teste o webhook manualmente
4. Revise a configuração do Asaas

**Logs principais:**
- `📄 [INVOICE]` - Emissão de nota fiscal
- `📍` - Parser de endereço
- `📝` - Detecção de contexto
- `✅` - Sucesso
- `❌` - Erro

