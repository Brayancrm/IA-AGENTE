# 📧 Como Configurar Unlayer (Editor de Email)

## 🎯 Onde Adicionar a Variável de Ambiente

Você precisa adicionar a variável `NEXT_PUBLIC_UNLAYER_PROJECT_ID` em **2 lugares**:

---

## 1️⃣ **DESENVOLVIMENTO LOCAL** (Seu Computador)

### Criar arquivo `.env.local` na raiz do projeto

1. **Crie um arquivo chamado `.env.local`** na pasta raiz do projeto (mesma pasta onde está o `package.json`)

2. **Adicione a variável:**
   ```env
   NEXT_PUBLIC_UNLAYER_PROJECT_ID=seu_project_id_aqui
   ```

3. **Exemplo completo do arquivo `.env.local`:**
   ```env
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=sua-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ia-agente-b2f46.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=ia-agente-b2f46
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ia-agente-b2f46.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=seu-app-id

   # Backend URL
   NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

   # Unlayer Editor
   NEXT_PUBLIC_UNLAYER_PROJECT_ID=seu_project_id_aqui
   ```

4. **Reinicie o servidor de desenvolvimento:**
   ```bash
   # Pare o servidor (Ctrl+C) e inicie novamente
   npm run dev
   ```

---

## 2️⃣ **PRODUÇÃO** (Vercel)

### Adicionar variável no Dashboard da Vercel

1. **Acesse o Dashboard da Vercel:**
   👉 https://vercel.com/dashboard

2. **Selecione seu projeto:**
   - Clique no projeto `IA AGENTE` ou o nome do seu projeto

3. **Vá em Settings:**
   - No menu lateral, clique em **"Settings"**

4. **Vá em Environment Variables:**
   - No menu de Settings, clique em **"Environment Variables"**

5. **Adicione a nova variável:**
   - **Key:** `NEXT_PUBLIC_UNLAYER_PROJECT_ID`
   - **Value:** `seu_project_id_aqui` (cole o Project ID que você obteve do Unlayer)
   - **Environment:** Selecione todas as opções:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

6. **Clique em "Save"**

7. **Faça um novo deploy:**
   - Vá em **"Deployments"**
   - Clique nos **3 pontinhos** (⋯) do último deployment
   - Selecione **"Redeploy"**
   - OU faça um commit e push para o GitHub (deploy automático)

---

## 🔍 Como Obter o Project ID do Unlayer

1. **Acesse:** https://unlayer.com
2. **Faça login** na sua conta
3. **Vá em:** Developer Console (ou Dashboard)
4. **Crie um novo projeto** ou selecione um existente
5. **Copie o Project ID** (número que aparece nas configurações do projeto)

---

## ✅ Verificar se Funcionou

### Desenvolvimento Local:
1. Abra o console do navegador (F12)
2. Vá na aba "Console"
3. Ao abrir o modal de criar template de email, você deve ver:
   ```
   ✅ Unlayer script carregado
   ✅ Editor Unlayer inicializado
   ```

### Produção:
1. Acesse o site em produção
2. Faça login como master
3. Vá na área "Email" do sidebar
4. Clique em "Criar Template"
5. O editor deve carregar normalmente

---

## ⚠️ Importante

- **Nunca commite o arquivo `.env.local`** no Git (ele já está no `.gitignore`)
- **Sempre adicione variáveis na Vercel** para produção
- **Reinicie o servidor** após adicionar variáveis locais
- **Faça redeploy** após adicionar variáveis na Vercel

---

## 🆘 Problemas Comuns

### ❌ "Editor não está pronto"
- Verifique se a variável está configurada corretamente
- Verifique se o Project ID está correto
- Verifique o console do navegador para erros

### ❌ "Unlayer script não carregou"
- Verifique sua conexão com a internet
- Verifique se não há bloqueadores de script (AdBlock, etc.)
- Verifique o console do navegador para erros de CORS

### ❌ "Project ID inválido"
- Verifique se copiou o ID completo
- Verifique se não há espaços antes/depois do ID
- Crie um novo projeto no Unlayer se necessário

