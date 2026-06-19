'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { auth, isError } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await auth.forgotPassword(email)
    setLoading(false)
    if (isError(res)) {
      setError(res.error)
    } else {
      setSent(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex' }}>
            <Logo size="lg" />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
            Reset your password
          </p>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 28px 24px' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>✉</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                If <strong>{email}</strong> is registered, we&apos;ve sent a password reset link. It expires in 1 hour.
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ padding: '10px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, color: 'var(--error)', fontSize: 13, marginBottom: 20, fontFamily: 'var(--font-mono)' }}>
                  {error}
                </div>
              )}

              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginTop: 0, marginBottom: 20 }}>
                Enter your account email and we&apos;ll send you a link to set a new password.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ marginTop: 4, width: '100%', padding: '11px', background: loading ? 'var(--bg3)' : 'var(--accent)', border: 'none', borderRadius: 7, color: loading ? 'var(--muted)' : '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', letterSpacing: '-0.01em' }}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
          Remembered it?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
