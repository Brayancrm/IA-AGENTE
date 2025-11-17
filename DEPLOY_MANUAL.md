# 🚀 Guia de Deploy Manual - Vercel

## 📋 Opções de Deploy Manual

### **Opção 1: Via Interface Web do Vercel (Mais Fácil)** ⭐

1. **Acesse o Dashboard do Vercel:**
   - Abra seu navegador e vá para: https://vercel.com/dashboard
   - Faça login com sua conta

2. **Selecione seu projeto:**
   - Clique no projeto "ia-agente" (ou o nome do seu projeto)

3. **Vá para a seção Deployments:**
   - No menu lateral, clique em "Deployments"
   - Você verá uma lista de todos os deployments

4. **Faça o Redeploy:**
   - Encontre o último deployment (o mais recente)
   - Clique nos **três pontos (...)** ao lado do deployment
   - Selecione **"Redeploy"**
   - Confirme clicando em **"Redeploy"** novamente

   **OU**

   - Clique no botão **"Create Deployment"** (canto superior direito)
   - Selecione o branch `main`
   - Clique em **"Deploy"**

---

### **Opção 2: Via Vercel CLI (Terminal)**

#### Passo 1: Instalar Vercel CLI (se ainda não tiver)
```powershell
npm install -g vercel
```

#### Passo 2: Fazer login no Vercel
```powershell
vercel login
```
- Isso abrirá o navegador para você fazer login
- Após o login, volte ao terminal

#### Passo 3: Navegar até a pasta do projeto
```powershell
cd "C:\Users\Dell - Brayan\IA AGENTE"
```

#### Passo 4: Fazer deploy para produção
```powershell
vercel --prod
```

**Ou usando npx (sem instalar globalmente):**
```powershell
npx vercel --prod
```

---

### **Opção 3: Via Git Push (Forçar Novo Commit)**

Se o Vercel está conectado ao GitHub/GitLab, você pode forçar um novo commit:

```powershell
# Navegar até a pasta
cd "C:\Users\Dell - Brayan\IA AGENTE"

# Adicionar todas as alterações
git add -A

# Fazer commit
git commit -m "Deploy manual - correções"

# Enviar para o repositório
git push origin main
```

O Vercel detectará automaticamente o push e iniciará um novo build.

---

### **Opção 4: Via npm Scripts**

O projeto já tem scripts configurados no `package.json`:

```powershell
# Navegar até a pasta
cd "C:\Users\Dell - Brayan\IA AGENTE"

# Opção A: Deploy normal
npm run deploy:vercel

# Opção B: Deploy forçado
npm run deploy:force

# Opção C: Deploy completo (com verificação prévia)
npm run deploy
```

---

## 🔍 Verificar Status do Deploy

Após iniciar o deploy, você pode verificar o status:

1. **No Dashboard do Vercel:**
   - Vá para: https://vercel.com/dashboard
   - Clique no seu projeto
   - Veja a seção "Deployments"
   - O status aparecerá como: "Building", "Ready", ou "Error"

2. **No Terminal (se usar CLI):**
   - O próprio comando mostrará o progresso
   - Você receberá uma URL quando o deploy estiver completo

---

## ⚠️ Solução de Problemas

### Erro: "vercel: command not found"
**Solução:** Instale o Vercel CLI:
```powershell
npm install -g vercel
```

### Erro: "Not authenticated"
**Solução:** Faça login:
```powershell
vercel login
```

### Deploy não inicia automaticamente após git push
**Solução:** 
1. Verifique se o Vercel está conectado ao repositório no dashboard
2. Vá em Settings > Git
3. Confirme que o repositório está conectado
4. Ou faça o deploy manual via interface web

### Build falha
**Solução:**
1. Veja os logs no dashboard do Vercel
2. Verifique se há erros de sintaxe no código
3. Execute `npm run build` localmente para testar:
```powershell
cd "C:\Users\Dell - Brayan\IA AGENTE"
npm run build
```

---

## 📝 Comandos Rápidos (Copy & Paste)

### Deploy via CLI (mais rápido):
```powershell
cd "C:\Users\Dell - Brayan\IA AGENTE"; npx vercel --prod --yes
```

### Deploy via Git:
```powershell
cd "C:\Users\Dell - Brayan\IA AGENTE"; git add -A; git commit -m "Deploy manual"; git push origin main
```

---

## ✅ Recomendação

**Para a maioria dos casos, use a Opção 1 (Interface Web)** - é a mais simples e confiável!

1. Acesse: https://vercel.com/dashboard
2. Clique no projeto
3. Clique em "Deployments"
4. Clique nos três pontos do último deployment
5. Selecione "Redeploy"

Pronto! 🎉
