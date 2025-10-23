# ✅ Correção do Código de Serviço Municipal

## 🔴 O Problema

A emissão da nota fiscal estava falhando com o erro:
```
"O Item da Lista de Serviço deve conter 3 a 4 dígitos"
```

### Causa Raiz
O backend estava enviando o código `'01.01'` (formato com ponto) quando deveria enviar apenas dígitos numéricos como `'6201501'`.

### Onde estava o erro?
No arquivo `backend/server.js`, linha 2441:
```javascript
municipalServiceCode: fiscalConfig.municipalServiceCode || '01.01',  // ❌ ERRADO
```

## ✅ A Correção

Alterado para usar o código correto cadastrado no Asaas:
```javascript
municipalServiceCode: fiscalConfig.municipalServiceCode || '6201501',  // ✅ CORRETO
```

O código `6201501` corresponde a "Análise e desenvolvimento de sistemas" e é aceito pela prefeitura de Brasília-DF.

## 🚀 Próximos Passos

1. **Reinicie o backend:**
   ```bash
   cd backend
   npm run start
   ```

2. **Teste a emissão:**
   - Faça um novo pedido via WhatsApp
   - A nota fiscal deve ser emitida com sucesso agora

3. **(Opcional) Configure no Firebase:**
   - Para usar um código diferente, salve em `users/data/{userId}/fiscal_config`
   - Use o endpoint: `POST /api/fiscal-config/save`

## 📋 Códigos de Serviço Válidos para Brasília

- Formato: **3 a 4 dígitos numéricos** (sem pontos ou caracteres especiais)
- Exemplos válidos:
  - `6201501` - Análise e desenvolvimento de sistemas
  - `6201` - Outros serviços de TI
  - `7020` - Consultoria

## 🔍 Como Verificar

Após reiniciar o backend, os logs mostrarão:
```
📝 [NF] Dados da nota fiscal preparados:
   - Código serviço: 6201501  ✅ (não mais 01.01)
```

