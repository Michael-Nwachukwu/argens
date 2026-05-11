'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  isError,
  marketplace,
  transactions,
  type ApiError,
  type MarketplaceEndpoint,
  type MarketplaceService,
  type Transaction,
} from '@/lib/api'
import { Icon, Icons } from '@/components/dashboard/Icon'

interface UpstreamErrorDetails {
  upstream_status?: number
  upstream_body?: unknown
  reason?: string
  service_id?: string
  transaction_id?: string
  no_payment_made?: boolean
}

function isUpstreamErrorDetails(d: unknown): d is UpstreamErrorDetails {
  return typeof d === 'object' && d !== null
}

/**
 * MPP operation ids encode path placeholders as `_<name>_id_` segments
 * (e.g. `agentmail_inboxes_inbox_id_messages_send` needs ?inbox_id=…).
 * Returns the detected placeholder names with empty-string defaults.
 */
function detectPlaceholders(operationId: string): Record<string, string> {
  if (!operationId) return {}
  const out: Record<string, string> = {}
  for (const m of operationId.matchAll(/_([a-z]+_id)_/g)) {
    if (m[1]) out[m[1]] = ''
  }
  return out
}

const MPP_BASE = 'https://apiserver.mpprouter.dev'

export default function MarketplacePage() {
  const [providers, setProviders] = useState<MarketplaceService[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [endpointId, setEndpointId] = useState<string | null>(null)
  const [payloadText, setPayloadText] = useState('{}')
  const [queryText, setQueryText] = useState('{}')
  const [recent, setRecent] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<UpstreamErrorDetails | null>(null)
  const [result, setResult] = useState<unknown>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [endpointsExpanded, setEndpointsExpanded] = useState(false)

  const ENDPOINT_PREVIEW_COUNT = 3

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const [providerRes, txRes] = await Promise.all([
        marketplace.services(),
        transactions.list({ type: 'marketplace', limit: 8 }),
      ])
      if (!mounted) return
      if (!isError(providerRes)) setProviders(providerRes.data)
      if (!isError(txRes)) setRecent(txRes.data)
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return providers
    return providers.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.categories.some(c => c.toLowerCase().includes(q)) ||
      p.endpoints.some(e => e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)),
    )
  }, [providers, search])

  const selected = useMemo(() => providers.find(p => p.id === selectedId) ?? null, [providers, selectedId])
  const endpoint = useMemo(
    () => selected?.endpoints.find(e => e.id === endpointId) ?? selected?.endpoints[0] ?? null,
    [selected, endpointId],
  )
  const placeholderKeys = useMemo(() => Object.keys(detectPlaceholders(endpoint?.id ?? '')), [endpoint])

  const selectEndpoint = (e: MarketplaceEndpoint | null) => {
    setEndpointId(e?.id ?? null)
    setPayloadText(JSON.stringify(e?.example_payload ?? {}, null, 2))
    const ph = detectPlaceholders(e?.id ?? '')
    setQueryText(Object.keys(ph).length > 0 ? JSON.stringify(ph, null, 2) : '{}')
    setResult(null); setError(null); setErrorDetails(null)
  }

  const openProvider = (p: MarketplaceService) => {
    setSelectedId(p.id)
    setEndpointsExpanded(false)
    selectEndpoint(p.endpoints[0] ?? null)
  }

  const closeDetail = () => {
    setSelectedId(null); setEndpointId(null)
    setResult(null); setError(null); setErrorDetails(null)
  }

  const callEndpoint = async () => {
    if (!selected || !endpoint || !selected.is_enabled) return

    let payload: Record<string, unknown>
    try {
      const parsed = JSON.parse(payloadText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Body must be a JSON object.')
      payload = parsed as Record<string, unknown>
    } catch (e) {
      setError(`Body JSON: ${(e as Error).message}`); setErrorDetails(null); return
    }

    let query: Record<string, string | number | boolean> | undefined
    const trimmed = queryText.trim()
    if (trimmed && trimmed !== '{}') {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const entries = Object.entries(parsed as Record<string, unknown>)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean)] as const)
          if (entries.length > 0) query = Object.fromEntries(entries)
        }
      } catch (e) {
        setError(`Query JSON: ${(e as Error).message}`); setErrorDetails(null); return
      }
    }

    setCalling(true); setError(null); setErrorDetails(null); setResult(null)
    const res = await marketplace.call({ service_id: endpoint.id, payload, ...(query && { query }) })
    if (isError(res)) {
      const err = res as ApiError
      setError(`${err.error} (${err.code})`)
      setErrorDetails(isUpstreamErrorDetails(err.details) ? err.details : null)
    } else {
      setResult(res.data)
      const txRes = await transactions.list({ type: 'marketplace', limit: 8 })
      if (!isError(txRes)) setRecent(txRes.data)
    }
    setCalling(false)
  }

  const toggleProvider = async (p: MarketplaceService) => {
    setTogglingId(p.id)
    const res = await marketplace.setEnabled(p.id, !p.is_enabled)
    if (!isError(res)) {
      setProviders(cur => cur.map(x => x.id === p.id ? { ...x, is_enabled: res.data.enabled } : x))
    }
    setTogglingId(null)
  }

  const copyServiceId = () => {
    if (!endpoint) return
    navigator.clipboard?.writeText(endpoint.id).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // ─── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    const totalEps = selected.endpoints.length
    const showAllEps = endpointsExpanded || totalEps <= ENDPOINT_PREVIEW_COUNT
    const visibleEps = showAllEps ? selected.endpoints : selected.endpoints.slice(0, ENDPOINT_PREVIEW_COUNT)
    const hiddenCount = totalEps - visibleEps.length

    return (
      <div style={{ padding: '28px 32px 40px', width: '100%', maxWidth: 1180, margin: '0 auto' }}>
        <button
          onClick={closeDetail}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '6px 11px', fontSize: 12, cursor: 'pointer', marginBottom: 18, fontFamily: 'var(--font-mono)' }}
        >
          ← all services
        </button>

        {/* The RIGHT column dictates the height (natural content height). The LEFT column
            is a grid item that stretches to match that height; its scrollable list is an
            absolutely-positioned child so the (long) list never inflates the row height. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)', gap: 20, alignItems: 'stretch' }}>
          {/* LEFT — list of other services (matches right's height, scrolls internally) */}
          <aside style={{ position: 'relative', minWidth: 0 }}>
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
              {filtered.map(p => {
                const active = p.id === selected.id
                return (
                  <button
                    key={p.id}
                    onClick={() => openProvider(p)}
                    style={{ textAlign: 'left', padding: 14, borderRadius: 10, border: `1px solid ${active ? 'var(--accent)' : p.is_enabled ? 'rgba(54,179,126,0.3)' : 'var(--border)'}`, background: active ? 'var(--bg3)' : 'var(--bg2)', cursor: 'pointer', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: 13, lineHeight: 1.4, flex: 1, fontFamily: 'var(--font-head)', fontWeight: 600 }}>{p.name}</strong>
                      <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{p.display_price}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</p>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      {p.categories.slice(0, 2).map(c => (
                        <span key={c} style={{ fontSize: 9, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{c}</span>
                      ))}
                      <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{p.endpoint_count} ep</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: p.is_enabled ? 'var(--success)' : 'var(--muted)', border: `1px solid ${p.is_enabled ? 'rgba(54,179,126,0.4)' : 'var(--border)'}`, borderRadius: 999, padding: '1px 6px', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{p.is_enabled ? 'enabled' : 'disabled'}</span>
                    </div>
                    {p.availability_note && (
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', opacity: 0.75 }}>{p.availability_note}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </aside>

          {/* RIGHT — active provider interface (natural height — drives the row height) */}
          <main style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Provider header */}
            <section style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg2)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: 22, color: 'var(--text)' }}>{selected.name}</h2>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{selected.description}</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{selected.display_price}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{selected.endpoint_count} endpoint{selected.endpoint_count === 1 ? '' : 's'}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>20% Argens markup</span>
                    {selected.docs_url && (<>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>·</span>
                      <a href={selected.docs_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>docs ↗</a>
                    </>)}
                  </div>
                  {selected.availability_note && (
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>{selected.availability_note}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <Switch enabled={selected.is_enabled} loading={togglingId === selected.id} onClick={() => void toggleProvider(selected)} />
                  <span style={{ fontSize: 10, color: selected.is_enabled ? 'var(--success)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    {selected.is_enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
              </div>
            </section>

            {/* Endpoints + call form — one card */}
            <section style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg2)', overflow: 'hidden' }}>
              {/* Endpoints list (collapsible after ENDPOINT_PREVIEW_COUNT) */}
              <div style={{ padding: '13px 18px 9px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>Endpoints ({totalEps})</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>pick one to call</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 92px', gap: 12, padding: '8px 18px', borderBottom: '1px solid var(--border)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                <span>Method</span><span>Endpoint</span><span style={{ textAlign: 'right' }}>Price</span>
              </div>
              <div style={{ position: 'relative' }}>
                {visibleEps.map(e => {
                  const active = e.id === endpoint?.id
                  return (
                    <button
                      key={e.id}
                      onClick={() => selectEndpoint(e)}
                      style={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '60px 1fr 92px', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)', borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, background: active ? 'var(--bg3)' : 'transparent', cursor: 'pointer', color: 'var(--text)', alignItems: 'start' }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'rgba(197,162,83,0.12)', border: '1px solid rgba(197,162,83,0.3)', borderRadius: 4, padding: '2px 5px', fontFamily: 'var(--font-mono)', textAlign: 'center', alignSelf: 'start' }}>{e.method}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, display: 'block' }}>{e.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{e.path}</span>
                        {e.description && e.description !== selected.description && (
                          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 3, lineHeight: 1.4 }}>{e.description}</span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{e.price}</span>
                    </button>
                  )
                })}
                {!showAllEps && (
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 38, pointerEvents: 'none', background: 'linear-gradient(to bottom, transparent, var(--bg2))' }} />
                )}
              </div>
              {totalEps > ENDPOINT_PREVIEW_COUNT && (
                <button
                  onClick={() => setEndpointsExpanded(v => !v)}
                  style={{ width: '100%', padding: '9px 18px', background: 'var(--bg2)', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}
                >
                  {showAllEps ? '▴ show fewer endpoints' : `▾ load more — ${hiddenCount} more endpoint${hiddenCount === 1 ? '' : 's'}`}
                </button>
              )}

              {/* Call form for the selected endpoint — same card */}
              {endpoint && (
                <div style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: 16 }}>Call: {endpoint.label}</h3>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{endpoint.price}</span>
                  </div>

                  {/* service_id (what an agent passes) */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                      Service ID — agents pass this to <code style={{ color: 'var(--text2)' }}>POST /v1/marketplace/call</code>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                      <code style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', overflow: 'auto', whiteSpace: 'nowrap' }}>{endpoint.id}</code>
                      <button onClick={copyServiceId} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: copied ? 'var(--success)' : 'var(--muted)', borderRadius: 6, padding: '0 12px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{copied ? '✓ copied' : 'copy'}</button>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 6, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      upstream: {endpoint.method} {MPP_BASE}{endpoint.path}
                    </div>
                  </div>

                  {/* path placeholders → query params */}
                  {placeholderKeys.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                        Path parameters (sent as query string: {placeholderKeys.map(k => `?${k}=…`).join(' ')})
                      </div>
                      <textarea
                        value={queryText}
                        onChange={e => setQueryText(e.target.value)}
                        spellCheck={false}
                        style={{ width: '100%', minHeight: 64, resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55, boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>Request body (JSON)</div>
                  <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>
                    See the service docs for required fields. Argens charges your wallet only after the upstream service responds.
                  </p>

                  {!selected.is_enabled && (
                    <div style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', borderRadius: 7, padding: 12, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
                      Enable <strong>{selected.name}</strong> (toggle above) before agents — or this panel — can call its endpoints.
                    </div>
                  )}

                  <textarea
                    value={payloadText}
                    onChange={e => setPayloadText(e.target.value)}
                    spellCheck={false}
                    style={{ width: '100%', minHeight: 200, resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55, boxSizing: 'border-box' }}
                  />

                  {error && (
                    <div style={{ marginTop: 12, border: '1px solid rgba(160,72,72,0.3)', background: 'rgba(160,72,72,0.10)', borderRadius: 7, padding: 12 }}>
                      <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: errorDetails ? 8 : 0, fontWeight: 500 }}>{error}</div>
                      {errorDetails && Boolean(errorDetails.upstream_status || errorDetails.upstream_body) && (<>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                          Upstream response{errorDetails.upstream_status ? ` (HTTP ${errorDetails.upstream_status})` : ''}{errorDetails.no_payment_made ? ' — no USDC charged' : ''}:
                        </div>
                        <pre style={{ margin: 0, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {typeof errorDetails.upstream_body === 'string' ? errorDetails.upstream_body : JSON.stringify(errorDetails.upstream_body, null, 2)}
                        </pre>
                        {errorDetails.transaction_id && (
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Transaction logged: {errorDetails.transaction_id}</div>
                        )}
                      </>)}
                    </div>
                  )}

                  <button
                    onClick={() => void callEndpoint()}
                    disabled={calling || !selected.is_enabled}
                    style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--accent)', background: calling || !selected.is_enabled ? 'var(--bg3)' : 'var(--accent)', color: calling || !selected.is_enabled ? 'var(--muted)' : '#0C0B0A', borderRadius: 7, padding: '10px 14px', cursor: calling || !selected.is_enabled ? 'default' : 'pointer', fontWeight: 600 }}
                  >
                    <Icon d={Icons.arrow} size={14} />
                    {calling ? 'Calling…' : selected.is_enabled ? `Call ${endpoint.label}` : 'Enable provider first'}
                  </button>
                </div>
              )}
            </section>

            {result !== null && (
              <section style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg2)', padding: 18 }}>
                <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--font-head)', fontSize: 16 }}>Result</h3>
                <pre style={{ margin: 0, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55 }}>{JSON.stringify(result, null, 2)}</pre>
              </section>
            )}

            <RecentList recent={recent} />
          </main>
        </div>
      </div>
    )
  }

  // ─── Grid view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px 40px', width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ color: 'var(--accent)' }}><Icon d={Icons.marketplace} size={18} /></span>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, margin: 0, color: 'var(--text)' }}>Marketplace</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, maxWidth: 720, lineHeight: 1.6 }}>
          MPP-enabled services on Stellar mainnet. Enable a service to let your agents call any of its endpoints with an API key. Click a service for its endpoints and a call interface.
        </p>
      </header>

      <div style={{ position: 'relative', marginBottom: 18 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search services by name, description, category, or endpoint…"
          style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 14px 11px 38px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
        />
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>⌕</span>
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
        {loading ? 'loading…' : `${filtered.length} of ${providers.length} services`}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading marketplace…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>No services match &ldquo;{search}&rdquo;.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(p => (
            <ProviderCard key={p.id} provider={p} toggling={togglingId === p.id} onToggle={() => void toggleProvider(p)} onOpen={() => openProvider(p)} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <RecentList recent={recent} />
      </div>
    </div>
  )
}

// ─── Provider card ───────────────────────────────────────────────────────────

function ProviderCard({ provider, toggling, onToggle, onOpen }: { provider: MarketplaceService; toggling: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{ background: 'var(--bg2)', border: `1px solid ${provider.is_enabled ? 'rgba(54,179,126,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 156, transition: 'border-color 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = provider.is_enabled ? 'rgba(54,179,126,0.3)' : 'var(--border)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{provider.display_price}</div>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <Switch enabled={provider.is_enabled} loading={toggling} onClick={onToggle} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flex: 1 }}>{provider.description}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {provider.categories.slice(0, 3).map(c => (
          <span key={c} style={{ fontSize: 10, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>{c}</span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{provider.endpoint_count} ep</span>
      </div>
    </div>
  )
}

// ─── Switch toggle ───────────────────────────────────────────────────────────

function Switch({ enabled, loading, onClick }: { enabled: boolean; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      disabled={loading}
      aria-label={enabled ? 'Disable service' : 'Enable service'}
      style={{ position: 'relative', width: 36, height: 20, borderRadius: 999, border: 'none', background: enabled ? 'var(--success)' : 'var(--bg3)', cursor: loading ? 'wait' : 'pointer', padding: 0, transition: 'background-color 0.15s', opacity: loading ? 0.6 : 1, flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

// ─── Recent calls ────────────────────────────────────────────────────────────

function RecentList({ recent }: { recent: Transaction[] }) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg2)', padding: 18 }}>
      <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--font-head)', fontSize: 16 }}>Recent marketplace calls</h3>
      {recent.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No marketplace transactions yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {recent.map(tx => (
            <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8, color: 'var(--text2)', fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.serviceId ?? tx.id}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tx.costPaid ?? tx.amount} USDC</span>
              <span style={{ color: tx.status === 'SUCCESS' ? 'var(--success)' : tx.status === 'FAILED' || tx.status === 'BLOCKED' ? 'var(--error)' : 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{tx.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
