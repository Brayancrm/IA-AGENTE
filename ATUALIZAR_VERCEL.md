# 🚨 IMPORTANTE: Atualizar Variável de Ambiente no Vercel

## O Problema

O erro continua porque a variável `NEXT_PUBLIC_APP_ID` no Vercel ainda está com o valor antigo `whatsapp-sales-agent` (com traço).

O Realtime Database do Firebase **NÃO aceita traços (-)** em caminhos!

## ✅ Solução: Atualizar no Vercel

### Passo 1: Acesse as Configurações do Projeto

1. Vá para: [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique no seu projeto **IA-AGENTE**
3. Clique em **"Settings"** (Configurações)

### Passo 2: Atualizar Variáveis de Ambiente

1. No menu lateral, clique em **"Environment Variables"**
2. Procure por: `NEXT_PUBLIC_APP_ID`
3. **EDITE** o valor de:
   - ❌ `whatsapp-sales-agent` (ERRADO - tem traço)
   - ✅ `whatsapp_sales_agent` (CORRETO - tem underscore)

### Passo 3: Fazer Redeploy

1. Vá em **"Deployments"**
2. Clique nos **três pontinhos** do último deploy
3. Clique em **"Redeploy"**
4. **Aguarde** o deploy finalizar

## 📋 Valores Corretos das Variáveis

Copie e cole exatamente assim no Vercel:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAT07qPBMudS0PF6-Ir-aQQhGUPJKE54n4
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ia-agente-b2f46.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ia-agente-b2f46
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ia-agente-b2f46.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=915148785133
NEXT_PUBLIC_FIREBASE_APP_ID=1:915148785133:web:90e381fe612842769e53e4
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-QTLFRJE275
NEXT_PUBLIC_APP_ID=whatsapp_sales_agent
```

⚠️ **ATENÇÃO:** O mais importante é `NEXT_PUBLIC_APP_ID=whatsapp_sales_agent` (com **underscore**, não traço!)

## 🔍 Como Testar

Após o redeploy:

1. Acesse: `ia-agente.vercel.app`
2. Faça login como master
3. Tente criar um usuário
4. Deve funcionar sem erros!
5. Verifique no Firebase Console em: `artifacts/whatsapp_sales_agent/registered_users`

## 📂 Novo Caminho no Realtime Database

```
artifacts/
  └── whatsapp_sales_agent/    ← Agora com underscore!
      └── registered_users/
          ├── -N123abc...
          └── -N456def...
```

