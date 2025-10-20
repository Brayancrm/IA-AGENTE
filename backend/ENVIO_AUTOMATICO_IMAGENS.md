# 📸 Envio Automático de Imagens de Produtos

## ✅ O que foi implementado?

Agora o seu agente de WhatsApp **envia automaticamente as fotos dos produtos/serviços** quando eles são mencionados nas respostas da IA!

---

## 🎯 Como Funciona?

### 1. **Detecção Automática**
Quando a IA menciona um produto ou serviço na resposta ao cliente, o sistema:
- 🔍 Detecta automaticamente qual produto foi mencionado
- 📷 Verifica se esse produto tem uma imagem cadastrada
- 📤 Envia a imagem automaticamente logo após o texto

### 2. **Fluxo de Funcionamento**

```
Cliente pergunta sobre um produto
    ↓
IA responde mencionando o produto
    ↓
Sistema detecta o nome do produto na resposta
    ↓
Sistema verifica se tem imagem cadastrada
    ↓
Envia automaticamente:
  1. Texto da resposta da IA
  2. Imagem do produto com legenda
```

### 3. **O que é enviado junto com a imagem?**

Cada imagem é enviada com uma legenda automática contendo:
- 📦 Nome do produto
- 💰 Preço
- 📝 Descrição (se houver)

**Exemplo:**
```
📦 *Notebook Dell Inspiron 15*
💰 R$ 3499.90

Notebook com processador Intel Core i7, 16GB RAM, SSD 512GB.
Ideal para trabalho e estudos.
```

---

## 🔧 Requisitos para Funcionar

Para que as imagens sejam enviadas automaticamente, você precisa:

### 1. **Cadastrar URLs de Imagens nos Produtos**

No painel, ao adicionar/editar produtos:
- ✅ Preencha o campo **"URL da Imagem"**
- ✅ Use URLs públicas de imagens (exemplo: do Imgur, Google Drive público, etc.)

**Exemplo de URL válida:**
```
https://i.imgur.com/abc123.jpg
https://exemplo.com/produtos/notebook.png
```

### 2. **Habilitar Catálogo nas Configurações do Assistente**

Certifique-se que nas configurações do assistente:
- ✅ **"Incluir Produtos do Catálogo"** está habilitado
- ✅ **"Incluir Serviços do Catálogo"** está habilitado (se aplicável)

---

## 📋 Como Testar

### Teste 1: Cliente pergunta sobre produto específico
```
Cliente: "Quanto custa o Notebook Dell?"
    ↓
IA: "O Notebook Dell Inspiron 15 custa R$ 3.499,90. 
     Ele vem com processador Intel Core i7..."
    ↓
Sistema detecta "Notebook Dell" e envia a foto automaticamente 📸
```

### Teste 2: Cliente pede para ver produtos
```
Cliente: "Quais notebooks vocês têm?"
    ↓
IA: "Temos o Notebook Dell Inspiron 15 (R$ 3.499,90) 
     e o Notebook Lenovo IdeaPad (R$ 2.899,90)..."
    ↓
Sistema detecta ambos e envia as duas fotos automaticamente 📸📸
```

### Teste 3: Conversa geral que menciona produto
```
Cliente: "Preciso de algo para trabalhar com edição de vídeo"
    ↓
IA: "Recomendo o Notebook Dell Inspiron 15, perfeito para edição..."
    ↓
Sistema detecta "Notebook Dell" e envia a foto 📸
```

---

## 🚀 Como Usar no Dia a Dia

### Passo 1: Configure seus produtos com imagens
1. Acesse o painel web
2. Vá em **"Catálogo (Itens)"**
3. Para cada produto/serviço:
   - Adicione uma URL de imagem válida
   - Preencha descrição detalhada
   - Salve

### Passo 2: Configure o prompt do assistente
No prompt do assistente, você pode adicionar instruções como:

```
Você é um assistente de vendas.
Quando o cliente perguntar sobre produtos, mencione-os pelo nome completo.
Sempre destaque os benefícios e características.
```

**Dica:** Não precisa pedir para "mostrar a foto" no prompt - isso acontece automaticamente!

### Passo 3: Teste com clientes
- Inicie a sessão WhatsApp
- Faça perguntas como um cliente faria
- Observe as fotos sendo enviadas automaticamente

---

## 🎨 Exemplos de Prompts Eficientes

### Prompt Básico
```
Você é um assistente de vendas da empresa XYZ.
Quando o cliente perguntar sobre produtos, mencione o nome completo
do produto e explique suas características principais.
```

### Prompt Avançado
```
Você é especialista em vendas de eletrônicos.

SEMPRE mencione produtos pelo nome completo quando relevante.
Seja proativo e sugira produtos que atendam às necessidades do cliente.

Quando o cliente perguntar sobre:
- Trabalho/estudo → Sugira notebooks e periféricos
- Entretenimento → Sugira TVs e sistemas de áudio
- Mobilidade → Sugira tablets e smartphones

Destaque sempre: preço, características principais e disponibilidade.
```

---

## 🔍 Detecção Inteligente

### O sistema detecta produtos de várias formas:

✅ **Nome completo:**
- "O **Notebook Dell Inspiron 15** é excelente..."

✅ **Variações do nome:**
- "O **notebook dell** custa R$ 3.499..."
- "Temos o **Dell Inspiron** disponível..."

✅ **Múltiplos produtos:**
- "Temos o **Notebook Dell** e o **Mouse Logitech**..."
  → Envia ambas as fotos automaticamente

---

## ⚙️ Configurações Técnicas

### Limites e Proteções

- **Delay entre imagens:** 1 segundo
  - Evita sobrecarga no WhatsApp
  - Imagens chegam em sequência organizada

- **Tratamento de erros:**
  - Se uma imagem falhar, as outras continuam
  - Erros são registrados nos logs

- **Cache de imagens:**
  - URLs são validadas antes do envio
  - Imagens inválidas são ignoradas silenciosamente

---

## 📊 Logs e Monitoramento

Para ver o sistema funcionando em tempo real:

```bash
cd backend
npm run pm2:logs
```

Você verá mensagens como:
```
🤖 Gerando resposta com IA...
✅ Resposta enviada: O Notebook Dell...
📸 Detectados 1 produto(s) com imagem na resposta
📤 Enviando imagem de: Notebook Dell Inspiron 15
✅ Imagem enviada: Notebook Dell Inspiron 15
```

---

## 🐛 Solução de Problemas

### Problema: Imagens não estão sendo enviadas

**Verifique:**
1. ✅ Produto tem URL de imagem cadastrada?
2. ✅ URL da imagem é pública e acessível?
3. ✅ Catálogo está habilitado nas configurações?
4. ✅ IA mencionou o produto pelo nome correto?

**Como testar:**
```bash
# Ver logs em tempo real
cd backend
npm run pm2:logs
```

### Problema: Imagem não carrega no WhatsApp

**Possíveis causas:**
- URL da imagem não é pública
- Servidor da imagem está offline
- Formato de imagem não suportado (use JPG, PNG, WEBP)

**Solução:**
- Use serviços de hospedagem confiáveis (Imgur, Cloudinary)
- Teste a URL no navegador antes de cadastrar
- Prefira imagens menores que 5MB

### Problema: Muitas imagens sendo enviadas

**Causa:** IA mencionou vários produtos na mesma resposta

**Soluções:**
1. Ajuste o prompt para ser mais específico
2. Peça na resposta para mencionar apenas 1-2 produtos por vez

---

## 📈 Melhores Práticas

### ✅ DO (Faça):
- Use imagens de alta qualidade
- URLs curtas e confiáveis
- Imagens com boa resolução (800x600 ou maior)
- Descrições detalhadas dos produtos
- Prompt claro sobre como mencionar produtos

### ❌ DON'T (Não faça):
- URLs muito longas ou com muitos parâmetros
- Imagens muito grandes (>5MB)
- URLs temporárias ou com expiração
- Deixar campo de imagem vazio
- Nomes de produtos muito genéricos

---

## 🎯 Exemplos de Uso Real

### Loja de Eletrônicos
```
Cliente: "Preciso de um notebook para jogos"
Bot: "Recomendo o Notebook Gamer ASUS ROG por R$ 7.499! 
      Tem RTX 3060, 16GB RAM e tela 144Hz."
[FOTO enviada automaticamente] 📸
```

### Loja de Roupas
```
Cliente: "Tem vestido azul?"
Bot: "Sim! O Vestido Azul Marinho Longo está por R$ 189,90. 
      Tamanhos P, M e G disponíveis."
[FOTO enviada automaticamente] 📸
```

### Prestador de Serviços
```
Cliente: "Quanto custa limpeza de sofá?"
Bot: "A Limpeza de Sofá Completa custa R$ 150,00. 
      Inclui aspiração, lavagem e impermeabilização."
[FOTO do antes/depois enviada automaticamente] 📸
```

---

## 🚀 Próximos Passos

Após testar o envio automático, você pode:

1. **Expandir o catálogo**
   - Adicionar mais produtos com imagens
   - Criar categorias organizadas

2. **Otimizar prompts**
   - Testar diferentes abordagens
   - Ajustar tom de voz

3. **Monitorar resultados**
   - Ver quais produtos geram mais interesse
   - Ajustar descrições baseado em perguntas frequentes

---

## 📞 Suporte

Se tiver dúvidas ou problemas:
1. Verifique os logs: `npm run pm2:logs`
2. Teste URLs de imagem no navegador
3. Revise as configurações do assistente

---

**Desenvolvido com ❤️ para melhorar suas vendas!** 🚀

