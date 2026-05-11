'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { StatusBadge } from '@/components/ui/Badge'
import { approval as approvalApi, isError } from '@/lib/api'
import type { ApprovalView } from '@/lib/api'

function ApproveConfirmContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token  = params.get('token') ?? ''

  const [view, setView]       = useState<ApprovalView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState<'approved' | 'rejected' | null>(null)
  const [acting, setActing]   = useState(false)

  useEffect(() => {
    if (!token) { setError('Missing approval token.'); setLoading(false); return }
    approvalApi.view(token)
      .then(r => {
        if (isError(r)) setError(r.error)
        else setView(r.data)
      })
      .catch(() => setError('Could not load the transaction.'))
      .finally(() => setLoading(false))
  }, [token])

  const act = async (kind: 'approved' | 'rejected') => {
    setActing(true)
    setError('')
    const r = kind === 'approved' ? await approvalApi.approve(token) : await approvalApi.reject(token)
    setActing(false)
    if (isError(r)) setError(r.error)
    else setDone(kind)
  }

  const tx = view?.transaction ?? null
  const approvalStatus = view?.approval.status ?? null
  const isPending = approvalStatus === 'PENDING' && tx?.status === 'PENDING_APPROVAL'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <Logo size="lg" href="/dashboard" />
      </div>

      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading…</div>
          )}

          {!loading && error && !view && (
            <>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Invalid approval link</div>
              <div style={{ padding: '12px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, fontSize: 13, color: 'var(--error)', marginBottom: 20 }}>
                {error}
              </div>
              <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
                Back to dashboard
              </button>
            </>
          )}

          {!loading && tx && !done && (
            <>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                {isPending ? 'Approve payment?' : 'Pending payment'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                {tx.type === 'marketplace'
                  ? 'A marketplace call exceeded your approval threshold and requires your action.'
                  : 'This payment exceeded your approval threshold and requires your action.'}
              </div>

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  tx.type === 'marketplace' && tx.service_id ? ['Service', tx.service_id] : ['Recipient', tx.recipient],
                  ['Amount', `${tx.cost_paid ?? tx.amount} ${tx.currency}`],
                  ['Memo', tx.memo ?? '—'],
                  ['Status', null],
                  ['Requested', new Date(tx.created_at).toLocaleString()],
                ] as const).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, gap: 12 }}>
                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{k}</span>
                    {k === 'Status' ? (
                      <StatusBadge status={tx.status} />
                    ) : (
                      <span style={{ color: 'var(--text2)', fontFamily: (['Recipient', 'Service'] as string[]).includes(k) ? 'var(--font-mono)' : 'inherit', fontSize: k === 'Recipient' ? 11 : 13, textAlign: 'right', overflowWrap: 'anywhere' }}>
                        {v as string}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {!isPending && (
                <div style={{ padding: '10px 14px', background: 'var(--warning-low)', border: '1px solid rgba(197,162,83,0.3)', borderRadius: 7, fontSize: 13, color: 'var(--warning)', marginBottom: 16 }}>
                  {approvalStatus === 'EXPIRED'
                    ? 'This approval link has expired (links are valid for 24 hours). The transaction was not executed.'
                    : `This transaction is no longer pending — it has already been ${(approvalStatus ?? tx.status).toLowerCase()}.`}
                </div>
              )}

              {isPending && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => void act('rejected')}
                    disabled={acting}
                    style={{ flex: 1, padding: '10px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, color: 'var(--error)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, cursor: acting ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => void act('approved')}
                    disabled={acting}
                    style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0B0A', fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, cursor: acting ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                  >
                    {acting ? 'Processing…' : `Approve ${tx.cost_paid ?? tx.amount} ${tx.currency}`}
                  </button>
                </div>
              )}

              {error && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>{error}</div>
              )}
            </>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{done === 'approved' ? '✓' : '✗'}</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 600, color: done === 'approved' ? 'var(--success)' : 'var(--error)', marginBottom: 8 }}>
                Payment {done === 'approved' ? 'approved' : 'rejected'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
                {done === 'approved'
                  ? 'The payment has been submitted to Stellar and will confirm shortly.'
                  : 'The payment has been rejected. No funds were moved.'}
              </div>
              <button onClick={() => router.push('/dashboard/transactions')} style={{ padding: '9px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                View transactions →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ApproveConfirmPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Loading…
      </div>
    }>
      <ApproveConfirmContent />
    </Suspense>
  )
}
