'use client'

import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { FundingHelpCard } from './FundingHelpCard'

/** Deposit instructions for the user's Stellar wallet (dashboard overview + wallet page). */
export function AddFundsModal({ address, onClose }: { address: string; onClose: () => void }) {
  const { copied, copy: copyText } = useCopyToClipboard()
  const copy = () => copyText(address)

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
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>Send USDC on Stellar mainnet to this address.</div>

        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Wallet address</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', wordBreak: 'break-all', lineHeight: '1.7' }}>
            {address || 'Wallet not initialised'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={copy}
            style={{
              padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)',
              borderRadius: 6, color: copied ? 'var(--success)' : 'var(--muted)',
              fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
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

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px', background: 'transparent',
            border: '1px solid var(--border2)', borderRadius: 7,
            color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
