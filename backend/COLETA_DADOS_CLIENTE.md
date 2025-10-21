# 📋 Sistema de Coleta de Dados do Cliente via WhatsApp

## 🎯 O Que Foi Implementado

O agente de WhatsApp agora **coleta E SALVA automaticamente** os dados do cliente durante a conversa e **usa esses dados para preencher o pagamento no Asaas**!

## 🚀 SALVAMENTO AUTOMÁTICO IMPLEMENTADO

✅ **O backend agora detecta e salva automaticamente:**
- Nome (aceita 1 ou mais palavras, sem números)
- Email (detecta formato email@dominio.com)
- CPF (SEMPRE 11 dígitos numéricos)
- CNPJ (SEMPRE 14 dígitos numéricos)

**Não é necessário chamar nenhum endpoint manualmente!** O sistema faz tudo sozinho! 🎉

---

## ✨ Como Funciona

### 1. Cliente Conversa Normalmente
O cliente fala com o bot sobre produtos, tira dúvidas, etc.

### 2. Bot Coleta Dados Durante a Conversa
O bot pergunta (de forma natural configurada no prompt):
- 📝 **Nome completo**
- 📧 **E-mail**  
- 📱 **CPF ou CNPJ**
- 📍 **Endereço** (opcional, para entrega)

### 3. Backend Detecta e Salva AUTOMATICAMENTE ⚡
**A cada mensagem do cliente**, o backend analisa:

```javascript
// DETECÇÃO DE NOME
- Aceita 1 ou mais palavras (ex: "João" ou "João Silva")
- Verifica se NÃO tem números
- Verifica se NÃO tem caracteres especiais (@, #, etc.)
- Mínimo 2 caracteres, máximo 100
- Se passar nas validações → SALVA automaticamente ✅

// DETECÇÃO DE EMAIL
- Procura padrão: algo@algo.algo
- Se encontrar → SALVA automaticamente ✅

// DETECÇÃO DE CPF
- Remove pontos, traços e espaços
- Conta dígitos: EXATAMENTE 11 = CPF ✅
- Se for 11 dígitos → SALVA automaticamente ✅

// DETECÇÃO DE CNPJ
- Remove pontos, traços e espaços
- Conta dígitos: EXATAMENTE 14 = CNPJ ✅
- Se for 14 dígitos → SALVA automaticamente ✅
```

**Local de salvamento:** `customerData/{userId}/{phone}`

### 4. Pagamento Usa os Dados Automaticamente
Quando o cliente quer comprar, o backend:
1. 🔍 **Busca os dados salvos** no Firebase
2. 📝 **Preenche automaticamente** no Asaas:
   - ✅ Nome completo
   - ✅ E-mail
   - ✅ CPF/CNPJ
   - ✅ Endereço (se fornecido)
3. 💳 **Cria a cobrança** com todos os dados

---

## 🚀 Como Configurar o Prompt

### Passo 1: Adicionar ao Prompt do Assistente

Vá em **Integrações** → **OpenAI** e adicione estas instruções ao prompt:

```
IMPORTANTE - COLETA DE DADOS DO CLIENTE:

Quando o cliente demonstrar interesse em comprar, você DEVE coletar os seguintes dados:

1. NOME COMPLETO:
   - Pergunte: "Para finalizar, preciso do seu nome completo, por favor"
   - Salve o nome fornecido

2. EMAIL:
   - Pergunte: "Qual é o seu melhor e-mail?"
   - Valide o formato (deve ter @ e .)

3. CPF OU CNPJ:
   - Pergunte: "Preciso do seu CPF (ou CNPJ se for empresa)"
   - Aceite apenas números (remova pontos e traços)
   - CPF: 11 dígitos
   - CNPJ: 14 dígitos

4. ENDEREÇO (se houver entrega):
   - Rua/Avenida
   - Número
   - Complemento
   - Bairro
   - CEP

FORMATO DE COLETA:
Pergunte os dados de forma natural e amigável. Exemplo:

"Ótimo! Para finalizar seu pedido, vou precisar de alguns dados:

📝 Primeiro, qual é o seu nome completo?"

(Aguarda resposta)

"📧 E qual é o seu e-mail?"

(Aguarda resposta)

"📱 Por último, preciso do seu CPF (11 dígitos, apenas números)"

(Aguarda resposta)

"✅ Perfeito! Agora estou gerando seu link de pagamento..."

IMPORTANTE:
- Colete UM dado por vez
- Seja amigável e profissional
- Explique que os dados são necessários para o pagamento
- NÃO gere o link de pagamento antes de coletar os dados
```

---

## 📊 Estrutura dos Dados no Firebase

Os dados são salvos em:

```
customerData/
  └── {userId}/
       └── {phoneNumber}/
            ├── name: "João Silva"
            ├── email: "joao@example.com"
            ├── cpfCnpj: "12345678900"
            ├── phone: "5511999999999@c.us"
            ├── address/
            │   ├── street: "Rua das Flores"
            │   ├── number: "123"
            │   ├── complement: "Apto 45"
            │   ├── neighborhood: "Centro"
            │   └── zipCode: "01234567"
            └── updatedAt: "2025-01-01T10:00:00Z"
```

---

## 🔄 Fluxo Completo

```
1. Cliente: "Quero o notebook Dell"
   ↓
2. Bot: "Ótimo! Preciso do seu nome completo"
   ↓
3. Cliente: "João Silva"
   ↓
4. Bot: "Obrigado! Qual é o seu e-mail?"
   ↓
5. Cliente: "joao@example.com"
   ↓
6. Bot: "E o seu CPF? (apenas números)"
   ↓
7. Cliente: "123.456.789-00"
   ↓
8. Bot: "✅ Perfeito! Gerando seu link..."
   [DADOS SÃO SALVOS NO FIREBASE]
   ↓
9. Sistema busca os dados salvos
   ↓
10. Cria cobrança no Asaas com TODOS os dados
   ↓
11. Cliente recebe link de pagamento completo
```

---

## 💡 Exemplo de Conversa Real

```
Cliente: Oi! Quanto custa o notebook?

Bot: Olá! O Notebook Dell custa R$ 3.499,90
     [ENVIA FOTO]
     
Cliente: Quero comprar!

Bot: Ótimo! Para finalizar, vou precisar de alguns dados.
     
     📝 Primeiro, qual é o seu nome completo?

Cliente: João Silva

Bot: Obrigado, João! 
     
     📧 Qual é o seu melhor e-mail?

Cliente: joao@example.com

Bot: Perfeito! 
     
     📱 Por último, preciso do seu CPF (11 dígitos)

Cliente: 123.456.789-00

Bot: ✅ Tudo certo, João!
     
     💳 Estou gerando seu link de pagamento...
     
     [Sistema salva os dados]
     [Sistema busca os dados]
     [Sistema cria cobrança com nome, email e CPF]
     
     ✅ Pedido Criado!
     
     📦 Itens:
     • 1x Notebook Dell - R$ 3.499,90
     
     💰 Total: R$ 3.499,90
     
     🔗 Link de Pagamento:
     https://www.asaas.com/pay/abc123
     
     💳 Formas de pagamento:
     • Pix (instantâneo)
     • Cartão de crédito
     • Boleto bancário
```

---

## 🛠️ APIs Disponíveis

### Salvar Dados do Cliente

```bash
POST /api/customer-data/save

Body:
{
  "userId": "5vbbBm06amVAjYCKHUwLmA9kwcj2",
  "phone": "5511999999999",
  "data": {
    "name": "João Silva",
    "email": "joao@example.com",
    "cpfCnpj": "12345678900"
  }
}

Response:
{
  "success": true,
  "message": "Dados salvos com sucesso"
}
```

### Buscar Dados do Cliente

```bash
GET /api/customer-data/get/:userId/:phone

Response:
{
  "success": true,
  "data": {
    "name": "João Silva",
    "email": "joao@example.com",
    "cpfCnpj": "12345678900",
    "phone": "5511999999999",
    "updatedAt": "2025-01-01T10:00:00Z"
  }
}
```

---

## ✅ Benefícios

1. ✨ **Experiência Melhorada**: Cliente fornece dados de forma natural
2. 🎯 **Dados Completos no Asaas**: CPF, email, endereço, etc.
3. 💾 **Reutilização**: Próximas compras já têm os dados salvos
4. 📊 **CRM Automático**: Todos os dados ficam salvos para análise
5. ⚡ **Checkout Mais Rápido**: Cliente que já comprou não precisa informar tudo novamente

---

## 🔒 Segurança

- ✅ Dados são criptografados pelo Firebase
- ✅ Acesso controlado por autenticação
- ✅ CPF/CNPJ são validados
- ✅ Seguem LGPD (armazenamento mínimo necessário)

---

## 🧪 Como Testar

1. **Inicie uma conversa** com o bot
2. **Mencione um produto**: "Quero o notebook"
3. **Demonstre interesse**: "Vou comprar"
4. **Responda as perguntas** do bot (nome, email, CPF)
5. **Receba o link** de pagamento
6. **Verifique no Asaas**: Os dados devem estar preenchidos!

---

## 📝 Validações Implementadas

### CPF/CNPJ
- Remove pontos, traços e espaços
- Valida quantidade de dígitos (11 ou 14)
- Armazena apenas números

### E-mail
- Verifica formato básico (@ e .)
- Salva em lowercase
- Remove espaços

### Nome
- Mínimo 2 palavras (nome e sobrenome)
- Capitaliza primeira letra de cada palavra

---

## 🆘 Resolução de Problemas

### Dados não estão sendo usados no pagamento

1. Verifique se os dados foram salvos:
   ```
   Firebase Console → Realtime Database → customerData
   ```

2. Verifique os logs do backend:
   ```
   📋 Dados do cliente: Encontrados ✅
   ```

3. Certifique-se que o formato está correto:
   ```javascript
   {
     name: "string",
     email: "string@domain.com",
     cpfCnpj: "apenas números"
   }
   ```

### Bot não está perguntando os dados

1. Verifique o prompt em: **Integrações → OpenAI**
2. Certifique-se que incluiu as instruções de coleta
3. Teste com palavras-chave claras: "quero comprar"

---

## 🎓 Próximos Passos

Depois de implementar, você pode:

1. 📊 **Criar dashboard** para visualizar dados dos clientes
2. 🔔 **Adicionar notificações** quando dados forem coletados
3. ✉️ **Email marketing** usando emails coletados
4. 📱 **SMS** para clientes que forneceram telefone
5. 🎁 **Programa de fidelidade** baseado nos dados

---

## 💰 Impacto no Negócio

- ⬆️ **Aumenta taxa de aprovação** no Asaas (dados completos)
- ⬇️ **Reduz erros** no pagamento
- ⚡ **Acelera compras futuras** (dados já salvos)
- 📊 **Melhora análise** de clientes
- 🎯 **Marketing direcionado** com dados reais

---

**Implementado com sucesso! 🎉**

Agora seu agente coleta dados automaticamente e cria pagamentos completos no Asaas!

