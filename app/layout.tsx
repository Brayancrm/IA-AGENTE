import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PWARegister } from '../components/PWARegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'dadosIA',
  description: 'Painel de controle para configurar um assistente de vendas e suporte virtual para WhatsApp',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/dadosia-app-icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/logo.png', sizes: 'any' },
    ],
    apple: [
      { url: '/dadosia-app-icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/dadosia-app-icon.svg',
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
  themeColor: '#76c893',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}