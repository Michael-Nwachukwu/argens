import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'Argens — Programmable payments for AI agents',
  description: 'An API key that authorizes autonomous USDC spending on Stellar — within policies you define, enforced on-chain.',
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
