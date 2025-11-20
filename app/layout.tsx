import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { PWARegister } from '../components/PWARegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'dadosIA',
  description: 'Painel de controle para configurar um assistente de vendas e suporte virtual para WhatsApp',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/logo.png', sizes: 'any' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'dadosIA',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'dadosIA',
    title: 'dadosIA',
    description: 'Painel de controle para configurar um assistente de vendas e suporte virtual para WhatsApp',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#25D366',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <Script
          src="https://editor.unlayer.com/embed.js"
          strategy="lazyOnload"
          onLoad={() => {
            if (typeof window !== 'undefined') {
              console.log('✅ Unlayer script carregado no head');
            }
          }}
          onError={(e) => {
            console.error('❌ Erro ao carregar script do Unlayer no head:', e);
          }}
        />
      </head>
      <body className={inter.className}>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}