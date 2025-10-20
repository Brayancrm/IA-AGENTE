# 💳 Integração Asaas - Pagamentos Automáticos

## 🎯 O Que Foi Implementado?

Agora seu agente de WhatsApp **gera links de pagamento automaticamente** quando o cliente demonstra intenção de compra!

---

## ✨ Funcionalidades

### 1. **Detecção Automática de Compra** 🤖
O bot detecta quando o cliente quer comprar através de palavras-chave como:
- "Quero comprar"
- "Vou comprar"
- "Quero levar"
- "Fechar pedido"
- "Finalizar compra"
- E outras variações

### 2. **Geração Automática de Link de Pagamento** 💳
Quando detecta intenção de compra, o bot:
- ✅ Cria cliente no Asaas automaticamente
- ✅ Gera cobrança com todos os produtos mencionados
- ✅ Envia link de pagamento por WhatsApp
- ✅ Permite pagamento via Pix, Cartão ou Boleto

### 3. **Confirmação Automática de Pagamento** ✅
Quando o cliente paga:
- ✅ Asaas avisa o sistema via webhook
- ✅ Sistema atualiza status do pedido
- ✅ Cliente recebe confirmação automática no WhatsApp

### 4. **Gestão de Pedidos** 📦
- ✅ Todos os pedidos são salvos no Firebase
- ✅ Histórico completo de compras
- ✅ Rastreamento de status

---

## 🚀 Como Configurar

### Passo 1: Obter API Key do Asaas

1. **Acesse:** https://www.asaas.com
2. **Crie uma conta** (se ainda não tiver)
3. **Vá em:** Configurações → Integrações → API Key
4. **Copie** a API Key

**⚠️ IMPORTANTE:** Use a API Key de **produção** para pagamentos reais ou **sandbox** para testes.

---

### Passo 2: Configurar no Site

1. Acesse: https://ia-agente.vercel.app/
2. Faça login
3. Vá em: **Integrações**
4. Aba: **Asaas**
5. Cole sua **API Key do Asaas**
6. Clique em: **Salvar Configuração Asaas**

---

### Passo 3: Configurar Webhook no Asaas

Para receber notificações de pagamento:

1. **Acesse:** https://www.asaas.com
2. **Vá em:** Configurações → Webhooks
3. **Adicione um novo webhook:**
   ```
   URL: https://ia-agente-production.up.railway.app/api/asaas/webhook
   ```
4. **Selecione eventos:**
   - ✅ PAYMENT_RECEIVED (Pagamento recebido)
   - ✅ PAYMENT_CONFIRMED (Pagamento confirmado)
   - ✅ PAYMENT_OVERDUE (Pagamento vencido)
   
5. **Salvar**

---

## 🎮 Como Funciona na Prática

### Fluxo Completo de Venda:

```
1. Cliente: "Quanto custa o Notebook Dell?"
   ↓
2. Bot: "O Notebook Dell custa R$ 3.499,90..."
   [ENVIA FOTO DO PRODUTO]
   ↓
3. Cliente: "Quero comprar!"
   ↓
4. Bot: "✅ Pedido Criado!
        
        📦 Itens:
        • 1x Notebook Dell - R$ 3.499,90
        
        💰 Total: R$ 3.499,90
        
        🔗 Link de Pagamento:
        https://www.asaas.com/pay/abc123
        
        💳 Formas de pagamento:
        • Pix (instantâneo)
        • Cartão de crédito
        • Boleto bancário
        
        Vencimento: 28/10/2025
        
        Após o pagamento, você receberá 
        uma confirmação automática! 🎉"
   ↓
5. Cliente clica no link e paga
   ↓
6. Asaas confirma pagamento (webhook)
   ↓
7. Bot: "✅ Pagamento Confirmado!
        
        Pedido #abc12345
        Valor: R$ 3.499,90
        
        Obrigado pela sua compra! 🎉
        Em breve você receberá mais
        informações sobre a entrega."
```

---

## 📋 Exemplos de Uso

### Exemplo 1: Compra Simples

```
Cliente: "Quero o sabão"
Bot: [Responde sobre o sabão e envia foto]

Cliente: "Vou levar"
Bot: [Gera link de pagamento automaticamente]
     ✅ Pedido Criado!
     • 1x Sabão - R$ 23,00
     🔗 Link: https://asaas.com/pay/...
```

### Exemplo 2: Múltiplos Produtos

```
Cliente: "Quero o notebook e o mouse"
Bot: [Fala sobre os produtos e envia fotos]

Cliente: "Quero comprar os dois"
Bot: ✅ Pedido Criado!
     • 1x Notebook Dell - R$ 3.499,90
     • 1x Mouse Logitech - R$ 89,90
     💰 Total: R$ 3.589,80
     🔗 Link: https://asaas.com/pay/...
```

### Exemplo 3: Serviço

```
Cliente: "Quanto custa a lavagem externa?"
Bot: "R$ 150,00" [envia detalhes]

Cliente: "Pode fazer o agendamento"
Bot: ✅ Pedido Criado!
     • 1x Lavagem Externa - R$ 150,00
     🔗 Link: https://asaas.com/pay/...
```

---

## 🎯 Palavras-Chave que Acionam Pagamento

O bot detecta intenção de compra com:

- ✅ "quero comprar"
- ✅ "vou comprar"
- ✅ "quero levar"
- ✅ "pode fazer o pedido"
- ✅ "fechar pedido"
- ✅ "confirmar pedido"
- ✅ "finalizar compra"
- ✅ "quero esse"
- ✅ "quero este"
- ✅ "vou levar"
- ✅ "me vende"
- ✅ "comprar"
- ✅ "adquirir"

---

## 📊 Estrutura de Dados

### Pedidos no Firebase

Localização: `orders/{userId}/{orderId}`

```json
{
  "orderId": "abc123",
  "chargeId": "pay_abc123",
  "customer": {
    "name": "Cliente WhatsApp",
    "phone": "5511999999999",
    "mobilePhone": "5511999999999"
  },
  "items": [
    {
      "name": "Notebook Dell",
      "price": 3499.90,
      "quantity": 1,
      "description": "Notebook Intel Core i7..."
    }
  ],
  "totalValue": 3499.90,
  "status": "pending", // ou "paid", "overdue", "cancelled"
  "createdAt": "2025-10-20T18:30:00.000Z",
  "paymentUrl": "https://www.asaas.com/pay/abc123",
  "updatedAt": "2025-10-20T18:35:00.000Z",
  "paymentData": {
    // Dados do Asaas quando pago
  }
}
```

---

## 🔧 Endpoints da API

### 1. Criar Cobrança

```http
POST /api/asaas/create-charge
Content-Type: application/json

{
  "userId": "user123",
  "customerData": {
    "name": "João Silva",
    "phone": "5511999999999",
    "email": "joao@email.com"
  },
  "items": [
    {
      "name": "Produto 1",
      "price": 100.00,
      "quantity": 2
    }
  ]
}
```

**Resposta:**
```json
{
  "success": true,
  "orderId": "order123",
  "chargeId": "pay_abc123",
  "invoiceUrl": "https://www.asaas.com/pay/abc123",
  "value": 200.00,
  "dueDate": "2025-10-27"
}
```

---

### 2. Webhook Asaas

```http
POST /api/asaas/webhook
Content-Type: application/json

{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_abc123",
    "value": 200.00,
    "status": "RECEIVED"
  }
}
```

---

## 📈 Monitoramento

### Ver Pedidos em Tempo Real

```bash
cd backend
npm run pm2:logs
```

Você verá:
```
🛒 Intenção de compra detectada!
💳 Gerando cobrança no Asaas...
✅ Cliente criado no Asaas: cus_abc123
✅ Cobrança criada no Asaas: pay_abc123
✅ Link de pagamento enviado!

📬 Webhook Asaas recebido: PAYMENT_RECEIVED
✅ Pedido abc12345 atualizado para status: paid
✅ Mensagem de confirmação enviada
```

---

## 🐛 Solução de Problemas

### Problema: Link de pagamento não é gerado

**Checklist:**
- [ ] API Key do Asaas está configurada?
- [ ] Cliente digitou palavra-chave de compra?
- [ ] Bot mencionou algum produto na resposta?
- [ ] Webhook está configurado no Asaas?

**Como verificar:**
```bash
npm run pm2:logs
```

Procure por:
- `🛒 Intenção de compra detectada!` ✅
- `⚠️ API Key do Asaas não configurada` ❌

---

### Problema: Confirmação de pagamento não chega

**Causa:** Webhook não está configurado

**Solução:**
1. Vá no Asaas → Configurações → Webhooks
2. Verifique se a URL está correta:
   ```
   https://ia-agente-production.up.railway.app/api/asaas/webhook
   ```
3. Teste o webhook manualmente no Asaas

---

### Problema: Cliente não consegue pagar

**Possíveis causas:**
- Conta Asaas em modo sandbox (só aceita pagamentos de teste)
- Link expirado (prazo de 7 dias)
- Problema com os dados do cliente

**Solução:**
- Use API Key de produção para pagamentos reais
- Gere novo pedido se o link expirou
- Verifique os logs para erros específicos

---

## 💰 Taxas do Asaas

| Forma de Pagamento | Taxa |
|-------------------|------|
| **Pix** | R$ 0,99 por transação |
| **Boleto** | R$ 2,49 por boleto |
| **Cartão de Crédito** | 3,99% por transação |

**Observação:** Taxas podem variar conforme o plano. Consulte: https://www.asaas.com/precos

---

## 🎯 Próximos Passos (Já Implementados)

- ✅ Detecção automática de compra
- ✅ Geração de link de pagamento
- ✅ Webhook de confirmação
- ✅ Mensagem automática ao confirmar
- ✅ Salvamento de pedidos
- ✅ Suporte a múltiplos produtos

---

## 📚 Recursos Adicionais

### Documentação Asaas
- API: https://docs.asaas.com/
- Webhooks: https://docs.asaas.com/reference/webhooks
- Sandbox: https://sandbox.asaas.com/

### Testar em Sandbox

1. Crie conta em: https://sandbox.asaas.com/
2. Use API Key de sandbox
3. Faça pagamentos de teste
4. Simule confirmações

---

## 🎉 Sistema Completo Funcionando!

Agora você tem um sistema completo de vendas:

1. ✅ Cliente pergunta sobre produto
2. ✅ Bot responde e envia foto
3. ✅ Cliente pede para comprar
4. ✅ Bot gera link de pagamento
5. ✅ Cliente paga (Pix/Cartão/Boleto)
6. ✅ Sistema confirma automaticamente
7. ✅ Cliente recebe confirmação no WhatsApp

**Tudo 100% automático! 🚀**

---

**Desenvolvido com ❤️ para automatizar suas vendas!**

