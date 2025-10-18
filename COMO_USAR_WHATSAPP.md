# 📱 Como Usar o WhatsApp Sales Agent - Guia Completo

## 🎯 Objetivo

Agora você pode controlar o WhatsApp completamente pelo site, sem precisar abrir o terminal toda vez! O backend ficará rodando em segundo plano.

---

## 🚀 Configuração Inicial (Fazer apenas UMA vez)

### Passo 1: Instalar Dependências do Backend

Abra o terminal no PowerShell e execute:

```powershell
cd backend
npm install
```

Isso instalará todas as dependências necessárias, incluindo o PM2 (gerenciador de processos).

### Passo 2: Iniciar o Backend em Segundo Plano

Você tem duas opções:

**Opção A - Usando o script automático (Mais fácil):**

1. Navegue até a pasta `backend`
2. Dê duplo clique no arquivo `start-backend.bat`
3. Pronto! O backend está rodando em segundo plano

**Opção B - Usando comandos no terminal:**

```powershell
cd backend
npm run pm2:start
```

### Passo 3: Verificar se o Backend está Rodando

Execute:

```powershell
npm run pm2:status
```

Você deve ver algo como:

```
┌────┬────────────────────────┬──────────┬──────┬───────────┐
│ id │ name                   │ mode     │ ↺    │ status    │
├────┼────────────────────────┼──────────┼──────┼───────────┤
│ 0  │ whatsapp-ia-backend    │ fork     │ 0    │ online    │
└────┴────────────────────────┴──────────┴──────┴───────────┘
```

Se o status estiver "online", significa que está funcionando! 🎉

---

## 🌐 Como Usar pelo Site

### 1. Acesse o Site

Abra seu navegador e acesse:
```
http://localhost:3000
```

### 2. Faça Login

Faça login com suas credenciais.

### 3. Vá para o Dashboard

No Dashboard, você verá um card verde grande no topo:

**"Controle da Sessão WhatsApp"**

### 4. Iniciar o WhatsApp

1. Clique no botão **"Iniciar WhatsApp"**
2. Aguarde alguns segundos
3. Um QR Code aparecerá na tela
4. Abra o WhatsApp no seu celular
5. Vá em: **Configurações** → **Aparelhos Conectados** → **Conectar Aparelho**
6. Escaneie o QR Code mostrado no site
7. Pronto! O status mudará para 🟢 **Conectado**

### 5. Desconectar o WhatsApp

Quando quiser desconectar:

1. Clique no botão **"Desconectar"**
2. O WhatsApp será desconectado imediatamente

---

## 🔧 Comandos Úteis

### Ver Status do Backend

```powershell
cd backend
npm run pm2:status
```

Ou dê duplo clique em `status-backend.bat`

### Ver Logs em Tempo Real

```powershell
cd backend
npm run pm2:logs
```

Isso mostrará todas as mensagens que o backend está processando.

### Parar o Backend

```powershell
cd backend
npm run pm2:stop
```

Ou dê duplo clique em `stop-backend.bat`

### Reiniciar o Backend

```powershell
cd backend
npm run pm2:restart
```

### Remover o Backend Completamente

```powershell
cd backend
npm run pm2:delete
```

---

## ⚡ Inicialização Automática no Windows

Se você quiser que o backend inicie automaticamente quando o Windows ligar:

### Método 1: Usando a Pasta de Inicialização

1. Pressione `Win + R`
2. Digite: `shell:startup`
3. Pressione Enter
4. Copie o arquivo `backend/start-backend.bat` para esta pasta
5. Pronto! O backend iniciará automaticamente quando o Windows iniciar

### Método 2: Usando o PM2 Startup

```powershell
cd backend
pm2 startup
pm2 save
```

Isso configurará o PM2 para iniciar automaticamente com o Windows.

---

## 🔍 Solução de Problemas

### Problema: "Erro ao conectar com o servidor"

**Solução:** Verifique se o backend está rodando:

```powershell
cd backend
npm run pm2:status
```

Se não estiver rodando, inicie-o:

```powershell
npm run pm2:start
```

### Problema: Backend não inicia

**Solução 1:** Verifique se o PM2 está instalado:

```powershell
cd backend
npm install
```

**Solução 2:** Tente iniciar manualmente para ver o erro:

```powershell
node server.js
```

### Problema: QR Code não aparece

**Solução:** 

1. Clique em "Desconectar"
2. Aguarde 5 segundos
3. Clique em "Iniciar WhatsApp" novamente
4. O novo QR Code deve aparecer

### Problema: WhatsApp desconecta sozinho

**Solução:**

1. Verifique se o celular está conectado à internet
2. Verifique se o WhatsApp no celular não foi desconectado manualmente
3. Reinicie o backend:

```powershell
cd backend
npm run pm2:restart
```

---

## 📊 Monitoramento

### Ver Recursos (CPU e Memória)

```powershell
cd backend
npm run pm2:monit
```

Isso abrirá uma interface em tempo real mostrando o uso de CPU e memória.

---

## 🎯 Fluxo de Trabalho Diário

### Dia a Dia (Backend já configurado)

1. ✅ O backend já está rodando em segundo plano (configurado uma vez)
2. 🌐 Acesse o site: `http://localhost:3000`
3. 🔐 Faça login
4. 📱 No Dashboard, clique em "Iniciar WhatsApp"
5. 📷 Escaneie o QR Code
6. ✅ Pronto! O assistente está funcionando

### Para Desativar

1. 🌐 Acesse o Dashboard
2. 🛑 Clique em "Desconectar"
3. ✅ O WhatsApp para de responder automaticamente

**Importante:** O backend continua rodando, você só desconectou a sessão do WhatsApp!

---

## 🆘 Comandos Rápidos de Referência

| Ação | Comando |
|------|---------|
| Iniciar backend | `npm run pm2:start` |
| Parar backend | `npm run pm2:stop` |
| Reiniciar backend | `npm run pm2:restart` |
| Ver status | `npm run pm2:status` |
| Ver logs | `npm run pm2:logs` |
| Monitorar recursos | `npm run pm2:monit` |
| Remover do PM2 | `npm run pm2:delete` |

---

## ✅ Checklist de Configuração

- [ ] Dependências instaladas (`npm install`)
- [ ] Backend iniciado com PM2 (`npm run pm2:start`)
- [ ] Backend rodando (`npm run pm2:status` mostra "online")
- [ ] Site acessível em `http://localhost:3000`
- [ ] Consegue fazer login no site
- [ ] Card de controle do WhatsApp aparece no Dashboard
- [ ] Consegue iniciar sessão WhatsApp pelo site
- [ ] QR Code aparece corretamente
- [ ] WhatsApp conecta com sucesso

---

## 🎉 Vantagens dessa Configuração

✅ **Sem dependência do terminal** - Controle tudo pelo site
✅ **Backend sempre rodando** - Não precisa iniciar toda vez
✅ **Inicia automaticamente** - Pode configurar para iniciar com o Windows
✅ **Logs salvos** - Todos os logs ficam salvos em arquivos
✅ **Reinicialização automática** - Se o backend cair, o PM2 reinicia automaticamente
✅ **Fácil de monitorar** - Use `pm2 monit` para ver em tempo real
✅ **Várias instâncias** - Pode rodar múltiplos usuários simultaneamente

---

## 📞 Suporte

Se tiver algum problema, verifique os logs:

```powershell
cd backend
npm run pm2:logs
```

Os logs também ficam salvos em:
- `backend/logs/error.log` - Erros
- `backend/logs/output.log` - Saída normal
- `backend/logs/combined.log` - Tudo junto

---

Feito com ❤️ para facilitar sua vida!

