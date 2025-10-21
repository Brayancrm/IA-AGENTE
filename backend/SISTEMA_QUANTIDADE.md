# 📊 Sistema de Quantidade Estruturado

## 🎯 Como Funciona Agora

O sistema agora suporta um **fluxo estruturado** onde o agente pergunta explicitamente a quantidade e o sistema salva para usar depois!

### Fluxo Completo:

```
1. Cliente: "Olá"
2. Cliente: "Quero sabão"

3. Agente: "Quantas unidades do Sabão você gostaria?"
   → Sistema detecta pergunta de quantidade ✅
   → Sistema salva contexto: aguardando quantidade

4. Cliente: "4"
   → Sistema detecta: resposta para quantidade ✅
   → Sistema salva: quantities["Sabão"] = 4 ✅

5. Agente: "Qual seu nome?"
6. Cliente: "Brayan"

7. Agente: "Qual seu CPF?"
8. Cliente: "06065596124"

9. Agente: "Qual seu email?"
10. Cliente: "brayamarket@gmail.com"

11. Agente: "Perfeito! Vou enviar seu Link..."
    → Sistema busca quantidade salva: 4x Sabão ✅
    → Sistema calcula: 4 x R$ 23 = R$ 92,00 ✅
    → Sistema gera link com valor correto ✅

12. Cliente recebe: Link de R$ 92,00 🎉
```

---

## 📝 Prompt Recomendado

Configure seu agente para seguir este fluxo:

```
Você é [Seu Nome], assistente de vendas.

FLUXO DE VENDA:

1️⃣ Quando cliente mencionar produto:
   "Ótimo! Quantas unidades do [Produto] você gostaria de adquirir?"
   
2️⃣ Cliente responde quantidade (ex: "4", "2 unidades", "quero 5")
   Sistema salva automaticamente ✅

3️⃣ Colete dados do cliente:
   - Nome completo
   - CPF
   - Email

4️⃣ Envie mensagem de gatilho EXATA:
   "Perfeito! Vou enviar abaixo seu Link para que efetue o Pagamento."
   
Sistema gera link com quantidade e valor corretos! ✅
```

---

## 🔑 Palavras-Chave Detectadas

O sistema detecta quando o agente pergunta quantidade usando estas palavras:

- "quantas unidades"
- "quantos"
- "quantas"
- "qual quantidade"
- "quantidade deseja"
- "quantas gostaria"
- "quantos gostaria"
- "me informe quantas"
- "me informe quantos"

**Exemplo válido:**
- "Quantas unidades do Sabão você gostaria?"
- "Quantos sabões você quer?"
- "Qual quantidade você deseja?"

---

## 💾 O Que É Salvo no Firebase

```
customerData/
  └── {userId}/
      └── {phoneNumber}/
          ├── name: "Brayan"
          ├── cpfCnpj: "06065596124"
          ├── email: "brayamarket@gmail.com"
          ├── quantities/
          │   ├── "Sabão": 4
          │   └── "Lavagem Externa": 2
          └── updatedAt: "2025-10-21T..."
```

---

## 🧪 Exemplos de Teste

### Teste 1: Quantidade Simples
```
Cliente: "Quero sabão"
Agente: "Quantas unidades?"
Cliente: "4"
✅ Salvo: 4x Sabão
[Coleta dados]
[Gera link]
✅ Link: R$ 92,00 (4 x R$ 23)
```

### Teste 2: Múltiplos Produtos
```
Cliente: "Quero sabão e lavagem"
Agente: "Quantas unidades do Sabão?"
Cliente: "3"
✅ Salvo: 3x Sabão

Agente: "E quantas lavagens?"
Cliente: "1"
✅ Salvo: 1x Lavagem Externa

[Coleta dados]
[Gera link]
✅ Link: R$ 219,00 (3x23 + 1x150)
```

### Teste 3: Resposta com Texto
```
Cliente: "Quero sabão"
Agente: "Quantas unidades?"
Cliente: "pode ser 5 unidades"
✅ Sistema extrai: 5
✅ Salvo: 5x Sabão
```

---

## 📊 Logs Esperados

Quando testar, você verá:

```
🎯 Agente perguntou a QUANTIDADE de "Sabão" - aguardando resposta
📝 Processando resposta para: quantity
✅ Quantidade detectada e salva: 4x Sabão
💾 Dados do cliente atualizados no Firebase

[... coleta de dados ...]

🎯 MENSAGEM DE GATILHO DETECTADA!
✅ 1 produto(s) mencionado(s): Sabão
📝 Buscando quantidades salvas...
✅ Quantidade salva encontrada: 4x Sabão
🚀 GERANDO LINK...
💰 Valor total calculado: R$ 92.00 (4 x R$ 23.00)
✅ LINK ENVIADO!
```

---

## 🆚 Diferenças dos Sistemas

### Sistema Anterior (Detecção Automática):
```
Cliente: "Quero 3 sabões"
Sistema detecta "3" automaticamente
Problema: Depende do cliente mencionar junto
```

### Sistema Novo (Contexto + Pergunta):
```
Cliente: "Quero sabão"
Agente: "Quantos?" ← PERGUNTA EXPLÍCITA
Cliente: "3"
Sistema salva quando cliente RESPONDE
✅ Mais confiável e estruturado!
```

---

## ⚙️ Como o Sistema Funciona (Técnico)

### 1. Detecção de Pergunta
Quando agente envia mensagem com palavras-chave de quantidade:
```javascript
detectAgentQuestion() → detecta "quantas unidades"
→ Salva em collectionContext: { waitingFor: 'quantity', productName: 'Sabão' }
```

### 2. Captura de Resposta
Quando cliente responde:
```javascript
detectAndSaveCustomerData() → vê context.waitingFor === 'quantity'
→ Extrai número da mensagem: "4"
→ Salva em customerData: { quantities: { "Sabão": 4 } }
```

### 3. Uso na Geração de Link
Quando gera link:
```javascript
getProductQuantities() → busca customerData.quantities["Sabão"]
→ Retorna: { name: "Sabão", price: 23, quantity: 4 }
→ createAsaasCharge() calcula: 4 × 23 = R$ 92,00
```

---

## ❓ FAQ

### Q: E se cliente não responder com número?
**A:** Sistema ignora e mantém quantidade padrão (1).

### Q: Posso usar detecção automática E perguntar?
**A:** Sim! Se agente não perguntar, o sistema antigo ainda funciona como fallback.

### Q: Funciona com múltiplos produtos?
**A:** Sim! Agente pode perguntar quantidade de cada produto separadamente.

### Q: Cliente pode mudar quantidade depois?
**A:** Não automaticamente. Precisa reiniciar conversa ou agente perguntar novamente.

---

## ✅ Benefícios

- ✅ **Controle total** do agente sobre o fluxo
- ✅ **Dados mais confiáveis** (pergunta explícita)
- ✅ **Suporta múltiplos produtos** com quantidades diferentes
- ✅ **Cálculo automático** do valor total
- ✅ **Experiência mais estruturada** para o cliente

---

## 🚀 Próximos Passos

1. **Aguarde o deploy** terminar (~2-3 min)
2. **Atualize seu prompt** para perguntar quantidade
3. **Teste** o fluxo completo
4. **Verifique** se valor está correto no link

---

**Sistema pronto! Boas vendas! 💰🎉**

