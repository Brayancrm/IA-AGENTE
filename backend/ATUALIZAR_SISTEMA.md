# 🔄 Como Atualizar o Sistema com as Novas Funcionalidades

## ✅ Mudanças Implementadas

✨ **NOVO:** Envio automático de imagens dos produtos quando mencionados nas conversas!

---

## 🚀 Como Aplicar a Atualização

### Opção 1: Usando Scripts BAT (Windows)

1. **Pare o backend:**
   - Dê duplo clique em `stop-backend.bat`
   - OU execute no terminal: `npm run pm2:stop`

2. **Inicie novamente:**
   - Dê duplo clique em `start-backend.bat`
   - OU execute no terminal: `npm run pm2:start`

### Opção 2: Usando Comandos no Terminal

```powershell
cd backend

# Parar o backend atual
npm run pm2:stop

# Ou reiniciar diretamente (mais rápido)
npm run pm2:restart
```

---

## ✅ Verificar se Funcionou

```powershell
cd backend
npm run pm2:status
```

Deve mostrar:
```
┌────┬─────────────────────┬──────────┬──────┬───────────┐
│ id │ name                │ mode     │ ↺    │ status    │
├────┼─────────────────────┼──────────┼──────┼───────────┤
│ 0  │ whatsapp-ia-backend │ fork     │ 1    │ online    │
└────┴─────────────────────┴──────────┴──────┴───────────┘
```

Note o número em "↺" (restarts) - deve ter aumentado.

---

## 📋 Checklist Pós-Atualização

- [ ] Backend reiniciado com sucesso
- [ ] Status mostra "online"
- [ ] Produtos têm URLs de imagens cadastradas
- [ ] Testado envio de mensagem mencionando produto
- [ ] Imagem foi recebida automaticamente

---

## 🧪 Como Testar

### 1. Acesse o site
```
http://localhost:3000
```

### 2. Conecte o WhatsApp
- Vá no Dashboard
- Clique em "Iniciar WhatsApp"
- Escaneie o QR Code

### 3. Envie mensagem de teste
Pelo seu celular (outro número), envie:
```
"Quais produtos vocês têm?"
```

### 4. Observe o resultado
- ✅ Bot responde com texto
- ✅ Bot envia automaticamente a(s) foto(s) dos produtos mencionados

---

## 📊 Ver Logs em Tempo Real

Para ver tudo funcionando:

```powershell
cd backend
npm run pm2:logs
```

Você verá:
```
🤖 Gerando resposta com IA...
✅ Resposta enviada: Temos o Notebook Dell...
📸 Detectados 1 produto(s) com imagem na resposta
📤 Enviando imagem de: Notebook Dell Inspiron 15
✅ Imagem enviada: Notebook Dell Inspiron 15
```

---

## 🔧 Solução de Problemas

### Backend não inicia após reiniciar

```powershell
# Remover processo antigo
npm run pm2:delete

# Iniciar do zero
npm run pm2:start
```

### Ainda usando código antigo

```powershell
# Forçar reinicialização completa
npm run pm2:delete
npm run pm2:start
```

### Ver erros específicos

```powershell
npm run pm2:logs --err
```

---

## 📝 Próximos Passos

1. ✅ Configure URLs de imagens nos produtos
2. ✅ Teste com diferentes produtos
3. ✅ Ajuste o prompt do assistente se necessário
4. ✅ Monitore os logs para ver tudo funcionando

---

## 📚 Documentação Adicional

- `ENVIO_AUTOMATICO_IMAGENS.md` - Guia completo do novo recurso
- `COMO_USAR_WHATSAPP.md` - Guia geral de uso

---

**Atualização concluída! 🎉**

