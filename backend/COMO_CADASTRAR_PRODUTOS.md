# 📦 Como Cadastrar Produtos no Sistema

## ⚠️ IMPORTANTE

Para gerar links de pagamento, você **PRECISA** ter produtos cadastrados no Firebase!

O erro "⚠️ Nenhum produto cadastrado" ocorre quando não há produtos em:
```
Firebase Realtime Database → products → {seu_userId}
```

---

## 🔧 Opção 1: Cadastrar via Firebase Console (Rápido)

### Passo 1: Abrir Firebase Console
1. Acesse: https://console.firebase.google.com
2. Selecione seu projeto
3. Vá em **Realtime Database**

### Passo 2: Criar Estrutura de Produtos

Navegue até a raiz do banco de dados e adicione esta estrutura:

```
products/
  └── {seu_userId}/  (ex: iXBUiParHJhz0U4mvcSo1)
      └── produto1/
          ├── id: "produto1"
          ├── name: "Sabão"
          ├── description: "Sabão da melhor qualidade de Brasília"
          ├── price: 23
          ├── category: "limpeza"
          ├── image: "https://url-da-imagem.com/sabao.jpg"
          ├── stock: 100
          └── createdAt: "2025-10-21T00:00:00.000Z"
```

### Passo 3: Adicionar Seus Produtos

**Exemplo - Sabão Ypê:**
```json
{
  "products": {
    "iXBUiParHJhz0U4mvcSo1": {
      "produto1": {
        "id": "produto1",
        "name": "Sabão",
        "description": "Sabão da melhor qualidade de Brasília",
        "price": 23,
        "category": "limpeza",
        "image": "https://exemplo.com/sabao.jpg",
        "stock": 100,
        "active": true,
        "createdAt": "2025-10-21T00:00:00.000Z"
      },
      "produto2": {
        "id": "produto2",
        "name": "Lavagem Externa",
        "description": "Lavagem completa do veículo",
        "price": 150,
        "category": "servicos",
        "image": "https://exemplo.com/lavagem.jpg",
        "stock": 999,
        "active": true,
        "createdAt": "2025-10-21T00:00:00.000Z"
      }
    }
  }
}
```

---

## 🔧 Opção 2: Cadastrar via API (Recomendado)

Vou criar um endpoint para você cadastrar produtos via API.

### Endpoint para Cadastrar Produtos

**POST** `/api/products/create`

**Body:**
```json
{
  "userId": "iXBUiParHJhz0U4mvcSo1",
  "product": {
    "name": "Sabão",
    "description": "Sabão da melhor qualidade de Brasília",
    "price": 23,
    "category": "limpeza",
    "image": "https://exemplo.com/sabao.jpg",
    "stock": 100
  }
}
```

---

## 📝 Campos do Produto

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | ✅ | ID único do produto (auto-gerado) |
| `name` | string | ✅ | Nome do produto (ex: "Sabão") |
| `description` | string | ❌ | Descrição detalhada |
| `price` | number | ✅ | Preço em reais (ex: 23) |
| `category` | string | ❌ | Categoria (ex: "limpeza", "servicos") |
| `image` | string | ❌ | URL da imagem |
| `stock` | number | ❌ | Quantidade em estoque |
| `active` | boolean | ❌ | Se está ativo (padrão: true) |
| `createdAt` | string | ✅ | Data de criação (ISO 8601) |

---

## 🎯 Como o Sistema Detecta Produtos

Quando o cliente menciona um produto na conversa, o sistema:

1. Busca **últimas 10 mensagens** da conversa
2. Procura por produtos cadastrados em `products/{userId}`
3. Compara o **nome do produto** com o texto das mensagens
4. Se encontrar → Adiciona ao pedido

**Exemplo:**
```
Cliente: "Quero 1 sabão"
Sistema busca: produtos com nome contendo "sabão"
Encontra: { name: "Sabão", price: 23 }
Adiciona ao pedido: ✅
```

---

## ⚠️ Resolução do Seu Problema

**Seu erro:**
```
⚠️ Nenhum produto cadastrado
```

**Solução:**

### 1. Descobrir seu userId

No Firebase Console, vá em:
```
Database → whatsapp_sessions
```

Encontre seu userId (ex: `iXBUiParHJhz0U4mvcSo1`)

### 2. Cadastrar produtos

Crie o nó:
```
products/
  └── iXBUiParHJhz0U4mvcSo1/  (seu userId)
      └── sabao/
          ├── id: "sabao"
          ├── name: "Sabão"
          ├── price: 23
          └── description: "Sabão da melhor qualidade"
```

### 3. Testar novamente

Envie no WhatsApp:
```
1. "Quero 1 sabão"
2. [Forneça nome, CPF, email]
3. [Agente envia mensagem de gatilho]
4. ✅ Link será gerado com sucesso!
```

---

## 🧪 Verificar se Produto Foi Cadastrado

**No Firebase Console:**
```
Database → products → {seu_userId} → (ver lista de produtos)
```

**Nos logs do backend:**
```bash
pm2 logs backend
```

Você verá:
```
✅ 1 produto(s) mencionado(s): Sabão
```

---

## 📊 Estrutura Completa Recomendada

```
{
  "products": {
    "iXBUiParHJhz0U4mvcSo1": {
      "sabao": {
        "id": "sabao",
        "name": "Sabão",
        "description": "Sabão da melhor qualidade de Brasília",
        "price": 23,
        "category": "limpeza",
        "image": "https://exemplo.com/images/sabao.jpg",
        "stock": 100,
        "active": true,
        "createdAt": "2025-10-21T00:00:00.000Z"
      },
      "lavagem-externa": {
        "id": "lavagem-externa",
        "name": "Lavagem Externa",
        "description": "Lavagem completa do veículo",
        "price": 150,
        "category": "servicos",
        "image": "https://exemplo.com/images/lavagem.jpg",
        "stock": 999,
        "active": true,
        "createdAt": "2025-10-21T00:00:00.000Z"
      }
    }
  }
}
```

---

## 🎉 Após Cadastrar Produtos

1. ✅ Produtos estarão no Firebase
2. ✅ Sistema encontrará produtos mencionados
3. ✅ Link de pagamento será gerado
4. ✅ Cliente receberá o link!

---

## 💡 Dica Pro

Se você já tem produtos cadastrados em outro local (planilha, etc.), posso ajudar a criar um script para importar todos de uma vez!

---

**Cadastre seus produtos e teste novamente! 🚀**

