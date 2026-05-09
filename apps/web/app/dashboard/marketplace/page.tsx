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
}

function isUpstreamErrorDetails(d: unknown): d is UpstreamErrorDetails {
  return typeof d === 'object' && d !== null
}

/**
 * MPP Router service IDs encode path placeholders as `_<name>_id_` segments
 * (e.g. `agentmail_inboxes_inbox_id_messages_send` needs ?inbox_id=…).
 * Returns a map of detected placeholder names with empty string defaults.
 */
function detectPlaceholders(serviceId: string): Record<string, string> {
  if (!serviceId) return {}
  const out: Record<string, string> = {}
  const matches = serviceId.matchAll(/_([a-z]+_id)_/g)
  for (const m of matches) {
    if (m[1]) out[m[1]] = ''
  }
  return out
}

export default function MarketplacePage() {
  const [services, setServices] = useState<MarketplaceService[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [endpointId, setEndpointId] = useState<string | null>(null)
  const [payloadText, setPayloadText] = useState('{}')
  const [queryText, setQueryText] = useState('{}')
  const [showQuery, setShowQuery] = useState(false)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<UpstreamErrorDetails | null>(null)
  const [result, setResult] = useState<unknown>(null)
  const [search, setSearch] = useState('')
  const [endpointCopied, setEndpointCopied] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const [serviceRes, txRes] = await Promise.all([
        marketplace.services(),
        transactions.list({ type: 'marketplace', limit: 8 }),
      ])

      if (!mounted) return

      if (!isError(serviceRes)) setServices(serviceRes.data)
      if (!isError(txRes)) setRecent(txRes.data)
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return services
    return services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.categories.some(c => c.toLowerCase().includes(q)),
    )
  }, [services, search])

  const selected = useMemo(
    () => services.find(service => service.id === selectedId) ?? null,
    [services, selectedId],
  )

  const endpoint = useMemo(
    () => selected?.endpoints.find(item => item.id === endpointId) ?? selected?.endpoints[0] ?? null,
    [selected, endpointId],
  )

  const openService = (service: MarketplaceService) => {
    const firstEndpoint = service.endpoints[0] ?? null
    const placeholders = detectPlaceholders(service.id)
    const hasPlaceholders = Object.keys(placeholders).length > 0
    setSelectedId(service.id)
    setEndpointId(firstEndpoint?.id ?? null)
    setPayloadText(JSON.stringify(firstEndpoint?.example_payload ?? {}, null, 2))
    setQueryText(hasPlaceholders ? JSON.stringify(placeholders, null, 2) : '{}')
    setShowQuery(hasPlaceholders)
    setResult(null)
    setError(null)
    setErrorDetails(null)
  }

  const closeDetail = () => {
    setSelectedId(null)
    setEndpointId(null)
    setResult(null)
    setError(null)
    setErrorDetails(null)
  }

  const selectEndpoint = (next: MarketplaceEndpoint) => {
    setEndpointId(next.id)
    setPayloadText(JSON.stringify(next.example_payload ?? {}, null, 2))
    setResult(null)
    setError(null)
    setErrorDetails(null)
  }

  const placeholderKeys = useMemo(() => Object.keys(detectPlaceholders(selected?.id ?? '')), [selected])

  const callService = async () => {
    if (!selected || !endpoint || !selected.is_enabled) return

    let payload: Record<string, unknown>
    try {
      const parsed = JSON.parse(payloadText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Payload must be a JSON object.')
      }
      payload = parsed as Record<string, unknown>
    } catch (e) {
      setError(`Body JSON: ${(e as Error).message}`)
      setErrorDetails(null)
      return
    }

    let query: Record<string, string | number | boolean> | undefined
    const trimmedQuery = queryText.trim()
    if (trimmedQuery && trimmedQuery !== '{}') {
      try {
        const parsed = JSON.parse(trimmedQuery) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const entries = Object.entries(parsed as Record<string, unknown>)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean)] as const)
          if (entries.length > 0) query = Object.fromEntries(entries)
        }
      } catch (e) {
        setError(`Query JSON: ${(e as Error).message}`)
        setErrorDetails(null)
        return
      }
    }

    setCalling(true)
    setError(null)
    setErrorDetails(null)
    setResult(null)

    const res = await marketplace.call({ service_id: selected.id, payload, ...(query && { query }) })

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

  const toggleService = async (service: MarketplaceService) => {
    setTogglingId(service.id)
    const next = !service.is_enabled
    const res = await marketplace.setEnabled(service.id, next)
    if (!isError(res)) {
      setServices(current => current.map(s =>
        s.id === service.id ? { ...s, is_enabled: res.data.enabled } : s,
      ))
    }
    setTogglingId(null)
  }

  const copyEndpoint = () => {
    if (!selected) return
    navigator.clipboard?.writeText(selected.service_url).catch(() => {})
    setEndpointCopied(true)
    setTimeout(() => setEndpointCopied(false), 1800)
  }

  // ─── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ padding: '28px 32px 40px', width: '100%', maxWidth: 1180, margin: '0 auto' }}>
        <button
          onClick={closeDetail}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--muted)', borderRadius: 6, padding: '6px 11px',
            fontSize: 12, cursor: 'pointer', marginBottom: 18, fontFamily: 'var(--font-mono)',
          }}
        >
          ← back to marketplace
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          {/* Left: service list summary */}
          <section style={{ display: 'grid', gap: 10, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 6 }}>
            {filtered.map(service => {
              const active = service.id === selected.id
              return (
                <button
                  key={service.id}
                  onClick={() => openService(service)}
                  style={{
                    textAlign: 'left',
                    padding: 14,
                    borderRadius: 8,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--bg3)' : 'var(--bg2)',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                    <strong style={{ fontSize: 13 }}>{service.name}</strong>
                    <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{service.display_price}</span>
                  </div>
                </button>
              )
            })}
          </section>

          <main style={{ display: 'grid', gap: 16 }}>
            <section style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: 20, color: 'var(--text)' }}>{selected.name}</h2>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {selected.description}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{selected.display_price}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>20% Argens markup</span>
                    {selected.docs_url && (
                      <>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>·</span>
                        <a href={selected.docs_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
                          docs ↗
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <Switch
                  enabled={selected.is_enabled}
                  loading={togglingId === selected.id}
                  onClick={() => void toggleService(selected)}
                />
              </div>

              {/* Endpoint URL with copy */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Endpoint
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <code style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', overflow: 'auto', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--accent)', marginRight: 8 }}>{endpoint?.method ?? 'POST'}</span>
                    {selected.service_url}
                  </code>
                  <button
                    onClick={copyEndpoint}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg3)',
                      color: endpointCopied ? 'var(--success)' : 'var(--muted)',
                      borderRadius: 6,
                      padding: '0 12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {endpointCopied ? '✓ copied' : 'copy'}
                  </button>
                </div>
              </div>

              {endpoint ? (
                <>
                  {placeholderKeys.length > 0 && (
                    <div style={{ marginBottom: 14, padding: 10, border: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: 7, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      This endpoint requires path parameters as query string values:
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginLeft: 6 }}>
                        {placeholderKeys.map(k => `?${k}=…`).join(' ')}
                      </span>
                    </div>
                  )}

                  {showQuery ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Query parameters (JSON object → ?key=value)
                        </div>
                        {placeholderKeys.length === 0 && (
                          <button
                            onClick={() => { setShowQuery(false); setQueryText('{}') }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                          >
                            remove
                          </button>
                        )}
                      </div>
                      <textarea
                        value={queryText}
                        onChange={e => setQueryText(e.target.value)}
                        spellCheck={false}
                        style={{
                          width: '100%',
                          minHeight: 70,
                          resize: 'vertical',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          borderRadius: 7,
                          padding: 12,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          lineHeight: 1.55,
                          boxSizing: 'border-box',
                          marginBottom: 14,
                        }}
                      />
                    </>
                  ) : (
                    <button
                      onClick={() => setShowQuery(true)}
                      style={{
                        marginBottom: 14,
                        background: 'transparent',
                        border: '1px dashed var(--border)',
                        color: 'var(--muted)',
                        borderRadius: 7,
                        padding: '8px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      + add query parameters (only needed for some services)
                    </button>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Request body (JSON)
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>
                    Refer to the service docs for required body fields. Argens charges your wallet only after the upstream service responds.
                  </p>

                  {!selected.is_enabled && (
                    <div style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg3)',
                      color: 'var(--muted)',
                      borderRadius: 7,
                      padding: 12,
                      fontSize: 13,
                      lineHeight: 1.5,
                      marginBottom: 12,
                    }}>
                      Enable this service before agents can call it with an API key.
                    </div>
                  )}

                  <textarea
                    value={payloadText}
                    onChange={e => setPayloadText(e.target.value)}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minHeight: 220,
                      resize: 'vertical',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 7,
                      padding: 12,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      lineHeight: 1.55,
                      boxSizing: 'border-box',
                    }}
                  />

                  {error && (
                    <div style={{ marginTop: 12, border: '1px solid rgba(160,72,72,0.3)', background: 'rgba(160,72,72,0.10)', borderRadius: 7, padding: 12 }}>
                      <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: errorDetails ? 8 : 0, fontWeight: 500 }}>
                        {error}
                      </div>
                      {errorDetails && Boolean(errorDetails.upstream_status || errorDetails.upstream_body) && (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                            Upstream response{errorDetails.upstream_status ? ` (HTTP ${errorDetails.upstream_status})` : ''}:
                          </div>
                          <pre style={{ margin: 0, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {typeof errorDetails.upstream_body === 'string'
                              ? errorDetails.upstream_body
                              : JSON.stringify(errorDetails.upstream_body, null, 2)}
                          </pre>
                          {errorDetails.transaction_id && (
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                              Transaction logged: {errorDetails.transaction_id}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <button
                    onClick={callService}
                    disabled={calling || !selected.is_enabled}
                    style={{
                      marginTop: 14,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      border: '1px solid var(--accent)',
                      background: calling || !selected.is_enabled ? 'var(--bg3)' : 'var(--accent)',
                      color: calling || !selected.is_enabled ? 'var(--muted)' : '#0C0B0A',
                      borderRadius: 7,
                      padding: '10px 14px',
                      cursor: calling || !selected.is_enabled ? 'default' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <Icon d={Icons.arrow} size={14} />
                    {calling ? 'Calling…' : selected.is_enabled ? 'Call service' : 'Enable service first'}
                  </button>
                </>
              ) : null}
            </section>

            {result !== null && (
              <section style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', padding: 18 }}>
                <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-head)', fontSize: 16 }}>Result</h2>
                <pre style={{
                  margin: 0,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.55,
                }}>{JSON.stringify(result, null, 2)}</pre>
              </section>
            )}

            <RecentList recent={recent} />
          </main>
        </div>
      </div>
    )
  }

  // ─── Grid view (default) ───────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px 40px', width: '100%', maxWidth: 1180, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ color: 'var(--accent)' }}><Icon d={Icons.marketplace} size={18} /></span>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, margin: 0, color: 'var(--text)' }}>
            Marketplace
          </h1>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, maxWidth: 700, lineHeight: 1.6 }}>
          MPP-enabled services on Stellar mainnet. Toggle a service to allow agents to call it. Click a service for the call interface.
        </p>
      </header>

      <div style={{ position: 'relative', marginBottom: 18 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search services by name, ID, description, or category…"
          style={{
            width: '100%',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '11px 14px 11px 38px',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>⌕</span>
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          {loading ? 'loading…' : `${filtered.length} of ${services.length} services`}
        </span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading marketplace…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
          No services match "{search}".
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              toggling={togglingId === service.id}
              onToggle={() => void toggleService(service)}
              onOpen={() => openService(service)}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <RecentList recent={recent} />
      </div>
    </div>
  )
}

// ─── Service card ────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  toggling,
  onToggle,
  onOpen,
}: {
  service: MarketplaceService
  toggling: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${service.is_enabled ? 'rgba(54,179,126,0.3)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: 16,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 156,
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = service.is_enabled ? 'rgba(54,179,126,0.3)' : 'var(--border)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {service.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {service.display_price}
          </div>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <Switch enabled={service.is_enabled} loading={toggling} onClick={onToggle} />
        </div>
      </div>
      <p style={{
        margin: 0,
        fontSize: 12,
        color: 'var(--muted)',
        lineHeight: 1.5,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        flex: 1,
      }}>
        {service.description}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {service.categories.slice(0, 3).map(category => (
          <span key={category} style={{
            fontSize: 10,
            color: 'var(--text2)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '2px 7px',
            fontFamily: 'var(--font-mono)',
          }}>{category}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Switch toggle ───────────────────────────────────────────────────────────

function Switch({ enabled, loading, onClick }: { enabled: boolean; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={loading}
      aria-label={enabled ? 'Disable service' : 'Enable service'}
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        borderRadius: 999,
        border: 'none',
        background: enabled ? 'var(--success)' : 'var(--bg3)',
        cursor: loading ? 'wait' : 'pointer',
        padding: 0,
        transition: 'background-color 0.15s',
        opacity: loading ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: enabled ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

// ─── Recent calls ────────────────────────────────────────────────────────────

function RecentList({ recent }: { recent: Transaction[] }) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', padding: 18 }}>
      <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-head)', fontSize: 16 }}>Recent marketplace calls</h2>
      {recent.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No marketplace transactions yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {recent.map(tx => (
            <div key={tx.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: 12,
              alignItems: 'center',
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
              color: 'var(--text2)',
              fontSize: 13,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.serviceId ?? tx.id}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tx.costPaid ?? tx.amount} USDC</span>
              <span style={{
                color: tx.status === 'SUCCESS' ? 'var(--success)'
                  : tx.status === 'FAILED' || tx.status === 'BLOCKED' ? 'var(--error)'
                  : 'var(--muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}>{tx.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
