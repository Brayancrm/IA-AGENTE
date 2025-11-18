# 🔒 Regras do Firebase Storage

## ⚠️ IMPORTANTE: Configurar Regras do Storage

O erro de CORS no upload de fotos geralmente é causado por regras de segurança muito restritivas no Firebase Storage.

## 🔑 DIFERENÇA ENTRE STORAGE E REALTIME DATABASE

**IMPORTANTE:** As regras do **Firebase Storage** são **COMPLETAMENTE SEPARADAS** das regras do **Realtime Database**:

- ✅ **Realtime Database Rules** → Controlam acesso aos dados (conversas, pedidos, etc.)
- ✅ **Storage Rules** → Controlam acesso aos arquivos (fotos, documentos, etc.)

**NÃO HÁ CONFLITO** entre elas! Você pode configurar ambas independentemente.

## 📝 Como Configurar:

⚠️ **ATENÇÃO:** Você está configurando as regras do **STORAGE**, não do Realtime Database!

1. **Acesse:** https://console.firebase.google.com
2. **Selecione:** `ia-agente-b2f46`
3. **No menu lateral:** Clique em **Storage** (Armazenamento) - **NÃO** em Realtime Database
4. **Clique na aba:** **Regras** (Rules) - dentro da seção Storage
5. **Cole as regras abaixo:**
6. **Clique em:** **Publicar** (botão azul)

**Localização no Console:**
```
Firebase Console
  └─ ia-agente-b2f46
      ├─ Realtime Database (suas regras atuais - NÃO MEXER)
      │   └─ Regras (Rules) → JSON com whatsapp_sessions, conversations, etc.
      └─ Storage (aqui que você vai configurar - NOVO)
          └─ Regras (Rules) → JavaScript com match /b/{bucket}/o
```

## ✅ GARANTIA: Suas Regras do Realtime Database Estão Seguras

As regras que você mostrou na foto (com `whatsapp_sessions`, `conversations`, `orders`, etc.) são do **Realtime Database** e **NÃO SERÃO AFETADAS** pelas regras do Storage.

- ✅ Suas regras do Realtime Database continuam funcionando normalmente
- ✅ As regras do Storage são configuradas em um lugar completamente diferente
- ✅ Não há risco de conflito ou perda de configuração

---

## 🔐 Regras Recomendadas:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Permitir upload de fotos de perfil para usuários autenticados
    match /user_photos/{userId}/{allPaths=**} {
      // Permitir leitura para o próprio usuário
      allow read: if request.auth != null && request.auth.uid == userId;
      // Permitir escrita apenas para o próprio usuário
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024  // Máximo 5MB
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Permitir acesso a outras pastas conforme necessário
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🔧 Alternativa: Regras Mais Permissivas (Apenas para Desenvolvimento)

⚠️ **ATENÇÃO:** Use apenas em desenvolvimento. Para produção, use as regras acima.

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## ✅ Verificação:

Após publicar as regras:

1. ✅ Tente fazer upload de uma foto novamente
2. ✅ Verifique se não há mais erros de CORS no console
3. ✅ A foto deve aparecer no preview após o upload

---

## 🐛 Se o Erro de CORS Persistir (Como na Sua Foto):

O erro de CORS pode ocorrer mesmo com regras corretas. Isso acontece porque o Firebase Storage usa Google Cloud Storage, que precisa de configuração de CORS adicional.

### Solução 1: Configurar CORS no Google Cloud Console

1. **Acesse:** https://console.cloud.google.com
2. **Selecione o projeto:** `ia-agente-b2f46`
3. **No menu lateral:** Vá em **Cloud Storage** → **Buckets**
4. **Clique no bucket:** `ia-agente-b2f46.firebasestorage.app` (ou similar)
5. **Clique na aba:** **Configuração** (Configuration)
6. **Role até:** **CORS** (Cross-Origin Resource Sharing)
7. **Clique em:** **Editar** (Edit)
8. **Cole esta configuração JSON:**

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

9. **Clique em:** **Salvar** (Save)

### Solução 2: Verificar se o Usuário Está Autenticado

O erro de CORS pode ocorrer se o usuário não estiver autenticado:

1. **Verifique no console do navegador:**
   - Abra o DevTools (F12)
   - Vá na aba "Console"
   - Digite: `firebase.auth().currentUser`
   - Deve retornar um objeto, não `null`

2. **Se retornar `null`:**
   - Faça login novamente
   - Aguarde alguns segundos
   - Tente fazer upload novamente

### Solução 3: Limpar Cache e Tentar Novamente

1. **Limpe o cache do navegador:**
   - Pressione `Ctrl+Shift+R` (Windows) ou `Cmd+Shift+R` (Mac)
   - Ou limpe o cache manualmente

2. **Tente em uma aba anônima:**
   - Abra uma janela anônima/privada
   - Faça login
   - Tente fazer upload

### Solução 4: Verificar Configuração do Firebase

1. **Certifique-se de que o Storage está habilitado:**
   - Firebase Console → Storage
   - Deve mostrar "Storage está ativado"

2. **Verifique o bucket:**
   - O bucket deve ser: `ia-agente-b2f46.firebasestorage.app` ou `ia-agente-b2f46.appspot.com`
   - Verifique no arquivo `.env` ou `env.local` se `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` está correto

### Solução 5: Regras Temporárias Mais Permissivas (TESTE)

Se nada funcionar, teste temporariamente com regras totalmente abertas (APENAS PARA TESTE):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;  // ⚠️ PERMISSIVO - APENAS PARA TESTE
    }
  }
}
```

**⚠️ IMPORTANTE:** Se funcionar com essas regras, o problema é nas regras. Se não funcionar, o problema é na configuração de CORS do Google Cloud.

