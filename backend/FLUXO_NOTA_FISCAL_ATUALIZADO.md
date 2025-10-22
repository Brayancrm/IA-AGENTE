# 📄 Fluxo de Nota Fiscal Atualizado

## ✅ Problema Resolvido

O Asaas precisa do **endereço completo** do cliente para emitir a nota fiscal. Antes, o sistema tentava emitir automaticamente após o pagamento, mas falhava por falta do endereço.

## 🔄 Novo Fluxo Implementado

### 1. **Após Confirmação de Pagamento**
- ✅ Sistema envia mensagem: "Pagamento Confirmado!"
- ✅ Sistema marca o pedido com `paymentConfirmedAt`
- ❌ **NÃO** emite nota fiscal automaticamente

### 2. **Agente Pergunta sobre Nota Fiscal**
- 🤖 IA detecta que há pedido pago sem nota fiscal
- 🤖 Agente pergunta: "Você deseja nota fiscal?"

### 3. **Cliente Responde**

#### Se **SIM**:
- 🤖 Agente informa: "Para emitir a nota fiscal, preciso do seu endereço completo."
- 🤖 Agente pede: "Rua, Número, Complemento, Bairro, Cidade, Estado e CEP"
- 📝 Sistema detecta a pergunta e marca contexto: `waitingFor: 'address'`

#### Se **NÃO**:
- 🤖 Agente confirma: "Tudo bem! Qualquer dúvida, estou à disposição."
- ✅ Fluxo encerrado

### 4. **Cliente Fornece Endereço**
- 📍 Sistema detecta e faz parse do endereço automaticamente
- 💾 Salva no Firebase: `customerData/${userId}/${phone}/address`
  ```json
  {
    "street": "Rua das Flores",
    "number": "123",
    "complement": "apto 45",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234567",
    "fullAddress": "..."
  }
  ```

### 5. **Emissão Automática da Nota Fiscal**
- 📄 Sistema busca o último pedido pago sem nota fiscal
- 📄 Atualiza o pedido com o endereço do cliente
- 📄 Emite nota fiscal no Asaas com todos os dados
- ✅ Envia mensagem com a nota fiscal para o cliente

## 🎯 Modificações Técnicas Implementadas

### 1. **Webhook Asaas** (linhas 2070-2108)
- ❌ Removida emissão automática de nota fiscal
- ✅ Apenas confirma pagamento e marca no Firebase

### 2. **Detecção de Perguntas** (linhas 962-1005)
Adicionadas detecções:
- `invoice_request` - Quando agente pergunta sobre nota fiscal
- `address` - Quando agente pede o endereço

### 3. **Detecção de Respostas** (linhas 1102-1133)
Adicionadas:
- Resposta sobre nota fiscal (sim/não)
- Parse e salvamento de endereço completo

### 4. **Função `parseAddress()`** (linhas 732-845)
Parser inteligente que extrai:
- CEP (formato: 12345-678 ou 12345678)
- Estado (2 letras: SP, RJ, etc)
- Rua (com prefixos: Rua, Av., etc)
- Número do endereço
- Complemento
- Bairro, Cidade

Suporta formatos:
- `"Rua X, 123, Centro, São Paulo, SP, 01234-567"`
- `"Av. Paulista 1000 apto 501 Bela Vista São Paulo SP 01310-100"`

### 5. **Função `tryEmitInvoiceWithAddress()`** (linhas 847-958)
- Busca último pedido pago sem NF
- Atualiza com endereço do cliente
- Emite nota fiscal
- Envia para o cliente via WhatsApp

### 6. **Prompt do Sistema** (linhas 616-657)
Adicionado fluxo completo:
```
📄 FLUXO DE NOTA FISCAL:
1. APÓS confirmar pagamento → pergunte sobre nota fiscal
2. Se SIM → peça endereço completo
3. Quando receber → agradeça
4. Se NÃO → confirme e encerre
```

### 7. **Contexto Automático** (linhas 524-548, 665-674)
- IA detecta pedido pago sem NF nas últimas 24h
- Adiciona aviso no prompt para perguntar sobre nota fiscal

### 8. **Função `emitirNotaFiscal()` Atualizada** (linhas 1916-1924)
Agora envia dados de endereço para o Asaas:
```javascript
postalCode: address.zipCode,
address: address.street,
addressNumber: address.number,
complement: address.complement,
province: address.neighborhood,
cityName: address.city
```

## 📊 Estrutura de Dados no Firebase

### **customerData/${userId}/${phone}**
```json
{
  "name": "João Silva",
  "cpfCnpj": "12345678900",
  "email": "joao@email.com",
  "phone": "5511999999999",
  "wantsInvoice": true,
  "address": {
    "street": "Rua das Flores",
    "number": "123",
    "complement": "apto 45",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234567",
    "fullAddress": "Rua das Flores, 123, apto 45, Centro, São Paulo, SP, 01234-567"
  },
  "updatedAt": "2025-10-22T..."
}
```

### **orders/${userId}/${orderId}**
```json
{
  "orderId": "xyz123",
  "chargeId": "pay_abc",
  "customer": {
    "name": "João Silva",
    "address": { ... }
  },
  "status": "paid",
  "paymentConfirmedAt": "2025-10-22T...",
  "invoiceId": "inv_123",
  "invoiceNumber": "00001",
  "invoiceStatus": "authorized"
}
```

## 🧪 Como Testar

1. **Fazer um pedido e pagar**
2. **Aguardar webhook** confirmar pagamento
3. **Enviar mensagem qualquer** para o agente
4. **IA deve perguntar**: "Você deseja nota fiscal?"
5. **Responder**: "Sim"
6. **IA pede endereço**
7. **Fornecer**: "Rua Teste, 100, Centro, São Paulo, SP, 12345-678"
8. **Sistema emite NF automaticamente**
9. **Recebe mensagem** com a nota fiscal

## ⚠️ Importante

- Endereço é **OBRIGATÓRIO** para emissão de NF
- Sistema detecta automaticamente pedidos pagos nas **últimas 24h**
- Dados do endereço são **salvos** para uso futuro
- Se houver erro, cliente recebe **mensagem explicativa**

## 🎉 Benefícios

✅ **Resolve o problema** do Asaas (endereço incompleto)  
✅ **Experiência melhor** - só pede quando necessário  
✅ **Dados salvos** - cliente não precisa repetir  
✅ **Automático** - emite assim que recebe o endereço  
✅ **Inteligente** - detecta formatos variados de endereço

