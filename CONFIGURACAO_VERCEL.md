# ⚙️ Configuração da Vercel para Produção

## 🎯 O Problema

O site https://ia-agente.vercel.app/ está tentando se conectar a `http://localhost:3001`, mas isso **não funciona** porque:

- ❌ `localhost` é o seu computador local
- ❌ A Vercel não tem acesso ao seu computador
- ❌ Usuários externos não conseguem usar o sistema

## ✅ A Solução

Você precisa fazer 2 coisas:

1. **Fazer deploy do backend** em um servidor público
2. **Configurar a URL do backend na Vercel**

---

## 🚀 Passo 1: Deploy do Backend

Escolha uma das opções:

### Opção A: Railway.app (Recomendado)
- $5 grátis por mês
- Deploy automático do GitHub
- [Ver guia completo](./DEPLOY_BACKEND.md#-opção-1-railwayapp-recomendado---grátis)

### Opção B: Render.com
- Plano gratuito (com limitações)
- [Ver guia completo](./DEPLOY_BACKEND.md#-opção-2-rendercom-grátis-com-limitações)

### Opção C: VPS Próprio
- Se você tem um servidor
- [Ver guia completo](./DEPLOY_BACKEND.md#-opção-3-vps-digitalocean-aws-azure)

---

## 🔧 Passo 2: Configurar na Vercel

Depois de fazer deploy do backend, você terá uma URL tipo:
- `https://seu-app.up.railway.app` (Railway)
- `https://seu-app.onrender.com` (Render)
- `https://seu-dominio.com` (VPS)

### 1. Acesse o Dashboard da Vercel

👉 https://vercel.com/dashboard

### 2. Selecione seu projeto

Clique em `ia-agente` (ou o nome do seu projeto)

### 3. Vá para Settings

No menu lateral: **Settings**

### 4. Adicione a Variável de Ambiente

- Clique em **Environment Variables**
- Clique em **Add New**

### 5. Configure:

```
Name:  NEXT_PUBLIC_BACKEND_URL
Value: https://sua-url-do-backend.com
```

**IMPORTANTE:** Não coloque `/` no final da URL!

✅ Correto: `https://seu-app.up.railway.app`  
❌ Errado: `https://seu-app.up.railway.app/`

### 6. Selecione os ambientes:

- ✅ Production
- ✅ Preview
- ✅ Development

### 7. Salve

Clique em **Save**

### 8. Faça Redeploy

- Vá em **Deployments** (menu lateral)
- Clique nos **...** da última deployment
- Selecione **Redeploy**
- Aguarde o deploy terminar

---

## ✅ Testar

### 1. Teste o Backend Diretamente

Abra no navegador:
```
https://sua-url-do-backend.com
```

Deve aparecer:
```json
{
  "status": "online",
  "service": "WhatsApp IA Backend",
  "version": "1.0.0",
  "activeSessions": 0
}
```

### 2. Teste no Site

1. Acesse: https://ia-agente.vercel.app/
2. Faça login
3. Vá no Dashboard
4. Clique **"Iniciar WhatsApp"**
5. O QR Code deve aparecer! ✅

---

## 🔍 Verificar se Funcionou

### Método 1: Console do Navegador

1. Abra o site: https://ia-agente.vercel.app/
2. Pressione **F12** (DevTools)
3. Vá na aba **Console**
4. Faça login
5. Vá no Dashboard

Se aparecer erros tipo:
- ❌ `Failed to fetch http://localhost:3001` → Variável não configurada
- ❌ `CORS error` → Backend não configurado corretamente
- ✅ Sem erros → Está funcionando!

### Método 2: Network Tab

1. Pressione **F12**
2. Vá na aba **Network**
3. No Dashboard, clique "Iniciar WhatsApp"
4. Veja as requisições

Você deve ver requisições para:
```
POST https://sua-url-do-backend.com/api/sessions/create
```

Se estiver indo para `localhost:3001`, a variável não está configurada.

---

## 🐛 Problemas Comuns

### Erro: "Failed to fetch http://localhost:3001"

**Causa:** Variável `NEXT_PUBLIC_BACKEND_URL` não configurada na Vercel

**Solução:**
1. Adicione a variável na Vercel
2. Faça redeploy
3. Limpe o cache do navegador (Ctrl+Shift+R)

### Erro: "CORS policy"

**Causa:** Backend não permite conexões da Vercel

**Solução:**
- O código já está atualizado com CORS correto
- Reinicie o backend
- Verifique se o backend está usando a versão mais recente do código

### Backend não responde

**Causa:** Backend não está rodando ou URL errada

**Solução:**
1. Teste a URL do backend diretamente no navegador
2. Verifique os logs do backend (Railway/Render dashboard)
3. Confirme que o backend está rodando

### Site carrega mas botões não funcionam

**Causa:** JavaScript está usando a URL antiga

**Solução:**
1. Limpe o cache: Ctrl+Shift+R
2. Teste em aba anônima
3. Verifique se o redeploy terminou

---

## 📊 Variáveis de Ambiente da Vercel

Você deve ter estas variáveis configuradas:

| Variável | Exemplo | Necessário |
|----------|---------|------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | AIza... | ✅ Sim |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ia-agente-b2f46.firebaseapp.com | ✅ Sim |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ia-agente-b2f46 | ✅ Sim |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ia-agente-b2f46.appspot.com | ✅ Sim |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 123456789 | ✅ Sim |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 1:123:web:abc | ✅ Sim |
| `NEXT_PUBLIC_APP_ID` | whatsapp-sales-agent | ✅ Sim |
| `NEXT_PUBLIC_BACKEND_URL` | https://seu-backend.com | ✅ **NOVO!** |

---

## 🎯 Resumo Rápido

```bash
# 1. Deploy do backend (Railway exemplo)
- Vá em railway.app
- New Project → Deploy from GitHub
- Selecione IA-AGENTE/backend
- Copie a URL gerada

# 2. Configure na Vercel
- vercel.com/dashboard
- Selecione ia-agente
- Settings → Environment Variables
- Adicione: NEXT_PUBLIC_BACKEND_URL = sua-url
- Salve
- Deployments → Redeploy

# 3. Teste
- Abra ia-agente.vercel.app
- Faça login
- Dashboard → Iniciar WhatsApp
- Funcionou! ✅
```

---

## 💡 Dica: Ambiente Local vs Produção

### Para desenvolvimento local:

Crie arquivo `.env.local` na raiz do projeto:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Para produção (Vercel):

Configure na dashboard:
```env
NEXT_PUBLIC_BACKEND_URL=https://seu-backend.com
```

Assim você pode trabalhar localmente sem problemas!

---

## 📞 Ainda com Dúvidas?

1. Veja o guia completo: [DEPLOY_BACKEND.md](./DEPLOY_BACKEND.md)
2. Verifique os logs na Vercel: https://vercel.com/dashboard
3. Verifique os logs do backend (Railway/Render)
4. Teste no modo incógnito do navegador

---

**Depois de configurar, seu sistema funcionará 100% online! 🎉**

