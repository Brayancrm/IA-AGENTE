# 📄 Sistema de Nota Fiscal Automática - Asaas

## 🎯 Visão Geral

Sistema completo de emissão automática de NFS-e (Nota Fiscal de Serviço Eletrônica) integrado com o Asaas. Após a confirmação do pagamento, a nota fiscal é emitida automaticamente e enviada para o cliente via WhatsApp.

---

## ✅ Funcionalidades

- ✅ **Emissão Automática** - NF gerada automaticamente após pagamento confirmado
- ✅ **Envio via WhatsApp** - Cliente recebe NF com link para PDF
- ✅ **Configuração Completa** - Todas as alíquotas de impostos configuráveis
- ✅ **Armazenamento** - Todas as NFs salvas no Firebase
- ✅ **Logs Detalhados** - Rastreamento completo de cada emissão
- ✅ **Interface Moderna** - Dashboard intuitivo para configuração

---

## 🔄 Fluxo Completo

```
1. Cliente faz o pedido pelo WhatsApp
   ↓
2. Sistema gera link de pagamento (Asaas)
   ↓
3. Cliente efetua o pagamento
   ↓
4. Asaas envia webhook: "PAYMENT_CONFIRMED"
   ↓
5. Sistema detecta pagamento confirmado
   ↓
6. Sistema emite NFS-e automaticamente
   ↓
7. NF é salva no Firebase (invoices/{userId}/{orderId})
   ↓
8. Cliente recebe NF via WhatsApp com link PDF
   ↓
9. Pedido é atualizado com dados da NF
```

---

## ⚙️ Configuração Inicial

### 1. Configurar no Asaas (Plataforma)

1. Acesse sua conta no Asaas
2. Vá em **Notas Fiscais → Configurações**
3. Preencha todos os dados fiscais da sua empresa:
   - CNPJ
   - Inscrição Municipal
   - Razão Social
   - Endereço completo
   - Regime tributário
4. **IMPORTANTE:** Entre em contato com a prefeitura da sua cidade para:
   - Verificar obrigatoriedade de emissão de NFS-e
   - Habilitar sua empresa para emitir NFS-e
   - Obter código de serviço municipal

### 2. Configurar no Dashboard

1. Acesse **Dashboard → Integrações → Fiscal**
2. Ative o toggle **"Emissão Automática de Nota Fiscal"**
3. Preencha os campos:

   **Inscrição Municipal:**
   - Digite sua inscrição municipal (fornecida pela prefeitura)

   **Alíquotas de Impostos (%):**
   - **ISS:** Imposto Sobre Serviços (geralmente 2% a 5%)
   - **COFINS:** Contribuição para Financiamento da Seguridade Social
   - **CSLL:** Contribuição Social sobre o Lucro Líquido
   - **INSS:** Instituto Nacional do Seguro Social
   - **IR:** Imposto de Renda
   - **PIS:** Programa de Integração Social

   **Outras Configurações:**
   - **Reter ISS:** Marque se o cliente retém o ISS na fonte
   - **Deduções:** Valor em R$ a ser deduzido (se aplicável)
   - **Observações:** Texto que aparecerá na nota fiscal

4. Clique em **Salvar Configuração Fiscal**

---

## 📊 Estrutura de Dados no Firebase

### Configurações Fiscais
```
users/data/{userId}/fiscal_config/
  ├── enabled: true/false
  ├── municipalRegistration: "123456"
  ├── issRate: 2.5
  ├── retainIss: false
  ├── cofinsRate: 3.0
  ├── csllRate: 1.0
  ├── inssRate: 0
  ├── irRate: 1.5
  ├── pisRate: 0.65
  ├── deductions: 0
  ├── observations: "Serviço prestado conforme contrato"
  └── updatedAt: "2025-10-21T..."
```

### Notas Fiscais Emitidas
```
invoices/{userId}/{orderId}/
  ├── invoiceId: "inv_..."          # ID da NF no Asaas
  ├── invoiceNumber: "123"          # Número da NF
  ├── orderId: "order_..."          # ID do pedido
  ├── chargeId: "pay_..."           # ID da cobrança
  ├── customer:                     # Dados do cliente
  │   ├── name: "João Silva"
  │   ├── cpfCnpj: "12345678900"
  │   └── email: "joao@email.com"
  ├── value: 100.00                 # Valor da NF
  ├── items: [...]                  # Itens da NF
  ├── status: "AUTHORIZED"          # Status da NF
  ├── effectiveDate: "2025-10-21"   # Data de emissão
  ├── taxes:                        # Impostos aplicados
  │   ├── iss: 2.5
  │   ├── cofins: 3.0
  │   └── ...
  ├── pdfUrl: "https://..."         # Link do PDF
  ├── xmlUrl: "https://..."         # Link do XML
  ├── createdAt: "2025-10-21T..."
  └── asaasData: {...}              # Dados completos do Asaas
```

### Pedidos (com dados da NF)
```
orders/{userId}/{orderId}/
  ├── ... (dados do pedido)
  ├── invoiceId: "inv_..."          # ID da NF emitida
  ├── invoiceNumber: "123"          # Número da NF
  ├── invoiceStatus: "AUTHORIZED"   # Status da NF
  └── invoiceEmittedAt: "2025-10-21T..." # Quando foi emitida
```

---

## 🛠️ API - Endpoints

### 1. Salvar Configurações Fiscais
```http
POST /api/fiscal-config/save
Content-Type: application/json

{
  "userId": "abc123",
  "config": {
    "enabled": true,
    "municipalRegistration": "123456",
    "issRate": 2.5,
    "retainIss": false,
    "cofinsRate": 3.0,
    "csllRate": 1.0,
    "inssRate": 0,
    "irRate": 1.5,
    "pisRate": 0.65,
    "deductions": 0,
    "observations": "Serviço prestado"
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Configurações fiscais salvas com sucesso"
}
```

### 2. Buscar Configurações Fiscais
```http
GET /api/fiscal-config/get/{userId}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "municipalRegistration": "123456",
    "issRate": 2.5,
    ...
  }
}
```

### 3. Listar Notas Fiscais
```http
GET /api/invoices/list/{userId}
```

**Resposta:**
```json
{
  "success": true,
  "invoices": [
    {
      "id": "order_123",
      "invoiceId": "inv_...",
      "invoiceNumber": "123",
      "customer": {...},
      "value": 100.00,
      "status": "AUTHORIZED",
      "createdAt": "2025-10-21T...",
      ...
    }
  ]
}
```

---

## 📝 Logs Detalhados

Quando uma NF é emitida, você verá logs como:

```
📄 [NF] Iniciando emissão de nota fiscal...
   Pedido: order_abc123
   Valor: 100.00
✅ [NF] API Key encontrada
✅ [NF] Configurações fiscais encontradas
📝 [NF] Dados da nota fiscal preparados
🌐 [NF] Enviando para Asaas: https://sandbox.asaas.com/api/v3/invoices
✅ [NF] Nota fiscal criada no Asaas
   ID: inv_xyz789
   Número: 123
✅ [NF] Nota fiscal salva no Firebase
✅ [NF] Pedido atualizado com dados da NF
✅ Nota fiscal emitida com sucesso: 123
✅ Nota fiscal enviada para o cliente
```

---

## 🚨 Erros Comuns e Soluções

### ❌ "API Key do Asaas não encontrada"
**Solução:** Configure a API Key do Asaas em Dashboard → Integrações → Asaas

### ❌ "Emissão de NF não está habilitada"
**Solução:** Habilite o toggle "Emissão Automática" em Dashboard → Integrações → Fiscal

### ❌ "Erro 400: Customer not found"
**Solução:** O cliente precisa estar cadastrado no Asaas. O sistema cria automaticamente ao gerar o link de pagamento.

### ❌ "Erro 400: Missing municipal registration"
**Solução:** Preencha a Inscrição Municipal nas configurações fiscais

### ❌ "Erro 403: Invoicing not enabled"
**Solução:** 
1. Acesse sua conta no Asaas
2. Vá em Notas Fiscais → Configurações
3. Complete todas as informações fiscais
4. Entre em contato com a prefeitura para habilitar emissão de NFS-e

---

## 💡 Informações Importantes

### Sobre Alíquotas de Impostos

- **ISS (Imposto Sobre Serviços):**
  - Varia de 2% a 5% dependendo do município
  - Consulte a legislação da sua cidade
  - Alguns municípios exigem retenção na fonte

- **COFINS, CSLL, INSS, IR, PIS:**
  - Dependem do regime tributário (Simples Nacional, Lucro Presumido, Lucro Real)
  - **Simples Nacional:** Geralmente não incide separadamente
  - **Lucro Presumido/Real:** Consulte seu contador

### Ambiente de Testes (Sandbox)

- Por padrão, o sistema usa o **sandbox do Asaas**
- Para produção, altere a variável de ambiente:
  ```
  ASAAS_ENV=production
  ```

### Custos

- O Asaas pode cobrar uma taxa por emissão de NF
- Consulte o plano contratado no Asaas
- Geralmente: R$ 0,50 a R$ 1,00 por nota

---

## 🧪 Como Testar

### Teste Completo (Sandbox):

1. **Configure as informações fiscais** no Dashboard
2. **Habilite a emissão automática**
3. **Faça um pedido pelo WhatsApp:**
   - Cliente: "Quero sabão"
   - Agente: "Quantas unidades?"
   - Cliente: "2"
   - [Coleta dados: nome, CPF, email]
   - Agente: "Perfeito! Vou enviar seu Link..."
4. **Pague o boleto/PIX gerado** (no sandbox, use dados de teste)
5. **Aguarde webhook do Asaas** (~30 segundos)
6. **Verifique os logs:** Deve aparecer "NF emitida"
7. **Cliente recebe mensagem** com link da NF

### Dados de Teste (Sandbox Asaas):

```
CPF válido para teste: 24971563792
CNPJ válido para teste: 32593710000103
Email de teste: test@test.com
PIX de teste: Use qualquer chave, será aprovado automaticamente
```

---

## 🔧 Manutenção

### Ver Notas Fiscais no Firebase

1. Acesse Firebase Console
2. Vá em Realtime Database
3. Navegue até: `invoices/{userId}/`
4. Você verá todas as NFs emitidas

### Ver Logs de Erro

- Logs de erro ficam salvos em: `invoices/{userId}/{orderId}_error`
- Contém detalhes do erro para debug

### Reemitir Nota Fiscal (Manualmente)

Se precisar reemitir uma NF manualmente:
```javascript
// No console do Firebase ou via API
await emitirNotaFiscal(userId, orderId, orderData, paymentData);
```

---

## 🎓 Recursos Adicionais

### Documentação Oficial do Asaas
- API de Notas Fiscais: https://docs.asaas.com/docs/notas-fiscais
- Webhooks: https://docs.asaas.com/docs/webhooks

### Legislação
- Consulte a prefeitura da sua cidade sobre:
  - Obrigatoriedade de emissão de NFS-e
  - Alíquota de ISS do seu serviço
  - Código de serviço municipal

---

## ✅ Checklist de Configuração

- [ ] Conta no Asaas criada e verificada
- [ ] Configurações fiscais completas no Asaas
- [ ] Empresa habilitada pela prefeitura para emitir NFS-e
- [ ] API Key do Asaas configurada no Dashboard
- [ ] Inscrição Municipal preenchida
- [ ] Alíquotas de impostos configuradas
- [ ] Emissão automática habilitada
- [ ] Teste realizado no ambiente sandbox
- [ ] Sistema funcionando corretamente

---

## 📞 Suporte

Se tiver problemas:

1. **Verifique os logs** do backend
2. **Consulte os erros salvos** no Firebase
3. **Teste no sandbox** antes de usar em produção
4. **Consulte seu contador** sobre alíquotas de impostos
5. **Entre em contato** com o suporte do Asaas se necessário

---

**Sistema pronto para emitir notas fiscais automaticamente! 📄✅**

