# 📸 Como Testar Envio Automático de Fotos em Produção

## ✅ Deploy Concluído!

As novas funcionalidades foram enviadas para:
- 🌐 **Frontend:** https://ia-agente.vercel.app/
- 🚂 **Backend:** https://ia-agente-production.up.railway.app

---

## 🧪 Como Testar

### Passo 1: Verificar se o Backend está Atualizado

Acesse no navegador:
```
https://ia-agente-production.up.railway.app
```

Deve retornar:
```json
{
  "status": "online",
  "service": "WhatsApp IA Backend",
  "version": "1.0.0",
  "activeSessions": 0
}
```

✅ Se retornar isso, o backend está online!

---

### Passo 2: Configurar URLs de Imagens nos Produtos

1. Acesse: https://ia-agente.vercel.app/
2. Faça login
3. Vá em **"Catálogo (Itens)"**
4. Para cada produto:
   - Clique em **"Editar"**
   - Preencha o campo **"URL da Imagem"**
   - Use URLs públicas de imagens

**Exemplos de URLs válidas:**
```
https://i.imgur.com/exemplo.jpg
https://raw.githubusercontent.com/usuario/repo/main/imagem.png
https://storage.googleapis.com/seu-bucket/imagem.jpg
```

**Dica:** Use o [Imgur](https://imgur.com/upload) para hospedar imagens gratuitamente!

---

### Passo 3: Conectar o WhatsApp

1. No **Dashboard**, clique em **"Iniciar WhatsApp"**
2. Escaneie o QR Code com seu celular
3. Aguarde o status mudar para: **🟢 Conectado**

---

### Passo 4: Enviar Mensagens de Teste

**De outro número de WhatsApp**, envie mensagens como:

#### Teste 1: Perguntar sobre produtos
```
"Quais produtos vocês têm?"
```

**Resultado esperado:**
- ✅ Bot responde com lista de produtos
- ✅ Bot envia **automaticamente** as fotos dos produtos mencionados
- ✅ Cada foto vem com legenda (nome, preço, descrição)

#### Teste 2: Perguntar sobre produto específico
```
"Quanto custa o Notebook Dell?"
```

**Resultado esperado:**
- ✅ Bot responde com informações do produto
- ✅ Bot envia **automaticamente** a foto do Notebook Dell

#### Teste 3: Pedir recomendação
```
"Preciso de algo para trabalhar em casa"
```

**Resultado esperado:**
- ✅ Bot sugere produtos relevantes
- ✅ Bot envia **automaticamente** as fotos dos produtos sugeridos

---

## 🔍 Verificar nos Logs do Railway

Para ver o sistema funcionando em tempo real:

1. Acesse: https://railway.app/project/joyful-commitment/production
2. Clique em **"IA-AGENTE"**
3. Vá na aba **"Logs"**
4. Você verá mensagens como:

```
🤖 Gerando resposta com IA...
✅ Resposta enviada: Temos o Notebook Dell...
📸 Detectados 1 produto(s) com imagem na resposta
📤 Enviando imagem de: Notebook Dell Inspiron 15
✅ Imagem enviada: Notebook Dell Inspiron 15
```

---

## 📱 Exemplo Real de Conversa

```
Cliente: "Oi, quais notebooks vocês têm?"
   ↓
Bot: "Olá! Temos ótimas opções de notebooks:

1. Notebook Dell Inspiron 15 - R$ 3.499,90
   - Intel Core i7, 16GB RAM, SSD 512GB
   
2. Notebook Lenovo IdeaPad - R$ 2.899,90
   - Intel Core i5, 8GB RAM, SSD 256GB

Qual deles te interessa mais?"
   ↓
[FOTO DO NOTEBOOK DELL ENVIADA] 📸
Legenda:
📦 Notebook Dell Inspiron 15
💰 R$ 3499.90
Notebook com processador Intel Core i7...
   ↓
[FOTO DO NOTEBOOK LENOVO ENVIADA] 📸
Legenda:
📦 Notebook Lenovo IdeaPad
💰 R$ 2899.90
Notebook com processador Intel Core i5...
```

---

## ⚙️ Configurações Importantes

### Habilitar Catálogo nas Configurações

1. Vá em **"Configuração do Assistente"**
2. Certifique-se que está habilitado:
   - ✅ Incluir Produtos do Catálogo
   - ✅ Incluir Serviços do Catálogo

### Ajustar o Prompt (Opcional)

No campo **"Mensagem de Boas-vindas"**, você pode adicionar:

```
Você é um assistente de vendas experiente.

Quando o cliente perguntar sobre produtos, mencione-os pelo nome
completo e destaque suas principais características.

Seja prestativo e sugira produtos que atendam às necessidades do cliente.
```

---

## 🐛 Solução de Problemas

### Problema: Imagens não estão sendo enviadas

**Checklist:**
- [ ] Produtos têm URL de imagem cadastrada?
- [ ] URL da imagem é pública e acessível?
- [ ] Catálogo está habilitado nas configurações?
- [ ] WhatsApp está conectado (🟢 Conectado)?
- [ ] Deploy do Railway foi concluído com sucesso?

**Como testar a URL da imagem:**
- Cole a URL no navegador
- Se a imagem abrir, a URL está correta
- Se não abrir, precisa usar outra URL

### Problema: Bot não responde

**Verifique:**
1. WhatsApp está conectado? (Dashboard → Status)
2. Backend está online? (Acesse a URL do Railway)
3. Há API Key configurada? (Configuração do Assistente)

**Solução:**
- Desconecte e reconecte o WhatsApp
- Verifique os logs no Railway
- Teste se o backend responde: `curl https://ia-agente-production.up.railway.app`

### Problema: Deploy falhou no Railway

**Passos:**
1. Acesse o Railway
2. Vá em "Deployments" → Último deploy
3. Clique em "View logs"
4. Veja o erro específico

**Causas comuns:**
- Erro de sintaxe no código (improvável, já testamos local)
- Falta de variáveis de ambiente
- Problema de memória/recursos

**Solução:**
- Faça rollback para o deploy anterior
- Verifique as variáveis de ambiente
- Entre em contato se persistir

---

## 📊 Métricas para Acompanhar

Após testar, observe:

- ✅ **Taxa de resposta:** Bot está respondendo todas as mensagens?
- ✅ **Fotos enviadas:** Quantas fotos foram enviadas automaticamente?
- ✅ **Tempo de resposta:** Bot responde rápido?
- ✅ **Erros:** Alguma imagem falhou ao enviar?

---

## 🎯 Checklist Completo de Teste

- [ ] Deploy do Railway concluído
- [ ] Backend responde na URL
- [ ] Login feito no site
- [ ] Produtos têm URLs de imagens
- [ ] Catálogo habilitado nas configurações
- [ ] WhatsApp conectado (🟢)
- [ ] Mensagem de teste enviada
- [ ] Bot respondeu com texto
- [ ] Bot enviou foto(s) automaticamente
- [ ] Fotos chegaram com legenda correta
- [ ] Logs mostram sucesso no Railway

---

## 🎉 Tudo Funcionando?

Se todos os testes passaram, parabéns! 🎊

Seu agente agora:
- ✅ Responde automaticamente no WhatsApp
- ✅ Envia fotos dos produtos automaticamente
- ✅ Funciona 24/7 na nuvem
- ✅ Não depende do seu computador local

---

## 📞 Próximos Passos

1. **Adicionar mais produtos** com fotos bonitas
2. **Refinar o prompt** do assistente
3. **Monitorar conversas** e ajustar respostas
4. **Expandir catálogo** com novos itens

---

## 📚 Documentação Completa

- `backend/ENVIO_AUTOMATICO_IMAGENS.md` - Guia completo do recurso
- `backend/ATUALIZAR_SISTEMA.md` - Como atualizar localmente
- `DEPLOY_BACKEND.md` - Informações sobre deploy

---

**Sistema 100% operacional em produção! 🚀**

