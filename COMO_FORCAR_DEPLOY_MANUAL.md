# 🚀 Como Forçar Deploy Manual

## 📋 Deploy Manual - Passo a Passo

### 🔧 BACKEND (Railway)

#### Opção 1: Via Dashboard do Railway (Mais Fácil)

1. **Acesse:** https://railway.app
2. **Entre no seu projeto:** `IA-AGENTE` ou nome do seu projeto
3. **Vá na aba "Deployments"** (ou "Deployments" no menu lateral)
4. **Encontre o deployment que falhou** (com ❌ ou "Failed")
5. **Clique nos "..."** (três pontos) ao lado do deployment
6. **Selecione "Redeploy"** ou "Deploy Again"
7. **Aguarde 2-5 minutos** para o build completar

#### Opção 2: Forçar Novo Deploy via Git

Se o Railway está conectado ao GitHub, você pode forçar um novo deploy fazendo um commit vazio:

```bash
# No terminal, dentro da pasta do projeto:
git commit --allow-empty -m "Forçar redeploy no Railway"
git push origin main
```

O Railway detectará o novo commit e iniciará um novo deploy automaticamente.

#### Opção 3: Via Railway CLI

1. **Instale o Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Conecte ao projeto:**
   ```bash
   railway link
   ```

4. **Faça deploy:**
   ```bash
   railway up
   ```

---

### 🎨 FRONTEND (Vercel)

#### Opção 1: Via Dashboard da Vercel (Mais Fácil)

1. **Acesse:** https://vercel.com/dashboard
2. **Selecione seu projeto:** `ia-agente` ou nome do seu projeto
3. **Vá na aba "Deployments"**
4. **Encontre o deployment que falhou** (com ❌ ou "Failed")
5. **Clique nos "..."** (três pontos) ao lado do deployment
6. **Selecione "Redeploy"**
7. **Escolha:**
   - ✅ **"Use existing Build Cache"** (mais rápido, usa cache)
   - ❌ **Desmarque** para forçar rebuild completo
8. **Clique em "Redeploy"**
9. **Aguarde 2-3 minutos**

#### Opção 2: Via Vercel CLI

1. **Instale o Vercel CLI** (se não tiver):
   ```bash
   npm install -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy para produção:**
   ```bash
   vercel --prod
   ```

4. **Ou forçar rebuild completo:**
   ```bash
   vercel --prod --force
   ```

#### Opção 3: Forçar Novo Deploy via Git

```bash
# No terminal, dentro da pasta do projeto:
git commit --allow-empty -m "Forçar redeploy na Vercel"
git push origin main
```

A Vercel detectará o novo commit e iniciará um novo deploy automaticamente.

---

## 🔍 Verificar Status do Deploy

### Railway (Backend)

1. **Acesse:** https://railway.app
2. **Vá em "Deployments"**
3. **Veja o status:**
   - 🟡 **Building** - Em progresso
   - 🟢 **Active** - Funcionando
   - 🔴 **Failed** - Falhou (veja logs)

4. **Ver logs:**
   - Clique no deployment
   - Veja a aba "Logs" para erros

### Vercel (Frontend)

1. **Acesse:** https://vercel.com/dashboard
2. **Vá em "Deployments"**
3. **Veja o status:**
   - 🟡 **Building** - Em progresso
   - 🟢 **Ready** - Funcionando
   - 🔴 **Error** - Falhou (veja logs)

4. **Ver logs:**
   - Clique no deployment
   - Veja a aba "Build Logs" ou "Function Logs"

---

## 🐛 Se o Deploy Continuar Falhando

### Backend (Railway)

1. **Verifique os logs:**
   - Railway → Deployments → Clique no deployment → Logs
   - Procure por erros em vermelho

2. **Verifique variáveis de ambiente:**
   - Railway → Settings → Variables
   - Certifique-se que `SERVICE_ACCOUNT_KEY` está configurada

3. **Verifique o código:**
   - Erros de sintaxe
   - Dependências faltando
   - Imports quebrados

### Frontend (Vercel)

1. **Verifique os logs:**
   - Vercel → Deployments → Clique no deployment → Build Logs
   - Procure por erros em vermelho

2. **Teste localmente:**
   ```bash
   npm run build
   ```
   Se falhar localmente, o problema está no código.

3. **Verifique variáveis de ambiente:**
   - Vercel → Settings → Environment Variables
   - Certifique-se que todas as variáveis do Firebase estão configuradas

---

## ⚡ Deploy Rápido (Ambos)

Se você quer forçar deploy em ambos ao mesmo tempo:

```bash
# 1. Commit vazio para forçar deploy
git commit --allow-empty -m "Forçar redeploy completo"
git push origin main

# 2. Aguarde 2-3 minutos
# 3. Verifique:
#    - Railway: https://railway.app
#    - Vercel: https://vercel.com/dashboard
```

---

## 📱 Comandos Úteis

### Railway CLI
```bash
railway status          # Ver status
railway logs            # Ver logs em tempo real
railway up              # Fazer deploy
railway open            # Abrir dashboard
```

### Vercel CLI
```bash
vercel ls               # Listar deployments
vercel logs             # Ver logs
vercel --prod           # Deploy produção
vercel --prod --force   # Deploy forçado (sem cache)
vercel inspect          # Ver configurações
```

---

## ✅ Checklist de Deploy

Antes de fazer deploy manual, verifique:

- [ ] Código está commitado no GitHub
- [ ] Não há erros de sintaxe
- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas (`npm install`)
- [ ] Build funciona localmente (`npm run build`)

---

## 🎯 Resumo Rápido

**Backend (Railway):**
1. Railway → Deployments → "..." → Redeploy
2. Ou: `git commit --allow-empty -m "redeploy" && git push`

**Frontend (Vercel):**
1. Vercel → Deployments → "..." → Redeploy
2. Ou: `vercel --prod --force`

**Ambos:**
```bash
git commit --allow-empty -m "Forçar redeploy"
git push origin main
```

---

**Pronto!** 🚀

