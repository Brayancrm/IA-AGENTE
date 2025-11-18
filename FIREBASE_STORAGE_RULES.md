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

## 🐛 Se o Erro Persistir:

1. **Verifique se o usuário está autenticado:**
   - O usuário precisa estar logado para fazer upload
   - Verifique se `auth.currentUser` não é `null`

2. **Verifique as regras do Storage:**
   - Certifique-se de que as regras foram publicadas corretamente
   - Verifique se o caminho `user_photos/{userId}/` está permitido

3. **Limpe o cache do navegador:**
   - Pressione `Ctrl+Shift+R` (Windows) ou `Cmd+Shift+R` (Mac)
   - Ou limpe o cache manualmente

4. **Verifique a configuração do Firebase:**
   - Certifique-se de que o Storage está habilitado no projeto
   - Verifique se o bucket está configurado corretamente

