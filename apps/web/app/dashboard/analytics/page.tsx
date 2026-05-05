'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/dashboard/TopBar'
import { spend as spendApi, transactions as txApi, isError } from '@/lib/api'
import type { SpendSummary, Transaction } from '@/lib/api'

type Period = 'daily' | 'weekly' | 'monthly'

function BarChart({ data }: { data: Array<{ date: string; amount: string }> }) {
  if (data.length === 0) return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No data</div>
  const max = Math.max(...data.map(d => parseFloat(d.amount)), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '0 8px' }}>
      {data.map((d, i) => {
        const pct = (parseFloat(d.amount) / max) * 100
        const label = d.date.length === 10 ? d.date.slice(5) : d.date
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div
              title={`${d.date}: $${parseFloat(d.amount).toFixed(2)}`}
              style={{
                width: '100%', background: 'var(--accent)', borderRadius: '2px 2px 0 0',
                height: `${Math.max(2, pct)}%`, transition: 'height 0.3s ease',
                opacity: 0.85,
              }}
            />
            <div style={{ fontSize: 9, color: 'var(--faint)', fontFamily: 'var(--font-mono)', textAlign: 'center', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)', fontWeight: 500 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [period, setPeriod]     = useState<Period>('monthly')
  const [summary, setSummary]   = useState<SpendSummary | null>(null)
  const [txs, setTxs]           = useState<Transaction[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [sRes, tRes] = await Promise.all([
        spendApi.summary(period),
        txApi.list({ limit: 100 }),
      ])
      if (!isError(sRes)) setSummary(sRes.data)
      if (!isError(tRes)) setTxs(tRes.data)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [period])

  const totalSpent   = summary ? parseFloat(summary.total_spent) : 0
  const txCount      = summary?.transaction_count ?? txs.length
  const blockedCount = summary?.blocked_count ?? txs.filter(t => t.status === 'BLOCKED').length
  const successCount = txs.filter(t => t.status === 'SUCCESS').length
  const failedCount  = txs.filter(t => t.status === 'FAILED').length
  const avgTx        = successCount > 0 ? totalSpent / successCount : 0

  // Memo breakdown
  const memoCounts: Record<string, number> = {}
  txs.filter(t => t.status === 'SUCCESS').forEach(t => {
    const key = t.memo ?? 'No memo'
    memoCounts[key] = (memoCounts[key] ?? 0) + 1
  })
  const topMemos = Object.entries(memoCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div style={{ overflowY: 'auto' }}>
      <TopBar title="Analytics" subtitle="Spend trends and policy insights." />
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px', borderRadius: 5, border: '1px solid',
                borderColor: period === p ? 'var(--accent)' : 'var(--border)',
                background: period === p ? 'var(--accent-low)' : 'transparent',
                color: period === p ? 'var(--accent)' : 'var(--muted)',
                fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.12s',
                textTransform: 'capitalize',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Spend chart */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Total spent ({period})</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                {loading ? '—' : `$${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </div>
          {loading ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading…</div>
          ) : (
            <BarChart data={(summary?.breakdown ?? []).slice(-20)} />
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 22px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Transaction summary</div>
            <StatRow label="Total transactions" value={String(txCount)} />
            <StatRow label="Successful" value={String(successCount)} />
            <StatRow label="Blocked by policy" value={String(blockedCount)} />
            <StatRow label="Failed" value={String(failedCount)} />
            <StatRow label="Average tx size" value={`$${avgTx.toFixed(2)}`} />
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 22px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Top memo categories</div>
            {topMemos.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>No successful transactions yet.</div>
            ) : (
              topMemos.map(([memo, count]) => (
                <div key={memo} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{memo}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', flexShrink: 0 }}>{count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Policy outcome breakdown */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Policy outcome breakdown</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Passed', count: successCount, color: 'var(--success)', bg: 'var(--success-low)' },
              { label: 'Blocked', count: blockedCount, color: 'var(--error)', bg: 'var(--error-low)' },
              { label: 'Failed', count: failedCount, color: 'var(--muted)', bg: 'var(--bg3)' },
            ].map(item => (
              <div key={item.label} style={{ flex: 1, padding: '16px', background: item.bg, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.count}</div>
                <div style={{ fontSize: 12, color: item.color, fontFamily: 'var(--font-mono)', opacity: 0.8 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
