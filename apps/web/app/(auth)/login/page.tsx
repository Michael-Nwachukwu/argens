'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Prefill email from localStorage
  useEffect(() => {
    const lastEmail = localStorage.getItem('argens_last_email')
    if (lastEmail) setEmail(lastEmail)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'inline-flex' }}>
          <Logo size="lg" />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
          Sign in to your dashboard
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '28px 28px 24px',
      }}>
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--error-low)',
            border: '1px solid rgba(160,72,72,0.3)',
            borderRadius: 7,
            color: 'var(--error)',
            fontSize: 13,
            marginBottom: 20,
            fontFamily: 'var(--font-mono)',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border2)',
                borderRadius: 7,
                padding: '10px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border2)',
                borderRadius: 7,
                padding: '10px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '11px',
              background: loading ? 'var(--bg3)' : 'var(--accent)',
              border: 'none',
              borderRadius: 7,
              color: loading ? 'var(--muted)' : '#0C0B0A',
              fontFamily: 'var(--font-head)',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '-0.01em',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
        No account?{' '}
        <Link href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Create one →
        </Link>
      </p>
    </div>
  )
}
