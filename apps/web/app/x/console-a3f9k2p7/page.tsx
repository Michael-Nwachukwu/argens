'use client'

// Argens Ops Console — admin observability + actions.
//
// URL is intentionally obscure (no /admin, no /dashboard/admin). Authorization
// is the ADMIN_SECRET pasted on first visit and stored in sessionStorage.
// sessionStorage clears when the tab closes; refresh-survival is acceptable.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Logo } from '@/components/ui/Logo'
import {
  asMppRouter,
  formatUpstreamBody,
  paymentSettledLabel,
  upstreamSignature,
} from '@/lib/mpp-diagnostics'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '')
const SECRET_KEY = 'argens_admin_secret'

// ─── Design tokens (matches the rest of the app) ─────────────────────────────
const t = {
  bg:         '#0C0B0A',
  bg2:        '#131210',
  bg3:        '#1C1916',
  border:     '#252220',
  border2:    '#34302B',
  text:       '#EDE9E3',
  text2:      '#B0A99F',
  muted:      '#706B65',
  faint:      '#403C38',
  accent:     '#C5A253',
  accentLow:  'rgba(197,162,83,0.10)',
  accentMid:  'rgba(197,162,83,0.28)',
  success:    '#4D9B6A',
  successLow: 'rgba(77,155,106,0.12)',
  error:      '#A04848',
  errorLow:   'rgba(160,72,72,0.12)',
  warning:    '#B8832A',
  warningLow: 'rgba(184,131,42,0.12)',
  pending:    '#6B7FAF',
  pendingLow: 'rgba(107,127,175,0.12)',
}

interface BalancesReport {
  network: 'mainnet' | 'testnet'
  stellar: Array<{ label: string; envKey: string; public_key: string | null; usdc: string | null; xlm: string | null; xlm_spendable?: string | null; configured: boolean; error?: string | null }>
  base_relayer: { label: string; configured: boolean; address: string | null; eth: string | null; chain: string; error?: string | null }
}

interface Stats {
  users: { total: number; verified: number }
  access_codes: { total: number; redeemed: number; unredeemed: number }
  credits: { active_grants: number; outstanding_total: string }
  transactions: { total: number; failed: number; pending_approval: number }
}

type Tab = 'users' | 'codes' | 'credits' | 'failed' | 'services'

interface UserRow {
  id: string
  email: string
  emailVerified: boolean
  accessCodeId: string | null
  createdAt: string
  wallet: { stellarPublicKey: string; status: string; balanceCache: string; creditsGranted: string } | null
  _count: { transactions: number }
}

interface UserDetail {
  id: string
  email: string
  emailVerified: boolean
  accessCodeId: string | null
  createdAt: string
  transfer_pin_set: boolean
  wallet: { stellarPublicKey: string; status: string; balanceCache: string; balanceCachedAt: string | null; creditsGranted: string; createdAt: string } | null
  policies: { allowanceLimit: string | null; maxTransactionLimit: string | null; approvalThreshold: string | null; totalSpent: string; updatedAt: string } | null
  apiKeys: Array<{ id: string; keyPrefix: string; isActive: boolean; lastUsedAt: string | null; createdAt: string }>
  creditGrants: Array<{ id: string; amount: string; amountRemaining: string; reason: string | null; expiresAt: string | null; createdAt: string }>
  _count: { transactions: number }
  usdc_live: string | null
  active_credits_balance: string
  tx_by_status: Array<{ status: string; count: number }>
  spend_by_type: Array<{ type: string; count: number; total: string }>
  activity: Array<{ id: string; eventType: string; eventData: unknown; createdAt: string }>
}

interface UserTxRow {
  id: string
  type: string
  status: string
  amount: string
  costPaid: string | null
  recipientAddress: string
  serviceId: string | null
  memo: string | null
  stellarTxHash: string | null
  crossChain: boolean
  destinationChain: string | null
  destinationTxHash: string | null
  blockedReason: string | null
  createdAt: string
}

interface CodeRow {
  id: string
  code: string
  note: string | null
  expiresAt: string | null
  redeemedBy: string | null
  redeemedAt: string | null
  createdAt: string
}

interface GrantRow {
  id: string
  userId: string
  amount: string
  amountRemaining: string
  reason: string | null
  expiresAt: string | null
  createdAt: string
  user: { email: string }
}

interface FailedTxRow {
  id: string
  status: string
  amount: string
  recipientAddress: string
  crossChain: boolean
  blockedReason: string | null
  createdAt: string
  user: { email: string }
  type?: string
  serviceId?: string | null
  metadata?: {
    refund?: { required?: boolean; amount?: string | null }
    mpp_router?: {
      receipt?: { method?: string; reference?: string; status?: string; timestamp?: string } | null
      progress?: Array<Record<string, unknown>>
      upstream_status?: number | null
      upstream_body?: unknown
      refund?: { status?: string; id?: string | null; status_url?: string | null; outcome?: string | null } | null
    }
  } | null
}

interface AdminServiceRow {
  provider_id: string
  name: string
  endpoint_count: number
  enabled: boolean
  note: string | null
  failed_count: number
  refund_required_count: number
  updated_at: string | null
}

// ─── API helpers ─────────────────────────────────────────────────────────────
function adminFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T | { error: string; code: string }> {
  const secret = typeof window !== 'undefined' ? sessionStorage.getItem(SECRET_KEY) ?? '' : ''
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': secret,
      ...(opts.headers ?? {}),
    },
  }).then(async (r) => {
    const json = await r.json().catch(() => ({}))
    if (!r.ok) return { error: json.error ?? `HTTP ${r.status}`, code: json.code ?? 'HTTP_ERROR' }
    return json.data ?? json
  })
}
function isErr(x: unknown): x is { error: string; code: string } {
  return Boolean(x && typeof x === 'object' && 'error' in (x as Record<string, unknown>))
}

// ─── Auth gate ───────────────────────────────────────────────────────────────
function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    // Verify by trying /admin/stats with the provided secret.
    const r = await fetch(`${API_BASE}/admin/stats`, { headers: { 'x-admin-secret': secret } })
    setLoading(false)
    if (r.ok) {
      sessionStorage.setItem(SECRET_KEY, secret)
      onAuthed()
    } else if (r.status === 401) {
      setError('Invalid secret.')
    } else if (r.status === 503) {
      setError('Admin endpoints are disabled (ADMIN_SECRET not set on the API).')
    } else {
      setError(`Verification failed (HTTP ${r.status}).`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}><Logo size="lg" /></div>
        <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 12, padding: '28px 26px' }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 17, color: t.text, marginBottom: 6 }}>Ops Console</div>
          <div style={{ fontSize: 13, color: t.muted, marginBottom: 22, lineHeight: 1.6 }}>Paste the admin secret to continue.</div>
          {error && (
            <div style={{ padding: '10px 14px', background: t.errorLow, border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, color: t.error, fontSize: 13, marginBottom: 16, fontFamily: 'JetBrains Mono, monospace' }}>{error}</div>
          )}
          <form onSubmit={submit}>
            <input
              type="password" autoFocus
              value={secret} onChange={(e) => setSecret(e.target.value)}
              placeholder="admin secret"
              style={{ width: '100%', boxSizing: 'border-box', background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 7, padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: t.text, outline: 'none', marginBottom: 12 }}
            />
            <button type="submit" disabled={loading || !secret} style={{ width: '100%', padding: 11, background: loading ? t.bg3 : t.accent, border: 'none', borderRadius: 7, color: loading ? t.muted : t.bg, fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Verifying…' : 'Unlock console'}
            </button>
          </form>
          <p style={{ fontSize: 11, color: t.faint, marginTop: 16, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>secret stored in sessionStorage · clears on tab close</p>
        </div>
      </div>
    </div>
  )
}

// ─── Reusable bits ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 24, color: accent ?? t.text, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: t.muted, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16, color: t.text, margin: 0 }}>{title}</h2>
        {action}
      </div>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>{children}</div>
    </section>
  )
}

// ─── Main dashboard ──────────────────────────────────────────────────────────
function Console({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('users')
  const [balances, setBalances] = useState<BalancesReport | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  const loadOverview = useCallback(async () => {
    const [b, s] = await Promise.all([
      adminFetch<BalancesReport>('/admin/wallets'),
      adminFetch<Stats>('/admin/stats'),
    ])
    if (!isErr(b)) setBalances(b)
    if (!isErr(s)) setStats(s)
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview])

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text }}>
      {/* Top bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'rgba(12,11,10,0.92)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo />
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: t.accentLow, color: t.accent, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>OPS</span>
          {balances && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: balances.network === 'mainnet' ? t.successLow : t.warningLow, color: balances.network === 'mainnet' ? t.success : t.warning, fontFamily: 'JetBrains Mono, monospace' }}>
              {balances.network}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={loadOverview} style={{ fontSize: 12, padding: '6px 10px', background: 'transparent', border: `1px solid ${t.border2}`, color: t.muted, borderRadius: 6, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>↻ refresh</button>
          <button onClick={onLogout} style={{ fontSize: 12, padding: '6px 10px', background: 'transparent', border: `1px solid ${t.border2}`, color: t.muted, borderRadius: 6, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>logout</button>
        </div>
      </header>

      <main style={{ padding: '24px clamp(16px,3vw,32px) 80px', maxWidth: 1280, margin: '0 auto' }}>

        {/* Wallet balances */}
        <section>
          <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16, color: t.text, marginTop: 0, marginBottom: 12 }}>Wallet balances</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {balances?.stellar.map((w) => (
              <WalletCard key={w.envKey} w={w} />
            ))}
            {balances && <RelayerCard r={balances.base_relayer} />}
            {!balances && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: '18px 20px', height: 110, opacity: 0.4 }}/>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16, color: t.text, marginBottom: 12 }}>System stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <StatCard label="Users" value={stats?.users.total ?? '—'} sub={`${stats?.users.verified ?? 0} verified`} />
            <StatCard label="Credits outstanding" value={`$${parseFloat(stats?.credits.outstanding_total ?? '0').toFixed(2)}`} sub={`${stats?.credits.active_grants ?? 0} active grants`} accent={t.accent} />
            <StatCard label="Transactions" value={stats?.transactions.total ?? '—'} sub={`${stats?.transactions.failed ?? 0} failed · ${stats?.transactions.pending_approval ?? 0} pending`} accent={(stats?.transactions.failed ?? 0) > 0 ? t.error : undefined} />
          </div>
        </section>

        {/* Tabs */}
        <div style={{ marginTop: 28, marginBottom: 14, display: 'flex', gap: 6, borderBottom: `1px solid ${t.border}` }}>
          {([
            ['users', 'Users'],
            ['codes', 'Access codes'],
            ['credits', 'Credits'],
            ['failed', 'Failed txns'],
            ['services', 'Marketplace'],
          ] as Array<[Tab, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${tab === key ? t.accent : 'transparent'}`,
                color: tab === key ? t.text : t.muted,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: tab === key ? 600 : 400,
                marginBottom: -1,
              }}
            >{label}</button>
          ))}
        </div>

        {tab === 'users'    && <UsersPanel network={balances?.network ?? 'mainnet'} />}
        {tab === 'codes'    && <CodesPanel onChanged={loadOverview} />}
        {tab === 'credits'  && <CreditsPanel onChanged={loadOverview} />}
        {tab === 'failed'   && <FailedPanel />}
        {tab === 'services' && <ServicesPanel />}

      </main>
    </div>
  )
}

// ─── Wallet cards ────────────────────────────────────────────────────────────
function WalletCard({ w }: { w: BalancesReport['stellar'][number] }) {
  const usdcNum = parseFloat(w.usdc ?? '0')
  const xlmNum  = parseFloat(w.xlm  ?? '0')
  return (
    <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{w.label}</div>
      {w.configured ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 20, color: t.text }}>
              {w.usdc ? `$${usdcNum.toFixed(2)}` : '—'}
            </span>
            <span style={{ fontSize: 11, color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>USDC</span>
          </div>
          <div style={{ fontSize: 12, color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>
            XLM: <span style={{ color: t.text2 }}>{w.xlm ? xlmNum.toFixed(4) : '—'}</span>
          </div>
          {/* Sponsored user reserves sit inside `xlm` but can never be spent — this is what runs out. */}
          {w.xlm_spendable != null && w.xlm_spendable !== w.xlm && (
            <div style={{ fontSize: 12, color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>
              Spendable: <span style={{ color: t.text2 }}>{parseFloat(w.xlm_spendable).toFixed(4)}</span>
            </div>
          )}
          {w.public_key && (
            <div style={{ fontSize: 10, color: t.faint, fontFamily: 'JetBrains Mono, monospace', marginTop: 8, wordBreak: 'break-all', lineHeight: 1.5 }}>
              {w.public_key.slice(0, 8)}…{w.public_key.slice(-6)}
            </div>
          )}
          {w.error && (
            <div title={w.error} style={{ fontSize: 10, color: t.error, marginTop: 6, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚠ {w.error}
            </div>
          )}
          {!w.error && w.usdc === null && w.xlm === null && (
            <div style={{ fontSize: 10, color: t.warning, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              ⓘ account not on-chain yet
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: t.warning, fontFamily: 'JetBrains Mono, monospace' }}>not configured</div>
      )}
    </div>
  )
}

function RelayerCard({ r }: { r: BalancesReport['base_relayer'] }) {
  const ethNum = parseFloat(r.eth ?? '0')
  const lowGas = r.configured && r.eth !== null && ethNum < 0.005
  return (
    <div style={{ background: t.bg2, border: `1px solid ${lowGas ? 'rgba(160,72,72,0.4)' : t.border}`, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{r.label}</div>
      {r.configured ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 20, color: lowGas ? t.error : t.text }}>
              {r.eth ? ethNum.toFixed(5) : '—'}
            </span>
            <span style={{ fontSize: 11, color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>ETH</span>
          </div>
          <div style={{ fontSize: 12, color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>chain: <span style={{ color: t.text2 }}>{r.chain}</span></div>
          {r.address && (
            <div style={{ fontSize: 10, color: t.faint, fontFamily: 'JetBrains Mono, monospace', marginTop: 8, wordBreak: 'break-all', lineHeight: 1.5 }}>
              {r.address.slice(0, 6)}…{r.address.slice(-4)}
            </div>
          )}
          {r.error && (
            <div title={r.error} style={{ fontSize: 10, color: t.error, marginTop: 6, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚠ {r.error}
            </div>
          )}
          {lowGas && !r.error && <div style={{ fontSize: 11, color: t.error, marginTop: 6 }}>⚠ low gas</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, color: t.warning, fontFamily: 'JetBrains Mono, monospace' }}>not configured</div>
      )}
    </div>
  )
}

// ─── Users panel ─────────────────────────────────────────────────────────────
function UsersPanel({ network }: { network: 'mainnet' | 'testnet' }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    const r = await fetch(`${API_BASE}/admin/users?limit=50${q ? `&email=${encodeURIComponent(q)}` : ''}`, {
      headers: { 'x-admin-secret': sessionStorage.getItem(SECRET_KEY) ?? '' },
    }).then(x => x.json())
    setLoading(false)
    if (r.data) {
      setUsers(r.data)
      setTotal(r.meta?.total ?? r.data.length)
    }
  }, [])

  useEffect(() => { load('') }, [load])

  const fmt = (d: string) => new Date(d).toLocaleString()

  return (
    <Section
      title={`Users (${total})`}
      action={
        <form onSubmit={(e) => { e.preventDefault(); load(search) }} style={{ display: 'flex', gap: 6 }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="filter by email…"
            style={{ background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: t.text, fontFamily: 'Inter, sans-serif', width: 220, outline: 'none' }}
          />
          <button type="submit" style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${t.border2}`, borderRadius: 6, color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer' }}>search</button>
        </form>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: t.bg3 }}>
              {['Email', 'Verified', 'Code', 'USDC', 'Credits granted', 'Tx', 'Joined'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 18, textAlign: 'center', color: t.faint }}>Loading…</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={7} style={{ padding: 18, textAlign: 'center', color: t.faint }}>No users.</td></tr>}
            {users.map(u => (
              <tr
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(u.id) } }}
                tabIndex={0}
                role="button"
                aria-label={`Open ${u.email}`}
                style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', background: selectedId === u.id ? t.bg3 : undefined }}
                onMouseEnter={(e) => { if (selectedId !== u.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={(e) => { if (selectedId !== u.id) e.currentTarget.style.background = '' }}
              >
                <td style={{ padding: '10px 14px', color: t.text }}>{u.email}</td>
                <td style={{ padding: '10px 14px', color: u.emailVerified ? t.success : t.muted, fontFamily: 'JetBrains Mono, monospace' }}>{u.emailVerified ? '✓' : '—'}</td>
                <td style={{ padding: '10px 14px', color: u.accessCodeId ? t.success : t.muted, fontFamily: 'JetBrains Mono, monospace' }}>{u.accessCodeId ? '✓' : '—'}</td>
                <td style={{ padding: '10px 14px', color: t.text2, fontFamily: 'JetBrains Mono, monospace' }}>{u.wallet ? parseFloat(u.wallet.balanceCache).toFixed(2) : '—'}</td>
                <td style={{ padding: '10px 14px', color: t.accent, fontFamily: 'JetBrains Mono, monospace' }}>{u.wallet ? `$${parseFloat(u.wallet.creditsGranted).toFixed(2)}` : '—'}</td>
                <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>{u._count.transactions}</td>
                <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{fmt(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedId && <UserDetailSheet userId={selectedId} network={network} onClose={() => setSelectedId(null)} />}
    </Section>
  )
}

// ─── User detail sheet ───────────────────────────────────────────────────────
const mono: React.CSSProperties = { fontFamily: 'JetBrains Mono, monospace' }
const usd = (v: string | null | undefined) => (v == null ? '—' : `$${parseFloat(v).toFixed(2)}`)
const when = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '—')
const short = (s: string, head = 6, tail = 4) => (s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s)

const TX_STATUS_COLOR: Record<string, string> = {
  SUCCESS: t.success, FAILED: t.error, BLOCKED: t.error, REJECTED: t.muted,
  PENDING_APPROVAL: t.warning, APPROVED: t.pending,
}

function SheetBlock({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ ...mono, fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
      <span style={{ color: t.muted }}>{k}</span>
      <span style={{ ...mono, color: t.text2, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
    </div>
  )
}

function UserDetailSheet({ userId, network, onClose }: { userId: string; network: 'mainnet' | 'testnet'; onClose: () => void }) {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [error, setError] = useState('')
  const [txs, setTxs] = useState<UserTxRow[]>([])
  const [txPage, setTxPage] = useState(1)
  const [txPages, setTxPages] = useState(1)
  const [txTotal, setTxTotal] = useState(0)
  const [txStatus, setTxStatus] = useState('')
  const [txLoading, setTxLoading] = useState(false)

  const explorer = `https://stellar.expert/explorer/${network === 'mainnet' ? 'public' : 'testnet'}`

  useEffect(() => {
    setUser(null); setError('')
    adminFetch<UserDetail>(`/admin/users/${encodeURIComponent(userId)}`).then((r) => {
      if (isErr(r)) setError(r.error)
      else setUser(r)
    })
  }, [userId])

  // Paginated list keeps the meta, so it bypasses adminFetch's data unwrapping.
  const loadTxs = useCallback(async (page: number, status: string) => {
    setTxLoading(true)
    const qs = `page=${page}&limit=25${status ? `&status=${status}` : ''}`
    const r = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/transactions?${qs}`, {
      headers: { 'x-admin-secret': sessionStorage.getItem(SECRET_KEY) ?? '' },
    }).then((x) => x.json()).catch(() => null)
    setTxLoading(false)
    if (r?.data) {
      setTxs((prev) => (page === 1 ? r.data : [...prev, ...r.data]))
      setTxPage(page)
      setTxPages(r.meta?.pages ?? 1)
      setTxTotal(r.meta?.total ?? r.data.length)
    }
  }, [userId])

  useEffect(() => { loadTxs(1, txStatus) }, [loadTxs, txStatus])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [onClose])

  const spent = user?.spend_by_type.reduce((sum, r) => sum + parseFloat(r.total), 0) ?? 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="User details"
        style={{ width: 'min(640px, 100vw)', height: '100%', overflowY: 'auto', background: t.bg2, borderLeft: `1px solid ${t.border2}`, padding: '20px 24px 48px', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 18, color: t.text, wordBreak: 'break-all' }}>{user?.email ?? (error ? 'User' : 'Loading…')}</div>
            <div style={{ ...mono, fontSize: 11, color: t.faint, marginTop: 4 }}>{userId}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ fontSize: 12, padding: '6px 10px', background: 'transparent', border: `1px solid ${t.border2}`, color: t.muted, borderRadius: 6, cursor: 'pointer', ...mono }}>esc ✕</button>
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: t.errorLow, border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, color: t.error, fontSize: 13, ...mono }}>{error}</div>
        )}

        {user && (
          <>
            {/* Balances */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 18 }}>
              <StatCard label="USDC (live)" value={user.wallet ? usd(user.usdc_live ?? user.wallet.balanceCache) : '—'} sub={user.wallet ? (user.usdc_live === null ? 'live read failed · cached' : `cached ${usd(user.wallet.balanceCache)}`) : 'no wallet'} />
              <StatCard label="Credits" value={usd(user.active_credits_balance)} sub={`${usd(user.wallet?.creditsGranted)} granted total`} accent={t.accent} />
              <StatCard label="Spent" value={`$${spent.toFixed(2)}`} sub={user.spend_by_type.map((r) => `${r.count} ${r.type}`).join(' · ') || 'no successful txns'} />
              <StatCard label="Transactions" value={user._count.transactions} sub={user.tx_by_status.map((r) => `${r.count} ${r.status.toLowerCase().replace('_', ' ')}`).join(' · ') || 'none'} />
            </div>

            {/* Account */}
            <SheetBlock title="Account">
              <KV k="Email verified" v={user.emailVerified ? <span style={{ color: t.success }}>yes</span> : <span style={{ color: t.warning }}>no</span>} />
              <KV k="Joined" v={when(user.createdAt)} />
              <KV k="Transfer PIN" v={user.transfer_pin_set ? 'set' : 'not set'} />
              <KV k="Signed up with access code" v={user.accessCodeId ? 'yes' : 'no'} />
            </SheetBlock>

            {/* Wallet */}
            <SheetBlock title="Wallet">
              {user.wallet ? (
                <>
                  <KV k="Address" v={<a href={`${explorer}/account/${user.wallet.stellarPublicKey}`} target="_blank" rel="noopener noreferrer" style={{ color: t.accent, textDecoration: 'none' }}>{short(user.wallet.stellarPublicKey, 8, 6)} ↗</a>} />
                  <KV k="Status" v={<span style={{ color: user.wallet.status === 'READY' ? t.success : t.warning }}>{user.wallet.status}</span>} />
                  <KV k="Balance cached at" v={when(user.wallet.balanceCachedAt)} />
                  <KV k="Created" v={when(user.wallet.createdAt)} />
                </>
              ) : <div style={{ fontSize: 12, color: t.muted }}>No wallet yet (email not verified).</div>}
            </SheetBlock>

            {/* Policy */}
            <SheetBlock title="Policy">
              {user.policies ? (
                <>
                  <KV k="Allowance" v={user.policies.allowanceLimit ? `${usd(user.policies.totalSpent)} spent of ${usd(user.policies.allowanceLimit)}` : `not set · ${usd(user.policies.totalSpent)} spent`} />
                  <KV k="Max per transaction" v={user.policies.maxTransactionLimit ? usd(user.policies.maxTransactionLimit) : 'not set'} />
                  <KV k="Approval threshold" v={user.policies.approvalThreshold ? usd(user.policies.approvalThreshold) : 'not set'} />
                  <KV k="Last changed" v={when(user.policies.updatedAt)} />
                </>
              ) : <div style={{ fontSize: 12, color: t.muted }}>No policy row.</div>}
            </SheetBlock>

            {/* API keys */}
            <SheetBlock title={`API keys (${user.apiKeys.length})`}>
              {user.apiKeys.length === 0 && <div style={{ fontSize: 12, color: t.muted }}>No keys generated.</div>}
              {user.apiKeys.map((k) => (
                <KV key={k.id} k={`${k.keyPrefix}…`} v={<><span style={{ color: k.isActive ? t.success : t.muted }}>{k.isActive ? 'active' : 'revoked'}</span>{' · last used '}{when(k.lastUsedAt)}</>} />
              ))}
            </SheetBlock>
          </>
        )}

        {/* Transactions */}
        <SheetBlock
          title={`Transactions (${txTotal})`}
          action={
            <select value={txStatus} onChange={(e) => setTxStatus(e.target.value)} style={{ background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 6, padding: '4px 8px', fontSize: 11, color: t.text2, ...mono }}>
              <option value="">all statuses</option>
              {Object.keys(TX_STATUS_COLOR).map((s) => <option key={s} value={s}>{s.toLowerCase().replace('_', ' ')}</option>)}
            </select>
          }
        >
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {txs.length === 0 && !txLoading && <div style={{ padding: 14, fontSize: 12, color: t.faint, textAlign: 'center' }}>No transactions.</div>}
            {txs.map((x) => {
              const charged = x.type === 'marketplace' && x.costPaid ? x.costPaid : x.amount
              return (
                <div key={x.id} style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: t.text }}>
                      {x.type === 'marketplace' ? (x.serviceId ?? 'marketplace') : `→ ${short(x.recipientAddress, 6, 4)}`}
                      {x.crossChain && <span style={{ ...mono, fontSize: 10, color: t.pending, marginLeft: 6 }}>{x.destinationChain ?? 'cross-chain'}</span>}
                    </span>
                    <span style={{ ...mono, color: t.text2 }}>{usd(charged)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, ...mono, fontSize: 11 }}>
                    <span style={{ color: TX_STATUS_COLOR[x.status] ?? t.muted }}>{x.status.toLowerCase().replace('_', ' ')}</span>
                    <span style={{ color: t.faint }}>{when(x.createdAt)}</span>
                  </div>
                  {(x.stellarTxHash || x.blockedReason || x.memo) && (
                    <div style={{ marginTop: 4, ...mono, fontSize: 11, color: t.muted, wordBreak: 'break-all' }}>
                      {x.stellarTxHash && <a href={`${explorer}/tx/${x.stellarTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: t.accent, textDecoration: 'none', marginRight: 10 }}>tx {short(x.stellarTxHash)} ↗</a>}
                      {x.memo && <span style={{ marginRight: 10 }}>memo: {x.memo}</span>}
                      {x.blockedReason && <span style={{ color: t.error }}>{x.blockedReason}</span>}
                    </div>
                  )}
                </div>
              )
            })}
            {txLoading && <div style={{ padding: 12, fontSize: 12, color: t.faint, textAlign: 'center' }}>Loading…</div>}
          </div>
          {txPage < txPages && !txLoading && (
            <button onClick={() => loadTxs(txPage + 1, txStatus)} style={{ marginTop: 8, width: '100%', padding: 8, background: 'transparent', border: `1px solid ${t.border2}`, borderRadius: 6, color: t.muted, fontSize: 12, cursor: 'pointer', ...mono }}>load more</button>
          )}
        </SheetBlock>

        {user && (
          <>
            {/* Credit grants */}
            <SheetBlock title={`Credit grants (${user.creditGrants.length})`}>
              {user.creditGrants.length === 0 && <div style={{ fontSize: 12, color: t.muted }}>No grants.</div>}
              {user.creditGrants.map((g) => (
                <KV key={g.id} k={`${usd(g.amountRemaining)} left of ${usd(g.amount)}`} v={`${g.reason ?? 'no reason'} · ${g.expiresAt ? `expires ${when(g.expiresAt)}` : 'no expiry'}`} />
              ))}
            </SheetBlock>

            {/* Activity */}
            <SheetBlock title="Activity">
              {user.activity.length === 0 && <div style={{ fontSize: 12, color: t.muted }}>No audit events.</div>}
              {user.activity.map((a) => (
                <div key={a.id} style={{ padding: '7px 0', borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ ...mono, color: t.text2 }}>{a.eventType}</span>
                    <span style={{ ...mono, fontSize: 11, color: t.faint }}>{when(a.createdAt)}</span>
                  </div>
                  {a.eventData != null && (
                    <div style={{ ...mono, fontSize: 11, color: t.muted, marginTop: 3, wordBreak: 'break-all' }}>{JSON.stringify(a.eventData)}</div>
                  )}
                </div>
              ))}
            </SheetBlock>
          </>
        )}
      </aside>
    </div>
  )
}

// ─── Codes panel ─────────────────────────────────────────────────────────────
function CodesPanel({ onChanged }: { onChanged: () => void }) {
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(5)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [newCodes, setNewCodes] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminFetch<CodeRow[]>('/admin/access-codes?limit=50')
    setLoading(false)
    if (!isErr(r)) setCodes(r as CodeRow[])
  }, [])

  useEffect(() => { load() }, [load])

  const generate = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setNewCodes([])
    const r = await adminFetch<{ codes: Array<{ code: string }> }>('/admin/access-codes', {
      method: 'POST', body: JSON.stringify({ count, note: note || undefined }),
    })
    setBusy(false)
    if (!isErr(r) && r.codes) {
      setNewCodes(r.codes.map((c) => c.code))
      setNote('')
      load(); onChanged()
    }
  }

  return (
    <>
      {newCodes.length > 0 && (
        <div style={{ marginTop: 4, marginBottom: 14, background: t.bg2, border: `1px solid ${t.accentMid}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>New codes — copy now (only shown once)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {newCodes.map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: t.bg, padding: '8px 12px', borderRadius: 6 }}>
                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.text2 }}>{c}</code>
                <button onClick={() => navigator.clipboard?.writeText(c)} style={{ padding: '3px 8px', background: 'transparent', border: `1px solid ${t.border2}`, color: t.muted, borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, cursor: 'pointer' }}>copy</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <Section
        title="Access codes"
        action={
          <form onSubmit={generate} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number" min={1} max={50}
              value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              style={{ width: 64, background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: t.text, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
            />
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="note (optional)"
              style={{ background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: t.text, fontFamily: 'Inter, sans-serif', width: 200, outline: 'none' }}
            />
            <button type="submit" disabled={busy} style={{ padding: '6px 14px', background: t.accent, border: 'none', borderRadius: 6, color: t.bg, fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? '…' : 'Generate'}
            </button>
          </form>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: t.bg3 }}>
                {['Code', 'Note', 'Status', 'Created', 'Redeemed'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: t.faint }}>Loading…</td></tr>}
              {!loading && codes.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: t.faint }}>No codes yet — generate some above.</td></tr>}
              {codes.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ padding: '10px 14px', color: t.text2, fontFamily: 'JetBrains Mono, monospace' }}>{c.code}</td>
                  <td style={{ padding: '10px 14px', color: t.muted }}>{c.note ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {c.redeemedBy
                      ? <span style={{ color: t.success }}>● redeemed</span>
                      : <span style={{ color: t.muted }}>○ free</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{new Date(c.createdAt).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{c.redeemedAt ? new Date(c.redeemedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

// ─── Credits panel ───────────────────────────────────────────────────────────
function CreditsPanel({ onChanged }: { onChanged: () => void }) {
  const [grants, setGrants] = useState<GrantRow[]>([])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('5')
  const [reason, setReason] = useState('')
  const [days, setDays] = useState(60)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminFetch<GrantRow[]>('/admin/credit-grants?limit=50')
    setLoading(false)
    if (!isErr(r)) setGrants(r as GrantRow[])
  }, [])

  useEffect(() => { load() }, [load])

  const grant = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await adminFetch<{ amount: string; email: string }>('/admin/credits/grant-by-email', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        amount: parseFloat(amount).toFixed(7),
        reason: reason.trim() || undefined,
        expiresInDays: days,
      }),
    })
    setBusy(false)
    if (isErr(r)) {
      setMsg({ kind: 'err', text: r.error })
    } else {
      setMsg({ kind: 'ok', text: `Granted $${parseFloat(r.amount).toFixed(2)} to ${r.email}` })
      setEmail(''); setAmount('5'); setReason('')
      load(); onChanged()
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleString()

  return (
    <>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: t.text, marginBottom: 12 }}>Grant credits by email</div>
        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', marginBottom: 10, background: msg.kind === 'ok' ? t.successLow : t.errorLow, color: msg.kind === 'ok' ? t.success : t.error, border: `1px solid ${msg.kind === 'ok' ? 'rgba(77,155,106,0.3)' : 'rgba(160,72,72,0.3)'}` }}>{msg.text}</div>
        )}
        <form onSubmit={grant} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 8, alignItems: 'end' }}>
          <Field label="Email"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" style={inputStyle()}/></Field>
          <Field label="Amount (USDC)"><input required type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle()}/></Field>
          <Field label="Expires (days)"><input required type="number" min={1} max={365} value={days} onChange={(e) => setDays(parseInt(e.target.value, 10) || 60)} style={inputStyle()}/></Field>
          <Field label="Reason (optional)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="beta tester thank-you" style={inputStyle()}/></Field>
          <button type="submit" disabled={busy} style={{ padding: '8px 16px', background: t.accent, border: 'none', borderRadius: 6, color: t.bg, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', height: 34 }}>
            {busy ? '…' : 'Grant'}
          </button>
        </form>
      </div>

      <Section title={`Credit grants (${grants.length})`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: t.bg3 }}>
                {['User', 'Granted', 'Remaining', 'Reason', 'Issued', 'Expires'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 18, textAlign: 'center', color: t.faint }}>Loading…</td></tr>}
              {!loading && grants.length === 0 && <tr><td colSpan={6} style={{ padding: 18, textAlign: 'center', color: t.faint }}>No grants yet.</td></tr>}
              {grants.map(g => {
                const remaining = parseFloat(g.amountRemaining)
                const expired = g.expiresAt && new Date(g.expiresAt) < new Date()
                return (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '10px 14px', color: t.text }}>{g.user.email}</td>
                    <td style={{ padding: '10px 14px', color: t.accent, fontFamily: 'JetBrains Mono, monospace' }}>${parseFloat(g.amount).toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', color: remaining > 0 && !expired ? t.text2 : t.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                      ${remaining.toFixed(2)} {expired && <span style={{ color: t.warning, fontSize: 10 }}>· expired</span>}
                    </td>
                    <td style={{ padding: '10px 14px', color: t.muted }}>{g.reason ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{fmt(g.createdAt)}</td>
                    <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{g.expiresAt ? fmt(g.expiresAt) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

// ─── Failed transactions panel ───────────────────────────────────────────────
function FailedPanel() {
  const [rows, setRows] = useState<FailedTxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedUpstream, setExpandedUpstream] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setLoading(true)
    adminFetch<FailedTxRow[]>('/admin/transactions/failed?limit=50').then(r => {
      setLoading(false)
      if (!isErr(r)) setRows(r as FailedTxRow[])
    })
  }, [])

  const signatureCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const mpp = asMppRouter(r.metadata)
      if (!mpp) continue
      const sig = upstreamSignature(mpp)
      counts.set(sig, (counts.get(sig) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }, [rows])

  return (
    <Section title={`Failed transactions (${rows.length})`}>
      {signatureCounts.length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 12px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: 6 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Upstream signatures (marketplace)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {signatureCounts.map(([sig, count]) => (
              <div key={sig} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                <span style={{ color: t.accent, flexShrink: 0, minWidth: 28 }}>{count}×</span>
                <span style={{ color: t.text2, wordBreak: 'break-word' }}>{sig}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: t.bg3 }}>
              {['User', 'Type', 'Amount', 'Recipient', 'Refund', 'Reason', 'When'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 18, textAlign: 'center', color: t.faint }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} style={{ padding: 18, textAlign: 'center', color: t.muted }}>Nothing failed recently. ✓</td></tr>}
            {rows.map(r => {
              const refundNeeded = Boolean(r.metadata?.refund?.required)
              const refundAmount = r.metadata?.refund?.amount
              const mppRefund = r.metadata?.mpp_router?.refund ?? null
              const mppAutoRefund = mppRefund?.outcome === 'mpp_auto'
              const mpp = asMppRouter(r.metadata)
              const body = mpp ? formatUpstreamBody(mpp.upstream_body) : null
              const settled = mpp ? paymentSettledLabel(mpp.receipt) : null
              const open = Boolean(expandedUpstream[r.id])
              return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${t.border}`, background: refundNeeded ? t.errorLow : 'transparent', verticalAlign: 'top' }}>
                <td style={{ padding: '10px 14px', color: t.text }}>{r.user.email}</td>
                <td style={{ padding: '10px 14px', color: r.crossChain ? '#5B8EFF' : r.type === 'marketplace' ? t.accent : t.text2, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{r.crossChain ? 'cctp' : r.type === 'marketplace' ? 'mkt' : 'direct'}</td>
                <td style={{ padding: '10px 14px', color: t.text2, fontFamily: 'JetBrains Mono, monospace' }}>${parseFloat(r.amount).toFixed(2)}</td>
                <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{r.serviceId ? r.serviceId : `${r.recipientAddress.slice(0, 8)}…${r.recipientAddress.slice(-4)}`}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                  {refundNeeded
                    ? <span style={{ color: t.error, border: '1px solid rgba(160,72,72,0.4)', background: t.errorLow, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>● REFUND NEEDED{refundAmount ? ` $${parseFloat(refundAmount).toFixed(4)}` : ''}</span>
                    : mppAutoRefund
                      ? (mppRefund?.status_url
                          ? <a href={mppRefund.status_url} target="_blank" rel="noopener noreferrer" style={{ color: t.muted, whiteSpace: 'nowrap', textDecoration: 'none' }} title="MPP Router is refunding the payer automatically — do not refund manually">AUTO-REFUND (MPP) ↗</a>
                          : <span style={{ color: t.muted, whiteSpace: 'nowrap' }} title="MPP Router is refunding the payer automatically — do not refund manually">AUTO-REFUND (MPP)</span>)
                      : <span style={{ color: t.faint }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px', color: t.error, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, maxWidth: 380, wordBreak: 'break-word' }}>
                  <div>{r.blockedReason ?? '—'}</div>
                  {mpp && body && (
                    <div style={{ marginTop: 8, color: t.text2 }}>
                      <div style={{ color: t.muted, marginBottom: 6 }}>
                        upstream {mpp.upstream_status ?? '—'}
                        {settled ? ` · ${settled.charged ? 'charged' : 'not charged'}` : ''}
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '8px 10px',
                          background: t.bg,
                          border: `1px solid ${t.border}`,
                          borderRadius: 5,
                          fontSize: 10,
                          color: t.text2,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: open ? 220 : 72,
                          overflow: 'auto',
                          lineHeight: 1.4,
                        }}
                      >
                        {open || body.text.length <= 220
                          ? body.text
                          : `${body.text.slice(0, 220)}…`}
                      </pre>
                      {body.text.length > 220 && (
                        <button
                          type="button"
                          onClick={() => setExpandedUpstream(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                          style={{
                            marginTop: 6,
                            padding: '2px 8px',
                            background: 'transparent',
                            border: `1px solid ${t.border2}`,
                            borderRadius: 4,
                            color: t.muted,
                            fontSize: 10,
                            cursor: 'pointer',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {open ? 'Collapse' : 'Expand full body'}
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ─── Marketplace services panel (global kill-switch) ──────────────────────────
function ServicesPanel() {
  const [rows, setRows] = useState<AdminServiceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminFetch<{ providers: AdminServiceRow[] }>('/admin/marketplace/services')
    setLoading(false)
    if (!isErr(r) && r.providers) setRows(r.providers)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (row: AdminServiceRow) => {
    const next = !row.enabled
    let note: string | undefined
    if (!next) {
      note = window.prompt(`Pause "${row.name}" platform-wide. Optional note (why):`, row.note ?? '') ?? undefined
    }
    setBusyId(row.provider_id)
    const r = await adminFetch<{ enabled: boolean }>(`/admin/marketplace/services/${encodeURIComponent(row.provider_id)}`, {
      method: 'POST',
      body: JSON.stringify({ enabled: next, ...(note ? { note } : {}) }),
    })
    setBusyId(null)
    if (!isErr(r)) {
      setRows(cur => cur.map(x => x.provider_id === row.provider_id ? { ...x, enabled: next, note: note ?? x.note } : x))
    }
  }

  const filtered = rows.filter(r => {
    if (onlyIssues && r.failed_count === 0 && r.refund_required_count === 0 && r.enabled) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return r.name.toLowerCase().includes(q) || r.provider_id.toLowerCase().includes(q)
  })

  const pausedCount = rows.filter(r => !r.enabled).length

  return (
    <Section
      title={`Marketplace providers (${rows.length} · ${pausedCount} paused)`}
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.muted, fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
            issues only
          </label>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="filter providers…"
            style={{ background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: t.text, fontFamily: 'Inter, sans-serif', width: 200, outline: 'none' }}
          />
          <button onClick={load} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${t.border2}`, borderRadius: 6, color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer' }}>↻</button>
        </div>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: t.bg3 }}>
              {['Provider', 'Endpoints', 'Failed', 'Refunds', 'Note', 'State'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1px solid ${t.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 18, textAlign: 'center', color: t.faint }}>Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 18, textAlign: 'center', color: t.muted }}>No providers match.</td></tr>}
            {filtered.map(r => (
              <tr key={r.provider_id} style={{ borderBottom: `1px solid ${t.border}`, background: !r.enabled ? t.errorLow : r.refund_required_count > 0 ? t.warningLow : 'transparent' }}>
                <td style={{ padding: '10px 14px', color: t.text }}>
                  {r.name}
                  <div style={{ fontSize: 10, color: t.faint, fontFamily: 'JetBrains Mono, monospace' }}>{r.provider_id}</div>
                </td>
                <td style={{ padding: '10px 14px', color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>{r.endpoint_count}</td>
                <td style={{ padding: '10px 14px', color: r.failed_count > 0 ? t.error : t.muted, fontFamily: 'JetBrains Mono, monospace' }}>{r.failed_count}</td>
                <td style={{ padding: '10px 14px', color: r.refund_required_count > 0 ? t.warning : t.muted, fontFamily: 'JetBrains Mono, monospace' }}>{r.refund_required_count}</td>
                <td style={{ padding: '10px 14px', color: t.muted, fontSize: 11, maxWidth: 240, wordBreak: 'break-word' }}>{r.note ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    onClick={() => toggle(r)}
                    disabled={busyId === r.provider_id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: busyId === r.provider_id ? 'wait' : 'pointer', padding: 0, opacity: busyId === r.provider_id ? 0.5 : 1 }}
                  >
                    <span style={{ position: 'relative', width: 34, height: 18, borderRadius: 999, background: r.enabled ? t.success : t.bg3, transition: 'background 0.15s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: r.enabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                    </span>
                    <span style={{ fontSize: 11, color: r.enabled ? t.success : t.muted, fontFamily: 'JetBrains Mono, monospace' }}>{r.enabled ? 'live' : 'paused'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ─── Small reusable form bits ────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  )
}
function inputStyle(): React.CSSProperties {
  return { background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: t.text, fontFamily: 'Inter, sans-serif', outline: 'none', height: 34, boxSizing: 'border-box' }
}

// ─── Page export ─────────────────────────────────────────────────────────────
export default function OpsConsolePage() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const s = sessionStorage.getItem(SECRET_KEY)
    setAuthed(Boolean(s))
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SECRET_KEY)
    setAuthed(false)
  }, [])

  if (authed === null) {
    return <div style={{ minHeight: '100vh', background: t.bg }}/>
  }
  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />
  }
  return <Console onLogout={logout} />
}
