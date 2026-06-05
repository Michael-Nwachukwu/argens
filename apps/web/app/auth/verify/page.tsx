'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'
const ONBOARDING_API_KEY = 'argens_onboarding_api_key'

function VerifyContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const requestedRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found.')
      return
    }

    // Guard against React strict-mode double-invocation in development.
    // The verification token is single-use — a second call would consume nothing
    // and report "invalid token" even when the first call succeeded.
    if (requestedRef.current) return
    requestedRef.current = true

    fetch(`${API}/auth/verify/${token}`)
      .then(r => r.json())
      .then(body => {
        if (body.data) {
          if (body.data.api_key) {
            try { sessionStorage.setItem(ONBOARDING_API_KEY, body.data.api_key) } catch { /* ignore */ }
          }
          setStatus('success')
          setMessage(body.data.message ?? 'Email verified.')
          setTimeout(() => router.push('/login'), 2500)
        } else {
          setStatus('error')
          setMessage(body.error ?? 'Verification failed.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Could not reach the server. Make sure the API is running.')
      })
  }, [token, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>

        {status === 'loading' && (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Verifying…</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>
              Email verified
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>{message}</div>
            <div style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>Redirecting to login…</div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✗</div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600, color: 'var(--error)', marginBottom: 8 }}>
              Verification failed
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, fontSize: 13, color: 'var(--error)', marginBottom: 20 }}>
              {message}
            </div>
            <button
              onClick={() => router.push('/login')}
              style={{ padding: '9px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              Back to login
            </button>
          </>
        )}

      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Loading…
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
