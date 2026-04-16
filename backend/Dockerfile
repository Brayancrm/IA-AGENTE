# Imagem otimizada para cache: apt (pesado) só refaz se esta camada mudar;
# alterações em server.js não reinstalam GTK/Chrome deps.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production

# Retries: espelhos APT às vezes devolvem índice incompleto (erro "unexpected size" no build da Railway).
RUN set -eux; \
  printf 'Acquire::Retries "5";\nAcquire::http::Timeout "120";\nAcquire::https::Timeout "120";\n' > /etc/apt/apt.conf.d/99railway; \
  APT_OK=0; \
  for i in 1 2 3 4 5 6; do \
    apt-get clean || true; \
    rm -rf /var/lib/apt/lists/* || true; \
    if apt-get update -qq; then APT_OK=1; break; fi; \
    echo "apt-get update falhou (tentativa $i/6), a aguardar 15s..."; \
    sleep 15; \
  done; \
  test "$APT_OK" = "1" || (echo "apt-get update falhou após 6 tentativas" >&2; exit 1); \
  apt-get install -y -qq --no-install-recommends \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libatspi2.0-0 \
    libxshmfence1 libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libgtk-3-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcursor1 libxext6 libxi6 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator3-1 xdg-utils \
  && (apt-get install -y -qq --no-install-recommends libasound2 \
      || apt-get install -y -qq --no-install-recommends libasound2t64 \
      || apt-get install -y -qq --no-install-recommends libasound2-data \
      || true) \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
