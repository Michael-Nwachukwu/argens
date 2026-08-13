'use client'

import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from 'react'
import { TopBar } from '@/components/dashboard/TopBar'
import { Icon, Icons } from '@/components/dashboard/Icon'
import { StatusBadge } from '@/components/ui/Badge'
import { transactions as txApi, isError } from '@/lib/api'
import type { Transaction, TransactionDetail, TxStatus } from '@/lib/api'
import {
  asMppRouter,
  buildDiagnosticBlob,
  formatUpstreamBody,
  paymentSettledLabel,
  progressStepLabel,
  type MppRouterMeta,
} from '@/lib/mpp-diagnostics'

const STATUS_OPTS: Array<'All' | TxStatus> = ['All', 'SUCCESS', 'BLOCKED', 'PENDING_APPROVAL', 'FAILED', 'REJECTED']

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--faint)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 4,
}

const valueStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text2)',
  fontFamily: 'var(--font-mono)',
  wordBreak: 'break-all',
  maxWidth: 300,
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{children}</div>
    </div>
  )
}

function UpstreamErrorBlock({
  tx,
  detail,
  loading,
  error,
}: {
  tx: Transaction
  detail: TransactionDetail | undefined
  loading: boolean
  error: string | null
}) {
  const [copied, setCopied] = useState(false)

  if (tx.status !== 'FAILED') return null

  // Only marketplace failures carry mpp_router — skip loading chrome for CCTP/direct.
  const maybeMarketplace = tx.type === 'marketplace' || Boolean(tx.serviceId)

  if (maybeMarketplace && loading && !detail) {
    return (
      <div style={{ width: '100%', marginTop: 4 }}>
        <div style={labelStyle}>Upstream error</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          Loading diagnostics…
        </div>
      </div>
    )
  }

  if (maybeMarketplace && error && !detail) {
    return (
      <div style={{ width: '100%', marginTop: 4 }}>
        <div style={labelStyle}>Upstream error</div>
        <div style={{ fontSize: 12, color: 'var(--error, #A04848)', fontFamily: 'var(--font-mono)' }}>
          Could not load diagnostics: {error}
        </div>
      </div>
    )
  }

  // List payload has no metadata — wait for detail before rendering (or deciding absence).
  if (!detail) return null

  const mpp = asMppRouter(detail.metadata)
  if (!mpp) return null

  const body = formatUpstreamBody(mpp.upstream_body)
  const settled = paymentSettledLabel(mpp.receipt)
  const serviceId = detail?.service_id ?? tx.serviceId ?? null
  const createdAt = detail?.created_at ?? tx.createdAt

  const onCopy = async () => {
    const blob = buildDiagnosticBlob({
      transaction_id: tx.id,
      service_id: serviceId,
      created_at: createdAt,
      mpp_router: mpp,
    })
    try {
      await navigator.clipboard.writeText(blob)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers / denied clipboard
      window.prompt('Copy diagnostic JSON:', blob)
    }
  }

  return (
    <div
      style={{
        width: '100%',
        marginTop: 8,
        paddingTop: 14,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ ...labelStyle, marginBottom: 0 }}>Upstream error</div>
        <button
          type="button"
          onClick={onCopy}
          style={{
            padding: '5px 10px',
            background: 'transparent',
            border: '1px solid var(--border2)',
            borderRadius: 5,
            color: copied ? 'var(--accent)' : 'var(--muted)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {copied ? 'Copied' : 'Copy diagnostic JSON'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <Field label="Upstream status">
          {mpp.upstream_status != null ? String(mpp.upstream_status) : '—'}
        </Field>
        <Field label="Payment settled">
          <span style={{ color: settled.charged ? 'var(--warning, #B8832A)' : 'var(--accent)' }}>
            {settled.label}
          </span>
          {settled.reference && (
            <div style={{ marginTop: 4 }}>
              <a
                href={`https://stellar.expert/explorer/public/tx/${settled.reference}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}
              >
                stellar.expert ↗
              </a>
            </div>
          )}
        </Field>
      </div>

      {mpp.progress.length > 0 && <ProgressStepper progress={mpp.progress} />}

      <div>
        <div style={labelStyle}>
          Upstream body{body.kind === 'html' ? ' (HTML)' : body.kind === 'json' ? ' (JSON)' : ''}
        </div>
        <pre
          style={{
            margin: 0,
            padding: '10px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text2)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 240,
            overflow: 'auto',
            lineHeight: 1.45,
          }}
        >
          {body.text}
        </pre>
      </div>
    </div>
  )
}

function ProgressStepper({ progress }: { progress: MppRouterMeta['progress'] }) {
  const steps = progress.map(progressStepLabel)
  return (
    <div>
      <div style={labelStyle}>Progress</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {steps.map((step, i) => (
          <span key={`${step}-${i}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
              }}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <span style={{ color: 'var(--faint)', padding: '0 6px' }}>→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

function TxRow({
  tx,
  expanded,
  onToggle,
  detail,
  detailLoading,
  detailError,
}: {
  tx: Transaction
  expanded: boolean
  onToggle: () => void
  detail: TransactionDetail | undefined
  detailLoading: boolean
  detailError: string | null
}) {
  const d = new Date(tx.createdAt)
  const timeStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const short = tx.recipientAddress.slice(0, 8) + '…' + tx.recipientAddress.slice(-6)
  const hashShort = tx.stellarTxHash ? tx.stellarTxHash.slice(0, 8) + '…' + tx.stellarTxHash.slice(-6) : '—'

  return (
    <>
      <div
        onClick={onToggle}
        style={{
          display: 'grid', gridTemplateColumns: '130px 1fr 150px 90px 120px',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          cursor: 'pointer', background: expanded ? 'var(--bg3)' : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)', alignSelf: 'center' }}>{timeStr}</div>
        <div style={{ alignSelf: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.memo ?? 'No memo'}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{short}</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: tx.status === 'SUCCESS' ? 'var(--text)' : 'var(--muted)', fontWeight: tx.status === 'SUCCESS' ? 500 : 400, alignSelf: 'center' }}>
          {tx.status === 'SUCCESS' ? '−' : ''}{tx.amount} USDC
        </div>
        <div style={{ alignSelf: 'center' }}><StatusBadge status={tx.status} /></div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)', alignSelf: 'center' }}>{hashShort}</div>
      </div>

      {expanded && (
        <div style={{ padding: '14px 16px 14px 146px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {[
            ['Transaction ID', tx.id],
            tx.blockedReason && ['Blocked reason', tx.blockedReason],
            tx.stellarTxHash && ['Stellar hash', tx.stellarTxHash],
            tx.memo && ['Memo', tx.memo],
          ].filter(Boolean).map(pair => {
            const [k, v] = pair as [string, string]
            return (
              <div key={k}>
                <div style={labelStyle}>{k}</div>
                <div style={valueStyle}>{v}</div>
              </div>
            )
          })}
          {tx.stellarTxHash && (
            <div>
              <div style={labelStyle}>Explorer</div>
              <a href={`https://stellar.expert/explorer/public/tx/${tx.stellarTxHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
                stellar.expert ↗
              </a>
            </div>
          )}
          <UpstreamErrorBlock
            tx={tx}
            detail={detail}
            loading={detailLoading}
            error={detailError}
          />
        </div>
      )}
    </>
  )
}

export default function TransactionsPage() {
  const [txs, setTxs]           = useState<Transaction[]>([])
  const [filter, setFilter]     = useState<'All' | TxStatus>('All')
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [details, setDetails] = useState<Record<string, TransactionDetail>>({})
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({})
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})
  const detailsRef = useRef(details)
  const detailLoadingRef = useRef(detailLoading)
  detailsRef.current = details
  detailLoadingRef.current = detailLoading

  const load = useCallback(async (p: number, status: string) => {
    setLoading(true)
    const r = await txApi.list({ page: p, limit: 20, status: status === 'All' ? undefined : status })
    if (!isError(r)) {
      setTxs(r.data)
      if (r.meta) setTotalPages(r.meta.pages)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(page, filter).catch(() => setLoading(false)) }, [load, page, filter])

  const fetchDetail = useCallback(async (id: string) => {
    if (detailsRef.current[id] || detailLoadingRef.current[id]) return
    setDetailLoading(prev => ({ ...prev, [id]: true }))
    setDetailErrors(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    const r = await txApi.get(id)
    if (isError(r)) {
      setDetailErrors(prev => ({ ...prev, [id]: r.error }))
    } else {
      setDetails(prev => ({ ...prev, [id]: r.data }))
    }
    setDetailLoading(prev => ({ ...prev, [id]: false }))
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = prev === id ? null : id
      if (next) void fetchDetail(next)
      return next
    })
  }, [fetchDetail])

  const filtered = txs.filter(tx =>
    (tx.memo ?? '').toLowerCase().includes(search.toLowerCase()) ||
    tx.recipientAddress.toLowerCase().includes(search.toLowerCase())
  )

  const exportCsv = () => {
    const rows = [
      ['id', 'date', 'recipient', 'memo', 'amount', 'status', 'hash'],
      ...filtered.map(t => [t.id, t.createdAt, t.recipientAddress, t.memo ?? '', t.amount, t.status, t.stellarTxHash ?? '']),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'transactions.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ overflowY: 'auto' }}>
      <TopBar
        title="Transactions"
        subtitle={`${filtered.length} shown`}
        actions={
          <button
            onClick={exportCsv}
            style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            Export CSV
          </button>
        }
      />
      <div style={{ padding: '24px 32px' }}>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', pointerEvents: 'none' }}>
              <Icon d={Icons.search} size={13} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by memo or address…"
              style={{
                width: 220, background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '7px 10px 7px 30px',
                fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text2)', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_OPTS.map(s => (
              <button
                key={s}
                onClick={() => { setFilter(s); setPage(1) }}
                style={{
                  padding: '5px 12px', borderRadius: 5, border: '1px solid',
                  borderColor: filter === s ? 'var(--accent)' : 'var(--border)',
                  background: filter === s ? 'var(--accent-low)' : 'transparent',
                  color: filter === s ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {s === 'PENDING_APPROVAL' ? 'PENDING' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 150px 90px 120px', padding: '9px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            {['Time', 'Memo / Recipient', 'Amount', 'Status', 'Tx Hash'].map(h => (
              <div key={h} style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '64px 32px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>No transactions found</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Try adjusting the status filter or search term.</div>
            </div>
          ) : (
            filtered.map(tx => (
              <TxRow
                key={tx.id}
                tx={tx}
                expanded={expanded === tx.id}
                onToggle={() => toggleExpand(tx.id)}
                detail={details[tx.id]}
                detailLoading={Boolean(detailLoading[tx.id])}
                detailError={detailErrors[tx.id] ?? null}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: page === 1 ? 'var(--faint)' : 'var(--muted)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            >
              ← Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: page === totalPages ? 'var(--faint)' : 'var(--muted)', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
