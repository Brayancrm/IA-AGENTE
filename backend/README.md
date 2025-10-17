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

### **Passo 5: Iniciar o Servidor**

```bash
npm start
```

Ou em modo de desenvolvimento (auto-reload):

```bash
npm run dev
```

Você verá:

```
✅ Servidor WPPConnect + IA rodando!
📡 Porta: 3001
🌐 URL: http://localhost:3001
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

## 📱 Como Usar no Dashboard

### **1. Configure a API de IA**

1. Acesse o dashboard: https://ia-agente.vercel.app
2. Faça login
3. Vá em **"Configuração do Assistente"**
4. Preencha:
   - Provedor de IA: OpenAI
   - API Key: sua chave da OpenAI
   - Modelo: gpt-3.5-turbo
   - Prompt do Sistema: personalize
   - Mensagem de Boas-vindas

5. Clique em **"Salvar Configurações"**

### **2. Conecte o WhatsApp**

1. No dashboard, clique em **"🔌 Conectar WhatsApp"**
2. Aguarde o QR Code aparecer
3. Abra o WhatsApp no celular
4. Vá em **Configurações → Aparelhos conectados → Conectar aparelho**
5. Escaneie o QR Code
6. ✅ Pronto! Seu assistente está online

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
├── package.json           ← Dependências
├── env.example            ← Exemplo de configuração
├── serviceAccountKey.json ← Credenciais Firebase (não fazer commit!)
└── README.md             ← Este arquivo
```

---

## 🚀 Deploy em Produção

### **Opção 1: VPS/Servidor Dedicado**

```bash
# Instalar PM2 para gerenciar o processo
npm install -g pm2

# Iniciar servidor
pm2 start server.js --name whatsapp-ia

# Ver logs
pm2 logs whatsapp-ia

# Reiniciar
pm2 restart whatsapp-ia
```

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

