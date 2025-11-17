# 🚀 Deploy Manual - Vercel

## Opção 1: Via Vercel CLI (Recomendado)

### Passo 1: Instalar Vercel CLI (se ainda não tiver)
```bash
npm install -g vercel
```

### Passo 2: Fazer login no Vercel
```bash
vercel login
```

### Passo 3: Fazer deploy para produção
```bash
cd "C:\Users\Dell - Brayan\IA AGENTE"
vercel --prod
```

## Opção 2: Via Interface Web do Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em "Deployments"
4. Clique nos três pontos (...) do último deployment
5. Selecione "Redeploy"
6. Ou clique em "Create Deployment" para fazer um novo deploy

## Opção 3: Forçar via Git Push

Se o Vercel está conectado ao GitHub, você pode forçar um novo commit:

```bash
cd "C:\Users\Dell - Brayan\IA AGENTE"
git add -A
git commit -m "Force deploy - fix agendamentos"
git push origin main
```

O Vercel deve detectar automaticamente o push e fazer o build.

## Opção 4: Via npm script

```bash
cd "C:\Users\Dell - Brayan\IA AGENTE"
npm run deploy:vercel
```

ou

```bash
npm run deploy:force
```

