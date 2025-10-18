# 🚀 Início Rápido - Backend WhatsApp

## Primeira Vez (Configuração Inicial)

### 1. Instalar Dependências
```powershell
npm install
```

### 2. Iniciar o Backend
Dê **duplo clique** em `start-backend.bat`

OU no terminal:
```powershell
npm run pm2:start
```

### 3. Verificar Status
```powershell
npm run pm2:status
```

Deve aparecer "online" ✅

---

## Uso Diário

### ✅ Não precisa fazer nada!
O backend já está rodando em segundo plano.

### 📱 Controlar WhatsApp
Acesse o site: `http://localhost:3000`
- Faça login
- No Dashboard, use os botões para:
  - **Iniciar WhatsApp** → Escaneia QR Code
  - **Desconectar** → Para o WhatsApp

---

## Comandos Úteis

| Comando | O que faz |
|---------|-----------|
| `npm run pm2:status` | Ver se está rodando |
| `npm run pm2:logs` | Ver logs em tempo real |
| `npm run pm2:stop` | Parar o backend |
| `npm run pm2:restart` | Reiniciar o backend |
| `npm run pm2:monit` | Monitor de recursos |

---

## Scripts Rápidos (.bat)

Você pode usar estes arquivos sem abrir o terminal:

- `start-backend.bat` → Inicia o backend
- `stop-backend.bat` → Para o backend  
- `status-backend.bat` → Mostra status

---

## ⚠️ Problema?

### Backend não responde?
```powershell
npm run pm2:restart
```

### Ver o que está acontecendo:
```powershell
npm run pm2:logs
```

---

## 🎯 Resumo

1. **Configure UMA vez** → `npm install` e `npm run pm2:start`
2. **Esqueça o terminal** → Use o site para tudo
3. **Backend sempre ligado** → Roda em segundo plano
4. **Controle pelo site** → Inicie/pare o WhatsApp quando quiser

Simples assim! 🎉

