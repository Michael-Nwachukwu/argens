'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { wallet as walletApi, isError } from '@/lib/api'

const BACKUP_ACK_KEY = (userId: string) => `argens_key_acked_${userId}`

function PrivateKeyBackupModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [step, setStep] = useState<'prompt' | 'confirm' | 'done'>('prompt')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const markAcknowledged = () => {
    try { localStorage.setItem(BACKUP_ACK_KEY(userId), '1') } catch { /* ignore */ }
    onClose()
  }

  const downloadKey = async () => {
    if (!password) { setError('Enter your password to continue.'); return }
    setLoading(true)
    setError('')

    const res = await walletApi.exportKey(password)
    setLoading(false)

    if (isError(res)) {
      setError(res.error)
      return
    }

    const { secret_key, public_key, network } = res.data
    const content = [
      'ARGENS WALLET — PRIVATE KEY BACKUP',
      '====================================',
      '',
      'Keep this file secret. Anyone with the secret key can spend all funds.',
      'Store it offline in a safe location.',
      '',
      `Network:    ${network}`,
      `Public key: ${public_key}`,
      `Secret key: ${secret_key}`,
      '',
      `Exported: ${new Date().toISOString()}`,
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `argens-wallet-backup-${public_key.slice(0, 8)}.txt`
    a.click()
    URL.revokeObjectURL(url)

    setStep('done')
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {step === 'done' ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 12, textAlign: 'center' }}>✓</div>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600, margin: '0 0 8px', textAlign: 'center' }}>
              Key downloaded
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 24px', textAlign: 'center' }}>
              Store your backup file somewhere safe and offline. You can export again any time from the Wallet page.
            </p>
            <button
              onClick={markAcknowledged}
              style={{ width: '100%', padding: '11px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Go to dashboard
            </button>
          </>
        ) : step === 'confirm' ? (
          <>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>
              Confirm your password
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
              Enter your account password to decrypt and download your wallet key.
            </p>

            <div
              style={{ background: 'rgba(160,72,72,0.12)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: 'var(--error)', lineHeight: 1.6 }}
            >
              Anyone with this key controls your wallet funds. Never share it.
            </div>

            {error && (
              <div style={{ padding: '9px 12px', background: 'rgba(160,72,72,0.12)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Your account password"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') void downloadKey() }}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setStep('prompt'); setPassword(''); setError('') }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={() => void downloadKey()}
                disabled={loading || !password}
                style={{ flex: 2, padding: '10px', background: loading || !password ? 'var(--bg3)' : 'var(--accent)', border: 'none', borderRadius: 7, color: loading || !password ? 'var(--muted)' : '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, cursor: loading || !password ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Downloading…' : 'Download key'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(255,190,40,0.12)', border: '1px solid rgba(255,190,40,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                🔑
              </div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600, margin: 0 }}>
                Back up your wallet key
              </h2>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, margin: '0 0 16px' }}>
              Your Argens wallet was just created. Download your private key and store it somewhere safe — this is your only way to self-custody or recover your wallet outside of Argens.
            </p>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 24 }}>
              {[
                'Keep the file offline — never in email or cloud storage',
                'Anyone with this key can spend all wallet funds',
                'You can re-export any time from the Wallet page',
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text2)', marginBottom: i < 2 ? 10 : 0, lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }}>•</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setStep('confirm')}
                style={{ width: '100%', padding: '11px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Download private key
              </button>
              <button
                onClick={markAcknowledged}
                style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}
              >
                I'll do this later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showKeyBackup, setShowKeyBackup] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  // Show private key backup modal once per user (until acknowledged)
  useEffect(() => {
    if (!user) return
    try {
      const acked = localStorage.getItem(BACKUP_ACK_KEY(user.id))
      if (!acked) setShowKeyBackup(true)
    } catch { /* ignore */ }
  }, [user])

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
      {showKeyBackup && (
        <PrivateKeyBackupModal
          userId={user.id}
          onClose={() => setShowKeyBackup(false)}
        />
      )}
    </div>
  )
}
