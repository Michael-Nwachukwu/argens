'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Logo } from '@/components/ui/Logo'

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
  pending:    '#6B7FAF',
  pendingLow: 'rgba(107,127,175,0.12)',
  warning:    '#B8832A',
}

interface Endpoint {
  id: string
  label: string
  method: string
  path: string
  description: string
  price: string
  example_payload: Record<string, unknown> | null
}

interface Provider {
  id: string
  name: string
  description: string
  categories: string[]
  display_price: string
  status: 'active' | 'limited'
  docs_url: string | null
  endpoint_count: number
  endpoints: Endpoint[]
}

const CATEGORIES = ['All', 'Search', 'Vision', 'AI Models', 'Compute', 'Comms', 'Data', 'Tools']

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Search:      { bg: t.successLow, color: t.success },
  Vision:      { bg: t.pendingLow, color: t.pending },
  'AI Models': { bg: t.accentLow,  color: t.accent  },
  Compute:     { bg: t.pendingLow, color: t.pending  },
  Comms:       { bg: t.accentLow,  color: t.accent   },
  Data:        { bg: t.successLow, color: t.success  },
  Tools:       { bg: 'rgba(112,107,101,0.15)', color: t.muted },
}

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: t.bg3, color: t.muted }
}

function avatarColor(name: string): string {
  const colors = ['#C5A253', '#4D9B6A', '#6B7FAF', '#B8832A', '#A04848', '#7B6FA0', '#3D8F8F']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]!
}

function ProviderAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const color = avatarColor(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: 9,
      background: `${color}18`, border: `1px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: size * 0.42, color }}>{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

// ─── Provider Row ─────────────────────────────────────────────────────────────
function ProviderRow({ provider }: { provider: Provider }) {
  const [expanded, setExpanded] = useState(false)
  const [activeEp, setActiveEp] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const active = provider.endpoints.find(e => e.id === activeEp) ?? null
  const primaryCat = provider.categories[0] ?? 'Tools'

  const handleCopy = () => {
    if (!active?.example_payload) return
    navigator.clipboard?.writeText(JSON.stringify(active.example_payload, null, 2)).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }

  const toggle = () => {
    setExpanded(e => !e)
    if (expanded) setActiveEp(null)
  }

  return (
    <div style={{ borderBottom: `1px solid ${t.border}` }}>

      {/* Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        className="svc-row"
        style={{ cursor: 'pointer', background: expanded ? t.bg2 : 'transparent', transition: 'background 0.12s' }}
      >
        <div className="svc-row-inner" style={{ display: 'grid', gridTemplateColumns: '44px 220px 1fr 150px 40px', gap: 20, padding: '13px 20px', alignItems: 'center' }}>

          <ProviderAvatar name={provider.name} size={36} />

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {provider.name}
              </span>
              {provider.status === 'limited' && (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: t.warning, background: 'rgba(184,131,42,0.12)', padding: '1px 5px', borderRadius: 3, flexShrink: 0, border: '1px solid rgba(184,131,42,0.2)' }}>limited</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ ...categoryColor(primaryCat), fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '1px 6px', borderRadius: 3 }}>{primaryCat}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint }}>{provider.endpoint_count} ep{provider.endpoint_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <span className="svc-col-desc" style={{ fontSize: 13, color: t.muted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block' }}>
            {provider.description}
          </span>

          <span className="svc-col-price" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.text2, textAlign: 'right' as const, display: 'block', whiteSpace: 'nowrap' as const }}>
            {provider.display_price}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke={expanded ? t.accent : t.faint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
              <path d="M2 5l5 5 5-5"/>
            </svg>
          </div>

        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ display: 'flex', borderTop: `1px solid ${t.border}`, background: t.bg2, minHeight: 180, maxHeight: 360, overflow: 'hidden' }}>

          {/* Endpoint list */}
          <div style={{ width: 240, borderRight: `1px solid ${t.border}`, flexShrink: 0, overflowY: 'auto' }} className="svc-ep-list">
            <div style={{ padding: '10px 16px 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' as const, position: 'sticky', top: 0, background: t.bg2 }}>
              Endpoints
            </div>
            {provider.endpoints.map((ep) => (
              <button
                key={ep.id}
                onClick={(e) => { e.stopPropagation(); setActiveEp(activeEp === ep.id ? null : ep.id) }}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px 8px 16px',
                  background: activeEp === ep.id ? t.bg3 : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left' as const, gap: 8,
                  borderLeft: `2px solid ${activeEp === ep.id ? t.accent : 'transparent'}`,
                  transition: 'all 0.1s',
                }}
              >
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: activeEp === ep.id ? t.text : t.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{ep.label}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.muted, flexShrink: 0 }}>{ep.price}</span>
              </button>
            ))}
          </div>

          {/* Right panel */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
            {active && activeEp ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#3A3733', flexShrink: 0 }}/>)}
                    <span style={{ marginLeft: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      POST /v1/marketplace/call · {active.id}
                    </span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleCopy() }} style={{ background: copied ? t.successLow : 'transparent', border: `1px solid ${copied ? 'rgba(77,155,106,0.3)' : t.border}`, color: copied ? t.success : t.faint, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}>
                    {copied ? '✓ copied' : 'copy'}
                  </button>
                </div>
                <pre style={{ flex: 1, margin: 0, padding: '12px 16px', fontSize: 11, lineHeight: 1.7, fontFamily: 'JetBrains Mono, monospace', overflowY: 'auto', overflowX: 'auto', color: t.text2 }}>
                  <code>{active.example_payload
                    ? JSON.stringify({ service_id: active.id, payload: active.example_payload }, null, 2)
                    : `{\n  "service_id": "${active.id}",\n  "payload": {}\n}`}
                  </code>
                </pre>
              </>
            ) : (
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.65, margin: 0, maxWidth: 520 }}>{provider.description}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {provider.categories.map(c => {
                    const cc = categoryColor(c)
                    return <span key={c} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, background: cc.bg, color: cc.color, padding: '2px 8px', borderRadius: 4 }}>{c}</span>
                  })}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.faint }}>← select an endpoint to preview its call payload</div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <a href="/signup" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 12, color: t.bg, background: t.accent, padding: '7px 16px', borderRadius: 5, textDecoration: 'none' }}>Create account</a>
                  <a href="/dashboard/marketplace" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: t.text2, border: `1px solid ${t.border2}`, padding: '7px 14px', borderRadius: 5, textDecoration: 'none' }}>Dashboard →</a>
                  {provider.docs_url && (
                    <a href={provider.docs_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: t.muted, textDecoration: 'none' }}>Docs ↗</a>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton row ─────────────────────────────────────────────────────
function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 220px 1fr 150px 40px', gap: 20, padding: '13px 20px', alignItems: 'center', borderBottom: `1px solid ${t.border}` }} className="svc-row-inner">
      <div style={{ width: 36, height: 36, borderRadius: 9, background: t.bg3, animation: `pulse 1.5s ${delay}s infinite` }}/>
      <div>
        <div style={{ width: 100, height: 13, borderRadius: 4, background: t.bg3, marginBottom: 7, animation: `pulse 1.5s ${delay}s infinite` }}/>
        <div style={{ width: 60, height: 10, borderRadius: 4, background: t.bg3, animation: `pulse 1.5s ${delay + 0.1}s infinite` }}/>
      </div>
      <div style={{ width: '70%', height: 12, borderRadius: 4, background: t.bg3, animation: `pulse 1.5s ${delay}s infinite` }} className="svc-col-desc"/>
      <div style={{ width: 80, height: 11, borderRadius: 4, background: t.bg3, marginLeft: 'auto', animation: `pulse 1.5s ${delay}s infinite` }} className="svc-col-price"/>
      <div style={{ width: 14, height: 14, borderRadius: 3, background: t.bg3, animation: `pulse 1.5s ${delay}s infinite` }}/>
    </div>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function ServicesNav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(16px,4vw,40px)', height: 58,
      background: 'rgba(12,11,10,0.9)', backdropFilter: 'blur(18px) saturate(130%)',
      borderBottom: `1px solid ${scrolled ? t.border : 'transparent'}`,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Logo />
        <div style={{ display: 'flex', gap: 24 }} className="svc-nav-links">
          {([['/', 'Home'], ['/services', 'Services'], ['/docs', 'Docs']] as [string,string][]).map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 13, color: href === '/services' ? t.accent : t.muted, textDecoration: 'none' }}>{label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="/login" style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>Sign in</a>
        <a href="/signup" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13, color: t.bg, background: t.accent, padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
          Get started
        </a>
      </div>
    </nav>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    fetch('/api/marketplace')
      .then(r => r.json())
      .then(d => { setProviders(d.providers ?? []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    let list = providers
    if (category !== 'All') {
      const catLower = category.toLowerCase()
      list = list.filter(p =>
        p.categories.some(c => c.toLowerCase() === catLower || c.toLowerCase().includes(catLower))
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categories.some(c => c.toLowerCase().includes(q))
      )
    }
    return list
  }, [providers, category, search])

  return (
    <>
      <style>{`
        @keyframes pulse    { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        a:hover { opacity:0.82; }

        .svc-row:hover { background: rgba(255,255,255,0.015) !important; }

        /* Column visibility */
        .svc-col-desc, .svc-col-price { display: block; }

        /* Tablet: hide price */
        @media (max-width: 900px) {
          .svc-row-inner  { grid-template-columns: 44px 200px 1fr 40px !important; }
          .svc-th-inner   { grid-template-columns: 44px 200px 1fr 40px !important; }
          .svc-col-price  { display: none !important; }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .svc-row-inner  { grid-template-columns: 36px 1fr 36px !important; gap: 12px !important; padding: 12px 16px !important; }
          .svc-th-inner   { display: none !important; }
          .svc-col-desc   { display: none !important; }
          .svc-col-price  { display: none !important; }
          .svc-nav-links  { display: none !important; }
          .svc-ep-list    { width: 180px !important; }
        }
      `}</style>

      <ServicesNav />

      <div style={{ background: t.bg, minHeight: '100vh', paddingTop: 58, overflowX: 'hidden' }}>

        {/* Hero */}
        <section style={{ position: 'relative', padding: 'clamp(48px,7vw,88px) clamp(16px,4vw,40px) 44px', textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 350, background: 'radial-gradient(ellipse at 50% 0%, rgba(197,162,83,0.09) 0%, transparent 65%)', pointerEvents: 'none' }}/>
          <div style={{ animation: 'fadeInUp 0.5s ease-out both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, background: t.accentLow, border: `1px solid ${t.accentMid}`, padding: '4px 14px', borderRadius: 20, marginBottom: 22 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, animation: 'pulse 2s infinite' }}/>
              Mainnet live · {loading ? '…' : `${providers.length} providers`}
            </div>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 'clamp(28px,5vw,54px)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 14, color: t.text }}>
              80+ AI services. One API key.
            </h1>
            <p style={{ fontSize: 16, color: t.text2, lineHeight: 1.75, maxWidth: 500, margin: '0 auto 32px' }}>
              Every service is callable via <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: t.text }}>POST /marketplace/call</span>. Argens handles auth, payment, and logging.
            </p>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke={t.text2} strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="6.5" cy="6.5" r="5.5"/><path d="M11 11l3 3"/>
                </svg>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search services, categories…"
                  style={{ width: '100%', boxSizing: 'border-box', background: t.bg2, border: `1px solid ${t.border2}`, borderRadius: 8, padding: '11px 14px 11px 38px', fontSize: 14, color: t.text, fontFamily: 'Inter, sans-serif', outline: 'none' }}
                  onFocus={e => (e.target.style.borderColor = t.accentMid)}
                  onBlur={e => (e.target.style.borderColor = t.border2)}
                />
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' as const, marginTop: 16 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: '5px 15px', borderRadius: 20, border: '1px solid',
                borderColor: category === cat ? t.accentMid : t.border,
                background: category === cat ? t.accentLow : 'transparent',
                color: category === cat ? t.accent : t.muted,
                fontFamily: category === cat ? 'Space Grotesk, sans-serif' : 'Inter, sans-serif',
                fontWeight: category === cat ? 600 : 400,
                fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}>{cat}</button>
            ))}
          </div>
        </section>

        {/* List container */}
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 clamp(12px,3vw,32px) 80px', width: '100%', boxSizing: 'border-box' }}>

          {/* Results bar */}
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 0 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.muted }}>
                {filtered.length} provider{filtered.length !== 1 ? 's' : ''}
                {(search || category !== 'All') && <span style={{ color: t.faint }}> · filtered</span>}
              </span>
              <a href="/signup" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 12, color: t.accent, textDecoration: 'none' }}>
                Create account to enable →
              </a>
            </div>
          )}

          {/* Table */}
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>

            {/* Sticky table header */}
            <div style={{ position: 'sticky', top: 0, background: t.bg2, borderBottom: `1px solid ${t.border}`, zIndex: 10 }}>
              <div className="svc-row-inner svc-th-inner" style={{ display: 'grid', gridTemplateColumns: '44px 220px 1fr 150px 40px', gap: 20, padding: '9px 20px', alignItems: 'center' }}>
                <div/>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Provider</div>
                <div className="svc-col-desc" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Description</div>
                <div className="svc-col-price" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' as const, textAlign: 'right' as const }}>Pricing</div>
                <div/>
              </div>
            </div>

            {/* Rows */}
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} delay={i * 0.07} />)
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: t.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                Could not load services. The catalog may be temporarily unavailable.
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ color: t.muted, fontSize: 14, fontFamily: 'Inter, sans-serif', marginBottom: 12 }}>
                  {search ? `No services match "${search}"` : `No services in "${category}"`}
                </div>
                <button onClick={() => { setSearch(''); setCategory('All') }} style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: t.accent, background: 'transparent', border: `1px solid ${t.accentMid}`, padding: '7px 16px', borderRadius: 6, cursor: 'pointer' }}>Clear filters</button>
              </div>
            ) : (
              filtered.map(p => <ProviderRow key={p.id} provider={p} />)
            )}

          </div>
        </div>

        {/* Bottom CTA */}
        {!loading && !error && (
          <div style={{ borderTop: `1px solid ${t.border}`, background: t.bg2 }}>
            <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(48px,7vw,80px) clamp(16px,4vw,40px)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 20 }}>
                One key, every service
              </div>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 'clamp(24px,4vw,42px)', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 16, color: t.text }}>
                Your agent can call all of these.
              </h2>
              <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.75, maxWidth: 500, margin: '0 auto 32px' }}>
                Create an account, fund your Stellar wallet with USDC, set spending limits, and your agent is ready to use every provider on this page — without a single separate API key.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
                <a href="/signup" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, color: t.bg, background: t.accent, padding: '11px 28px', borderRadius: 7, textDecoration: 'none' }}>
                  Create free account
                </a>
                <a href="/docs" style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: t.text2, border: `1px solid ${t.border2}`, padding: '11px 24px', borderRadius: 7, textDecoration: 'none' }}>
                  Read the docs
                </a>
              </div>
              <p style={{ marginTop: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.faint }}>
                Or paste <span style={{ color: t.text2 }}>SKILL.md</span> into any AI agent and it onboards itself.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${t.border}`, padding: '24px clamp(16px,4vw,40px)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 16 }}>
            <Logo />
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const }}>
              {([['/', 'Home'], ['/services', 'Services'], ['/docs', 'Docs'], ['/SKILL.md', 'SKILL.md'], ['/signup', 'Sign up']] as [string,string][]).map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>{label}</a>
              ))}
            </div>
            <div style={{ fontSize: 12, color: t.faint, fontFamily: 'JetBrains Mono, monospace' }}>© 2026 Argens Inc.</div>
          </div>
        </footer>

      </div>
    </>
  )
}
