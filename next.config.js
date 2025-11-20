/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração para PWA
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
  // Permitir carregamento de scripts externos do Unlayer
  async rewrites() {
    return [];
  },
}

module.exports = nextConfig
