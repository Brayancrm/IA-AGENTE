# 🤖 WhatsApp Sales Agent com IA

Sistema completo de atendimento automático via WhatsApp com Inteligência Artificial.

## 🎯 Novidade: Controle Total pelo Site!

✨ **Agora você pode controlar o WhatsApp completamente pelo site, sem precisar abrir o terminal!**

### O que mudou:

- ✅ **Backend roda em segundo plano** com PM2
- ✅ **Iniciar/Parar WhatsApp pelo site** com um clique
- ✅ **QR Code aparece direto na tela** do Dashboard
- ✅ **Status em tempo real** da conexão
- ✅ **Não precisa mais ficar abrindo terminal**

---

## 🚀 Início Rápido

### 1️⃣ Configurar Backend (Uma vez só)

```powershell
cd backend
npm install
npm run pm2:start
```

Ou simplesmente dê **duplo clique** em `backend/start-backend.bat`

### 2️⃣ Configurar Frontend

```powershell
npm install
npm run dev
```

### 3️⃣ Usar o Sistema

1. Acesse: `http://localhost:3000`
2. Faça login
3. No Dashboard, clique em **"Iniciar WhatsApp"**
4. Escaneie o QR Code
5. Pronto! 🎉

---

## 📚 Documentação Completa

### Guias de Uso

- 📖 **[COMO_USAR_WHATSAPP.md](./COMO_USAR_WHATSAPP.md)** - Guia completo e detalhado
- ⚡ **[backend/INICIO_RAPIDO.md](./backend/INICIO_RAPIDO.md)** - Guia rápido de 5 minutos
- 🔧 **[backend/README.md](./backend/README.md)** - Documentação técnica do backend

### Guias de Configuração

- 🔥 **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Configurar Firebase (se existir)
- 📱 **[WPPCONNECT_SETUP.md](./WPPCONNECT_SETUP.md)** - Configurar WPPConnect

---

## 🎮 Controles pelo Site

### Dashboard

No Dashboard você terá um **card verde** com controles:

| Botão | Ação |
|-------|------|
| **Iniciar WhatsApp** | Inicia sessão e mostra QR Code |
| **Desconectar** | Para a sessão do WhatsApp |
| **Atualizar Status** | Verifica status da conexão |

### Status da Conexão

- 🟢 **Conectado** - WhatsApp funcionando
- 🟡 **Aguardando QR Code** - Escaneie o QR Code
- 🔴 **Desconectado** - WhatsApp parado

---

## 🛠️ Comandos Úteis

### Backend (PM2)

```powershell
cd backend

# Ver status
npm run pm2:status

# Ver logs em tempo real
npm run pm2:logs

# Parar backend
npm run pm2:stop

# Reiniciar backend
npm run pm2:restart

# Monitor de recursos
npm run pm2:monit
```

### Frontend (Next.js)

```powershell
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Rodar produção
npm start
```

---

## 📁 Estrutura do Projeto

```
IA AGENTE/
├── app/                          ← Frontend Next.js
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── backend/                      ← Backend Node.js
│   ├── server.js                ← Servidor principal
│   ├── ecosystem.config.js      ← Config PM2
│   ├── start-backend.bat        ← Iniciar (Windows)
│   ├── stop-backend.bat         ← Parar (Windows)
│   ├── status-backend.bat       ← Status (Windows)
│   └── logs/                    ← Logs do PM2
├── components/                   ← Componentes React
│   ├── LandingPage.jsx
│   └── ...
├── whatsapp-sales-agent.jsx     ← App principal
├── COMO_USAR_WHATSAPP.md        ← 📖 Guia completo
├── README.md                     ← Este arquivo
└── package.json
```

---

## 🔧 Tecnologias

### Frontend
- **Next.js 14** - Framework React
- **Tailwind CSS** - Estilização
- **Firebase** - Autenticação e Database
- **Lucide Icons** - Ícones

### Backend
- **Node.js** - Runtime
- **Express** - API REST
- **WPPConnect** - Integração WhatsApp
- **Firebase Admin** - Backend Firebase
- **PM2** - Gerenciador de processos
- **OpenAI API** - Inteligência Artificial

---

## 🎯 Funcionalidades

### ✅ Controle pelo Site
- Iniciar/Parar WhatsApp com um clique
- QR Code na tela
- Status em tempo real
- Sem dependência de terminal

### ✅ Assistente IA
- Responde automaticamente mensagens
- Contexto de conversas
- Catálogo de produtos/serviços
- Personalização completa

### ✅ Gerenciamento
- Dashboard intuitivo
- Catálogo de produtos
- Configuração de IA
- Perfil da empresa

### ✅ Multi-usuário
- Sistema Master/Comum
- Isolamento de dados
- Gerenciamento de usuários

---

## 🔐 Segurança

- ✅ Autenticação via Firebase
- ✅ Dados isolados por usuário
- ✅ API Keys em variáveis de ambiente
- ✅ Service Account não commitado
- ✅ CORS configurado

---

## 🚀 Deploy

### Backend

**VPS/Servidor:**
```bash
cd backend
npm install
npm run pm2:start
pm2 startup
pm2 save
```

### Frontend

**Vercel (Recomendado):**
```bash
npm run build
vercel --prod
```

**Configurar variáveis de ambiente:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_BACKEND_URL` ⚠️ **IMPORTANTE!**
- E outras do Firebase

### ⚠️ ATENÇÃO: Backend em Produção

O site na Vercel (https://ia-agente.vercel.app/) **NÃO FUNCIONA** com `localhost:3001`!

Você precisa:

1. ✅ Fazer deploy do backend em um servidor público (Railway, Render, VPS)
2. ✅ Configurar `NEXT_PUBLIC_BACKEND_URL` na Vercel com a URL pública

📖 **Guias completos:**
- [DEPLOY_BACKEND.md](./DEPLOY_BACKEND.md) - Como fazer deploy do backend
- [CONFIGURACAO_VERCEL.md](./CONFIGURACAO_VERCEL.md) - Como configurar a Vercel

| Cenário | Frontend | Backend | Funciona? |
|---------|----------|---------|-----------|
| **Local** | localhost:3000 | localhost:3001 | ✅ Sim |
| **Produção** | vercel.app | localhost:3001 | ❌ NÃO! |
| **Produção** | vercel.app | railway/render/vps | ✅ Sim! |

---

## 🆘 Solução de Problemas

### Backend não responde

```powershell
cd backend
npm run pm2:restart
```

### WhatsApp não conecta

1. Verifique se o backend está rodando: `npm run pm2:status`
2. Veja os logs: `npm run pm2:logs`
3. Tente desconectar e conectar novamente

### QR Code não aparece

1. Clique em "Desconectar"
2. Aguarde 5 segundos
3. Clique em "Iniciar WhatsApp"

### Ver logs detalhados

```powershell
cd backend
npm run pm2:logs
```

Ou abra os arquivos:
- `backend/logs/error.log`
- `backend/logs/output.log`

---

## 📊 Monitoramento

### Status do Backend

```powershell
cd backend
npm run pm2:status
```

### Monitor em Tempo Real

```powershell
npm run pm2:monit
```

Mostra:
- CPU usage
- Memory usage
- Uptime
- Restarts

---

## 🎓 Como Usar - Fluxo Completo

### Configuração Inicial (Uma vez)

1. **Instalar dependências:**
   ```powershell
   npm install
   cd backend
   npm install
   ```

2. **Iniciar backend em segundo plano:**
   ```powershell
   npm run pm2:start
   ```
   Ou dê duplo clique em `start-backend.bat`

3. **Iniciar frontend:**
   ```powershell
   cd ..
   npm run dev
   ```

### Uso Diário

1. **Acesse o site:** `http://localhost:3000`
2. **Faça login**
3. **Configure o Assistente IA** (primeira vez):
   - Vá em "Configuração do Assistente"
   - Adicione sua API Key da OpenAI
   - Configure o prompt e mensagem de boas-vindas
   - Salve

4. **Inicie o WhatsApp:**
   - No Dashboard, clique em "Iniciar WhatsApp"
   - Escaneie o QR Code que aparecerá
   - Aguarde status mudar para 🟢 Conectado

5. **Pronto!** O assistente está respondendo automaticamente

### Para Desativar

- No Dashboard, clique em "Desconectar"
- O WhatsApp para de responder
- O backend continua rodando em segundo plano

---

## 📞 Suporte

Para problemas ou dúvidas:

1. Verifique os logs: `cd backend && npm run pm2:logs`
2. Consulte a documentação: [COMO_USAR_WHATSAPP.md](./COMO_USAR_WHATSAPP.md)
3. Reinicie o backend: `npm run pm2:restart`

---

## 📄 Licença

MIT License - Livre para uso

---

## 🎉 Contribuições

Contribuições são bem-vindas!

---

**Desenvolvido com ❤️ para facilitar atendimento via WhatsApp**

🚀 **Agora com controle total pelo site - Sem precisar do terminal!**
