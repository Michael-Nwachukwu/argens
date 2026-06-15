'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Logo } from '@/components/ui/Logo'

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  successMid: 'rgba(77,155,106,0.25)',
  error:      '#A04848',
  errorLow:   'rgba(160,72,72,0.12)',
  pending:    '#6B7FAF',
  pendingLow: 'rgba(107,127,175,0.12)',
  pendingMid: 'rgba(107,127,175,0.25)',
  warning:    '#B8832A',
  warningLow: 'rgba(184,131,42,0.12)',
}

const SECTIONS = [
  { id: 'overview',        label: 'Overview'         },
  { id: 'quickstart',      label: 'Quickstart'       },
  { id: 'authentication',  label: 'Authentication'   },
  { id: 'payments',        label: 'Payments'         },
  { id: 'policies',        label: 'Policy Engine'    },
  { id: 'approvals',       label: 'Approvals'        },
  { id: 'marketplace',     label: 'Marketplace'      },
  { id: 'discoverability', label: 'Discoverability'  },
  { id: 'responses',       label: 'Response Shapes'  },
  { id: 'errors',          label: 'Error Codes'      },
  { id: 'limits',          label: 'Limits & Security'},
]

// ─── FadeUp ───────────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setV(true); obs.disconnect() }
    }, { threshold: 0.06 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(22px)', transition: `opacity 0.65s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.65s ${delay}s cubic-bezier(0.16,1,0.3,1)` }}>
      {children}
    </div>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function DocsNav() {
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
      background: 'rgba(12,11,10,0.9)',
      backdropFilter: 'blur(18px) saturate(130%)',
      borderBottom: `1px solid ${scrolled ? t.border : 'transparent'}`,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted }}>
          <span style={{ color: t.faint }}>/</span>
          <span style={{ color: t.accent }}>docs</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <a href="/SKILL.md" style={{ fontSize: 13, color: t.muted, textDecoration: 'none', fontFamily: 'JetBrains Mono, monospace' }}>SKILL.md</a>
        <a href="/llms.txt" style={{ fontSize: 13, color: t.muted, textDecoration: 'none', fontFamily: 'JetBrains Mono, monospace' }}>llms.txt</a>
        <a href="/signup" style={{ fontSize: 13, fontWeight: 600, color: t.bg, background: t.accent, padding: '7px 16px', borderRadius: 6, textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}>
          Get started
        </a>
      </div>
    </nav>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ active }: { active: string }) {
  return (
    <aside className="docs-sidebar" style={{ borderRight: `1px solid ${t.border}` }}>
      <nav style={{
        position: 'sticky',
        top: 58,
        maxHeight: 'calc(100vh - 58px)',
        overflowY: 'auto',
        padding: '32px 0 32px 0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16, paddingLeft: 24 }}>
          On this page
        </div>
        <div style={{ flex: 1 }}>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} style={{
              display: 'block',
              padding: '7px 24px',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fontWeight: active === s.id ? 500 : 400,
              color: active === s.id ? t.accent : t.text2,
              background: active === s.id ? t.accentLow : 'transparent',
              borderLeft: `2px solid ${active === s.id ? t.accent : 'transparent'}`,
              textDecoration: 'none',
              transition: 'all 0.15s',
              lineHeight: 1.5,
            }}>
              {s.label}
            </a>
          ))}
        </div>
        <div style={{ marginTop: 28, padding: '0 16px' }}>
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12, color: t.text, marginBottom: 8 }}>Quick onboard</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.text2, lineHeight: 1.6, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 5, padding: '8px 10px', wordBreak: 'break-all' }}>
              Hi, read https://argens.xyz/SKILL.md and continue with the onboarding steps.
            </div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 8, lineHeight: 1.5 }}>Paste into any AI agent. It onboards itself.</div>
          </div>
        </div>
      </nav>
    </aside>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.87em',
      background: t.bg3, color: t.text, border: `1px solid ${t.border}`,
      padding: '1px 6px', borderRadius: 4, lineHeight: 1,
    }}>{children}</code>
  )
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ color: t.accent, fontWeight: 600 }}>{children}</span>
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <div style={{ width: 8, height: 8, background: t.accent, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>{children}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 18, color: t.text }}>
      {children}
    </h2>
  )
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 16, color: t.text2, lineHeight: 1.8, maxWidth: 680 }}>{children}</p>
}

function syntaxHighlight(code: string): React.ReactNode {
  return code.split('\n').map((line, lineIdx, arr) => {
    const isLast = lineIdx === arr.length - 1
    // Comment lines
    if (/^\s*(#|\/\/)/.test(line)) {
      return (
        <React.Fragment key={lineIdx}>
          <span style={{ color: t.muted, fontStyle: 'italic' }}>{line}</span>
          {!isLast && '\n'}
        </React.Fragment>
      )
    }
    // Tokenize non-comment lines
    const tokens: React.ReactNode[] = []
    let rest = line
    let idx = 0
    while (rest.length > 0) {
      let m: RegExpMatchArray | null
      // JSON key: "key":
      m = rest.match(/^("[\w\s._/-]+")(\s*:)/)
      if (m) { tokens.push(<span key={idx++} style={{ color: t.accent }}>{m[1]}</span>, <span key={idx++} style={{ color: t.text2 }}>{m[2]}</span>); rest = rest.slice(m[0].length); continue }
      // URL
      m = rest.match(/^https?:\/\/[^\s\\,'"{}()]+/)
      if (m) { tokens.push(<span key={idx++} style={{ color: '#7DB88A' }}>{m[0]}</span>); rest = rest.slice(m[0].length); continue }
      // String value
      m = rest.match(/^"[^"]*"/)
      if (m) { tokens.push(<span key={idx++} style={{ color: '#7DB88A' }}>{m[0]}</span>); rest = rest.slice(m[0].length); continue }
      // Boolean / null
      m = rest.match(/^(true|false|null)(?=[\s,}\])]|$)/)
      if (m) { tokens.push(<span key={idx++} style={{ color: '#E09050' }}>{m[0]}</span>); rest = rest.slice(m[0].length); continue }
      // Number
      m = rest.match(/^-?\d+(\.\d+)?(?=[\s,}\])]|$)/)
      if (m) { tokens.push(<span key={idx++} style={{ color: '#A08BC8' }}>{m[0]}</span>); rest = rest.slice(m[0].length); continue }
      // Arrow →
      if (rest[0] === '→') { tokens.push(<span key={idx++} style={{ color: t.accent }}>→</span>); rest = rest.slice(1); continue }
      // HTTP method / shell command at token boundary
      m = rest.match(/^(curl|GET|POST|PUT|DELETE|PATCH|export)(?=\s|$)/)
      if (m) { tokens.push(<span key={idx++} style={{ color: t.accent, fontWeight: 600 }}>{m[0]}</span>); rest = rest.slice(m[0].length); continue }
      // env var $FOO
      m = rest.match(/^\$[A-Z_][A-Z_0-9]*/)
      if (m) { tokens.push(<span key={idx++} style={{ color: '#A08BC8' }}>{m[0]}</span>); rest = rest.slice(m[0].length); continue }
      tokens.push(rest[0]); rest = rest.slice(1)
    }
    return (
      <React.Fragment key={lineIdx}>
        {tokens}
        {!isLast && '\n'}
      </React.Fragment>
    )
  })
}

function TerminalBlock({ file, tag, children }: { file?: string; tag?: React.ReactNode; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  const handleCopy = () => {
    const text = codeRef.current?.textContent ?? ''
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const highlighted = typeof children === 'string' ? syntaxHighlight(children) : children

  return (
    <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: '#3A3733' }}/>)}
          {file && <span style={{ marginLeft: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted }}>{file}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tag}
          <button onClick={handleCopy} style={{ background: copied ? t.successLow : 'transparent', border: `1px solid ${copied ? t.successMid : t.border}`, color: copied ? t.success : t.faint, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s' }}>
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>
      </div>
      <pre ref={codeRef} style={{ margin: 0, padding: '16px 18px', fontSize: 12.5, lineHeight: 1.75, fontFamily: 'JetBrains Mono, monospace', overflowX: 'auto', color: t.text2 }}>
        <code>{highlighted}</code>
      </pre>
    </div>
  )
}

function SchemaTable({ rows }: { rows: { key: string; type?: string; desc: string }[] }) {
  return (
    <div style={{ overflow: 'hidden', borderRadius: 8, border: `1px solid ${t.border}`, marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 90px 1fr', background: t.bg2, padding: '8px 16px', borderBottom: `1px solid ${t.border}` }}>
        {['Field', 'Type', 'Description'].map(h => (
          <span key={h} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{h}</span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '200px 90px 1fr', padding: '10px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${t.border}` : 'none', alignItems: 'start', background: t.bg }}>
          <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.accent }}>{r.key}</code>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted, paddingTop: 1 }}>{r.type ?? ''}</span>
          <span style={{ fontSize: 13, color: t.text2, lineHeight: 1.6 }}>{r.desc}</span>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: 'confirmed' | 'blocked' | 'pending' | 'failed' | 'live' }) {
  const map = {
    confirmed: { bg: t.successLow, color: t.success, dot: t.success,    label: 'CONFIRMED' },
    blocked:   { bg: t.errorLow,   color: t.error,   dot: t.error,      label: 'BLOCKED'   },
    pending:   { bg: t.pendingLow, color: t.pending,  dot: t.pending,   label: 'PENDING'   },
    failed:    { bg: t.errorLow,   color: t.error,   dot: t.error,      label: 'FAILED'    },
    live:      { bg: t.successLow, color: t.success,  dot: t.success,   label: 'LIVE'      },
  }
  const s = map[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.color, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }}/>
      {s.label}
    </span>
  )
}

function InfoCard({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: t.bg2,
      border: `1px solid ${accent ? t.accentMid : t.border}`,
      borderRadius: 10, padding: 20,
      ...(accent ? { boxShadow: `0 0 0 1px ${t.accentLow}` } : {}),
    }}>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: accent ? t.accent : t.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

function Callout({ type, children }: { type: 'tip' | 'warning' | 'error'; children: React.ReactNode }) {
  const map = {
    tip:     { bg: t.successLow, border: t.successMid, color: t.success,  icon: '✓' },
    warning: { bg: t.warningLow, border: 'rgba(184,131,42,0.3)', color: t.warning, icon: '⚠' },
    error:   { bg: t.errorLow,   border: 'rgba(160,72,72,0.3)', color: t.error,   icon: '✕' },
  }
  const s = map[type]
  return (
    <div style={{ display: 'flex', gap: 12, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '12px 16px', marginTop: 16 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 13, color: s.color, flexShrink: 0, lineHeight: 1.7 }}>{s.icon}</span>
      <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: t.border, margin: '40px 0' }} />
}

// ─── Section components ────────────────────────────────────────────────────────

function OverviewSection() {
  return (
    <section id="overview" style={{ position: 'relative', paddingTop: 16, paddingBottom: 52, borderBottom: `1px solid ${t.border}` }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: 0, right: '-10%', width: '55%', height: '90%', background: 'radial-gradient(ellipse at 80% 20%, rgba(197,162,83,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <FadeUp>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, background: t.accentLow, border: `1px solid ${t.accentMid}`, padding: '4px 12px', borderRadius: 20, marginBottom: 28, letterSpacing: '0.04em' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, animation: 'glow 2s infinite alternate' }}/>
          Live on Stellar mainnet · v1 API
        </div>
        <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 'clamp(30px,4.5vw,56px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20, color: t.text }}>
          Argens API Documentation
        </h1>
        <p style={{ fontSize: 17, color: t.text2, lineHeight: 1.8, maxWidth: 660, marginBottom: 32 }}>
          <Accent>Argens</Accent> is a programmable payment infrastructure for AI agents. One API key gives your agent a USDC wallet on Stellar, three human-defined spending rules, cross-chain settlement to Base via CCTP V2, and access to a paid marketplace of 80+ AI services — all without blockchain knowledge.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
          <a href="#quickstart" style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: t.bg, background: t.accent, padding: '10px 22px', borderRadius: 7, textDecoration: 'none' }}>
            Start here →
          </a>
          <a href="/SKILL.md" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: t.text2, border: `1px solid ${t.border2}`, padding: '10px 20px', borderRadius: 7, textDecoration: 'none' }}>
            Read SKILL.md
          </a>
          <a href="/signup" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: t.muted, border: `1px solid ${t.border}`, padding: '10px 20px', borderRadius: 7, textDecoration: 'none' }}>
            Create account
          </a>
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: t.border, borderRadius: 10, overflow: 'hidden', marginTop: 48 }} className="docs-stats-grid">
          {[
            { v: 'USDC',    l: 'only asset in V1'           },
            { v: '80+',     l: 'marketplace providers'      },
            { v: 'Stellar', l: '+ Base via CCTP V2'         },
            { v: '24h',     l: 'approval window for pauses' },
          ].map((s, i) => (
            <div key={i} style={{ background: t.bg2, padding: '20px 24px' }}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 22, color: t.accent, marginBottom: 4 }}>{s.v}</div>
              <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.5 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FadeUp>
    </section>
  )
}

function QuickstartSection() {
  const steps = [
    {
      num: '01',
      title: 'Create an account',
      desc: 'Sign up at argens.xyz. You\'ll receive a verification email. Argens automatically creates and funds a Stellar wallet with USDC trustline on signup — 2 XLM absorbed on your behalf, nothing to configure.',
      code: `# After email verification, your wallet is live
GET /v1/wallet/balance
→ { "balance": "0.0000000", "wallet_address": "GXXX...", "currency": "USDC" }`,
    },
    {
      num: '02',
      title: 'Fund your wallet',
      desc: 'Send USDC to your Stellar wallet address. Use any Stellar-compatible wallet (Lobstr, StellarX, your exchange\'s Stellar withdrawal). Argens detects the deposit and emails you a confirmation.',
      code: `# Your Stellar deposit address (shown in dashboard)
GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Minimum deposit: there is no minimum.
# Argens absorbs XLM fees for all outgoing transactions.`,
    },
    {
      num: '03',
      title: 'Set spending policies',
      desc: 'Configure three rules in the dashboard: a monthly allowance (total spend cap), a per-transaction maximum (blocks any single large payment), and an approval threshold (pauses payments above a certain size for your review).',
      code: `# Policy check order — enforced on every /pay call
1. max_transaction_limit  →  per-payment cap, checked first
2. allowance_limit        →  monthly running total
3. approval_threshold     →  pause-for-review above this amount`,
    },
    {
      num: '04',
      title: 'Generate an API key',
      desc: 'Go to the API Keys page. Your key has the prefix argns_live_ and is shown once. Argens stores only a bcrypt hash — if you lose it, regenerate. Give the key to your agent as an environment variable.',
      code: `# Set the key in your agent's environment
export ARGENS_KEY="argns_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Verify it's active
curl https://api.argens.xyz/v1/agent/status \\
  -H "Authorization: Bearer $ARGENS_KEY"`,
    },
    {
      num: '05',
      title: 'Make your first payment',
      desc: 'Call POST /pay with a Stellar G... address for a direct Stellar payment, or a 0x... EVM address for a cross-chain USDC transfer to Base via CCTP V2. No additional configuration needed.',
      code: `curl -X POST https://api.argens.xyz/v1/pay \\
  -H "Authorization: Bearer $ARGENS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "amount": "5.0000000",
    "currency": "USDC",
    "memo": "hello from my agent"
  }'`,
    },
  ]

  return (
    <section id="quickstart" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Getting started</SectionLabel>
        <SectionHeading>Quickstart — zero to live in five steps.</SectionHeading>
        <Lead>No blockchain knowledge required. No SDK to install. Your agent needs nothing but an API key.</Lead>
      </FadeUp>

      <div style={{ marginTop: 40 }}>
        {steps.map((s, i) => (
          <FadeUp key={s.num} delay={i * 0.05}>
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr minmax(0,420px)', gap: 36, padding: '36px 0', borderTop: `1px solid ${t.border}` }} className="docs-step-row">
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.accent, paddingTop: 3, letterSpacing: '0.04em' }}>{s.num}</div>
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 18, letterSpacing: '-0.015em', marginBottom: 10, color: t.text }}>{s.title}</div>
                <p style={{ fontSize: 14, color: t.text2, lineHeight: 1.75, maxWidth: 440 }}>{s.desc}</p>
              </div>
              <div className="docs-step-code" style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                <div style={{ padding: '9px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 6 }}>
                  {[0,1,2].map(j => <div key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3A3733' }}/>)}
                </div>
                <pre style={{ margin: 0, padding: '12px 14px', lineHeight: 1.65, color: t.text2, overflowX: 'auto', whiteSpace: 'pre' }}><code>{s.code}</code></pre>
              </div>
            </div>
          </FadeUp>
        ))}
        <div style={{ borderTop: `1px solid ${t.border}` }} />
      </div>
    </section>
  )
}

function AuthSection() {
  return (
    <section id="authentication" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Authentication</SectionLabel>
        <SectionHeading>Two auth paths. Never mix them.</SectionHeading>
        <Lead>Agent routes use API keys. Dashboard routes use the session JWT. They are separate by design — agent spend and human-initiated spend have different trust models.</Lead>
      </FadeUp>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }} className="docs-2col">
        <FadeUp delay={0.05}>
          <InfoCard title="Agent API Key" accent>
            The <Mono>argns_live_…</Mono> key is the only credential an agent needs. Pass it as <Mono>Authorization: Bearer &lt;key&gt;</Mono>. Never expires unless you explicitly regenerate. Access: <Mono>/pay</Mono>, <Mono>/quote</Mono>, <Mono>/agent/status</Mono>, <Mono>/transactions</Mono>, <Mono>/marketplace/call</Mono>, <Mono>/marketplace/services</Mono>.
          </InfoCard>
        </FadeUp>
        <FadeUp delay={0.1}>
          <InfoCard title="Dashboard JWT">
            Issued on login, expires in 1 hour. Used exclusively by the web dashboard. Manual wallet transfers (<Mono>/wallet/send</Mono>) require JWT auth — not callable with an API key. This keeps agent spend and manual transfers on separate audit trails.
          </InfoCard>
        </FadeUp>
      </div>

      <FadeUp delay={0.1}>
        <TerminalBlock file="curl" tag={<StatusBadge status="confirmed" />}>
{`# Agent auth — works for /pay, /quote, /agent/status, /marketplace/*
curl https://api.argens.xyz/v1/agent/status \\
  -H "Authorization: Bearer argns_live_xxxxxxxx"

# → 200
{
  "data": {
    "api_key_status": "active",
    "wallet_balance": "492.5000000",
    "credits_balance": "5.0000000",
    "policies": {
      "allowance_limit": "500.0000000",
      "allowance_remaining": "492.5000000",
      "max_transaction_limit": "50.0000000",
      "approval_threshold": "100.0000000"
    },
    "today_spend": "7.5000000",
    "today_transactions": 3
  }
}`}
        </TerminalBlock>
      </FadeUp>

      <FadeUp delay={0.12}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }} className="docs-3col">
          {[
            { title: 'Never log API keys', desc: 'The key is a credential. Never include it in logs, traces, error messages, or responses. Argens stores only a bcrypt hash — the raw key is unrecoverable after creation.' },
            { title: 'Store in environment', desc: 'Set ARGENS_KEY as an environment variable, not hardcoded. For hosted agents, use the secret manager provided by your cloud platform.' },
            { title: 'Regenerate to rotate', desc: 'The API Keys page lets you regenerate at any time. The old key is immediately revoked. Keep the new key safe — it\'s shown once.' },
          ].map((c, i) => (
            <div key={i} style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 18 }}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, color: t.text, marginBottom: 8 }}>{c.title}</div>
              <p style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.65 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </FadeUp>
    </section>
  )
}

function PaymentsSection() {
  const [tab, setTab] = useState<'stellar' | 'base' | 'quote'>('stellar')
  return (
    <section id="payments" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Payments</SectionLabel>
        <SectionHeading>Send USDC to Stellar or Base in one call.</SectionHeading>
        <Lead>
          <Mono>POST /pay</Mono> auto-detects the destination chain from the recipient address format. A <Mono>G…</Mono> address routes to Stellar directly. A <Mono>0x…</Mono> address routes through Circle CCTP V2 and mints USDC natively on Base. Same endpoint — no <Mono>chain:</Mono> param needed.
        </Lead>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div style={{ display: 'flex', gap: 6, marginTop: 28, marginBottom: 2 }}>
          {[
            { id: 'stellar', label: 'Stellar (direct)' },
            { id: 'base',    label: 'Base via CCTP'    },
            { id: 'quote',   label: 'Quote (dry run)'  },
          ].map(btn => (
            <button key={btn.id} onClick={() => setTab(btn.id as typeof tab)} style={{
              padding: '5px 14px', borderRadius: 20, border: '1px solid',
              borderColor: tab === btn.id ? t.accentMid : t.border,
              background: tab === btn.id ? t.accentLow : 'transparent',
              color: tab === btn.id ? t.accent : t.muted,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
            }}>{btn.label}</button>
          ))}
        </div>

        {tab === 'stellar' && (
          <TerminalBlock file="POST /pay" tag={<StatusBadge status="confirmed" />}>
{`# Request
{
  "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "amount": "25.0000000",
  "currency": "USDC",
  "memo": "optional · max 28 bytes",
  "metadata": {
    "agent_id": "research-agent-01",
    "job_id": "job_abc123"
  }
}

# Response — 200
{
  "data": {
    "status": "success",
    "transaction_id": "cmpn8yh5900011uqz...",
    "stellar_tx_hash": "5d889c269123...",
    "amount": "25.0000000",
    "recipient": "GXXX...",
    "timestamp": "2026-05-27T10:00:00Z",
    "policy_check": {
      "allowance": "passed",
      "max_transaction": "passed",
      "approval_threshold": "passed"
    }
  }
}`}
          </TerminalBlock>
        )}

        {tab === 'base' && (
          <TerminalBlock file="POST /pay" tag={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.pending }}>Base via CCTP · relay in progress</span>}>
{`# Request — same endpoint, just a 0x... address
{
  "recipient": "0x7FBbE68068A3Aa7E479A1E51e792F4C2073b018f",
  "amount": "10.0000000",
  "currency": "USDC"
}

# Response — 200 (returned after Stellar burn; Base relay is async)
{
  "data": {
    "status": "cross_chain_pending",
    "transaction_id": "txn_abc123",
    "stellar_tx_hash": "5d889c269...",
    "destination_chain": "base",
    "message": "USDC burned on Stellar. Mint on Base is in progress.",
    "poll_url": "/v1/transactions/txn_abc123"
  }
}

# Poll GET /v1/transactions/:id until destination_tx_hash appears
{
  "data": {
    "status": "SUCCESS",
    "stellar_tx_hash": "5d889c269...",
    "destination_tx_hash": "0xb086f56e0259...",
    "cross_chain": true,
    "destination_chain": "base"
  }
}`}
          </TerminalBlock>
        )}

        {tab === 'quote' && (
          <TerminalBlock file="POST /quote" tag={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.muted }}>no DB write · no Stellar tx</span>}>
{`# Identical body to /pay — but nothing executes
{
  "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "amount": "75.0000000",
  "currency": "USDC"
}

# → 200 (would succeed)
{
  "data": {
    "status": "would_succeed",
    "amount": "75.0000000",
    "policy_check": {
      "allowance": "would_pass",
      "max_transaction": "would_pass",
      "approval_threshold": "would_pass"
    }
  }
}

# → 200 (would be blocked)
{
  "data": {
    "status": "would_be_blocked",
    "reason": "max_transaction_exceeded",
    "policy": { "max_transaction_limit": "50.0000000", "attempted_amount": "75.0000000" }
  }
}`}
          </TerminalBlock>
        )}
      </FadeUp>

      <FadeUp delay={0.08}>
        <Callout type="warning">
          <strong>Amount format:</strong> all amounts are JSON <strong>strings</strong> with seven decimals — <Mono>"25.0000000"</Mono> not <Mono>25</Mono>. This applies to requests, responses, and polling results. Parsing amounts as numbers introduces float errors.
        </Callout>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16, color: t.text, marginBottom: 16 }}>Request fields</div>
          <SchemaTable rows={[
            { key: 'recipient',  type: 'string',  desc: 'Stellar G… address (56 chars) for direct Stellar payment, or 0x… EVM address (42 chars) for CCTP Base settlement.' },
            { key: 'amount',     type: 'string',  desc: 'USDC amount as a string with 7 decimal places. e.g. "25.0000000". Never a number.' },
            { key: 'currency',   type: 'string',  desc: 'Always "USDC" in V1. Required.' },
            { key: 'memo',       type: 'string?', desc: 'Optional. Max 28 bytes. Included in the Stellar transaction memo field.' },
            { key: 'metadata',   type: 'object?', desc: 'Optional. Any JSON object. Stored on the transaction record for your own reference (agent_id, job_id, etc.).' },
          ]} />
        </div>
      </FadeUp>
    </section>
  )
}

function PoliciesSection() {
  return (
    <section id="policies" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Policy Engine</SectionLabel>
        <SectionHeading>Three rules. Every payment runs through all three.</SectionHeading>
        <Lead>
          Policies are the core of Argens. They run in order — earliest failure wins — on every <Mono>/pay</Mono> call and every marketplace call. There is no way to bypass them from the agent side.
        </Lead>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div style={{ marginTop: 32, background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            Check order — first failure blocks execution immediately
          </div>
          {[
            { n: '01', name: 'Max Transaction', code: 'max_transaction_limit', desc: 'A per-payment hard cap. If the requested amount exceeds this limit, the payment is blocked before the Stellar transaction is even built. No allowance is checked. This runs first so a runaway agent cannot drain your wallet in a single call.' },
            { n: '02', name: 'Monthly Allowance', code: 'allowance_limit', desc: 'The total USDC your agent can spend in the current period. Checked against policy.total_spent. When exhausted, all further payments are blocked until the next reset or you raise the limit.' },
            { n: '03', name: 'Approval Threshold', code: 'approval_threshold', desc: 'Payments at or above this amount are paused, not blocked. Argens emails you a magic link to a dashboard confirmation page. The agent polls /transactions/:id. You approve or reject — the payment executes only on explicit approval.' },
          ].map((r, i) => (
            <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '48px 180px 1fr', gap: 20, padding: '18px 20px', borderBottom: i < 2 ? `1px solid ${t.border}` : 'none', alignItems: 'start' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent }}>{r.n}</div>
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: t.text, marginBottom: 5 }}>{r.name}</div>
                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted }}>{r.code}</code>
              </div>
              <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.65 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }} className="docs-2col">
          <TerminalBlock file="POST /pay — blocked (402)">
{`{
  "error": "Transaction blocked by policy",
  "code": "POLICY_BLOCKED",
  "details": {
    "reason": "max_transaction_exceeded",
    "policy": {
      "max_transaction_limit": "50.0000000",
      "attempted_amount": "75.0000000"
    }
  }
}

# NEVER retry a 402. The payment was blocked by
# policy — not a transient network error. Log it.`}
          </TerminalBlock>
          <TerminalBlock file="POST /pay — pending approval (202)">
{`{
  "data": {
    "status": "pending_approval",
    "transaction_id": "txn_abc125",
    "message": "Awaiting developer approval.",
    "poll_url": "/v1/transactions/txn_abc125"
  }
}

# Agent polls GET /v1/transactions/txn_abc125
# until status is SUCCESS or REJECTED.
# Approval expires after 24 hours.`}
          </TerminalBlock>
        </div>
      </FadeUp>

      <FadeUp delay={0.12}>
        <Callout type="tip">
          <strong>total_spent tracks the requested amount only.</strong> The wallet is debited exactly what you request on direct transfers. Marketplace calls are debited at the <Mono>cost_paid</Mono> amount logged on the transaction.
        </Callout>
      </FadeUp>
    </section>
  )
}

function ApprovalsSection() {
  return (
    <section id="approvals" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Approval Flow</SectionLabel>
        <SectionHeading>Human in the loop — without breaking the agent.</SectionHeading>
        <Lead>
          When a payment hits the <Mono>approval_threshold</Mono>, Argens doesn't fail the request — it pauses it. The agent gets a <Mono>202</Mono> with a poll URL. You get an email with a one-click confirmation page. The agent resumes when you approve.
        </Lead>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div style={{ position: 'relative', marginTop: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { icon: '⌖', step: 'Agent calls POST /pay', desc: 'Amount meets or exceeds approval_threshold. Policy check returns PENDING_APPROVAL.', badge: null },
              { icon: '◈', step: 'Argens stores the payment', desc: 'Transaction created with status PENDING_APPROVAL. A 24-hour single-use token is generated.', badge: null },
              { icon: '✉', step: 'Approval email sent', desc: 'You receive an email with a link to the dashboard confirmation page — not a direct action URL. Email scanners cannot accidentally approve.', badge: null },
              { icon: '◉', step: 'Agent polls /transactions/:id', desc: 'The agent polls at a reasonable cadence. Status is PENDING_APPROVAL until you act. No timeout on the agent side — approval can take up to 24h.', badge: 'polling' },
              { icon: '✓', step: 'You approve or reject', desc: 'The dashboard shows full transaction detail. You click Approve or Reject. On approval, Argens re-runs the policy check and executes the payment.', badge: null },
              { icon: '●', step: 'Agent receives final status', desc: 'Next poll returns SUCCESS (with stellar_tx_hash) or REJECTED. The agent continues its loop.', badge: null },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 20, paddingBottom: i < 5 ? 24 : 0, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: t.accent, flexShrink: 0 }}>{r.icon}</div>
                  {i < 5 && <div style={{ width: 1, flex: 1, background: t.border, marginTop: 6 }}/>}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: t.text }}>{r.step}</div>
                    {r.badge === 'polling' && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.pending, background: t.pendingLow, padding: '1px 7px', borderRadius: 4 }}>POLLING</span>}
                  </div>
                  <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.65, maxWidth: 520 }}>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <Callout type="warning">
          Argens <strong>never sends a direct action URL in email</strong>. Email clients, Slack previews, and antivirus scanners automatically fetch URLs in emails — a direct <Mono>GET /approve/:token</Mono> link would be triggered accidentally. The email contains only a link to the dashboard confirmation page. Approval requires a button click.
        </Callout>
      </FadeUp>
    </section>
  )
}

function MarketplaceSection() {
  const [copied, setCopied] = useState(false)
  return (
    <section id="marketplace" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Marketplace</SectionLabel>
        <SectionHeading>80+ AI services. One API key. Zero subscriptions.</SectionHeading>
        <Lead>
          Call any enabled provider by service ID. Argens handles the upstream API call, debits the cost from your wallet, runs the full policy check, and logs the transaction. Your agent needs no separate accounts or API keys.
        </Lead>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="docs-2col">
          <div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: t.text, marginBottom: 10 }}>1. Discover services</div>
            <TerminalBlock file="GET /marketplace/services">
{`# Optional filters
?search=image         → search by name or description
?category=vision      → filter by category
?enabled=true         → only your enabled providers

# Response includes 86 providers
{
  "data": [{
    "provider_id": "flux-schnell",
    "name": "Flux Schnell Image Generation",
    "category": "Vision",
    "enabled": false,
    "skill_url": "/SKILL/flux-schnell.md",
    "endpoints": [{
      "id": "flux_schnell_generate",
      "name": "Generate Image",
      "cost_estimate": "0.0030"
    }]
  }, ...]
}`}
            </TerminalBlock>
          </div>
          <div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: t.text, marginBottom: 10 }}>2. Enable in dashboard, then call</div>
            <TerminalBlock file="POST /marketplace/call">
{`{
  "service_id": "flux_schnell_generate",
  "payload": {
    "prompt": "isometric city at golden hour",
    "width": 1024,
    "height": 1024
  }
}

# → 200
{
  "data": {
    "status": "success",
    "transaction_id": "txn_k2m9p",
    "service_id": "flux_schnell_generate",
    "cost_paid": "0.0036000",
    "result": { ... upstream response ... }
  }
}`}
            </TerminalBlock>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }} className="docs-3col">
          {[
            { tag: 'Search',  services: ['Exa', 'Perplexity', 'Tavily', 'You.com'],       cost: '0.0010–0.002 USDC'  },
            { tag: 'Vision',  services: ['Flux Schnell', 'Flux Dev', 'DALL-E 3', 'Fal'],   cost: '0.003–0.05 USDC'   },
            { tag: 'Compute', services: ['E2B Sandbox', 'Daytona', 'Modal', 'Morph'],       cost: '0.005–0.02 USDC'   },
            { tag: 'LLMs',    services: ['GPT-4o', 'Claude 3.5', 'Gemini', 'Llama 3'],      cost: '0.001–0.10 USDC'   },
            { tag: 'Comms',   services: ['AgentMail', 'Resend', 'Courier', 'Loops'],         cost: '0.002–0.01 USDC'   },
            { tag: 'Data',    services: ['Codex GraphQL', 'CryptoCompare', 'Twelve Data'],   cost: '0.005–0.02 USDC'   },
          ].map((c, i) => (
            <div key={i} style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.accent, background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'inline-block', padding: '2px 9px', borderRadius: 4, marginBottom: 10 }}>{c.tag}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {c.services.map(s => (
                  <div key={s} style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: t.text2 }}>{s}</div>
                ))}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.muted, borderTop: `1px solid ${t.border}`, paddingTop: 8, marginTop: 6 }}>{c.cost} / call</div>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={0.12}>
        <Callout type="tip">
          <strong>Skill files per provider.</strong> Fetch <Mono>/SKILL/{'{provider_id}'}.md</Mono> for any enabled provider to get a concise usage reference your agent can load as context before making calls. No external documentation to find.
        </Callout>
      </FadeUp>

      <FadeUp delay={0.14}>
        <div style={{ marginTop: 24, background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: t.text }}>Marketplace policy note</div>
            <StatusBadge status="confirmed" />
          </div>
          <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.7 }}>
            The same three policies — max transaction, allowance, approval threshold — apply to marketplace calls exactly as they do to direct payments. Agents cannot bypass policy limits by routing through the marketplace. The <Mono>cost_paid</Mono> field on the transaction record is what policy checks against.
          </p>
        </div>
      </FadeUp>
    </section>
  )
}

function DiscoverabilitySection() {
  const [copied, setCopied] = useState(false)
  const SKILL_PROMPT = 'Hi, read https://argens.xyz/SKILL.md and continue with the onboarding steps.'
  const copy = () => {
    navigator.clipboard?.writeText(SKILL_PROMPT).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  return (
    <section id="discoverability" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Agent Discoverability</SectionLabel>
        <SectionHeading>One prompt. Any agent. Under 60 seconds.</SectionHeading>
        <Lead>
          The fastest way to onboard an AI agent is to give it the <Mono>SKILL.md</Mono> URL as context. The agent reads the full API surface, asks for your key, and is ready to spend. No SDK, no install, no boilerplate.
        </Lead>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div style={{ marginTop: 32, background: t.bg2, border: `1px solid ${t.accentMid}`, borderRadius: 12, padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: 'radial-gradient(ellipse at 80% 20%, rgba(197,162,83,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.accent, fontSize: 14 }}>▶</div>
            <div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: t.text }}>The one-line onboarding prompt</div>
              <div style={{ fontSize: 12, color: t.accent, fontFamily: 'JetBrains Mono, monospace' }}>Works with Claude, ChatGPT, LangChain, CrewAI, any agent that reads a URL</div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 7, padding: '13px 44px 13px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: t.text2, lineHeight: 1.6 }}>
              {SKILL_PROMPT}
            </div>
            <button onClick={copy} style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: copied ? t.successLow : t.bg2, color: copied ? t.success : t.muted, fontFamily: 'monospace', fontSize: 10, transition: 'all 0.15s' }}>
              {copied ? '✓ copied' : 'copy'}
            </button>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.08}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }} className="docs-3col">
          {[
            {
              icon: '⌖',
              title: 'SKILL.md',
              url: '/SKILL.md',
              desc: 'The primary agent onboarding payload. Full API surface, authentication instructions, response shapes, error codes, and amount format rules — all in one file under 6,000 tokens. Versioned.',
            },
            {
              icon: '◈',
              title: 'Provider skill files',
              url: '/SKILL/{provider_id}.md',
              desc: 'Per-provider usage reference for marketplace endpoints. The agent fetches this after discovering a provider in /marketplace/services. Shows exact payload shapes and response formats.',
            },
            {
              icon: '◉',
              title: 'llms.txt',
              url: '/llms.txt',
              desc: 'Discovery index for LLM tools and crawlers. Points to SKILL.md, the docs page, the API catalog, and the provider skill URL pattern. Follows the emerging llms.txt convention.',
            },
          ].map((c, i) => (
            <InfoCard key={i} title={c.title}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, marginBottom: 8, background: t.accentLow, display: 'inline-block', padding: '2px 8px', borderRadius: 4 }}>{c.url}</div>
              <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.65, marginTop: 8 }}>{c.desc}</p>
            </InfoCard>
          ))}
        </div>
      </FadeUp>
    </section>
  )
}

function ResponsesSection() {
  return (
    <section id="responses" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Response Reference</SectionLabel>
        <SectionHeading>Every response uses the same envelope.</SectionHeading>
        <Lead>
          Success is <Mono>{'{ "data": ... }'}</Mono>. Error is <Mono>{'{ "error": "...", "code": "...", "details": ... }'}</Mono>. No exceptions. The <Mono>meta</Mono> field appears on paginated responses only.
        </Lead>
      </FadeUp>

      <FadeUp delay={0.06}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }} className="docs-2col">
          <TerminalBlock file="success" tag={<StatusBadge status="confirmed" />}>
{`// Single resource
{ "data": { ... } }

// Paginated list
{
  "data": [...],
  "meta": {
    "page": 1,
    "total": 247,
    "pages": 25
  }
}`}
          </TerminalBlock>
          <TerminalBlock file="error" tag={<StatusBadge status="blocked" />}>
{`{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": {
    // Optional context — field-level errors,
    // policy details, upstream error info, etc.
  }
}

// HTTP status codes:
// 400 — validation error or bad request
// 401 — missing or invalid auth
// 402 — policy blocked (do not retry)
// 404 — resource not found
// 422 — valid request but cannot process
// 429 — rate limit exceeded
// 500 — server error
// 502 — upstream failure (e.g. Stellar)`}
          </TerminalBlock>
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: t.text, marginBottom: 14 }}>Transaction record fields</div>
          <SchemaTable rows={[
            { key: 'id',                type: 'string',   desc: 'CUID — the transaction ID. Use to poll for status updates.' },
            { key: 'status',            type: 'enum',     desc: 'SUCCESS | BLOCKED | PENDING_APPROVAL | APPROVED | REJECTED | FAILED' },
            { key: 'amount',            type: 'string',   desc: 'Requested amount as a 7-decimal string.' },
            { key: 'stellar_tx_hash',   type: 'string?',  desc: 'Stellar transaction hash. Present on SUCCESS and cross-chain burn.' },
            { key: 'destination_chain', type: 'string?',  desc: '"base" for CCTP payments. Null for Stellar-only.' },
            { key: 'destination_tx_hash', type: 'string?', desc: 'Base mint transaction hash. Present after successful CCTP relay.' },
            { key: 'cross_chain',       type: 'boolean',  desc: 'true when the payment used the CCTP route to Base.' },
            { key: 'blocked_reason',    type: 'string?',  desc: 'max_transaction_exceeded | allowance_exceeded — present when BLOCKED.' },
            { key: 'cost_paid',         type: 'string?',  desc: 'Marketplace only. The total debited from the wallet for this service call.' },
            { key: 'policy_result',     type: 'object?',  desc: 'Policy check result stored for audit purposes.' },
          ]} />
        </div>
      </FadeUp>
    </section>
  )
}

function ErrorsSection() {
  const codes = [
    { code: 'VALIDATION_ERROR',      http: '400', action: 'fix',        desc: 'Request body failed schema validation. Check the details field for per-field errors.' },
    { code: 'INVALID_RECIPIENT',     http: '400', action: 'fix',        desc: 'Recipient is neither a Stellar G… address (56 chars) nor a 0x… EVM address (42 chars).' },
    { code: 'INVALID_AMOUNT',        http: '400', action: 'fix',        desc: 'Amount is not a valid 7-decimal string, or is zero or negative.' },
    { code: 'UNAUTHORIZED',          http: '401', action: 'auth',       desc: 'API key missing, malformed, or not found. Check the Authorization header format.' },
    { code: 'API_KEY_INACTIVE',      http: '401', action: 'auth',       desc: 'The API key has been deactivated. Regenerate from the dashboard.' },
    { code: 'EMAIL_NOT_VERIFIED',    http: '403', action: 'auth',       desc: 'Account email is not verified. API keys cannot be generated until verified.' },
    { code: 'POLICY_BLOCKED',        http: '402', action: 'no-retry',   desc: 'Payment was blocked by policy (max_transaction or allowance). Do not retry automatically.' },
    { code: 'INSUFFICIENT_BALANCE',  http: '422', action: 'no-retry',   desc: 'Wallet USDC balance is below the requested amount. Fund the wallet first.' },
    { code: 'SERVICE_DISABLED',      http: '403', action: 'dashboard',  desc: 'Marketplace provider is disabled. Enable it in the dashboard before calling.' },
    { code: 'SERVICE_NOT_FOUND',     http: '404', action: 'fix',        desc: 'service_id does not match any known endpoint. Check /marketplace/services.' },
    { code: 'MARKETPLACE_NOT_MPP',   http: '422', action: 'upstream',   desc: 'MPP Router rejected the call before payment. No USDC was charged. Check your payload.' },
    { code: 'CCTP_BURN_FAILED',      http: '502', action: 'retry',      desc: 'The Stellar burn transaction failed. No Base relay was started. Check Stellar RPC status.' },
    { code: 'STELLAR_ERROR',         http: '502', action: 'retry-once', desc: 'Stellar submitted the transaction but it failed on-chain. Rare. Check Stellar Explorer.' },
    { code: 'RATE_LIMIT_EXCEEDED',   http: '429', action: 'backoff',    desc: 'Exceeded 100 requests per minute per API key. Back off and retry.' },
    { code: 'APPROVAL_EXPIRED',      http: '400', action: 're-submit',  desc: 'Approval token is expired (24h window). The agent must re-submit the original payment.' },
    { code: 'APPROVAL_ALREADY_ACTED', http: '400', action: 'no-retry', desc: 'The approval token has already been used. Each token is single-use.' },
  ]

  const actionColors: Record<string, { bg: string; color: string }> = {
    'fix':         { bg: t.errorLow,   color: t.error   },
    'auth':        { bg: t.errorLow,   color: t.error   },
    'no-retry':    { bg: t.errorLow,   color: t.error   },
    'dashboard':   { bg: t.warningLow, color: t.warning },
    'upstream':    { bg: t.warningLow, color: t.warning },
    'retry':       { bg: t.pendingLow, color: t.pending },
    'retry-once':  { bg: t.pendingLow, color: t.pending },
    'backoff':     { bg: t.warningLow, color: t.warning },
    're-submit':   { bg: t.warningLow, color: t.warning },
  }

  return (
    <section id="errors" style={{ padding: '56px 0', borderBottom: `1px solid ${t.border}` }}>
      <FadeUp>
        <SectionLabel>Error Reference</SectionLabel>
        <SectionHeading>Machine-readable codes for every failure mode.</SectionHeading>
        <Lead>Every error response includes a <Mono>code</Mono> field. Use it to handle failures programmatically — not the human-readable <Mono>error</Mono> string, which may change.</Lead>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div style={{ marginTop: 32, overflow: 'hidden', borderRadius: 10, border: `1px solid ${t.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 52px 100px 1fr', background: t.bg2, padding: '8px 16px', borderBottom: `1px solid ${t.border}` }}>
            {['Code', 'HTTP', 'Action', 'Description'].map(h => (
              <span key={h} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.faint, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{h}</span>
            ))}
          </div>
          {codes.map((r, i) => {
            const ac = actionColors[r.action] ?? { bg: t.bg3, color: t.muted }
            return (
              <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '240px 52px 100px 1fr', padding: '10px 16px', borderBottom: i < codes.length - 1 ? `1px solid ${t.border}` : 'none', background: t.bg, alignItems: 'start' }}>
                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: t.accent }}>{r.code}</code>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted, paddingTop: 1 }}>{r.http}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: ac.color, background: ac.bg, padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 1 }}>{r.action}</span>
                <span style={{ fontSize: 12.5, color: t.text2, lineHeight: 1.6 }}>{r.desc}</span>
              </div>
            )
          })}
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <Callout type="error">
          <strong>Never retry a 402 POLICY_BLOCKED.</strong> A 402 means the payment was rejected by the developer's own rules — not a transient network error. Retrying wastes API quota and annoys the developer. Log the error and surface it to the operator.
        </Callout>
      </FadeUp>
    </section>
  )
}

function LimitsSection() {
  return (
    <section id="limits" style={{ padding: '56px 0' }}>
      <FadeUp>
        <SectionLabel>Limits & Security</SectionLabel>
        <SectionHeading>Hard limits and security model.</SectionHeading>
        <Lead>Reference for building robust agents and integrations.</Lead>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }} className="docs-2col">
          <div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: t.text, marginBottom: 12 }}>API Limits</div>
            <SchemaTable rows={[
              { key: 'Rate limit',         type: 'hard', desc: '100 requests per minute per API key. Returns 429 when exceeded.' },
              { key: 'Memo length',         type: 'hard', desc: 'Max 28 bytes for Stellar transaction memo.' },
              { key: 'Pagination max',      type: 'hard', desc: 'max limit=100 per page on GET /transactions.' },
              { key: 'Amount format',       type: 'hard', desc: 'Strings only. 7 decimal places. "25.0000000" — never a number.' },
              { key: 'Approval TTL',        type: 'hard', desc: 'Approval tokens expire after 24 hours. Single use.' },
              { key: 'Balance cache TTL',   type: 'soft', desc: '30-second cache on /wallet/balance. Live balance on Horizon.' },
            ]} />
          </div>
          <div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: t.text, marginBottom: 12 }}>Security model</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { title: 'Agent-custodial',      desc: 'Argens holds your encrypted Stellar signing key so agents can spend autonomously. The key is AES-256-GCM encrypted at rest. You can export it anytime from the dashboard.' },
                { title: 'No raw key exposure',  desc: 'Secret keys are never returned in responses, never logged, and decrypted only in memory for the duration of signing.' },
                { title: 'API key storage',       desc: 'Your API key is shown once on creation. Argens stores only a bcrypt hash. The original is unrecoverable — regenerate if lost.' },
                { title: 'Approval email safety', desc: 'Magic links go to a dashboard confirmation page, not a direct action endpoint. Email scanners cannot accidentally approve a payment.' },
              ].map((s, i) => (
                <div key={i} style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, color: t.accent, marginBottom: 5 }}>{s.title}</div>
                  <p style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.65 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div style={{ marginTop: 32, background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: '24px 28px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16, color: t.text, marginBottom: 8 }}>Ready to build?</div>
            <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.7, maxWidth: 460 }}>Create a free account, fund a wallet, and your agent can be spending in under 5 minutes. No blockchain knowledge required.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' as const }}>
            <a href="/signup" style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, color: t.bg, background: t.accent, padding: '9px 20px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
              Create account
            </a>
            <a href="/SKILL.md" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: t.text2, border: `1px solid ${t.border2}`, padding: '9px 18px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
              Read SKILL.md
            </a>
          </div>
        </div>
      </FadeUp>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function DocsFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${t.border}`, padding: '28px clamp(16px,4vw,40px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 20 }}>
        <Logo />
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' as const }}>
          {[['/', 'Home'], ['/docs', 'Docs'], ['/SKILL.md', 'SKILL.md'], ['/llms.txt', 'llms.txt'], ['/signup', 'Sign up']].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>{label}</a>
          ))}
        </div>
        <div style={{ fontSize: 12, color: t.faint, fontFamily: 'JetBrains Mono, monospace' }}>© 2026 Argens Inc.</div>
      </div>
    </footer>
  )
}

// ─── Active section tracker ────────────────────────────────────────────────────
function useActiveSection() {
  const [active, setActive] = useState('overview')
  useEffect(() => {
    const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) setActive(e.target.id)
      })
    }, { rootMargin: '-20% 0px -75% 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
  return active
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const active = useActiveSection()

  return (
    <>
      <style>{`
        @keyframes glow { from{opacity:0.5;box-shadow:none} to{opacity:1;box-shadow:0 0 8px currentColor} }
        @keyframes dotPulse { 0%,100%{opacity:0.25;transform:scale(0.85)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        a:hover { opacity: 0.82; }

        /* Sidebar hidden by default; revealed at desktop width */
        .docs-sidebar { display: none; }

        /* Layout: single column on mobile, sidebar + content on desktop */
        .docs-layout {
          display: grid;
          grid-template-columns: 1fr;
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (min-width: 1024px) {
          .docs-sidebar { display: block !important; }
          .docs-layout { grid-template-columns: 260px 1fr !important; }
        }
        @media (max-width: 767px) {
          .docs-2col { grid-template-columns: 1fr !important; }
          .docs-3col { grid-template-columns: 1fr !important; }
          .docs-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .docs-step-row { grid-template-columns: 48px 1fr !important; gap: 14px !important; }
          .docs-step-code { grid-column: 1 / -1 !important; }
        }
      `}</style>

      <DocsNav />

      <div style={{ minHeight: '100vh', background: t.bg, paddingTop: 58 }}>
        <div className="docs-layout">
          <Sidebar active={active} />

          <main style={{ minWidth: 0, padding: '28px clamp(16px,3vw,48px) 60px' }}>
            <OverviewSection />
            <QuickstartSection />
            <AuthSection />
            <PaymentsSection />
            <PoliciesSection />
            <ApprovalsSection />
            <MarketplaceSection />
            <DiscoverabilitySection />
            <ResponsesSection />
            <ErrorsSection />
            <LimitsSection />
          </main>
        </div>

        <DocsFooter />
      </div>
    </>
  )
}
