# 🔄 Variáveis de Template do CRM

Agora você pode usar variáveis nos **Steps das Configurações do Assistente** para personalizar mensagens com dados do cliente do CRM!

## 📝 Como Usar

Nos campos de **descrição** dos steps, use as variáveis entre chaves duplas `{{variável}}`:

**Exemplo:**
```
Olá {{nome}}! Como posso ajudá-lo hoje?
```

Quando o assistente processar essa mensagem, `{{nome}}` será substituído pelo nome do cliente cadastrado no CRM.

---

## 🎯 Variáveis Disponíveis

### Dados Básicos do Cliente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{nome}}` ou `{{name}}` | Nome completo do cliente | João Silva |
| `{{email}}` | Email do cliente | joao@email.com |
| `{{telefone}}` ou `{{phone}}` | Telefone do cliente (sem @c.us) | 5511999999999 |
| `{{cpf}}` ou `{{cpfCnpj}}` | CPF/CNPJ do cliente | 123.456.789-00 |

### Dados de Endereço

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{endereco}}` ou `{{address}}` | Endereço completo (rua + número) | Rua das Flores, 123 |
| `{{rua}}` ou `{{street}}` | Nome da rua | Rua das Flores |
| `{{numero}}` ou `{{number}}` | Número do endereço | 123 |
| `{{complemento}}` ou `{{complement}}` | Complemento (apto, casa, etc) | Apartamento 45 |
| `{{bairro}}` ou `{{neighborhood}}` | Bairro | Centro |
| `{{cidade}}` ou `{{city}}` | Cidade | São Paulo |
| `{{estado}}` ou `{{state}}` | Estado (UF) | SP |
| `{{cep}}` | CEP | 01234-567 |

### Dados Customizados

Se você criou campos customizados no CRM através da funcionalidade de **Coleta de Dados Personalizados**, você pode usar:

```
{{nome_do_campo}}
```

**Exemplo:** Se você criou um campo chamado "Empresa", use:
```
Olá {{nome}}! Vi que você trabalha na {{empresa}}.
```

**Nota:** Os nomes dos campos customizados podem ser escritos em:
- `{{campo_customizado}}` (snake_case)
- `{{campoCustomizado}}` (camelCase)

---

## 💡 Exemplos Práticos

### Exemplo 1: Saudação Personalizada
```
Olá {{nome}}! Seja bem-vindo(a) à nossa loja! 😊

Como posso ajudá-lo(a) hoje?
```

**Resultado para cliente "João Silva":**
```
Olá João Silva! Seja bem-vindo(a) à nossa loja! 😊

Como posso ajudá-lo(a) hoje?
```

### Exemplo 2: Mensagem com Endereço
```
Olá {{nome}}!

Confirmando seu endereço de entrega:
{{endereco}}, {{complemento}}
{{bairro}}, {{cidade}} - {{estado}}
CEP: {{cep}}

Está correto?
```

**Resultado:**
```
Olá João Silva!

Confirmando seu endereço de entrega:
Rua das Flores, 123, Apartamento 45
Centro, São Paulo - SP
CEP: 01234-567

Está correto?
```

### Exemplo 3: Mensagem de Confirmação
```
Perfeito, {{nome}}!

Seus dados:
📧 Email: {{email}}
📱 Telefone: {{telefone}}
🆔 CPF: {{cpf}}

Tudo certo?
```

---

## ⚠️ Comportamento

- **Se o dado não estiver cadastrado:** A variável será substituída por um texto padrão como "Cliente", "email não cadastrado", etc.
- **Funciona em:** Descrições dos steps, mensagens do assistente geradas pela IA
- **Case-insensitive:** `{{nome}}`, `{{NOME}}`, `{{Nome}}` funcionam da mesma forma

---

## 🚀 Onde Funciona

As variáveis funcionam em:

1. ✅ **Descrição dos Steps** - Quando o assistente usa a descrição como guia
2. ✅ **Respostas da IA** - Quando a IA gera mensagens que contêm variáveis
3. ✅ **System Prompt** - Se você usar variáveis no prompt do sistema

---

## 📋 Dica

**Use variáveis sempre que quiser personalizar mensagens com dados do cliente!**

Exemplos de uso:
- Saudação inicial: `Olá {{nome}}!`
- Confirmação de pedido: `Pedido confirmado, {{nome}}!`
- Envio de link: `Olá {{nome}}, aqui está seu link de pagamento.`
- Mensagem de boas-vindas: `Bem-vindo de volta, {{nome}}!`

---

## 🔍 Debug

Os logs do backend mostrarão quando variáveis foram substituídas:

```
🔄 Variáveis substituídas no texto: Sim
   Original: Olá {{nome}}! Como posso ajudar?
   Substituído: Olá João Silva! Como posso ajudar?
```

Isso ajuda a identificar se as variáveis estão funcionando corretamente!

