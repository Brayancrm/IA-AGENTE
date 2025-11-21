# 🎨 Beefree Editor - Guia de Configuração

## ✅ Migração Concluída

O editor foi migrado do Unlayer para **Beefree**!

---

## 🔧 Como Configurar

### **Passo 1: Criar Conta no Beefree**

1. Acesse: https://beefree.io
2. Clique em **"Sign Up"** ou **"Criar Conta"**
3. Crie sua conta gratuita

### **Passo 2: Obter API Key**

1. Após fazer login, acesse o **Developer Console**
   - Geralmente em: https://beefree.io/developers ou no menu de configurações
2. Crie um novo projeto ou use o projeto padrão
3. Copie a **API Key** fornecida

### **Passo 3: Configurar no Projeto**

#### **Local (.env.local):**
```env
NEXT_PUBLIC_BEEFREE_API_KEY=sua_api_key_aqui
```

#### **Vercel (Produção):**
1. Acesse: https://vercel.com
2. Vá em seu projeto → Settings → Environment Variables
3. Adicione:
   - **Name:** `NEXT_PUBLIC_BEEFREE_API_KEY`
   - **Value:** Sua API Key do Beefree
4. Faça redeploy

---

## 📝 Nota Importante

A URL do iframe do Beefree pode variar conforme a documentação oficial. Se o editor não carregar:

1. Verifique a documentação em: https://developers.beefree.io
2. A URL atual está configurada como: `https://editor.beefree.io/embed?apiKey=...`
3. Se necessário, ajuste a URL no arquivo `components/BeefreeEditor.jsx` (linha ~116)

---

## 🎯 Vantagens do Beefree

- ✅ **Gratuito** para começar (até 1000 emails/mês)
- ✅ **Mais estável** que Unlayer
- ✅ **Interface moderna** e intuitiva
- ✅ **Templates profissionais** prontos
- ✅ **Sem problemas de reinicialização**

---

## 🚀 Próximos Passos

1. Configure a API Key (local e Vercel)
2. Teste o editor
3. Se necessário, ajuste a URL do iframe conforme documentação oficial

---

## 📞 Suporte

- Documentação: https://developers.beefree.io
- Suporte: https://beefree.io/support


