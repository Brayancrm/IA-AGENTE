# 🚨 INSTRUÇÕES URGENTES - AJUSTE NECESSÁRIO NO ASAAS

## ✅ Deploy Realizado

**Commit:** `bbbb9cd`  
**Status:** ✅ Código do backend corrigido para `'0101'`

---

## 🔴 O QUE VOCÊ PRECISA FAZER AGORA

### O problema estava em DOIS lugares:

1. ✅ **Backend** - JÁ CORRIGIDO (código mudado para `'0101'`)
2. ⚠️ **Asaas** - VOCÊ PRECISA CORRIGIR MANUALMENTE!

---

## 📋 PASSO A PASSO - FAÇA AGORA

### 1️⃣ Entre no Asaas
```
https://www.asaas.com
```

### 2️⃣ Vá em Configurações de Serviços
```
Menu: Receber → Notas Fiscais → Configurações → Aba "Serviços"
```

### 3️⃣ Edite o Serviço Padrão
Aquele que tem a marcação verde (✅) e está com:
```
Código: 6201501 | 01.01 - Análise e desenvolvimento de sistemas
ISS: 5%
```

### 4️⃣ Altere o Código
**MUDE DE:**
```
6201501 | 01.01 - Análise e desenvolvimento de sistemas
```

**PARA:**
```
0101
```

### 5️⃣ Mantenha os Outros Campos
```
✅ Descrição: Análise e desenvolvimento de sistemas
✅ ISS: 5%
✅ Marcar como padrão: SIM (✅)
```

### 6️⃣ Salve

### 7️⃣ Delete os Outros Serviços (Opcional)
- ❌ Aquele com código `6201501` e ISS 0%
- ❌ Aquele com código `01.01` e ISS 0%

**Deixe apenas um serviço: código `0101`, ISS 5%, marcado como padrão**

---

## 🎯 Resultado Final no Asaas

Você deve ter apenas 1 serviço cadastrado:

| Padrão | Código | ISS | Descrição |
|--------|--------|-----|-----------|
| ✅ | `0101` | `5%` | Análise e desenvolvimento de sistemas |

---

## 🔍 Por Que Isso é Necessário?

### O erro dizia:
```
"O Item da Lista de Serviço deve conter 3 a 4 dígitos"
```

### Tentativas:
1. ❌ `01.01` → Tem PONTO (não aceito)
2. ❌ `6201501` → Tem 7 DÍGITOS (prefeitura quer 3-4)
3. ✅ `0101` → 4 dígitos SEM ponto (CORRETO!)

---

## ⏱️ Depois de Ajustar

1. **Aguarde 3 minutos** (para o deploy do backend completar)
2. **Faça um pedido de teste**
3. **Efetue o pagamento**
4. **Aguarde a emissão automática**
5. ✅ **Nota fiscal deve ser emitida COM SUCESSO!**

---

## 🔔 IMPORTANTE

**SEM ajustar o Asaas, o erro pode continuar!**

O backend vai enviar `'0101'`, mas se o Asaas estiver configurado com o código errado, pode dar conflito.

**Ajuste AGORA no Asaas!**

---

## ✅ Checklist

Antes de testar, confirme:

- [ ] Entrei no Asaas
- [ ] Editei o serviço padrão
- [ ] Alterei o código para `0101`
- [ ] Mantive ISS em 5%
- [ ] Salvei as alterações
- [ ] Aguardei 3 minutos do deploy
- [ ] Fiz pedido de teste
- [ ] Nota fiscal emitida com sucesso! 🎉

---

## 📸 Como Deve Ficar

**Antes (errado):**
```
Padrão: ✅
Código: 6201501 | 01.01 - Análise e desenvolvimento de sistemas
ISS: 5%
```

**Depois (correto):**
```
Padrão: ✅
Código: 0101
ISS: 5%
Descrição: Análise e desenvolvimento de sistemas
```

---

## 🆘 Dúvidas?

Se ainda der erro depois de ajustar:
1. Tire print do erro
2. Verifique os logs do Railway
3. Confirme que o serviço no Asaas está como `0101`

**Agora deve funcionar de verdade!** 🚀

