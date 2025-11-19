# 📧 Como Configurar AWS SES (Simple Email Service)

## 💰 Preço
- **US$ 0,10 por 1.000 emails enviados**
- **62.000 emails grátis por mês** (se estiver usando EC2)
- Muito mais barato que SendGrid!

---

## 🎯 Onde Adicionar as Variáveis de Ambiente

Você precisa adicionar as variáveis do AWS SES em **2 lugares**:

---

## 1️⃣ **DESENVOLVIMENTO LOCAL** (Seu Computador)

### Criar/editar arquivo `.env` na pasta `backend/`

1. **Crie ou edite o arquivo `.env`** na pasta `backend/` (mesma pasta onde está o `server.js`)

2. **Adicione as variáveis:**
   ```env
   AWS_ACCESS_KEY_ID=sua_access_key_aqui
   AWS_SECRET_ACCESS_KEY=sua_secret_key_aqui
   AWS_SES_REGION=us-east-1
   AWS_SES_FROM_EMAIL=noreply@seudominio.com
   ```

3. **Exemplo completo do arquivo `backend/.env`:**
   ```env
   # Configurações do Servidor
   PORT=3001
   NODE_ENV=development

   # Firebase
   FIREBASE_DATABASE_URL=https://ia-agente-b2f46.firebaseio.com

   # URLs
   FRONTEND_URL=http://localhost:3000
   FRONTEND_URL_PROD=https://ia-agente.vercel.app

   # AWS SES (Email)
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   AWS_SES_REGION=us-east-1
   AWS_SES_FROM_EMAIL=noreply@seudominio.com
   ```

4. **Reinicie o servidor backend:**
   ```bash
   # Pare o servidor (Ctrl+C) e inicie novamente
   cd backend
   npm start
   # ou
   npm run dev
   ```

---

## 2️⃣ **PRODUÇÃO** (Railway/Render)

### Adicionar variáveis no Dashboard da Railway/Render

1. **Acesse o Dashboard:**
   - **Railway:** https://railway.app/dashboard
   - **Render:** https://dashboard.render.com

2. **Selecione seu projeto backend**

3. **Vá em Variables ou Environment Variables**

4. **Adicione as seguintes variáveis:**
   - **Key:** `AWS_ACCESS_KEY_ID`
     **Value:** `sua_access_key_aqui`
   
   - **Key:** `AWS_SECRET_ACCESS_KEY`
     **Value:** `sua_secret_key_aqui`
   
   - **Key:** `AWS_SES_REGION`
     **Value:** `us-east-1` (ou a região que você escolher)
   
   - **Key:** `AWS_SES_FROM_EMAIL`
     **Value:** `noreply@seudominio.com` (deve ser um email verificado no SES)

5. **Salve e faça redeploy** do backend

---

## 🔍 Como Obter as Credenciais do AWS SES

### Passo 1: Criar Conta AWS (se não tiver)

1. Acesse: https://aws.amazon.com
2. Clique em **"Criar uma conta AWS"** ou **"Fazer login"**
3. Complete o cadastro (pode usar cartão de crédito, mas não será cobrado se ficar no free tier)

### Passo 2: Criar IAM User com Permissões SES

1. **Acesse o Console IAM:**
   - Vá para: https://console.aws.amazon.com/iam
   - Ou procure por "IAM" na barra de busca do AWS

2. **Criar um novo usuário:**
   - Clique em **"Users"** (Usuários) no menu lateral
   - Clique em **"Create user"** (Criar usuário)
   - **Username:** `ses-email-sender` (ou qualquer nome)
   - Clique em **"Next"**

3. **Adicionar permissões:**
   - Selecione **"Attach policies directly"**
   - Procure e selecione: **"AmazonSESFullAccess"**
   - Clique em **"Next"** e depois **"Create user"**

4. **Criar Access Keys:**
   - Clique no usuário que você acabou de criar
   - Vá na aba **"Security credentials"**
   - Role até **"Access keys"**
   - Clique em **"Create access key"**
   - Selecione **"Application running outside AWS"**
   - Clique em **"Next"** e depois **"Create access key"**
   - **IMPORTANTE:** Copie o **Access Key ID** e **Secret Access Key** imediatamente!
   - Você não poderá ver a Secret Key novamente depois

### Passo 3: Verificar Email no SES

1. **Acesse o Console SES:**
   - Vá para: https://console.aws.amazon.com/ses
   - Ou procure por "SES" na barra de busca

2. **Verificar email remetente:**
   - No menu lateral, clique em **"Verified identities"**
   - Clique em **"Create identity"**
   - Selecione **"Email address"**
   - Digite o email que você quer usar como remetente (ex: `noreply@seudominio.com`)
   - Clique em **"Create identity"**
   - **Verifique o email:** AWS enviará um email de verificação. Clique no link para verificar.

3. **Escolher região:**
   - **IMPORTANTE:** O SES funciona por região. Escolha uma região (ex: `us-east-1`, `sa-east-1` para Brasil)
   - Use a mesma região nas variáveis `AWS_SES_REGION`

### Passo 4: Sair do Sandbox (Opcional mas Recomendado)

Por padrão, o SES está em **"Sandbox mode"**, o que significa:
- ✅ Você só pode enviar para emails **verificados**
- ❌ Não pode enviar para qualquer email

**Para sair do Sandbox e enviar para qualquer email:**

1. No Console SES, vá em **"Account dashboard"**
2. Role até **"Sending limits"**
3. Clique em **"Request production access"**
4. Preencha o formulário explicando seu caso de uso
5. Aguarde aprovação (geralmente 24-48 horas)

---

## ✅ Verificar se Funcionou

### Desenvolvimento Local:

1. Inicie o servidor backend:
   ```bash
   cd backend
   npm start
   ```

2. Verifique os logs. Você deve ver:
   ```
   ✅ AWS SES inicializado
   ```

3. Se aparecer:
   ```
   ⚠️ AWS SES não configurado
   ```
   Verifique se as variáveis estão corretas no arquivo `.env`

### Produção:

1. Verifique os logs do backend no Railway/Render
2. Deve aparecer: `✅ AWS SES inicializado`

---

## ⚠️ Importante

- **Nunca commite o arquivo `.env`** no Git (ele já está no `.gitignore`)
- **Sempre adicione variáveis na Railway/Render** para produção
- **O email remetente (`AWS_SES_FROM_EMAIL`)** deve ser verificado no SES
- **Se estiver em Sandbox**, só pode enviar para emails verificados
- **Use a mesma região** em `AWS_SES_REGION` que você configurou no SES

---

## 🆘 Problemas Comuns

### ❌ "AWS SES não configurado"
- Verifique se as variáveis `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` estão no `.env`
- Verifique se não há espaços antes/depois dos valores
- Reinicie o servidor após adicionar as variáveis

### ❌ "Email address is not verified"
- O email remetente precisa ser verificado no SES
- Verifique o email no Console SES → Verified identities
- Clique no link de verificação enviado por email

### ❌ "Message rejected: Email address is not verified"
- Você está em Sandbox mode
- Só pode enviar para emails verificados
- Solicite sair do Sandbox no Console SES

### ❌ "The security token included in the request is invalid"
- As credenciais (Access Key ID ou Secret Access Key) estão incorretas
- Verifique se copiou corretamente (sem espaços)
- Crie novas Access Keys se necessário

### ❌ "Region not found"
- Verifique se a região em `AWS_SES_REGION` está correta
- Regiões comuns: `us-east-1`, `us-west-2`, `sa-east-1` (Brasil), `eu-west-1`

---

## 📚 Recursos Úteis

- **Documentação AWS SES:** https://docs.aws.amazon.com/ses/
- **Console SES:** https://console.aws.amazon.com/ses
- **Console IAM:** https://console.aws.amazon.com/iam
- **Preços AWS SES:** https://aws.amazon.com/ses/pricing/

---

## 💡 Dica

Se você tem um domínio próprio, pode verificar o domínio inteiro no SES em vez de verificar cada email individualmente. Isso permite usar qualquer email do domínio (ex: `noreply@`, `contato@`, `vendas@`, etc.).

