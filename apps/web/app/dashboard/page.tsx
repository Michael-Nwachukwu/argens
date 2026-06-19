'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/dashboard/TopBar'
import { Icon, Icons } from '@/components/dashboard/Icon'
import { StatusBadge } from '@/components/ui/Badge'
import { FundingHelpCard } from '@/components/dashboard/FundingHelpCard'
import { transactions as txApi, wallet as walletApi, policies as policyApi, isError } from '@/lib/api'
import type { Transaction, WalletBalance, Policy } from '@/lib/api'

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subColor, side }: {
  label: string; value: string; sub?: string; subColor?: string; side?: { label: string; value: string; sub?: string }
}) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: 'var(--muted)', marginBottom: 8,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>{label}</div>
          <div style={{
            fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1,
          }}>{value}</div>
          {sub && (
            <div style={{ fontSize: 12, color: subColor ?? 'var(--muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              {sub}
            </div>
          )}
        </div>
        {side && (
          <div style={{ minWidth: 82, textAlign: 'right', paddingTop: 1 }}>
            <div style={{ fontSize: 10, color: '#6EA8FF', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Credits</div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 700, color: '#8DBBFF', lineHeight: 1 }}>
              {side.value}
            </div>
            <div style={{ fontSize: 10, color: '#6EA8FF', fontFamily: 'var(--font-mono)', marginTop: 5 }}>
              {side.sub ?? side.label}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Recent TX Row ──────────────────────────────────────────────────────────────
function RecentTxRow({ tx }: { tx: Transaction }) {
  const shortAddr = tx.recipientAddress.slice(0, 6) + '…' + tx.recipientAddress.slice(-4)
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: 'var(--text2)', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{tx.memo ?? 'No memo'}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {shortAddr}
        </div>
      </div>
      <StatusBadge status={tx.status} />
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        color: tx.status === 'SUCCESS' ? 'var(--text)' : 'var(--muted)',
        fontWeight: 500, minWidth: 80, textAlign: 'right',
      }}>
        {tx.status === 'SUCCESS' ? `−${tx.amount}` : tx.amount} USDC
      </div>
    </div>
  )
}

// ─── Add Funds Modal ────────────────────────────────────────────────────────────
function AddFundsModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(address).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const short = address ? (address.slice(0, 10) + '…' + address.slice(-6)) : '—'

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

// ─── Approve Modal ──────────────────────────────────────────────────────────────
function ApproveModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const router = useRouter()
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 28, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Review pending payment</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>This payment exceeded your approval threshold and requires your review.</div>

        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, border: '1px solid var(--border)', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            ['Recipient', tx.recipientAddress],
            ['Amount', `${tx.amount} USDC`],
            ['Memo', tx.memo ?? '—'],
          ] as const).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>{k}</span>
              <span style={{ color: 'var(--text2)', fontFamily: k === 'Recipient' ? 'var(--font-mono)' : 'inherit', fontSize: k === 'Recipient' ? 11 : 13 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            onClick={() => { if (tx.approvalToken) router.push(`/approve/confirm?token=${tx.approvalToken}`) }}
            disabled={!tx.approvalToken}
            style={{ flex: 1, padding: '9px', background: tx.approvalToken ? 'var(--accent)' : 'var(--bg3)', border: 'none', borderRadius: 7, color: tx.approvalToken ? '#0C0B0A' : 'var(--muted)', fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, cursor: tx.approvalToken ? 'pointer' : 'not-allowed' }}
          >
            Review →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Overview Page ──────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const [walletData, setWalletData]       = useState<WalletBalance | null>(null)
  const [policyData, setPolicyData]       = useState<Policy | null>(null)
  const [recentTxs, setRecentTxs]         = useState<Transaction[]>([])
  const [pendingTxs, setPendingTxs]       = useState<Transaction[]>([])
  const [todaySpend, setTodaySpend]       = useState('0.0000000')
  const [addFundsOpen, setAddFundsOpen]   = useState(false)
  const [approveModal, setApproveModal]   = useState<Transaction | null>(null)
  const [dismissingId, setDismissingId]   = useState<string | null>(null)
  const [loading, setLoading]             = useState(true)

  const handleDismiss = async (id: string) => {
    setDismissingId(id)
    const res = await txApi.dismiss(id)
    setDismissingId(null)
    if (!isError(res)) {
      setPendingTxs(cur => cur.filter(t => t.id !== id))
    }
  }

  useEffect(() => {
    async function load() {
      const [wRes, pRes, txRes, pendRes] = await Promise.all([
        walletApi.balance(),
        policyApi.get(),
        txApi.list({ limit: 5 }),
        txApi.list({ status: 'PENDING_APPROVAL', limit: 10 }),
      ])
      if (!isError(wRes)) setWalletData(wRes.data)
      if (!isError(pRes)) setPolicyData(pRes.data)
      if (!isError(txRes)) {
        setRecentTxs(txRes.data)
        // Sum today's spend from successful txs
        const todayStr = new Date().toISOString().slice(0, 10)
        const sum = txRes.data
          .filter(t => t.status === 'SUCCESS' && t.createdAt.startsWith(todayStr))
          .reduce((acc, t) => acc + parseFloat(t.amount), 0)
        setTodaySpend(sum.toFixed(7))
      }
      if (!isError(pendRes)) setPendingTxs(pendRes.data)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [])

  const balance = walletData?.balance ?? '0.0000000'
  const balanceNum = parseFloat(balance)
  const creditsNum = parseFloat(walletData?.credits_balance ?? '0')
  const allowance = policyData?.allowance_limit ? parseFloat(policyData.allowance_limit) : null
  const totalSpent = policyData?.total_spent ? parseFloat(policyData.total_spent) : 0
  const remaining = allowance !== null ? allowance - totalSpent : null
  const pctUsed = allowance !== null ? Math.min(100, Math.round((totalSpent / allowance) * 100)) : null
  const blockedCount = recentTxs.filter(t => t.status === 'BLOCKED').length

  return (
    <div style={{ overflowY: 'auto' }}>
      <TopBar
        title="Overview"
        subtitle={today}
        actions={
          <button
            onClick={() => setAddFundsOpen(true)}
            style={{
              padding: '7px 14px', background: 'var(--accent)', border: 'none',
              borderRadius: 6, color: '#0C0B0A', fontFamily: 'var(--font-head)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
            }}
          >
            + Add funds
          </button>
        }
      />

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Wallet address strip */}
        <WalletStrip address={walletData?.wallet_address ?? ''} onAddFunds={() => setAddFundsOpen(true)} />

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <StatCard
            label="Wallet Balance"
            value={`$${balanceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`${balance} USDC`}
            side={creditsNum > 0 ? {
              label: 'Argens credits',
              value: `$${creditsNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              sub: 'marketplace',
            } : undefined}
          />
          <StatCard
            label="Today's Spend"
            value={`$${parseFloat(todaySpend).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`${recentTxs.filter(t => t.status === 'SUCCESS').length} transactions`}
          />
          <StatCard
            label="Monthly Remaining"
            value={remaining !== null ? `$${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Unlimited'}
            sub={allowance !== null ? `of $${allowance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cap` : 'No cap set'}
          />
          <StatCard
            label="Blocked"
            value={String(blockedCount)}
            sub="this period"
            subColor={blockedCount > 0 ? 'var(--error)' : undefined}
          />
        </div>

        {/* Pending approval alerts */}
        {pendingTxs.map(tx => (
          <div key={tx.id} style={{
            background: 'rgba(107,127,175,0.08)', border: '1px solid rgba(107,127,175,0.25)',
            borderRadius: 8, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <StatusBadge status="PENDING_APPROVAL" />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, color: 'var(--text2)' }}>
                Payment of <strong style={{ color: 'var(--text)' }}>{tx.amount} USDC</strong>
                {tx.memo ? ` — ${tx.memo}` : ''} requires your approval
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
                {new Date(tx.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={() => setApproveModal(tx)}
              style={{
                padding: '5px 12px', background: 'var(--success-low)',
                border: '1px solid rgba(77,155,106,0.3)', borderRadius: 5,
                color: 'var(--success)', fontSize: 12, fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Review
            </button>
            <button
              onClick={() => void handleDismiss(tx.id)}
              disabled={dismissingId === tx.id}
              title="Dismiss — rejects this payment, no funds are sent"
              aria-label="Dismiss pending payment"
              style={{
                padding: '5px 10px', background: 'transparent',
                border: '1px solid var(--border2)', borderRadius: 5,
                color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)',
                cursor: dismissingId === tx.id ? 'wait' : 'pointer',
                opacity: dismissingId === tx.id ? 0.5 : 1,
              }}
            >
              {dismissingId === tx.id ? '…' : 'Dismiss'}
            </button>
          </div>
        ))}

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          {/* Recent transactions */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600 }}>Recent transactions</div>
              <button
                onClick={() => router.push('/dashboard/transactions')}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                View all →
              </button>
            </div>
            {loading ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading…</div>
            ) : recentTxs.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No transactions yet.</div>
            ) : (
              recentTxs.map(tx => <RecentTxRow key={tx.id} tx={tx} />)
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Monthly cap usage */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Monthly cap usage</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--text2)' }}>${totalSpent.toFixed(2)} spent</span>
                <span style={{ color: 'var(--muted)' }}>{allowance !== null ? `$${allowance.toFixed(0)} cap` : 'No cap'}</span>
              </div>
              <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pctUsed ?? 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                {pctUsed !== null ? `${pctUsed}% of allowance used` : 'No allowance set'}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Quick actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Add wallet funds', onClick: () => setAddFundsOpen(true) },
                  { label: 'Edit policies', onClick: () => router.push('/dashboard/policies') },
                  { label: 'View API keys', onClick: () => router.push('/dashboard/api-keys') },
                ].map((a, i) => (
                  <button
                    key={i}
                    onClick={a.onClick}
                    style={{
                      width: '100%', padding: '8px 12px', background: 'var(--bg3)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'var(--font-body)',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    {a.label} →
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {addFundsOpen && <AddFundsModal address={walletData?.wallet_address ?? ''} onClose={() => setAddFundsOpen(false)} />}
      {approveModal && <ApproveModal tx={approveModal} onClose={() => setApproveModal(null)} />}
    </div>
  )
}

function WalletStrip({ address, onAddFunds }: { address: string; onAddFunds: () => void }) {
  const [copied, setCopied] = useState(false)
  const short = address ? (address.slice(0, 8) + '…' + address.slice(-6)) : '—'
  const copy = () => {
    if (!address) return
    navigator.clipboard?.writeText(address).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
      padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Wallet address</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)' }}>{short}</div>
      </div>
      <button onClick={copy} style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border2)', background: 'transparent', color: copied ? 'var(--success)' : 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0 }}>
        {copied ? '✓' : 'copy'}
      </button>
      <button onClick={onAddFunds} style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
        + Add funds
      </button>
    </div>
  )
}
