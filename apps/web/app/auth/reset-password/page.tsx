'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { auth, isError } from '@/lib/api'

function ResetPasswordContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const res = await auth.resetPassword(token, password)
    setLoading(false)
    if (isError(res)) {
      setError(res.error)
    } else {
      setDone(true)
      setTimeout(() => router.push('/login'), 2200)
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
            Choose a new password
          </p>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 28px 24px' }}>
          {!token ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>✗</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, color: 'var(--error)', marginBottom: 8 }}>Invalid link</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                This reset link is missing its token. Request a new one from the forgot-password page.
              </div>
            </div>
          ) : done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>Password updated</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>You can now sign in with your new password.</div>
              <div style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>Redirecting to login…</div>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ padding: '10px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, color: 'var(--error)', fontSize: 13, marginBottom: 20, fontFamily: 'var(--font-mono)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>New password</label>
                  <PasswordInput
                    required
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Confirm password</label>
                  <PasswordInput
                    required
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ marginTop: 4, width: '100%', padding: '11px', background: loading ? 'var(--bg3)' : 'var(--accent)', border: 'none', borderRadius: 7, color: loading ? 'var(--muted)' : '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', letterSpacing: '-0.01em' }}
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
          <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Loading…
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
