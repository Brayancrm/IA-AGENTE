# Dockerfile para backend com dependências do Chromium
FROM node:18-slim

# Instalar dependências do sistema necessárias para Chromium
RUN apt-get update && apt-get install -y -qq \
  libglib2.0-0 \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libatspi2.0-0 \
  libxshmfence1 \
  && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências Node.js
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Expor porta
EXPOSE 3001

# Comando para iniciar
CMD ["node", "server.js"]

