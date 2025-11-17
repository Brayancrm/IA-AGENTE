# 🔧 Correção: Erro Dockerfile no Railway

## 🐛 Problema

**Erro no Railway:**
```
Build Failed: bc.Build: failed to solve: failed to read dockerfile: 
open backend/Dockerfile: no such file or directory
```

## 🔍 Causa

O Railway estava tentando usar Docker quando deveria usar Nixpacks. O Dockerfile estava causando conflito.

## ✅ Solução Implementada

1. **Removido `Dockerfile`** - Não é necessário, vamos usar Nixpacks
2. **Criado `nixpacks.toml`** - Configuração específica do Nixpacks que:
   - Instala Node.js 18
   - Instala todas as dependências do sistema necessárias para Chromium
   - Executa `npm install`
   - Inicia com `node server.js`

3. **Simplificado `railway.json`** - Agora apenas especifica usar Nixpacks

## 📋 Arquivos Modificados

- ❌ **Removido:** `backend/Dockerfile`
- ✅ **Criado:** `backend/nixpacks.toml`
- ✅ **Atualizado:** `backend/railway.json`

## 🚀 Próximo Deploy

O Railway agora vai:
1. Detectar `nixpacks.toml`
2. Usar Nixpacks (não Docker)
3. Instalar dependências do sistema automaticamente
4. Instalar dependências Node.js
5. Iniciar o servidor

## ✅ Resultado Esperado

- ✅ Build deve funcionar sem erro de Dockerfile
- ✅ Dependências do sistema serão instaladas
- ✅ Chromium deve funcionar corretamente

