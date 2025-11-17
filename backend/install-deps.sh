#!/bin/bash
# Script para instalar dependências do sistema necessárias para o Chromium
# Este script é executado durante o build no Railway/Render

echo "🔧 Instalando dependências do sistema para Chromium..."

# Atualizar lista de pacotes
apt-get update -qq

# Instalar dependências essenciais do Chromium
apt-get install -y -qq \
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
  libxshmfence1

echo "✅ Dependências instaladas com sucesso!"

