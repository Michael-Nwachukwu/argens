import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'Argens — Programmable payments for AI agents',
  description: 'Give your AI agent the ability to pay. An API key that authorizes autonomous USDC spending on Stellar, within policies you define.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '256x256 48x48 32x32 16x16', type: 'image/x-icon' },
      { url: '/argens-icon.png', sizes: '1024x1024', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Argens — Programmable payments for AI agents',
    description: 'Give your AI agent the ability to pay. An API key that authorizes autonomous USDC spending on Stellar, within policies you define.',
    url: 'https://argens.xyz',
    siteName: 'Argens',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Argens — Programmable payments for AI agents',
    description: 'Give your AI agent the ability to pay. An API key that authorizes autonomous USDC spending on Stellar, within policies you define.',
  },
  metadataBase: new URL('https://argens.xyz'),
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
