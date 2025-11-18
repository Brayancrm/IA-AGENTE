# 🚀 Como Resolver o Erro de CORS no Upload de Foto

## 📋 Passo a Passo SIMPLES

### ✅ PASSO 1: Configurar CORS no Google Cloud Console

O erro de CORS acontece porque o Google Cloud Storage (que o Firebase usa) precisa de uma configuração especial.

1. **Abra este link:** https://console.cloud.google.com/storage/browser?project=ia-agente-b2f46

2. **Você verá uma lista de "Buckets" (buckets). Clique no bucket:**
   - `ia-agente-b2f46.firebasestorage.app` 
   - OU `ia-agente-b2f46.appspot.com`
   - (Pode aparecer apenas um, não tem problema)

3. **No topo da página, clique na aba "CONFIGURAÇÃO"** (Configuration)

4. **Role a página até encontrar a seção "CORS"** (Cross-Origin Resource Sharing)

5. **Clique no botão "EDITAR"** (Edit) ao lado de CORS

6. **Apague tudo que estiver lá e cole EXATAMENTE isto:**

```json
[
  {
    "origin": ["https://ia-agente.vercel.app", "https://*.vercel.app"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

7. **Clique em "SALVAR"** (Save)

8. **Aguarde alguns segundos** (pode levar até 1 minuto para aplicar)

---

### ✅ PASSO 2: Testar o Upload

1. **Volte para o site:** https://ia-agente.vercel.app

2. **Faça login** (se não estiver logado)

3. **Vá em "Cadastro do Usuário"**

4. **Clique em "Escolher Foto"** e selecione uma imagem

5. **Aguarde o upload** - deve funcionar agora! ✅

---

## 🆘 Se Ainda Não Funcionar:

### Opção A: Limpar Cache do Navegador

1. Pressione `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)
2. Tente fazer upload novamente

### Opção B: Tentar em Aba Anônima

1. Abra uma janela anônima/privada (`Ctrl + Shift + N`)
2. Acesse https://ia-agente.vercel.app
3. Faça login
4. Tente fazer upload

### Opção C: Verificar se Está Logado

1. Abra o Console do navegador (F12)
2. Vá na aba "Console"
3. Digite: `firebase.auth().currentUser`
4. Se aparecer `null`, você precisa fazer login novamente

---

## 📸 Onde Encontrar CORS no Google Cloud:

```
Google Cloud Console
  └─ Cloud Storage
      └─ Buckets
          └─ [Seu Bucket]
              └─ Aba "CONFIGURAÇÃO"
                  └─ Seção "CORS"
                      └─ Botão "EDITAR"
```

---

## ✅ Resumo Rápido:

1. ✅ Acesse: https://console.cloud.google.com/storage/browser?project=ia-agente-b2f46
2. ✅ Clique no bucket
3. ✅ Aba "CONFIGURAÇÃO" → Seção "CORS" → "EDITAR"
4. ✅ Cole o JSON acima
5. ✅ Salve
6. ✅ Teste no site

**Pronto!** 🎉

