# 🚀 Flow Builder - Início Rápido

## ✅ Implementação Concluída!

Tudo foi configurado e está pronto para uso!

---

## 🎯 Como Testar AGORA

### 1️⃣ Reiniciar o Backend

```bash
cd backend
npm start
```

**Ou use o atalho:**
```bash
backend\start-backend.bat
```

### 2️⃣ Iniciar o Frontend

Em outro terminal:
```bash
npm run dev
```

### 3️⃣ Abrir a Página de Teste

Abra no navegador:
```
http://localhost:3000/flow-builder-test
```

---

## 🎨 O Que Você Vai Ver

Uma interface visual com:

```
┌─────────────────────────────────────┐
│ 🎯 Fluxo do Agente                  │
│              [+ Adicionar Passo]    │
├─────────────────────────────────────┤
│ ⋮⋮ 👋 Passo 1: Cumprimentar  [✏️][🗑️]│
├─────────────────────────────────────┤
│ ⋮⋮ ❓ Passo 2: Perguntar Nome [✏️][🗑️]│
├─────────────────────────────────────┤
│ ⋮⋮ 📦 Passo 3: Mostrar Produtos[✏️][🗑️]│
└─────────────────────────────────────┘
```

---

## 🧪 Testes para Fazer

### Teste 1: Adicionar Step
1. Clique em **"+ Adicionar Passo"**
2. Escolha um tipo de ação
3. Preencha título e descrição
4. Clique em **"Salvar"**
5. ✅ Novo passo aparece na lista

### Teste 2: Editar Step
1. Clique no ícone **✏️** de um passo
2. Modifique o texto
3. Clique em **"Salvar"**
4. ✅ Alterações são aplicadas

### Teste 3: Remover Step
1. Clique no ícone **🗑️** de um passo
2. ✅ Passo é removido

### Teste 4: Reordenar Steps
1. Clique e segure o ícone **⋮⋮**
2. Arraste para cima ou para baixo
3. Solte
4. ✅ Ordem é alterada

### Teste 5: Ver Prompt Gerado
1. Role a página até o fim
2. Veja a seção **"📝 Preview do Prompt Gerado"**
3. ✅ Prompt é gerado automaticamente dos steps

---

## 📂 Arquivos Criados

```
✅ components/FlowBuilder.jsx          (Interface visual)
✅ hooks/useFlowBuilder.js             (Gerenciamento de estado)
✅ app/flow-builder-test/page.tsx      (Página de teste)
✅ backend/server.js                   (Endpoints adicionados)
```

---

## 🔧 Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/ai-config/:userId` | Buscar configuração |
| PUT | `/api/ai-config/:userId` | Salvar configuração |

---

## 🎯 Próximos Passos

### Para Usar em Produção:

1. **Integrar na página de configuração real**
   
   Copie o código de `app/flow-builder-test/page.tsx` para sua página de config.

2. **Adicionar autenticação**
   
   ```jsx
   import { useAuth } from '@/hooks/useAuth';
   
   const { user } = useAuth();
   const { steps, setSteps } = useFlowBuilder(user?.uid);
   ```

3. **Conectar com backend real**
   
   Os endpoints já estão configurados!

4. **Personalizar tipos de ação**
   
   Edite o array `actionTypes` em `FlowBuilder.jsx`

---

## 🐛 Solução de Problemas

### Backend não inicia?
```bash
cd backend
npm install
npm start
```

### Frontend não carrega?
```bash
npm install
npm run dev
```

### Drag & drop não funciona?
- Certifique-se que `@hello-pangea/dnd` está instalado
- Teste em navegador atualizado (Chrome/Edge)

### Erro ao salvar?
- Verifique se o backend está rodando
- Veja o console do navegador (F12)
- Veja os logs do backend

---

## 📚 Documentação Completa

- 📖 **FLOW_BUILDER_GUIA.md** - Guia completo com exemplos
- 📝 **FLOW_BUILDER_RESUMO.md** - Resumo executivo
- 🔧 **backend/ENDPOINTS_FLOW_BUILDER.md** - Detalhes dos endpoints

---

## ✅ Checklist de Verificação

- [x] ✅ Dependências instaladas
- [x] ✅ Componente FlowBuilder criado
- [x] ✅ Hook useFlowBuilder criado
- [x] ✅ Endpoints no backend
- [x] ✅ Página de teste criada
- [ ] ⏳ Testar no navegador
- [ ] ⏳ Integrar na página real
- [ ] ⏳ Fazer deploy

---

## 🎉 Está Pronto!

Agora é só:
1. Reiniciar o backend
2. Iniciar o frontend
3. Abrir http://localhost:3000/flow-builder-test
4. Testar!

**Divirta-se criando fluxos visualmente!** 🚀

