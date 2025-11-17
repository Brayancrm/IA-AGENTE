# 🔧 Instalação de Dependências do Sistema para Chromium

## 🐛 Problema

O Chromium precisa de bibliotecas do sistema Linux que não vêm instaladas por padrão em ambientes de produção (Railway, Render, etc).

**Erro:**
```
error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file
```

## ✅ Solução Implementada

Foram criados arquivos de configuração que instalam automaticamente as dependências durante o build:

### **Arquivos Criados:**

1. **`install-deps.sh`** - Script bash para instalar dependências
2. **`Dockerfile`** - Para deploy via Docker
3. **`railway.json`** - Configuração para Railway
4. **`render.yaml`** - Configuração para Render

## 🚀 Como Funciona

### **Railway.app:**

O arquivo `railway.json` já está configurado. O Railway vai:
1. Detectar o arquivo `railway.json`
2. Executar o comando de build que instala as dependências
3. Instalar as bibliotecas necessárias antes do `npm install`

### **Render.com:**

O arquivo `render.yaml` já está configurado. O Render vai:
1. Detectar o arquivo `render.yaml`
2. Executar o comando de build que instala as dependências
3. Instalar as bibliotecas necessárias antes do `npm install`

### **Docker:**

Se usar Docker:
```bash
docker build -t whatsapp-backend .
docker run -p 3001:3001 whatsapp-backend
```

### **VPS/Servidor Próprio:**

Execute manualmente antes de iniciar:
```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libatk1.0-0 \
  libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libatspi2.0-0 libxshmfence1
```

## 📋 Dependências Instaladas

- `libglib2.0-0` - Biblioteca GLib (essencial)
- `libnss3` - Network Security Services
- `libnspr4` - Netscape Portable Runtime
- `libatk1.0-0` - Accessibility Toolkit
- `libatk-bridge2.0-0` - AT-SPI bridge
- `libcups2` - Common Unix Printing System
- `libdrm2` - Direct Rendering Manager
- `libdbus-1-3` - D-Bus message bus
- `libxkbcommon0` - Keyboard handling
- `libxcomposite1` - X11 Composite extension
- `libxdamage1` - X11 Damage extension
- `libxfixes3` - X11 Fixes extension
- `libxrandr2` - X11 RandR extension
- `libgbm1` - Generic Buffer Management
- `libasound2` - ALSA sound library
- `libatspi2.0-0` - Assistive Technology Service Provider Interface
- `libxshmfence1` - Shared memory fences

## 🔍 Verificar se Funcionou

Após o deploy, verifique os logs:

```bash
# No Railway/Render, procure por:
"✅ Dependências instaladas com sucesso!"
```

Ou teste a conexão:
1. Acesse o painel
2. Clique em "Conectar WhatsApp"
3. ✅ Deve funcionar sem erro de `libglib`

## ⚠️ Notas

- O script `install-deps.sh` é executado automaticamente após `npm install` (via `postinstall`)
- Em Windows, o script não executa (normal, não precisa dessas libs)
- Em produção Linux, as dependências são instaladas automaticamente

## 🔄 Próximo Deploy

Após fazer commit desses arquivos:
1. Railway/Render detecta os novos arquivos de configuração
2. Executa o build com instalação de dependências
3. Chromium deve funcionar corretamente ✅

