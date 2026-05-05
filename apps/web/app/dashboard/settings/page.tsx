'use client'

import { useState } from 'react'
import { TopBar } from '@/components/dashboard/TopBar'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { pin as pinApi, isError } from '@/lib/api'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15 }}>{title}</div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth()
  const router = useRouter()
  const [showSetPin, setShowSetPin] = useState(false)
  const [showRemovePin, setShowRemovePin] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinForm, setPinForm] = useState({ pin: '', password: '' })
  const [removeForm, setRemoveForm] = useState({ password: '' })

  const handleLogout = () => { logout(); router.push('/login') }

  const handleSetPin = async () => {
    if (pinForm.pin.length !== 4 || !/^\d{4}$/.test(pinForm.pin)) {
      setPinError('PIN must be exactly 4 digits')
      return
    }
    if (!pinForm.password) {
      setPinError('Password is required')
      return
    }
    setPinLoading(true)
    setPinError('')
    const res = await pinApi.set({ pin: pinForm.pin, password: pinForm.password })
    setPinLoading(false)
    if (isError(res)) {
      setPinError(res.error)
    } else {
      setShowSetPin(false)
      setPinForm({ pin: '', password: '' })
      await refreshUser()
    }
  }

  const handleRemovePin = async () => {
    if (!removeForm.password) {
      setPinError('Password is required')
      return
    }
    setPinLoading(true)
    setPinError('')
    const res = await pinApi.remove({ password: removeForm.password })
    setPinLoading(false)
    if (isError(res)) {
      setPinError(res.error)
    } else {
      setShowRemovePin(false)
      setRemoveForm({ password: '' })
      await refreshUser()
    }
  }

  return (
    <div style={{ overflowY: 'auto' }}>
      <TopBar title="Settings" subtitle="Account and notification preferences." />
      <div style={{ padding: '24px 32px', maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Account */}
        <Section title="Account">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Email</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                {user?.email ?? '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: user?.emailVerified ? 'var(--success)' : 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
              {user?.emailVerified ? '● Email verified' : '○ Email not verified'}
            </div>
          </div>
        </Section>

        {/* Password */}
        <Section title="Change password">
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.6' }}>
            Password changes are handled via email. Contact support at <a href="mailto:support@argens.io" style={{ color: 'var(--accent)', textDecoration: 'none' }}>support@argens.io</a> to reset your password.
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.6', marginBottom: 8 }}>
            Email notifications are sent to your account email. You will be notified when:
          </div>
          {[
            'A transaction is blocked by policy',
            'A payment requires your approval',
            'Your wallet receives funds',
            'Your balance is running low',
            'An API key is regenerated',
            'Policies are changed',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text2)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--success)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>●</span>
              {item}
            </div>
          ))}
        </Section>

        {/* Transfer PIN */}
        <Section title="Transfer PIN">
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.6', marginBottom: 12 }}>
            Protect manual transfers from the dashboard with a 4-digit PIN. Even if your session is compromised, this PIN guards against unauthorized payments.
          </div>
          {user?.transferPinSet ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                ● Transfer PIN is active
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowSetPin(true); setPinError('') }}
                  style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                >
                  Change PIN
                </button>
                <button
                  onClick={() => { setShowRemovePin(true); setPinError('') }}
                  style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                >
                  Remove PIN
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                ○ No transfer PIN set
              </div>
              <button
                onClick={() => { setShowSetPin(true); setPinError('') }}
                style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0C0B0A', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, width: 'fit-content' }}
              >
                Set transfer PIN
              </button>
            </div>
          )}
        </Section>

        {/* Set PIN Modal */}
        {showSetPin && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSetPin(false)}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                {user?.transferPinSet ? 'Change transfer PIN' : 'Set transfer PIN'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: '1.6' }}>
                Choose a 4-digit PIN to protect manual transfers from your dashboard.
              </div>
              {pinError && (
                <div style={{ padding: '10px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 12, marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
                  {pinError}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>4-Digit PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinForm.pin}
                    onChange={e => setPinForm({ ...pinForm, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="••••"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Current Password</label>
                  <input
                    type="password"
                    value={pinForm.password}
                    onChange={e => setPinForm({ ...pinForm, password: e.target.value })}
                    placeholder="••••••••"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowSetPin(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSetPin} disabled={pinLoading} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0B0A', fontFamily: 'var(--font-body)', fontSize: 13, cursor: pinLoading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: pinLoading ? 0.6 : 1 }}>
                  {pinLoading ? 'Setting…' : 'Set PIN'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove PIN Modal */}
        {showRemovePin && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowRemovePin(false)}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                Remove transfer PIN
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: '1.6' }}>
                You will no longer need to enter a PIN for manual dashboard transfers. Your session timeout (5 minutes) remains active.
              </div>
              {pinError && (
                <div style={{ padding: '10px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 12, marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
                  {pinError}
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Current Password</label>
                <input
                  type="password"
                  value={removeForm.password}
                  onChange={e => setRemoveForm({ password: e.target.value })}
                  placeholder="••••••••"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowRemovePin(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleRemovePin} disabled={pinLoading} style={{ flex: 1, padding: '10px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, color: 'var(--error)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: pinLoading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: pinLoading ? 0.6 : 1 }}>
                  {pinLoading ? 'Removing…' : 'Remove PIN'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Danger zone */}
        <Section title="Danger zone">
          <div style={{ padding: '14px 16px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', lineHeight: '1.6' }}>
            Account deletion removes all wallets, API keys, policies, and transaction history permanently. This cannot be undone.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleLogout}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              Sign out
            </button>
            <button
              onClick={() => alert('Contact support@argens.io to delete your account.')}
              style={{ padding: '8px 16px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              Delete account…
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
