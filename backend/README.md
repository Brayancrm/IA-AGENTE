# 🤖 Backend WhatsApp IA - Guia de Instalação

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Firebase
- API Key de IA (OpenAI, Claude, etc.)

---

## 🚀 Instalação Passo a Passo

### **Passo 1: Instalar Dependências**

```bash
cd backend
npm install
```

### **Passo 2: Configurar Firebase Service Account**

1. Acesse: https://console.firebase.google.com
2. Selecione o projeto: **ia-agente-b2f46**
3. Vá em **Project Settings** (⚙️)
4. Aba **Service Accounts**
5. Clique em **"Generate New Private Key"**
6. Salve o arquivo como: `backend/serviceAccountKey.json`

⚠️ **IMPORTANTE:** Nunca faça commit deste arquivo! Ele já está no `.gitignore`.

### **Passo 3: Configurar Variáveis de Ambiente**

Copie o arquivo de exemplo:

```bash
cp env.example .env
```

Edite o arquivo `.env` se necessário.

### **Passo 4: Atualizar Regras do Realtime Database**

Vá para: https://console.firebase.google.com/project/ia-agente-b2f46/database/ia-agente-b2f46-default-rtdb/rules

Cole estas regras:

```json
{
  "rules": {
    "users": {
      "registered": {
        ".read": "auth != null",
        ".write": "auth != null"
      },
      "data": {
        "$userId": {
          ".read": "auth != null && auth.uid == $userId",
          ".write": "auth != null && auth.uid == $userId"
        }
      }
    },
    "whatsapp_sessions": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    },
    "conversations": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    },
    "ai_config": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    }
  }
}
```

### **Passo 5: Iniciar o Servidor em Segundo Plano**

🎯 **NOVIDADE:** Agora o backend roda em segundo plano com PM2!

**Opção A - Script Automático (Windows):**

Dê duplo clique em `start-backend.bat`

**Opção B - Terminal:**

```bash
npm run pm2:start
```

**Verificar se está rodando:**

```bash
npm run pm2:status
```

Você verá:
```
┌────┬─────────────────────┬─────────┬─────────┬──────────┐
│ id │ name                │ mode    │ status  │ restart  │
├────┼─────────────────────┼─────────┼─────────┼──────────┤
│ 0  │ whatsapp-ia-backend │ fork    │ online  │ 0        │
└────┴─────────────────────┴─────────┴─────────┴──────────┘
```

✅ **Vantagens:**
- Roda em segundo plano (pode fechar o terminal!)
- Reinicia automaticamente se cair
- Logs salvos em arquivos
- Pode iniciar com o Windows

### **Comandos Úteis do PM2**

| Comando | Descrição |
|---------|-----------|
| `npm run pm2:status` | Ver status do backend |
| `npm run pm2:logs` | Ver logs em tempo real |
| `npm run pm2:stop` | Parar o backend |
| `npm run pm2:restart` | Reiniciar o backend |
| `npm run pm2:delete` | Remover completamente |
| `npm run pm2:monit` | Monitor de recursos (CPU/RAM) |

### **Modo de Desenvolvimento (Terminal Aberto)**

Se preferir desenvolvimento com auto-reload:

```bash
npm run dev
```

---

## 🧪 Testar o Servidor

### **1. Verificar Status**

```bash
curl http://localhost:3001
```

Resposta esperada:
```json
{
  "status": "online",
  "service": "WhatsApp IA Backend",
  "version": "1.0.0",
  "activeSessions": 0
}
```

### **2. Criar Sessão WhatsApp**

```bash
curl -X POST http://localhost:3001/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"userId":"SEU_USER_ID_AQUI"}'
```

---

## 🌐 Como Usar no Dashboard (NOVO!)

🎉 **NOVIDADE:** Agora você controla TUDO pelo site, sem precisar do terminal!

### **1. Configure a API de IA**

1. Acesse o dashboard: `http://localhost:3000` ou https://ia-agente.vercel.app
2. Faça login
3. Vá em **"Configuração do Assistente"**
4. Preencha:
   - Provedor de IA: OpenAI
   - API Key: sua chave da OpenAI
   - Modelo: gpt-3.5-turbo
   - Prompt do Sistema: personalize
   - Mensagem de Boas-vindas

5. Clique em **"Salvar Configurações"**

### **2. Conecte o WhatsApp (Pelo Site!)**

1. No Dashboard, você verá um **card verde** com "Controle da Sessão WhatsApp"
2. Clique em **"Iniciar WhatsApp"**
3. O QR Code aparecerá automaticamente na tela
4. Abra o WhatsApp no celular
5. Vá em **Configurações → Aparelhos conectados → Conectar aparelho**
6. Escaneie o QR Code mostrado no site
7. ✅ Pronto! Status mudará para 🟢 **Conectado**

### **3. Desconectar o WhatsApp**

No mesmo card, clique em **"Desconectar"** quando quiser parar.

### **4. Atualizar Status**

Clique em **"Atualizar Status"** para verificar o estado da conexão.

### **✨ Vantagens do Controle pelo Site:**

- ✅ Sem precisar abrir terminal
- ✅ QR Code aparece direto na tela
- ✅ Status em tempo real
- ✅ Controle fácil: Iniciar/Parar com um clique
- ✅ Interface visual bonita
- ✅ Backend sempre rodando em segundo plano

---

## 🔌 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Status do servidor |
| POST | `/api/sessions/create` | Criar sessão WhatsApp |
| POST | `/api/sessions/disconnect` | Desconectar WhatsApp |
| GET | `/api/sessions/status/:userId` | Status da sessão |
| POST | `/api/messages/send` | Enviar mensagem manual |
| GET | `/api/conversations/:userId` | Listar conversas |

---

## 🐛 Solução de Problemas

### **Erro: serviceAccountKey.json não encontrado**

✅ **Solução:** Baixe o arquivo do Firebase Console (veja Passo 2)

### **Erro: QR Code não aparece**

✅ **Solução:** 
1. Verifique se o servidor está rodando
2. Verifique os logs no terminal
3. Tente recriar a sessão

### **Erro: IA não responde**

✅ **Solução:**
1. Verifique se a API Key está correta
2. Confirme que há créditos na conta da OpenAI
3. Veja os logs do servidor para detalhes

### **Erro: Mensagens não chegam**

✅ **Solução:**
1. Verifique se o WhatsApp está conectado (✅ no dashboard)
2. Confirme que não é um grupo
3. Veja os logs: `console.log` mostrará todas as mensagens

---

## 📦 Estrutura de Arquivos

```
backend/
├── server.js              ← Servidor principal
├── package.json           ← Dependências (com PM2!)
├── ecosystem.config.js    ← Configuração do PM2
├── env.example            ← Exemplo de configuração
├── serviceAccountKey.json ← Credenciais Firebase (não fazer commit!)
├── start-backend.bat      ← Script para iniciar (Windows)
├── stop-backend.bat       ← Script para parar (Windows)
├── status-backend.bat     ← Script para ver status (Windows)
├── logs/                  ← Logs do PM2
│   ├── error.log          ← Erros
│   ├── output.log         ← Saída normal
│   └── combined.log       ← Todos os logs
├── INICIO_RAPIDO.md       ← Guia rápido
└── README.md              ← Este arquivo
```

## 📚 Documentação

- **[INICIO_RAPIDO.md](./INICIO_RAPIDO.md)** - Guia de início rápido
- **[../COMO_USAR_WHATSAPP.md](../COMO_USAR_WHATSAPP.md)** - Guia completo e detalhado de uso

---

## 🚀 Deploy em Produção

### **Opção 1: VPS/Servidor Dedicado (Recomendado)**

O PM2 já está configurado! Basta usar:

```bash
# Clonar repositório
git clone seu-repo.git
cd backend

# Instalar dependências
npm install

# Iniciar com PM2 (já configurado!)
npm run pm2:start

# Configurar para iniciar automaticamente no boot
pm2 startup
pm2 save

# Ver status
npm run pm2:status

# Ver logs
npm run pm2:logs
```

✅ **Pronto!** Seu backend está rodando em produção com:
- Reinicialização automática
- Logs salvos
- Monitoramento de recursos
- Inicia com o servidor

### **Opção 2: Railway.app**

1. Crie conta em: https://railway.app
2. Conecte seu repositório GitHub
3. Adicione variáveis de ambiente
4. Deploy automático!

### **Opção 3: Render.com**

1. Crie conta em: https://render.com
2. New → Web Service
3. Conecte repositório
4. Configure variáveis
5. Deploy!

---

## 🔐 Segurança

- ✅ **Nunca** faça commit do `serviceAccountKey.json`
- ✅ **Nunca** exponha suas API Keys
- ✅ Use **variáveis de ambiente** para senhas
- ✅ Configure **firewall** no servidor de produção
- ✅ Use **HTTPS** em produção

---

## 📊 Monitoramento

Ver logs em tempo real:

```bash
npm start
```

Todos os eventos são logados:
- 📱 Sessões criadas
- 📨 Mensagens recebidas
- 🤖 Respostas da IA
- ❌ Erros

---

## 🆘 Suporte

Problemas? Veja os logs:

```bash
tail -f logs/server.log
```

Ou contate o desenvolvedor.

---

**Pronto! Seu backend está configurado e rodando! 🎉**

