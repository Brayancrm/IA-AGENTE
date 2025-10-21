# 🔒 Regras do Realtime Database (Versão Funcional)

## 📝 Como Configurar:

1. **Acesse:** https://console.firebase.google.com
2. **Selecione:** `ia-agente-b2f46`
3. **No menu lateral:** **Realtime Database**
4. **Clique na aba:** **Regras** (Rules)
5. **Selecione o database:** `ia-agente-b2f46` (NÃO o default-rtdb)
6. **Cole as regras do arquivo:** `REALTIME_DATABASE_RULES.json`
7. **Clique em:** **Publicar** (botão azul)

---

## 🔐 Estrutura das Regras:

As regras garantem que cada usuário só pode acessar seus próprios dados:

```json
{
  "rules": {
    "whatsapp_sessions": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    },
    "conversations": { ... },
    "customerData": { ... },
    "orders": { ... },
    "invoices": { ... },
    "products": { ... },
    "collectionContext": { ... },
    "users": { ... }
  }
}
```

---

## 📊 O Que Cada Caminho Armazena:

| Caminho | Descrição |
|---------|-----------|
| `whatsapp_sessions/{userId}` | Status da conexão WhatsApp |
| `conversations/{userId}/{contactNumber}` | Mensagens do WhatsApp |
| `customerData/{userId}/{phoneNumber}` | Dados dos clientes (nome, email, CPF) |
| `orders/{userId}/{orderId}` | Pedidos realizados |
| `invoices/{userId}/{orderId}` | Notas fiscais emitidas |
| `products/{userId}/{productId}` | Produtos cadastrados |
| `collectionContext/{userId}/{contactNumber}` | Contexto de coleta de dados |
| `users/data/{userId}` | Configurações do usuário |
| `users/registered` | Usuários registrados (master pode ler) |

---

## ✅ Verificação:

Após publicar as regras, o sistema deve funcionar normalmente:

- ✅ Dashboard carrega
- ✅ WhatsApp conecta
- ✅ Clientes fazem pedidos
- ✅ Links de pagamento são gerados
- ✅ Notas fiscais são emitidas

---

## 🚨 Importante:

**Use APENAS o database:** `ia-agente-b2f46`

**NÃO use:** `ia-agente-b2f46-default-rtdb` (está vazio)

O sistema foi configurado para usar: `https://ia-agente-b2f46.firebaseio.com`

