'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Sidebar } from '@/components/dashboard/Sidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--muted)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <polygon points="10,1 19,10 10,19 1,10" fill="var(--accent)" />
            <polygon points="10,6 14,10 10,14 6,10" fill="var(--bg)" />
          </svg>
          Loading…
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
