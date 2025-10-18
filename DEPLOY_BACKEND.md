# 🚀 Como Fazer Deploy do Backend em Produção

Para que o site na Vercel (https://ia-agente.vercel.app/) funcione, você precisa fazer deploy do backend em algum servidor público.

---

## ⚠️ IMPORTANTE

O frontend na Vercel **NÃO CONSEGUE** se conectar ao `localhost:3001` do seu computador!

Você precisa:
1. ✅ Fazer deploy do backend em um servidor público
2. ✅ Configurar a variável de ambiente `NEXT_PUBLIC_BACKEND_URL` na Vercel

---

## 🎯 Opções de Deploy do Backend

### 🔥 Opção 1: Railway.app (RECOMENDADO - Grátis)

**Vantagens:**
- ✅ $5 de crédito grátis por mês
- ✅ Deploy automático do GitHub
- ✅ Suporta PM2
- ✅ URL HTTPS gratuita
- ✅ Fácil configuração

**Como fazer:**

1. **Criar conta:** https://railway.app

2. **Novo Projeto:**
   - Click em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Conecte seu repositório `IA-AGENTE`
   - Selecione o diretório `backend/`

3. **Configurar Variáveis de Ambiente:**
   - Vá em "Variables"
   - Adicione:
     ```
     PORT=3001
     NODE_ENV=production
     FIREBASE_DATABASE_URL=https://ia-agente-b2f46.firebaseio.com
     ```

4. **Adicionar serviceAccountKey.json:**
   - Copie o conteúdo do seu `serviceAccountKey.json`
   - Crie uma variável chamada `SERVICE_ACCOUNT_JSON`
   - Cole o conteúdo completo

5. **Configurar Start Command:**
   - Em "Settings" → "Deploy"
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

6. **Deploy!**
   - Railway gerará uma URL tipo: `https://seu-app.up.railway.app`
   - Copie essa URL

7. **Configurar na Vercel:**
   - Vá em: https://vercel.com/dashboard
   - Selecione seu projeto `ia-agente`
   - Settings → Environment Variables
   - Adicione:
     ```
     NEXT_PUBLIC_BACKEND_URL=https://seu-app.up.railway.app
     ```
   - Salve e faça redeploy

---

### 🎨 Opção 2: Render.com (Grátis com limitações)

**Vantagens:**
- ✅ Plano gratuito disponível
- ✅ URL HTTPS automática
- ✅ Deploy do GitHub

**Limitações:**
- ⚠️ Servidor "dorme" após 15 minutos de inatividade
- ⚠️ Demora ~30s para "acordar"

**Como fazer:**

1. **Criar conta:** https://render.com

2. **Novo Web Service:**
   - Dashboard → New → Web Service
   - Conecte seu repositório GitHub
   - Root Directory: `backend`

3. **Configurações:**
   ```
   Name: whatsapp-ia-backend
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   Plan: Free
   ```

4. **Environment Variables:**
   - Adicione todas as variáveis necessárias
   - Incluindo o SERVICE_ACCOUNT_JSON

5. **Deploy e configure na Vercel** (mesmos passos da Railway)

---

### 🖥️ Opção 3: VPS (DigitalOcean, AWS, Azure)

**Para quem tem VPS:**

1. **SSH no servidor:**
   ```bash
   ssh seu-usuario@seu-servidor
   ```

2. **Instalar Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clonar repositório:**
   ```bash
   git clone https://github.com/Brayancrm/IA-AGENTE.git
   cd IA-AGENTE/backend
   ```

4. **Instalar dependências:**
   ```bash
   npm install
   ```

5. **Configurar .env:**
   ```bash
   nano .env
   ```
   Cole suas configurações

6. **Adicionar serviceAccountKey.json:**
   ```bash
   nano serviceAccountKey.json
   ```
   Cole o conteúdo

7. **Iniciar com PM2:**
   ```bash
   npm run pm2:start
   pm2 startup
   pm2 save
   ```

8. **Configurar Nginx (Opcional):**
   ```nginx
   server {
       listen 80;
       server_name seu-dominio.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

9. **Configurar SSL com Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d seu-dominio.com
   ```

---

## 🔧 Configurar URL do Backend na Vercel

Depois de fazer deploy do backend:

1. **Acesse:** https://vercel.com/dashboard

2. **Selecione seu projeto:** `ia-agente`

3. **Vá em:** Settings → Environment Variables

4. **Adicione a variável:**
   ```
   Name: NEXT_PUBLIC_BACKEND_URL
   Value: https://sua-url-do-backend.com
   ```

5. **Adicione para todos os ambientes:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development

6. **Salve**

7. **Faça Redeploy:**
   - Vá em "Deployments"
   - Clique nos "..." da última deployment
   - Selecione "Redeploy"

---

## ✅ Testar a Conexão

Após configurar tudo:

1. **Teste o backend diretamente:**
   ```bash
   curl https://sua-url-do-backend.com
   ```
   
   Deve retornar:
   ```json
   {
     "status": "online",
     "service": "WhatsApp IA Backend",
     "version": "1.0.0"
   }
   ```

2. **Teste no site:**
   - Acesse: https://ia-agente.vercel.app/
   - Faça login
   - Vá no Dashboard
   - Clique "Iniciar WhatsApp"
   - Deve funcionar!

---

## 🐛 Solução de Problemas

### Erro: CORS

Se aparecer erro de CORS no console do navegador:

1. Verifique se o backend tem a URL da Vercel no CORS
2. O arquivo `backend/server.js` já está configurado
3. Reinicie o backend após fazer mudanças

### Erro: Failed to fetch

Significa que o frontend não consegue alcançar o backend:

1. Verifique se o backend está rodando
2. Teste a URL do backend diretamente no navegador
3. Confirme que a variável `NEXT_PUBLIC_BACKEND_URL` está configurada na Vercel
4. Faça redeploy na Vercel após adicionar a variável

### Backend "dorme" (Render Free)

No plano gratuito do Render, o backend dorme após 15 minutos:

**Solução 1:** Upgrade para plano pago ($7/mês)

**Solução 2:** Use um serviço de "keep alive":
- Crie um cron job que faça ping a cada 10 minutos
- Use: https://cron-job.org/
- Configure para fazer GET na sua URL a cada 10 minutos

**Solução 3:** Migre para Railway (melhor plano gratuito)

---

## 💰 Custos Estimados

| Serviço | Custo | Recomendação |
|---------|-------|--------------|
| **Railway** | $5 grátis/mês, depois ~$5-10/mês | ⭐⭐⭐⭐⭐ Melhor opção |
| **Render** | Grátis (com limitações) | ⭐⭐⭐ OK para testes |
| **DigitalOcean VPS** | $6/mês | ⭐⭐⭐⭐ Para quem sabe Linux |
| **AWS EC2 t2.micro** | ~$8-10/mês | ⭐⭐⭐ Mais caro |
| **Vercel (Frontend)** | Grátis! | ⭐⭐⭐⭐⭐ Já está deployado |

---

## 🎯 Configuração Final

Após fazer deploy do backend:

### Arquivo `.env.local` (Local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Vercel Environment Variables (Produção)
```env
NEXT_PUBLIC_BACKEND_URL=https://sua-url-do-backend.com
```

---

## 📱 Fluxo Completo

```
┌─────────────────────┐
│  Usuário acessa     │
│  ia-agente.vercel   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Frontend (Vercel)  │
│  Next.js            │
└──────────┬──────────┘
           │
           │ fetch(BACKEND_URL)
           │
           ▼
┌─────────────────────┐
│  Backend (Railway)  │
│  Node.js + PM2      │
│  WPPConnect         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  WhatsApp Server    │
└─────────────────────┘
```

---

## 🆘 Precisa de Ajuda?

1. Verifique os logs do backend
2. Teste a URL do backend diretamente
3. Confirme as variáveis de ambiente na Vercel
4. Verifique o console do navegador (F12)

---

**🚀 Depois de configurar, seu sistema funcionará 100% online, sem depender do seu computador local!**

