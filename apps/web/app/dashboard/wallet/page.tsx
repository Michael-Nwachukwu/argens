'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/dashboard/TopBar'
import { wallet as walletApi, isError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { FundingHelpCard } from '@/components/dashboard/FundingHelpCard'
import { PasswordInput } from '@/components/ui/PasswordInput'
import type { WalletBalance } from '@/lib/api'

const BACKUP_ACK_KEY = (userId: string) => `argens_key_acked_${userId}`

function AddFundsModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(address).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Add funds to wallet</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>Send USDC on Stellar to this address.</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', wordBreak: 'break-all', lineHeight: '1.7', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '12px 14px', marginBottom: 16 }}>
          {address}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={copy} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: copied ? 'var(--success)' : 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}>
            {copied ? '✓ Copied' : 'Copy address'}
          </button>
        </div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          {['Send USDC from any Stellar wallet or exchange', 'Use the Stellar network — not Ethereum or Solana', 'Balance updates within ~5 seconds of confirmation'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text2)', marginBottom: i < 2 ? 8 : 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{i + 1}.</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>stellar mainnet · USDC only</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <FundingHelpCard />
        <button onClick={onClose} style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          Done
        </button>
      </div>
    </div>
  )
}

export default function WalletPage() {
  const { user } = useAuth()
  const [walletData, setWalletData] = useState<WalletBalance | null>(null)
  const [loading, setLoading]       = useState(true)
  const [walletNotReady, setWalletNotReady] = useState(false)
  const [retryLoading, setRetryLoading]     = useState(false)
  const [retryError, setRetryError]         = useState('')
  const [showFunds, setShowFunds]   = useState(false)
  const [showSend, setShowSend]         = useState(false)
  const [copied, setCopied]             = useState(false)
  const [keyStep, setKeyStep]           = useState<'idle' | 'warning' | 'password' | 'done'>('idle')
  const [keyPassword, setKeyPassword]   = useState('')
  const [keyError, setKeyError]         = useState('')
  const [keyLoading, setKeyLoading]     = useState(false)
  const [sendForm, setSendForm]         = useState({ recipient: '', amount: '', memo: '', pin: '' })
  const [sendStep, setSendStep]     = useState<'form' | 'pin' | 'sending' | 'result'>('form')
  const [sendError, setSendError]   = useState('')
  const [sendResult, setSendResult] = useState<{ status: string; message?: string; transaction_id?: string; stellar_tx_hash?: string } | null>(null)

  useEffect(() => {
    walletApi.balance()
      .then(r => {
        if (isError(r)) {
          if (r.code === 'WALLET_NOT_READY') setWalletNotReady(true)
        } else {
          setWalletData(r.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleBootstrapRetry = async () => {
    setRetryLoading(true)
    setRetryError('')
    const res = await walletApi.bootstrapRetry()
    setRetryLoading(false)
    if (isError(res)) {
      setRetryError(res.error)
    } else {
      setWalletNotReady(false)
      setLoading(true)
      walletApi.balance()
        .then(r => { if (!isError(r)) setWalletData(r.data) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }

  const handleSend = async () => {
    if (!sendForm.recipient || !sendForm.amount) {
      setSendError('Recipient and amount are required')
      return
    }
    if (!/^G[A-Z2-7]{55}$/.test(sendForm.recipient)) {
      setSendError('Invalid recipient address (must be Stellar address starting with G)')
      return
    }
    if (parseFloat(sendForm.amount) <= 0) {
      setSendError('Amount must be greater than 0')
      return
    }

    if (user?.transferPinSet && !sendForm.pin) {
      setSendStep('pin')
      setSendError('')
      return
    }

    setSendStep('sending')
    setSendError('')
    const res = await walletApi.send({
      recipient: sendForm.recipient,
      amount: sendForm.amount,
      memo: sendForm.memo || undefined,
      pin: user?.transferPinSet ? sendForm.pin : undefined,
    })
    setSendStep('result')
    if (isError(res)) {
      setSendError(res.error)
      setSendResult(null)
    } else {
      setSendError('')
      setSendResult(res.data)
    }
  }

  const downloadKey = async () => {
    if (!keyPassword) { setKeyError('Enter your password to continue.'); return }
    setKeyLoading(true)
    setKeyError('')
    const res = await walletApi.exportKey(keyPassword)
    setKeyLoading(false)
    if (isError(res)) { setKeyError(res.error); return }

    const { secret_key, public_key, network, fees_note } = res.data
    const content = [
      'ARGENS WALLET — PRIVATE KEY BACKUP',
      '====================================',
      '',
      'Keep this file secret. Anyone with the secret key can spend all funds.',
      '',
      ...(fees_note ? [fees_note, ''] : []),
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

    if (user) {
      try { localStorage.setItem(BACKUP_ACK_KEY(user.id), '1') } catch { /* ignore */ }
    }
    setKeyStep('done')
    setKeyPassword('')
  }

  const resetSend = () => {
    setShowSend(false)
    setSendForm({ recipient: '', amount: '', memo: '', pin: '' })
    setSendStep('form')
    setSendError('')
    setSendResult(null)
  }

  const address = walletData?.wallet_address ?? ''
  const balance = walletData?.balance ?? '0.0000000'
  const balanceNum = parseFloat(balance)

  const copy = () => {
    if (!address) return
    navigator.clipboard?.writeText(address).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const explorerUrl = address ? `https://stellar.expert/explorer/public/account/${address}` : '#'

  return (
    <div style={{ overflowY: 'auto' }}>
      <TopBar
        title="Wallet"
        subtitle="Agent-custodial · Stellar mainnet"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowSend(true)}
              style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              → Send
            </button>
            <button
              onClick={() => setShowFunds(true)}
              style={{ padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add funds
            </button>
          </div>
        }
      />
      {walletNotReady && (
        <div style={{ margin: '20px 32px 0', padding: '20px 24px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Wallet setup incomplete</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 16 }}>
            Your wallet was created but the on-chain setup didn't finish. This can happen when the platform wallet that sponsors account reserves is briefly low. Click below to retry — it usually takes a few seconds.
          </div>
          {retryError && (
            <div style={{ fontSize: 12, color: 'var(--error)', fontFamily: 'var(--font-mono)', marginBottom: 12, padding: '8px 12px', background: 'var(--error-low)', borderRadius: 6, border: '1px solid rgba(160,72,72,0.25)' }}>
              {retryError}
            </div>
          )}
          <button
            onClick={handleBootstrapRetry}
            disabled={retryLoading}
            style={{ padding: '9px 20px', background: retryLoading ? 'var(--bg3)' : 'var(--accent)', border: 'none', borderRadius: 7, color: retryLoading ? 'var(--muted)' : '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, cursor: retryLoading ? 'not-allowed' : 'pointer' }}
          >
            {retryLoading ? 'Activating wallet…' : 'Activate wallet'}
          </button>
        </div>
      )}
      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Balance cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>USDC Balance</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1 }}>
                {loading ? '—' : `$${balanceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{loading ? 'Loading…' : `${balance} USDC`}</div>
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 22px' }}>
              {/* Reserves are sponsored and every fee is paid by Argens, so 0 XLM is normal. */}
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Network fees</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1 }}>
                Paid by Argens
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                {loading ? 'Loading…' : `Reserves sponsored · ${walletData?.xlm_balance ?? '0.0000000'} XLM held`}
              </div>
            </div>
          </div>

          {/* Credits — only shown when user has been granted credits */}
          {!loading && parseFloat(walletData?.credits_balance ?? '0') > 0 && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--accent-mid)', borderRadius: 8, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-low)', border: '1px solid var(--accent-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 16, flexShrink: 0 }}>◈</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Argens credits</div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1 }}>
                  ${parseFloat(walletData!.credits_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                  Prepaid marketplace budget · non-withdrawable · used before USDC on marketplace calls
                </div>
              </div>
            </div>
          )}

          {/* Address */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Wallet address</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', wordBreak: 'break-all', lineHeight: '1.7', marginBottom: 14 }}>
              {loading ? 'Loading…' : (address || 'Wallet not initialised')}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={copy} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: copied ? 'var(--success)' : 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
                {copied ? '✓ Copied' : 'Copy address'}
              </button>
              <button onClick={() => setShowFunds(true)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer' }}>
                Show QR
              </button>
              {address && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                >
                  stellar.expert ↗
                </a>
              )}
            </div>
          </div>

          {/* Network details */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Network details</div>
            {([
              ['Network', 'Stellar mainnet'],
              ['Assets', 'USDC (Circle) — XLM reserves and fees covered by Argens'],
              ['Custody model', 'Agent-custodial'],
              ['Balance cached', walletData?.cached_at ? new Date(walletData.cached_at).toLocaleString() : '—'],
            ] as const).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Export key */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Export private key</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.6', margin: '0 0 14px' }}>
              Export your private key to self-custody or migrate your wallet. Encrypted at rest — only decrypted for this export with your password.
            </p>
            {keyStep === 'done' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 14px', background: 'rgba(54,179,126,0.10)', border: '1px solid rgba(54,179,126,0.25)', borderRadius: 6, fontSize: 13, color: 'var(--success)' }}>
                  Key downloaded — store the file somewhere safe and offline.
                </div>
                <button onClick={() => setKeyStep('idle')} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', width: 'fit-content' }}>
                  Export again
                </button>
              </div>
            ) : keyStep === 'password' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 14px', background: 'rgba(160,72,72,0.10)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, fontSize: 12, color: 'var(--error)' }}>
                  Anyone with this key controls your wallet. Never share it.
                </div>
                {keyError && (
                  <div style={{ padding: '9px 12px', background: 'rgba(160,72,72,0.10)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, fontSize: 12, color: 'var(--error)' }}>
                    {keyError}
                  </div>
                )}
                <PasswordInput
                  value={keyPassword}
                  onChange={value => { setKeyPassword(value); setKeyError('') }}
                  placeholder="Your account password"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') void downloadKey() }}
                  fontFamily="var(--font-body)"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setKeyStep('idle'); setKeyPassword(''); setKeyError('') }} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Cancel
                  </button>
                  <button onClick={() => void downloadKey()} disabled={keyLoading || !keyPassword} style={{ padding: '7px 14px', background: keyLoading || !keyPassword ? 'var(--bg3)' : 'var(--accent)', border: 'none', borderRadius: 6, color: keyLoading || !keyPassword ? 'var(--muted)' : '#0C0B0A', fontSize: 13, cursor: keyLoading || !keyPassword ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-head)', fontWeight: 600 }}>
                    {keyLoading ? 'Downloading…' : 'Download .txt'}
                  </button>
                </div>
              </div>
            ) : keyStep === 'warning' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 14px', background: 'rgba(160,72,72,0.10)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, fontSize: 13, color: 'var(--error)' }}>
                  Anyone with this key can spend all funds. Never share it.
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Argens pays this wallet's network fees and sponsors its reserves, so it may hold no XLM. To use the key in another wallet app, send it a small amount of XLM first.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setKeyStep('idle')} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Cancel
                  </button>
                  <button onClick={() => setKeyStep('password')} style={{ padding: '7px 14px', background: 'rgba(160,72,72,0.12)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                    I understand — continue
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setKeyStep('warning')} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Export private key…
              </button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'flex-start' }}>Receive funds</div>
            {/* QR placeholder (no external lib) */}
            <div style={{ width: 160, height: 160, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ fontSize: 28 }}>◈</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '0 12px' }}>
                {address ? (address.slice(0, 8) + '\n…\n' + address.slice(-8)) : 'No wallet'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: '1.6' }}>
              Send USDC to this wallet.<br />Stellar mainnet · USDC only.
            </div>
            <button
              onClick={() => setShowFunds(true)}
              style={{ width: '100%', padding: '9px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add funds
            </button>
          </div>
        </div>
      </div>

      {showFunds && <AddFundsModal address={address} onClose={() => setShowFunds(false)} />}

      {/* Send Modal */}
      {showSend && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={resetSend}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: 28, width: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            {sendStep === 'result' && sendResult ? (
              <>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                  {sendError ? 'Transfer failed' : 'Transfer initiated'}
                </div>
                {sendError ? (
                  <div style={{ padding: '12px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 8, color: 'var(--error)', fontSize: 13, marginBottom: 20, lineHeight: '1.6' }}>
                    {sendError}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.6', marginBottom: 20 }}>
                    {sendResult.status === 'pending_approval' ? 'Your transfer is pending developer approval. Check your email for confirmation.' : 'Your transfer has been submitted to the Stellar network.'}
                    {sendResult.stellar_tx_hash && (
                      <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', wordBreak: 'break-all' }}>
                        Tx: {sendResult.stellar_tx_hash}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={resetSend} style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>
                  Done
                </button>
              </>
            ) : sendStep === 'sending' ? (
              <>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>Sending…</div>
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>Please wait while we process your transfer.</div>
              </>
            ) : sendStep === 'pin' ? (
              <>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Enter transfer PIN</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Your 4-digit PIN is required to confirm this transfer.</div>
                {sendError && (
                  <div style={{ padding: '10px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
                    {sendError}
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <PasswordInput
                    maxLength={4}
                    value={sendForm.pin}
                    onChange={value => { setSendForm({ ...sendForm, pin: value.replace(/\D/g, '') }); setSendError('') }}
                    placeholder="••••"
                    autoFocus
                    inputMode="numeric"
                    fontSize={16}
                    textAlign="center"
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setSendStep('form')} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>
                    Back
                  </button>
                  <button onClick={handleSend} disabled={sendForm.pin.length !== 4} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0B0A', fontFamily: 'var(--font-body)', fontSize: 13, cursor: sendForm.pin.length === 4 ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: sendForm.pin.length === 4 ? 1 : 0.6 }}>
                    Confirm
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Send USDC</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Manual transfer from your dashboard.</div>
                {sendError && (
                  <div style={{ padding: '10px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
                    {sendError}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Recipient address</label>
                    <input
                      type="text"
                      value={sendForm.recipient}
                      onChange={e => { setSendForm({ ...sendForm, recipient: e.target.value }); setSendError('') }}
                      placeholder="G..."
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Amount (USDC)</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={sendForm.amount}
                      onChange={e => { setSendForm({ ...sendForm, amount: e.target.value }); setSendError('') }}
                      placeholder="0.0000000"
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Memo (optional)</label>
                    <input
                      type="text"
                      value={sendForm.memo}
                      onChange={e => { setSendForm({ ...sendForm, memo: e.target.value }); setSendError('') }}
                      placeholder="Invoice #123…"
                      maxLength={28}
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                {sendForm.amount && (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>You send:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 500 }}>{parseFloat(sendForm.amount).toFixed(7)} USDC</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>No Argens fee — direct transfer</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={resetSend} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSend} disabled={!sendForm.recipient || !sendForm.amount} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0B0A', fontFamily: 'var(--font-body)', fontSize: 13, cursor: sendForm.recipient && sendForm.amount ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: sendForm.recipient && sendForm.amount ? 1 : 0.6 }}>
                    {user?.transferPinSet ? 'Next' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
