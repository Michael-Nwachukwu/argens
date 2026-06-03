'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { auth, isError } from '@/lib/api'

type Stage = 'form' | 'verify' | 'resend'

export default function SignupPage() {
  const searchParams = useSearchParams()

  const [stage, setStage] = useState<Stage>('form')
  const [accessCode, setAccessCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  // Prefill access code from query string (?code=argns_beta_xxx) — invite links pass it here.
  useEffect(() => {
    const code = searchParams?.get('code')
    if (code) setAccessCode(code)
  }, [searchParams])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setErrorCode('')
    if (!accessCode.trim()) { setError('An access code is required during beta'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const res = await auth.signup(email, password, accessCode.trim())
    setLoading(false)
    if (isError(res)) {
      setError(res.error)
      setErrorCode(res.code ?? '')
    } else {
      setStage('verify')
    }
  }

  const isAccessCodeError = errorCode.startsWith('ACCESS_CODE_')

  const handleResend = async () => {
    setResendLoading(true)
    await auth.resendVerification(email)
    setResendLoading(false)
    setResendDone(true)
    setTimeout(() => setResendDone(false), 3000)
  }

  if (stage === 'verify') {
    return (
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', marginBottom: 32 }}>
          <Logo size="lg" />
        </div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '32px 28px',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--accent-low)', border: '1px solid var(--accent-mid)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 22,
          }}>◈</div>
          <h2 style={{
            fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600,
            letterSpacing: '-0.015em', color: 'var(--text)', marginBottom: 8,
          }}>Check your email</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.7', marginBottom: 24 }}>
            We sent a verification link to{' '}
            <span style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{email}</span>.
            Click the link to activate your wallet.
          </p>
          <button
            onClick={handleResend}
            disabled={resendLoading}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border2)',
              borderRadius: 6,
              color: resendDone ? 'var(--success)' : 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              cursor: resendLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {resendDone ? '✓ Email sent' : resendLoading ? 'Sending…' : 'Resend email'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
          Already verified?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Sign in →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'inline-flex' }}>
          <Logo size="lg" />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
          Create your agent payment account
        </p>
      </div>

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
            marginBottom: 12,
            fontFamily: 'var(--font-mono)',
          }}>
            {error}
            {isAccessCodeError && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <a href="https://tally.so/r/xX9AxG" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                  Join the waitlist instead →
                </a>
              </div>
            )}
          </div>
        )}

        <div style={{ background: 'var(--accent-low)', border: '1px solid var(--accent-mid)', borderRadius: 7, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          Argens is in private beta. An access code is required to sign up.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {([
            { label: 'Access code', type: 'text', value: accessCode, set: setAccessCode, placeholder: 'argns_beta_xxxxxxxx', ac: 'off', password: false },
            { label: 'Email', type: 'email', value: email, set: setEmail, placeholder: 'you@example.com', ac: 'email', password: false },
            { label: 'Password', type: 'password', value: password, set: setPassword, placeholder: '••••••••', ac: 'new-password', password: true },
            { label: 'Confirm password', type: 'password', value: confirm, set: setConfirm, placeholder: '••••••••', ac: 'new-password', password: true },
          ] as const).map(f => (
            <div key={f.label}>
              <label style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>{f.label}</label>
              {f.password ? (
                <PasswordInput
                  required
                  value={f.value}
                  onChange={f.set}
                  placeholder={f.placeholder}
                  autoComplete={f.ac}
                />
              ) : (
                <input
                  type={f.type}
                  required
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  autoComplete={f.ac}
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
              )}
            </div>
          ))}

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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Sign in →
        </Link>
      </p>
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 10 }}>
        No access code?{' '}
        <a href="https://tally.so/r/xX9AxG" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
          Join the waitlist →
        </a>
      </p>
    </div>
  )
}
