# 📋 Sistema 100% Automático de Coleta de Dados e Geração de Links

## 🎯 O Que o Sistema Faz

O agente de WhatsApp agora:
1. **Detecta e salva automaticamente** dados do cliente (Nome, Email, CPF/CNPJ)
2. **Gera link de pagamento AUTOMATICAMENTE** quando todos os 3 dados são coletados
3. **NÃO precisa de palavras-chave** como "quero comprar", "fechar pedido", etc.

## 🚀 Como Funciona (100% Automático!)

### 1. Detecção Automática de Dados

O backend analisa **cada mensagem** do cliente e detecta automaticamente:

#### 📝 Nome
- **Validação:** 1 ou mais palavras, sem números, sem caracteres especiais
- **Exemplos válidos:**
  - ✅ "João"
  - ✅ "Maria Silva"
  - ✅ "José da Silva Santos"
- **Exemplos inválidos:**
  - ❌ "João123" (contém números)
  - ❌ "teste@email.com" (contém @)

#### 📧 Email
- **Formato:** usuario@dominio.extensao
- **Exemplos:**
  - ✅ "joao@gmail.com"
  - ✅ "maria.silva@empresa.com.br"

#### 🆔 CPF
- **Formato:** EXATAMENTE 11 dígitos numéricos
- **Aceita com ou sem formatação:**
  - ✅ "12345678900"
  - ✅ "123.456.789-00" (salvo como: 12345678900)

#### 🏢 CNPJ
- **Formato:** EXATAMENTE 14 dígitos numéricos (nunca mais, nunca menos)
- **Aceita com ou sem formatação:**
  - ✅ "12345678000190"
  - ✅ "12.345.678/0001-90" (salvo como: 12345678000190)

### 2. Salvamento no Firebase

```
customerData/
  └── {userId}/
      └── {phoneNumber}/
          ├── name: "João Silva"
          ├── email: "joao@email.com"
          ├── cpfCnpj: "12345678900"
          ├── phone: "5511999999999@c.us"
          └── updatedAt: "2025-10-21T12:00:00.000Z"
```

### 3. 🎯 Geração AUTOMÁTICA do Link

**NOVO!** Quando o **3º dado é salvo**:

1. ✅ Sistema detecta que todos os dados foram coletados
2. 🔍 Busca produtos mencionados nas **últimas 10 mensagens**
3. 🎁 Se encontrar produtos + API Asaas configurada
4. 🚀 **GERA LINK AUTOMATICAMENTE!**
5. 📲 Envia direto para o cliente

#### ⚡ NÃO Precisa Mais de Comandos!

**Antes:** Cliente precisava dizer "quero comprar", "fechar pedido", etc.

**AGORA:** Assim que o 3º dado for fornecido, se houver produtos mencionados, **o link é gerado automaticamente!** 🎉

---

## 🤖 Como Configurar o Prompt

```
Você é a [Seu Nome], assistente de vendas da [Sua Empresa].

Apresente produtos e serviços. Seja PROATIVO e sugira os mais vendidos.

Quando o cliente demonstrar interesse em adquirir algum produto:

1️⃣ Informe que precisa de alguns dados para gerar o link de pagamento
2️⃣ Pergunte o NOME (Aguarde a resposta antes de continuar)
3️⃣ Pergunte o CPF ou CNPJ (Aguarde a resposta antes de continuar)
4️⃣ Pergunte o EMAIL (Aguarde a resposta antes de continuar)

⚠️ IMPORTANTE:
- Pergunte UM dado por vez (não peça todos de uma vez!)
- Aguarde a resposta do cliente antes da próxima pergunta
- Se o cliente NÃO fornecer os 3 dados, explique que não será possível gerar o link

✨ APÓS COLETAR OS 3 DADOS:
O sistema irá gerar AUTOMATICAMENTE o link de pagamento e enviar para o cliente.
Você NÃO precisa fazer nada, apenas aguarde! O sistema faz tudo sozinho! 🚀

Seja cordial, profissional e transmita confiança!
```

### Exemplo de Conversa:

```
Cliente: "Olá, quanto custa o Curso de Excel?"

Bot: "Olá! O Curso de Excel Avançado custa R$ 299,00! 
     Ele inclui certificado, suporte vitalício e atualizações gratuitas.
     
     Gostaria de adquirir?"

Cliente: "Sim, quero!"

Bot: "Perfeito! Para gerar seu link de pagamento, preciso confirmar alguns dados.
     
     📝 Primeiro, qual é o seu nome completo?"

Cliente: "João Silva"

Bot: "Obrigada, João! 
     
     📱 Agora, qual é o seu CPF ou CNPJ?"

Cliente: "123.456.789-00"

Bot: "Ótimo!
     
     📧 Por fim, qual é o seu email?"

Cliente: "joao@email.com"

[🎯 SISTEMA DETECTA QUE TODOS OS DADOS FORAM COLETADOS]
[🔍 SISTEMA ENCONTRA "Curso de Excel" NAS MENSAGENS]
[🚀 SISTEMA GERA LINK AUTOMATICAMENTE]
[📲 SISTEMA ENVIA O LINK]

Bot (automático): ✅ Pedido Criado!

📦 Itens:
• 1x Curso de Excel Avançado - R$ 299,00

💰 Total: R$ 299,00

🔗 Link de Pagamento:
https://www.asaas.com/pay/abc123

💳 Formas de pagamento disponíveis:
• 💚 Pix (aprovação instantânea)
• 💳 Cartão de crédito
• 🎫 Boleto bancário

📅 Vencimento: 30/10/2025

Após a confirmação do pagamento, você receberá uma notificação automática! 🎉
```

---

## 📊 Logs no Console

### Durante a coleta:

```
✅ Nome detectado e salvo: João Silva
💾 Dados do cliente atualizados no Firebase
📊 Dados coletados até agora:
   Nome: João Silva ✅
   Email: ❌ Ainda não coletado
   CPF/CNPJ: ❌ Ainda não coletado
```

```
✅ CPF detectado e salvo: 12345678900
💾 Dados do cliente atualizados no Firebase
📊 Dados coletados até agora:
   Nome: João Silva ✅
   Email: ❌ Ainda não coletado
   CPF/CNPJ: 12345678900 ✅
```

### Quando o 3º dado é coletado (AUTOMÁTICO):

```
✅ Email detectado e salvo: joao@email.com
💾 Dados do cliente atualizados no Firebase
📊 Dados coletados até agora:
   Nome: João Silva ✅
   Email: joao@email.com ✅
   CPF/CNPJ: 12345678900 ✅
   
🎯 TODOS OS DADOS COLETADOS! Verificando produtos mencionados...
✅ 1 produto(s) mencionado(s): Curso de Excel Avançado
🚀 GERANDO LINK DE PAGAMENTO AUTOMATICAMENTE...
💳 Gerando cobrança no Asaas...
✅ LINK DE PAGAMENTO ENVIADO AUTOMATICAMENTE!
🎉 PROCESSO AUTOMÁTICO CONCLUÍDO COM SUCESSO!
```

---

## 🔄 Fluxo Completo (Automático)

```
1. Cliente menciona produto
   ("Quero o Curso de Excel")
   ↓
2. Bot solicita dados (um por vez)
   - Nome
   - CPF/CNPJ  
   - Email
   ↓
3. Sistema detecta e salva cada dado automaticamente
   ↓
4. Quando 3º dado é salvo:
   ↓
5. Sistema verifica produtos mencionados
   ↓
6. Sistema busca API Key do Asaas
   ↓
7. Sistema cria cobrança (com dados preenchidos!)
   ↓
8. Sistema envia link automaticamente ✨
   ↓
9. Cliente recebe link pronto para pagar
```

---

## ✅ Vantagens

- 🎯 **100% Automático:** Não precisa de comandos especiais
- ⚡ **Super Rápido:** Link gerado assim que o 3º dado é coletado
- 🧠 **Inteligente:** Detecta produtos mencionados na conversa
- 📋 **Completo:** Dados já preenchidos no Asaas
- 💾 **Reutilizável:** Dados salvos para futuras compras
- 🎨 **Natural:** Cliente nem percebe que é automático
- 🔒 **Seguro:** Firebase + validações

---

## 🔍 O Que o Sistema Verifica

Para gerar o link automaticamente, o sistema precisa de:

1. ✅ **Nome coletado**
2. ✅ **Email coletado**
3. ✅ **CPF ou CNPJ coletado**
4. ✅ **Produtos mencionados** (últimas 10 mensagens)
5. ✅ **API Key do Asaas** configurada
6. ✅ **Sessão WhatsApp** ativa

**Se TODAS as condições são atendidas → GERA LINK AUTOMATICAMENTE! 🚀**

---

## 🛠️ Manutenção

### Ver dados de um cliente

```
Firebase Console:
Database → customerData → {seu_userId} → {telefone_do_cliente}
```

### Limpar dados de um cliente

```
Firebase Console:
Database → customerData → {seu_userId} → {telefone_do_cliente}
(clique com botão direito → Delete)
```

### Ver logs em tempo real

```bash
# No terminal do backend:
pm2 logs backend

# Ou se rodando com npm:
npm run dev
```

---

## 🚨 Observações Importantes

1. **Nome:** Aceita 1 ou mais palavras (ex: "João" OU "João Silva")
2. **CNPJ:** SEMPRE 14 dígitos (o sistema ignora números com 12, 13, 15+ dígitos)
3. **Produtos:** Sistema analisa últimas **10 mensagens** para encontrar produtos
4. **Automático:** Link só é gerado SE:
   - ✅ Todos os 3 dados coletados
   - ✅ Há produtos mencionados
   - ✅ API Key configurada
5. **Privacidade:** Siga a LGPD ao coletar dados!

---

## 💡 Casos de Uso

### Cenário 1: Cliente menciona produto primeiro

```
Cliente: "Quanto custa o Curso de Python?"
Bot: "Custa R$ 399,00! Deseja adquirir?"
Cliente: "Sim!"
Bot: [Coleta nome, cpf, email]
🚀 LINK GERADO AUTOMATICAMENTE!
```

### Cenário 2: Cliente decide comprar depois

```
Cliente: "Olá!"
Bot: "Oi! Conheça nosso Curso de Marketing Digital!"
Cliente: "Interessante, vou levar!"
Bot: [Coleta nome, cpf, email]
🚀 LINK GERADO AUTOMATICAMENTE!
```

### Cenário 3: Cliente já tem dados salvos

```
Cliente: "Oi, quero o Curso de Design"
Bot: "Olá novamente, João! Gerando seu pedido..."
🚀 LINK GERADO USANDO DADOS SALVOS!
```

---

## 🎓 Dicas de Ouro

1. ✨ **Personalize o prompt** com o tom da sua marca
2. 📊 **Monitore os logs** para ver coleta em tempo real
3. 🧪 **Teste com diferentes formatos** de CPF/CNPJ
4. 🔑 **Configure a API Key** do Asaas nas configurações
5. 💬 **Seja natural** na coleta (não pareça robô!)
6. ⏱️ **Aguarde respostas** (um dado por vez!)

---

## 🎯 Requisitos para Funcionar

- ✅ Backend rodando (PM2 ou npm run dev)
- ✅ Firebase configurado
- ✅ API Key do Asaas nas configurações
- ✅ Produtos cadastrados
- ✅ Sessão WhatsApp conectada
- ✅ Prompt do assistente configurado

---

## ✨ Resumo

**Antes:**
- Cliente: "quero comprar"
- Bot pergunta dados
- Cliente fornece dados
- Bot: "gerar link de pagamento"
- Sistema gera link

**AGORA (100% Automático):**
- Cliente menciona produto
- Bot coleta dados (nome, cpf, email)
- 🎯 **ASSIM QUE O 3º DADO É COLETADO → LINK É GERADO E ENVIADO AUTOMATICAMENTE!**

---

**Sistema implementado com sucesso! 🎉**

Seu agente agora coleta dados e gera links de pagamento de forma 100% automática!

**Nenhuma ação manual necessária. Apenas aguarde a mágica acontecer! ✨**
