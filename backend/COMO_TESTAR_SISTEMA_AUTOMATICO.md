# 🧪 Como Testar o Sistema 100% Automático

## 📋 Pré-requisitos

Antes de testar, certifique-se que:

- ✅ Backend está rodando (`pm2 logs backend` ou `npm run dev`)
- ✅ WhatsApp conectado (QR Code escaneado)
- ✅ API Key do Asaas configurada
- ✅ Pelo menos 1 produto cadastrado
- ✅ Prompt do assistente configurado

---

## 🎯 Teste Completo (Passo a Passo)

### 1️⃣ Abra o Terminal do Backend

```bash
cd backend
pm2 logs backend --lines 50
```

Ou se estiver rodando com npm:
```bash
npm run dev
```

### 2️⃣ Inicie Conversa no WhatsApp

Abra seu WhatsApp e envie mensagem para o número conectado:

```
Olá!
```

**Aguarde resposta do bot.**

---

### 3️⃣ Mencione um Produto

```
Quanto custa o [Nome do Produto]?
```

Exemplo:
```
Quanto custa o Curso de Excel?
```

**Aguarde resposta do bot.**

---

### 4️⃣ Demonstre Interesse

```
Quero comprar!
```

ou

```
Vou levar!
```

**O bot deve perguntar o NOME.**

---

### 5️⃣ Forneça o Nome

```
João Silva
```

**👀 OBSERVE NO TERMINAL:**
```
✅ Nome detectado e salvo: João Silva
💾 Dados do cliente atualizados no Firebase
📊 Dados coletados até agora:
   Nome: João Silva ✅
   Email: ❌ Ainda não coletado
   CPF/CNPJ: ❌ Ainda não coletado
```

**O bot deve perguntar o CPF/CNPJ.**

---

### 6️⃣ Forneça o CPF ou CNPJ

Para CPF (11 dígitos):
```
123.456.789-00
```

ou sem formatação:
```
12345678900
```

Para CNPJ (14 dígitos):
```
12.345.678/0001-90
```

ou sem formatação:
```
12345678000190
```

**👀 OBSERVE NO TERMINAL:**
```
✅ CPF detectado e salvo: 12345678900
💾 Dados do cliente atualizados no Firebase
📊 Dados coletados até agora:
   Nome: João Silva ✅
   Email: ❌ Ainda não coletado
   CPF/CNPJ: 12345678900 ✅
```

**O bot deve perguntar o EMAIL.**

---

### 7️⃣ Forneça o Email

```
joao@email.com
```

ou

```
joao.silva@empresa.com.br
```

**👀 OBSERVE NO TERMINAL (MÁGICA ACONTECE!):**
```
✅ Email detectado e salvo: joao@email.com
💾 Dados do cliente atualizados no Firebase
📊 Dados coletados até agora:
   Nome: João Silva ✅
   Email: joao@email.com ✅
   CPF/CNPJ: 12345678900 ✅
   
🎯 TODOS OS DADOS COLETADOS! Verificando produtos mencionados...
✅ 1 produto(s) mencionado(s): Curso de Excel
🚀 GERANDO LINK DE PAGAMENTO AUTOMATICAMENTE...
💳 Gerando cobrança no Asaas...
✅ Cobrança criada com sucesso! ID: pay_abc123
✅ LINK DE PAGAMENTO ENVIADO AUTOMATICAMENTE!
🎉 PROCESSO AUTOMÁTICO CONCLUÍDO COM SUCESSO!
```

---

### 8️⃣ Receba o Link (Automático!)

**O bot enviará automaticamente:**

```
✅ Pedido Criado!

📦 Itens:
• 1x Curso de Excel - R$ 299,00

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

## ✅ Validações

### 1. Verifique no Firebase

```
Firebase Console:
Database → customerData → {seu_userId} → {telefone_do_cliente}
```

Deve ter:
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "cpfCnpj": "12345678900",
  "phone": "5511999999999@c.us",
  "updatedAt": "2025-10-21T12:34:56.789Z"
}
```

### 2. Verifique no Asaas

1. Acesse: https://www.asaas.com
2. Vá em: **Cobranças**
3. Encontre a cobrança criada
4. Verifique se os dados estão preenchidos:
   - ✅ Nome: João Silva
   - ✅ Email: joao@email.com
   - ✅ CPF: 123.456.789-00

### 3. Verifique o Link

1. Clique no link enviado pelo bot
2. Confirme que abre a página de pagamento do Asaas
3. Confirme que os dados estão preenchidos

---

## 🐛 Resolução de Problemas

### ❌ Link não foi gerado automaticamente

**Possíveis causas:**

1. **API Key não configurada**
   ```
   Vá em: Dashboard → Configurações → Asaas → Cole a API Key
   ```

2. **Produto não foi mencionado**
   ```
   Certifique-se de mencionar um produto cadastrado antes de fornecer os dados
   ```

3. **Backend não está rodando**
   ```bash
   pm2 status
   # Se não estiver rodando:
   pm2 restart backend
   ```

4. **Erro nos logs**
   ```bash
   pm2 logs backend --err
   ```

---

### ❌ Dados não foram detectados

**1. Nome não foi detectado:**
   - ✅ Use nome SEM números
   - ✅ Use nome SEM caracteres especiais (@, #, etc.)
   - ✅ Exemplos válidos: "João", "Maria Silva"

**2. CPF não foi detectado:**
   - ✅ Use EXATAMENTE 11 dígitos
   - ✅ Pode ter ou não formatação
   - ✅ Exemplos: "12345678900" ou "123.456.789-00"

**3. CNPJ não foi detectado:**
   - ✅ Use EXATAMENTE 14 dígitos
   - ✅ Pode ter ou não formatação
   - ✅ Exemplos: "12345678000190" ou "12.345.678/0001-90"

**4. Email não foi detectado:**
   - ✅ Use formato: usuario@dominio.extensao
   - ✅ Exemplos: "joao@gmail.com", "maria@empresa.com.br"

---

### ❌ Bot não está respondendo

**1. Verifique conexão WhatsApp:**
   ```bash
   pm2 logs backend | grep "READY"
   ```
   
   Deve aparecer:
   ```
   ✅ Cliente WhatsApp READY!
   ```

**2. Verifique se há erros:**
   ```bash
   pm2 logs backend --err
   ```

**3. Reinicie o backend:**
   ```bash
   pm2 restart backend
   ```

---

## 🎓 Teste Avançado

### Teste com Cliente que já tem Dados

1. **Limpe os dados** do cliente no Firebase
2. **Faça o fluxo completo** (coleta dados)
3. **Inicie nova conversa** com o MESMO número
4. **Mencione outro produto**
5. **Sistema deve usar os dados salvos** automaticamente!

---

### Teste com Múltiplos Produtos

1. Mencione **2 ou mais produtos** na conversa:
   ```
   Cliente: "Tenho interesse no Curso de Excel e também no Curso de Python"
   ```

2. **Forneça os 3 dados**
3. **Sistema deve criar cobrança com TODOS os produtos mencionados!**

---

### Teste de Validação

**Nome inválido:**
```
João123 ❌
teste@email ❌
João Silva ✅
```

**CPF inválido:**
```
123456 ❌ (poucos dígitos)
12345678900 ✅ (11 dígitos)
123456789001 ❌ (12 dígitos)
```

**CNPJ inválido:**
```
1234567890 ❌ (10 dígitos)
12345678000190 ✅ (14 dígitos)
123456780001901 ❌ (15 dígitos)
```

**Email inválido:**
```
joao@ ❌
joao@email ❌
joao@email.com ✅
```

---

## 📊 Checklist Final

- [ ] Backend rodando
- [ ] WhatsApp conectado
- [ ] API Key configurada
- [ ] Produto cadastrado
- [ ] Prompt configurado
- [ ] Teste de coleta de nome funcionou
- [ ] Teste de coleta de CPF/CNPJ funcionou
- [ ] Teste de coleta de email funcionou
- [ ] Link foi gerado automaticamente
- [ ] Link foi enviado para o cliente
- [ ] Dados foram salvos no Firebase
- [ ] Cobrança foi criada no Asaas
- [ ] Dados estão preenchidos no Asaas

---

## 🎉 Se Tudo Funcionou

**PARABÉNS!** 🎊

Seu sistema está 100% funcional e automático!

Agora você pode:
- 📱 Testar com clientes reais
- 📊 Monitorar vendas no Asaas
- 💰 Receber pagamentos automaticamente
- 🎯 Focar em vender, o sistema cuida do resto!

---

## 📞 Precisa de Ajuda?

Se algo não funcionou:

1. **Leia os logs** (`pm2 logs backend`)
2. **Verifique os passos** deste guia
3. **Teste um passo por vez**
4. **Documente o erro** para investigação

---

**Sistema testado e aprovado! ✅**

**Boas vendas! 🚀💰**

