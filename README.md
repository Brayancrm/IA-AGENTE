# WhatsApp Sales Agent Builder

Painel de controle para configurar um assistente de vendas e suporte virtual para WhatsApp.

## 🚀 Como Executar

### 📦 Deploy no Vercel (Recomendado)

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/whatsapp-sales-agent.git
   cd whatsapp-sales-agent
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   - Copie `env.example` para `.env.local`
   - Configure suas credenciais do Firebase:
     ```bash
     cp env.example .env.local
     ```

4. **Configure o Firebase no console do Vercel:**
   - Vá para o projeto no Vercel
   - Settings > Environment Variables
   - Adicione todas as variáveis do `env.example`

5. **Deploy:**
   ```bash
   vercel --prod
   ```

### 🏠 Desenvolvimento Local

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure o arquivo `.env.local`:**
   ```bash
   cp env.example .env.local
   # Edite .env.local com suas credenciais
   ```

3. **Execute o projeto:**
   ```bash
   npm run dev
   ```

4. **Abra no navegador:**
   - O aplicativo estará disponível em `http://localhost:3000`

## 📋 Funcionalidades

- ✅ **Dashboard** com status de configuração
- ✅ **Cadastro da Empresa** (nome, CNPJ, WhatsApp)
- ✅ **Catálogo de Itens** (produtos e serviços)
- ✅ **Integrações** (Asaas e Fiscal)
- ✅ **Configuração do Assistente**
- ✅ **Sistema de notificações** (Toast)
- ✅ **Design responsivo** com Tailwind CSS
- ✅ **Integração com Firestore** em tempo real

## 🛠 Tecnologias

- **Next.js 14** (Framework React)
- **Firebase/Firestore** (Banco de dados)
- **Tailwind CSS** (Estilização)
- **Lucide React** (Ícones)
- **Vercel** (Deploy)

## 📱 Interface

O aplicativo possui uma interface moderna com:
- Sidebar de navegação fixa
- Design responsivo
- Tema em tons de índigo
- Notificações em tempo real
- Modais interativos

## 🔧 Configuração do Firebase

Certifique-se de que seu projeto Firebase tem:
- Firestore habilitado
- Autenticação configurada
- Regras de segurança apropriadas

## 🌐 Deploy no Vercel

### Passo a passo:

1. **Crie um repositório no GitHub** com todos os arquivos
2. **Conecte o repositório ao Vercel**
3. **Configure as variáveis de ambiente** no Vercel:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_APP_ID`
4. **Deploy automático** será feito a cada push

### Variáveis de Ambiente no Vercel:

Vá em **Settings > Environment Variables** e adicione:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_APP_ID=whatsapp-sales-agent
```

## 📂 Estrutura do Projeto

```
whatsapp-sales-agent/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── whatsapp-sales-agent.jsx
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
├── env.example
└── README.md
```
