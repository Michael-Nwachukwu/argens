'use client'

import { useState, useEffect, useRef } from 'react'
import { Logo } from './ui/Logo'

// ─── Design tokens ────────────────────────────────────────────────────────────
const t = {
  bg:          '#0C0B0A',
  bg2:         '#131210',
  bg3:         '#1C1916',
  border:      '#252220',
  border2:     '#34302B',
  text:        '#EDE9E3',
  text2:       '#B0A99F',
  muted:       '#706B65',
  faint:       '#403C38',
  accent:      '#C5A253',
  accentLow:   'rgba(197,162,83,0.10)',
  accentMid:   'rgba(197,162,83,0.28)',
  success:     '#4D9B6A',
  successLow:  'rgba(77,155,106,0.12)',
  error:       '#A04848',
  errorLow:    'rgba(160,72,72,0.12)',
  pending:     '#6B7FAF',
  pendingLow:  'rgba(107,127,175,0.12)',
  warning:     '#B8832A',
}

const SYN = {
  kw:  (c: string) => <span style={{ color: t.accent }}>{c}</span>,
  str: (c: string) => <span style={{ color: '#7DB88A' }}>{c}</span>,
  fn:  (c: string) => <span style={{ color: '#A08BC8' }}>{c}</span>,
  cmt: (c: string) => <span style={{ color: t.faint, fontStyle: 'italic' }}>{c}</span>,
}

const SKILL_PROMPT = 'Hi, read https://argens.xyz/SKILL.md and continue with the onboarding steps.'
const TALLY_FORM_ID = 'xX9AxG'

// ─── Utilities ────────────────────────────────────────────────────────────────
function useTally() {
  useEffect(() => {
    if (document.querySelector('script[src*="tally.so"]')) return
    const s = document.createElement('script')
    s.src = 'https://tally.so/widgets/embed.js'
    s.async = true
    document.head.appendChild(s)
  }, [])
}

function useIsMobile(bp = 768) {
  const [is, setIs] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`)
    setIs(mq.matches)
    const fn = (e: MediaQueryListEvent) => setIs(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [bp])
  return is
}

// Scroll-reveal motion primitive
function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.7s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.7s ${delay}s cubic-bezier(0.16,1,0.3,1)`,
      ...style,
    }}>
      {children}
    </div>
  )
}

function WaitlistButton({ size = 'sm', label = 'Join the waitlist', full }: { size?: 'sm' | 'lg'; label?: string; full?: boolean }) {
  const pad  = size === 'lg' ? '13px 28px' : '8px 16px'
  const font = size === 'lg' ? 15 : 13
  return (
    <button
      data-tally-open={TALLY_FORM_ID}
      data-tally-layout="modal"
      data-tally-width="480"
      data-tally-emoji-text="👋"
      data-tally-emoji-animation="wave"
      style={{
        padding: pad, borderRadius: 7, fontSize: font, fontWeight: 600,
        background: t.accent, color: t.bg, border: 'none', cursor: 'pointer',
        fontFamily: 'Space Grotesk, sans-serif',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: full ? '100%' : undefined,
        letterSpacing: '-0.01em',
      }}
    >
      {label}
    </button>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  useTally()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => { if (!isMobile) setMenuOpen(false) }, [isMobile])

  const links: [string, string][] = [
    ['#how', 'How it works'],
    ['#marketplace', 'Marketplace'],
    ['/services', 'Services'],
    ['#policies', 'Policies'],
    ['/docs', 'Docs'],
  ]

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 40px)', height: 58,
        background: 'rgba(12,11,10,0.88)',
        backdropFilter: 'blur(18px) saturate(130%)',
        borderBottom: `1px solid ${scrolled || menuOpen ? t.border : 'transparent'}`,
        transition: 'border-color 0.2s',
      }}>
        <Logo />
        {!isMobile && (
          <>
            <ul style={{ display: 'flex', alignItems: 'center', gap: 28, listStyle: 'none', margin: 0, padding: 0 }}>
              {links.map(([href, label]) => (
                <li key={href}><a href={href} style={{ fontSize: 13, color: t.muted, textDecoration: 'none', transition: 'color 0.15s' }}>{label}</a></li>
              ))}
            </ul>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WaitlistButton />
            </div>
          </>
        )}
        {isMobile && (
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: 6, padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {menuOpen
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>}
          </button>
        )}
      </nav>

      {isMobile && (
        <div style={{
          position: 'fixed', top: 58, left: 0, right: 0, zIndex: 199,
          background: 'rgba(12,11,10,0.97)', backdropFilter: 'blur(20px)',
          borderBottom: menuOpen ? `1px solid ${t.border}` : 'none',
          overflow: 'hidden', maxHeight: menuOpen ? 400 : 0, transition: 'max-height 0.25s ease',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column' }}>
            {links.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}
                style={{ fontSize: 16, color: t.text2, textDecoration: 'none', padding: '14px 4px', borderBottom: `1px solid ${t.border}`, display: 'block' }}>
                {label}
              </a>
            ))}
            <div style={{ marginTop: 20 }}><WaitlistButton size="lg" full /></div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Hero widgets ─────────────────────────────────────────────────────────────

function HeroDirectPayWidget() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const cycle = () => {
      setPhase(0)
      const timers = [
        setTimeout(() => setPhase(1), 2000),
        setTimeout(() => setPhase(2), 3400),
        setTimeout(() => setPhase(3), 4600),
        setTimeout(cycle,  7500),
      ]
      return timers
    }
    const timers = cycle()
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#3A3733' }}/>)}
            <span style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 12, color: t.muted }}>agent.ts</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontSize: 10, padding: '2px 7px', borderRadius: 4, background: t.successLow, color: t.success }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>live
          </span>
        </div>
        <div style={{ padding: '18px 22px', fontSize: 12, lineHeight: 1.8, fontFamily: 'JetBrains Mono, monospace', overflowX: 'auto' }}>
          <pre style={{ margin: 0 }}><code>
            {SYN.cmt('// send USDC — agent pays directly')}{'\n\n'}
            {SYN.kw('await')} {SYN.fn('fetch')}({SYN.str("'/v1/pay'")}, {'{'}
            {'\n  '}method: {SYN.str("'POST'")},{'\n  '}
            body: {SYN.fn('JSON.stringify')}({'{'}{'\n    '}
            recipient: {SYN.str('"GXXX...7STELLAR"')},{'\n    '}
            amount: {SYN.str('"25.0000000"')},{'\n    '}
            memo: {SYN.str('"research API usage"')},
            {'\n  '}{'}'})
            {'\n'}{'}'});{phase === 0 && <span style={{ animation: 'blink 1s step-end infinite', color: t.accent }}>▋</span>}
          </code></pre>
        </div>
      </div>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, overflow: 'hidden' }}>
        {phase === 0 && (
          <div style={{ padding: '11px 16px', color: t.faint }}>awaiting call…</div>
        )}
        {phase === 1 && (
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInUp 0.2s ease-out' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.warning, flexShrink: 0, animation: 'glow 0.8s infinite alternate' }}/>
            <span style={{ color: t.muted }}>policy.check() — max_tx ✓ · allowance ✓</span>
          </div>
        )}
        {phase === 2 && (
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInUp 0.2s ease-out' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.pending, flexShrink: 0, animation: 'dotPulse 1s infinite' }}/>
            <span style={{ color: t.muted }}>submitting to Stellar mainnet…</span>
          </div>
        )}
        {phase === 3 && (
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8, width: '100%', animation: 'fadeInUp 0.2s ease-out', boxSizing: 'border-box' }}>
            <span style={{ background: t.successLow, color: t.success, fontSize: 10, padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>● CONFIRMED</span>
            <span style={{ color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>hash: <span style={{ color: t.text2 }}>3afc9…d2e1</span></span>
            <span style={{ marginLeft: 'auto', color: t.success, fontWeight: 500, flexShrink: 0 }}>−25.00 USDC</span>
          </div>
        )}
      </div>
    </div>
  )
}

function HeroMarketplaceWidget() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const cycle = () => {
      setPhase(0)
      const timers = [
        setTimeout(() => setPhase(1), 2000),
        setTimeout(() => setPhase(2), 3200),
        setTimeout(() => setPhase(3), 4500),
        setTimeout(cycle,  8000),
      ]
      return timers
    }
    const timers = cycle()
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#3A3733' }}/>)}
            <span style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 12, color: t.muted }}>agent.ts</span>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 10, padding: '2px 7px', borderRadius: 4, background: t.accentLow, color: t.accent }}>marketplace</span>
        </div>
        <div style={{ padding: '18px 22px', fontSize: 12, lineHeight: 1.8, fontFamily: 'JetBrains Mono, monospace', overflowX: 'auto' }}>
          <pre style={{ margin: 0 }}><code>
            {SYN.cmt('// call a service — Argens pays for it')}{'\n\n'}
            {SYN.kw('const')} result = {SYN.kw('await')} {SYN.fn('fetch')}({SYN.str("'/v1/marketplace/call'")}, {'{'}
            {'\n  '}body: {SYN.fn('JSON.stringify')}({'{'}{'\n    '}
            {SYN.str('service_id')}: {SYN.str('"exa-search"')},{'\n    '}
            {SYN.str('payload')}: {'{ '}{SYN.str('query')}: {SYN.str('"AI funding 2025"')}{' }'},
            {'\n  '}{'}'})
            {'\n'}{'}'});{phase === 0 && <span style={{ animation: 'blink 1s step-end infinite', color: t.accent }}>▋</span>}
          </code></pre>
        </div>
      </div>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, overflow: 'hidden' }}>
        {phase === 0 && (
          <div style={{ padding: '11px 16px', color: t.faint }}>awaiting call…</div>
        )}
        {phase === 1 && (
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInUp 0.2s ease-out' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.warning, flexShrink: 0, animation: 'glow 0.8s infinite alternate' }}/>
            <span style={{ color: t.muted }}>policy.check() · 0.0010 USDC · allowance ok</span>
          </div>
        )}
        {phase === 2 && (
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInUp 0.2s ease-out' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.pending, flexShrink: 0, animation: 'dotPulse 1s infinite' }}/>
            <span style={{ color: t.muted }}>routing to Exa via Stellar mainnet…</span>
          </div>
        )}
        {phase === 3 && (
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8, width: '100%', animation: 'fadeInUp 0.2s ease-out', boxSizing: 'border-box' }}>
            <span style={{ background: t.successLow, color: t.success, fontSize: 10, padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>● CONFIRMED</span>
            <span style={{ color: t.muted }}>−0.0010 USDC · 4 results returned</span>
            <span style={{ marginLeft: 'auto', color: t.accent, fontSize: 10, flexShrink: 0 }}>txn_k2m9p</span>
          </div>
        )}
      </div>
    </div>
  )
}

const CHAT_SEQ = [
  { delay: 500,  type: 'msg',      role: 'user',  text: SKILL_PROMPT },
  { delay: 1200, type: 'thinking' },
  { delay: 2100, type: 'msg',      role: 'agent', text: 'Got it — reading SKILL.md now…', dim: true },
  { delay: 2900, type: 'thinking' },
  { delay: 3900, type: 'msg',      role: 'agent', text: "What's your Argens API key? I'll verify it's active and show your current policies." },
  { delay: 5300, type: 'msg',      role: 'user',  text: 'argns_live_7xK2mNpQ9rL…', mono: true },
  { delay: 6000, type: 'thinking' },
  { delay: 7000, type: 'msg',      role: 'agent', text: '✓ Active. Balance: 492.50 USDC · max_tx: $50 · allowance: $500/mo. Your agent can now pay.', accent: true },
] as const

type ChatMsgItem = Extract<typeof CHAT_SEQ[number], { type: 'msg' }>

function HeroPromptWidget({ active }: { active: boolean }) {
  const [messages, setMessages] = useState<ChatMsgItem[]>([])
  const [thinking, setThinking] = useState(false)

  useEffect(() => {
    setMessages([]); setThinking(false)
    if (!active) return
    const timers = CHAT_SEQ.map(item => setTimeout(() => {
      if (item.type === 'thinking') setThinking(true)
      else { setThinking(false); setMessages(m => [...m, item as ChatMsgItem]) }
    }, item.delay))
    return () => timers.forEach(clearTimeout)
  }, [active])

  return (
    <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#3A3733' }}/>)}
        <span style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 12, color: t.muted }}>Claude — agent session</span>
        <span style={{ marginLeft: 'auto', background: t.successLow, color: t.success, fontFamily: 'monospace', fontSize: 10, padding: '2px 7px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>connected
        </span>
      </div>
      <div style={{ padding: 16, minHeight: 224, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'hidden' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, animation: 'fadeInUp 0.22s ease-out' }}>
            {msg.role === 'agent' && (
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: t.accent, flexShrink: 0, marginTop: 1, fontFamily: 'monospace', fontWeight: 700 }}>A</div>
            )}
            <div style={{
              maxWidth: '82%', padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: 'accent' in msg && msg.accent ? 'rgba(77,155,106,0.08)' : t.bg3,
              border: `1px solid ${'accent' in msg && msg.accent ? 'rgba(77,155,106,0.25)' : t.border2}`,
              fontSize: msg.role === 'user' ? 12 : 12.5,
              color: 'accent' in msg && msg.accent ? t.success : 'dim' in msg && msg.dim ? t.muted : t.text2,
              fontFamily: 'mono' in msg && msg.mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
              lineHeight: 1.55,
            }}>{msg.text}</div>
          </div>
        ))}
        {thinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInUp 0.18s ease-out' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: t.accent, fontFamily: 'monospace', fontWeight: 700 }}>A</div>
            <div style={{ display: 'flex', gap: 4, padding: '9px 13px', background: t.bg3, border: `1px solid ${t.border2}`, borderRadius: '10px 10px 10px 2px' }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: t.muted, display: 'inline-block', animation: `dotPulse 1.2s ${i*0.25}s infinite ease-in-out` }}/>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
type HeroTab = 'pay' | 'marketplace' | 'prompt'
const HERO_TABS: { id: HeroTab; label: string }[] = [
  { id: 'pay',         label: 'Direct Pay'   },
  { id: 'marketplace', label: 'Marketplace'  },
  { id: 'prompt',      label: 'Agent Setup'  },
]
const DWELLS: Record<HeroTab, number> = { pay: 8000, marketplace: 9500, prompt: 11000 }

function Hero() {
  const [view, setView]   = useState<HeroTab>('pay')
  const [pinned, setPinned] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (pinned) return
    timerRef.current = setTimeout(() => {
      setView(v => v === 'pay' ? 'marketplace' : v === 'marketplace' ? 'prompt' : 'pay')
    }, DWELLS[view])
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [view, pinned])

  const switchTo = (v: HeroTab) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPinned(true); setView(v)
  }

  return (
    <section className="lp-hero" style={{ padding: '148px 0 96px', position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '-8%', right: '-5%', width: '60%', height: '80%', background: 'radial-gradient(ellipse at 80% 20%, rgba(197,162,83,0.06) 0%, transparent 65%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: '10%', left: '-5%', width: '40%', height: '50%', background: 'radial-gradient(ellipse at 20% 80%, rgba(77,155,106,0.04) 0%, transparent 65%)', pointerEvents: 'none' }}/>

      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 0px', position: 'relative', zIndex: 1 }}>
        <div className="lp-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

          {/* Left copy */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, background: t.accentLow, border: `1px solid ${t.accentMid}`, padding: '5px 12px', borderRadius: 20, marginBottom: 28, letterSpacing: '0.04em', animation: 'fadeInUp 0.6s 0.1s both ease-out' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, display: 'inline-block', animation: 'glow 2s infinite alternate' }}/>
              Live on Stellar mainnet
            </div>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(36px, 5.5vw, 72px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 22, animation: 'fadeInUp 0.6s 0.18s both ease-out' }}>
              Give your AI agent the ability to pay.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: t.text2, marginBottom: 32, maxWidth: 420, animation: 'fadeInUp 0.6s 0.26s both ease-out' }}>
              A programmable USDC wallet and AI service marketplace for autonomous agents. One API key — your agent pays, calls 20+ services, and operates within the limits you set.
            </p>
            <div className="lp-hero-cta" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', animation: 'fadeInUp 0.6s 0.34s both ease-out' }}>
              <WaitlistButton size="lg" label="Get early access" />
              <a href="#how" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 26px', borderRadius: 7, fontSize: 15, color: t.text2, border: `1px solid ${t.border2}`, textDecoration: 'none' }}>
                See how it works →
              </a>
            </div>
            <div className="lp-hero-stats" style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 28, animation: 'fadeInUp 0.6s 0.42s both ease-out' }}>
              {[
                { v: '40+',        l: 'AI services on mainnet' },
                { v: '$0',         l: 'fee on direct transfers' },
                { v: '3',          l: 'policy rules to set' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  {i > 0 && <div className="lp-stat-div" style={{ width: 1, height: 30, background: t.border }}/>}
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: t.accent }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{s.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — tabbed widget */}
          <div style={{ animation: 'fadeInUp 0.7s 0.3s both ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              {HERO_TABS.map(tab => (
                <button key={tab.id} onClick={() => switchTo(tab.id)} style={{
                  padding: '5px 13px', borderRadius: 20, border: '1px solid',
                  borderColor: view === tab.id ? t.accentMid : t.border,
                  background: view === tab.id ? t.accentLow : 'transparent',
                  color: view === tab.id ? t.accent : t.muted,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, cursor: 'pointer',
                  transition: 'all 0.15s', letterSpacing: '0.04em',
                }}>{tab.label}</button>
              ))}
              {pinned && (
                <button onClick={() => setPinned(false)} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${t.border}`, background: 'transparent', color: t.faint, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer', marginLeft: 4 }}>auto ↺</button>
              )}
            </div>

            {isMobile ? (
              <div>
                {view === 'pay' && <HeroDirectPayWidget />}
                {view === 'marketplace' && <HeroMarketplaceWidget />}
                {view === 'prompt' && <HeroPromptWidget active />}
              </div>
            ) : (
              <div style={{ position: 'relative', height: 320 }}>
                {(['pay', 'marketplace', 'prompt'] as HeroTab[]).map(id => (
                  <div key={id} style={{ position: 'absolute', inset: 0, opacity: view === id ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: view === id ? 'auto' : 'none' }}>
                    {id === 'pay'         && <HeroDirectPayWidget />}
                    {id === 'marketplace' && <HeroMarketplaceWidget />}
                    {id === 'prompt'      && <HeroPromptWidget active={view === 'prompt'} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Live Activity Ticker ─────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { agent: 'research-agent',  action: 'web search · Exa',          cost: '0.0010' },
  { agent: 'claude-3-agent',  action: 'sent 25.00 USDC',            cost: '25.0000' },
  { agent: 'gpt-4o-agent',    action: 'image gen · Flux Schnell',   cost: '0.0030' },
  { agent: 'dev-agent',       action: 'code sandbox · E2B',         cost: '0.0050' },
  { agent: 'mailer-agent',    action: 'email delivery · AgentMail', cost: '0.0020' },
  { agent: 'quant-agent',     action: 'blockchain data · Codex',    cost: '0.0100' },
  { agent: 'writer-agent',    action: 'sent 5.00 USDC',             cost: '5.0000' },
  { agent: 'content-agent',   action: 'image gen · Flux Schnell',   cost: '0.0030' },
  { agent: 'scout-agent',     action: 'web search · Exa',           cost: '0.0010' },
  { agent: 'analyst-agent',   action: 'sent 100.00 USDC',           cost: '100.0000' },
]

function LiveTicker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, background: t.bg2, overflow: 'hidden', padding: '13px 0', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, background: `linear-gradient(to right, ${t.bg2}, transparent)`, zIndex: 1, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, background: `linear-gradient(to left, ${t.bg2}, transparent)`, zIndex: 1, pointerEvents: 'none' }}/>
      <div className="lp-ticker-track" style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap' }}>
        {doubled.map((item, i) => (
          <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 28px', flexShrink: 0, borderRight: `1px solid ${t.border}` }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.success, flexShrink: 0 }}/>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted }}>
              <span style={{ color: t.text2 }}>{item.agent}</span>
              <span style={{ margin: '0 5px', color: t.faint }}>→</span>
              {item.action}
              <span style={{ margin: '0 5px', color: t.faint }}>·</span>
              <span style={{ color: t.accent }}>−{item.cost} USDC</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Problem ──────────────────────────────────────────────────────────────────
function Problem() {
  const cases = [
    {
      who:     'Research agent',
      before:  'Blocked at a paywalled data API. Stops. Asks a human.',
      after:   'Pays $0.001 per search call. Loop continues.',
      icon:    '⌖',
    },
    {
      who:     'Code agent',
      before:  'Needs an execution sandbox. No way to provision one autonomously.',
      after:   'Spins up E2B, pays per second of runtime. No human needed.',
      icon:    '⌘',
    },
    {
      who:     'Content agent',
      before:  'Image generation requires a billed account. Agent can\'t have one.',
      after:   'Calls Flux Schnell, pays $0.003 per image. Inline in the workflow.',
      icon:    '◈',
    },
  ]
  return (
    <section style={{ padding: '80px 0', borderTop: `1px solid ${t.border}`, background: t.bg2 }}>
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <FadeUp>
          <div style={{ maxWidth: 680, margin: '0 auto 56px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(20px,3vw,30px)', fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.02em', color: t.text }}>
              Agents can plan, reason, and act.{' '}
              <span style={{ color: t.muted }}>But every time they need to spend money, the loop breaks. A human has to step in.</span>
            </p>
            <p style={{ marginTop: 20, fontSize: 16, color: t.muted, lineHeight: 1.7 }}>
              <span style={{ color: t.accent, fontWeight: 600 }}>Argens</span> closes the loop — autonomously, with spending rules you define.
            </p>
          </div>
        </FadeUp>
        <div className="lp-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {cases.map((c, i) => (
            <FadeUp key={c.who} delay={i * 0.08}>
              <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, height: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 18, color: t.accent, marginBottom: 14, fontFamily: 'JetBrains Mono, monospace' }}>{c.icon}</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, color: t.text, marginBottom: 12 }}>{c.who}</div>
                <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.6, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ color: t.error, marginRight: 6 }}>✕</span>{c.before}
                </div>
                <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.6 }}>
                  <span style={{ color: t.success, marginRight: 6 }}>✓</span>{c.after}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Fund a smart wallet',
      desc: 'A USDC wallet on Stellar is created automatically when you sign up. Your private key is encrypted and stored — exportable anytime. Fund it via any Stellar wallet and your agent is ready to spend.',
      snippet: 'GET /v1/wallet/balance',
      result: '// { balance: "250.0000000", address: "GXXX..." }',
    },
    {
      num: '02',
      title: 'Set spending rules',
      desc: 'Define a monthly allowance, a per-transaction maximum, and an approval threshold. Any payment that exceeds your rules is blocked before it touches the blockchain — not after.',
      snippet: '{ allowance: 500, max_tx: 50, threshold: 100 }',
      result: '// Rules active — agent constrained to policy',
    },
    {
      num: '03',
      title: 'Give your agent the API key',
      desc: 'One environment variable. Your agent calls POST /v1/pay for transfers or POST /v1/marketplace/call for AI services. Argens handles USDC settlement on Stellar, logs every transaction, and alerts you when approval is needed.',
      snippet: 'ARGENS_KEY=argns_live_…',
      result: '// Agent payments + services unlocked',
    },
  ]
  return (
    <section className="lp-section-lg" style={{ padding: '96px 0' }} id="how">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <FadeUp>
          <div style={{ marginBottom: 64 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>How it works</span>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(26px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, maxWidth: 500 }}>
              From zero to autonomous<br/>agent payments in three steps.
            </h2>
          </div>
        </FadeUp>
        {steps.map((s, i) => (
          <FadeUp key={i} delay={i * 0.06}>
            <div className="lp-how-row" style={{ display: 'grid', gridTemplateColumns: '64px 1fr minmax(0,360px)', gap: 40, alignItems: 'start', padding: '36px 0', borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.accent, paddingTop: 3, letterSpacing: '0.04em' }}>{s.num}</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 10 }}>{s.title}</div>
                <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.7, maxWidth: 400 }}>{s.desc}</p>
              </div>
              <div className="lp-how-code" style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: t.faint }}>$</span>
                  <span style={{ color: t.text2 }}>{s.snippet}</span>
                </div>
                <div style={{ padding: '10px 16px', color: t.success, opacity: 0.85 }}>{s.result}</div>
              </div>
            </div>
          </FadeUp>
        ))}
        <div style={{ borderTop: `1px solid ${t.border}` }}/>
      </div>
    </section>
  )
}

// ─── Marketplace ──────────────────────────────────────────────────────────────
function Marketplace() {
  const services = [
    { name: 'Web Search',       id: 'exa-search',    cost: '0.0010', tag: 'Search',  desc: 'Real-time web results across the open web for any query.' },
    { name: 'Image Generation', id: 'flux-schnell',  cost: '0.0030', tag: 'Vision',  desc: 'Text-to-image via Flux Schnell — high quality, sub-second.' },
    { name: 'Code Execution',   id: 'e2b-sandbox',   cost: '0.0050', tag: 'Compute', desc: 'Secure, isolated sandbox environments to run and test code.' },
    { name: 'Email Delivery',   id: 'agentmail',     cost: '0.0020', tag: 'Comms',   desc: 'Send emails and handle replies autonomously from your agent.' },
    { name: 'Blockchain Data',  id: 'codex-graphql', cost: '0.0100', tag: 'Data',    desc: 'Query on-chain data across major networks via GraphQL.' },
  ]

  const tagColors: Record<string, { color: string; bg: string }> = {
    Search:  { color: t.success, bg: t.successLow },
    Vision:  { color: t.pending, bg: t.pendingLow },
    Compute: { color: t.pending, bg: t.pendingLow },
    Comms:   { color: t.accent,  bg: t.accentLow  },
    Data:    { color: t.success, bg: t.successLow },
  }

  const features = [
    {
      title: 'Zero Setup',
      desc:  'Enable any service in the dashboard. Your agent gets access immediately — no accounts, no API keys to manage per provider.',
    },
    {
      title: 'Per-Call Pricing',
      desc:  'Pay fractions of a cent per API call. No monthly commitments. Your agent spends only what it uses.',
    },
    {
      title: 'Skill Files Included',
      desc:  'Every service ships a skill file your agent loads to understand exactly how to call the API — no documentation to read.',
    },
  ]

  return (
    <section className="lp-section-lg" style={{ padding: '96px 0', borderTop: `1px solid ${t.border}`, background: t.bg2 }} id="marketplace">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>

        {/* Section header */}
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'end', marginBottom: 52 }}>
          <FadeUp>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
                <div style={{ width: 10, height: 10, background: t.accent, borderRadius: 2, flexShrink: 0 }}/>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Pay-per-use marketplace</span>
              </div>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(32px,4.2vw,58px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0, color: t.text }}>
                40+ AI services.<br/>Zero subscriptions.
              </h2>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div>
              <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.75, marginBottom: 22 }}>
                Your agent calls any provider — AI models, search engines, code sandboxes, data APIs — paying per use from its Argens wallet. No separate accounts. No API keys to manage per service. No rate-limit negotiations.
              </p>
              <a href="/services" style={{ fontSize: 14, color: t.accent, textDecoration: 'none', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500 }}>Browse all services →</a>
            </div>
          </FadeUp>
        </div>

        {/* Service grid — container bg acts as 1px divider between cells */}
        <FadeUp delay={0.06}>
          <div style={{ background: t.border, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 64 }}>
            <div className="lp-svc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {services.map((svc) => {
                const tc = tagColors[svc.tag] ?? { color: t.muted, bg: t.bg3 }
                return (
                  <div key={svc.id} style={{ background: t.bg, padding: '22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, background: tc.bg, color: tc.color, fontFamily: 'monospace' }}>{svc.tag}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.text2 }}>
                        {svc.cost} <span style={{ color: t.faint, fontSize: 10 }}>USDC</span>
                      </span>
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, color: t.text }}>{svc.name}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.faint }}>{svc.id}</div>
                    <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.55, marginTop: 2 }}>{svc.desc}</div>
                  </div>
                )
              })}
              <div style={{ background: t.bg2, padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 120 }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 30, color: t.accent }}>+35</div>
                <div style={{ fontSize: 12, color: t.muted, textAlign: 'center' as const, lineHeight: 1.5 }}>more services<br/>on mainnet</div>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* Feature callouts */}
        <div className="lp-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
          {features.map((f, i) => (
            <FadeUp key={f.title} delay={i * 0.08}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, background: t.accent, borderRadius: 2, flexShrink: 0 }}/>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: t.text }}>{f.title}</div>
                </div>
                <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>{f.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>

      </div>
    </section>
  )
}

// ─── Two Ways ────────────────────────────────────────────────────────────────
function TwoWays() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(SKILL_PROMPT).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <section className="lp-section-lg" style={{ padding: '96px 0', borderTop: `1px solid ${t.border}` }} id="integration">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <FadeUp>
          <div style={{ marginBottom: 56 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Integration</span>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(26px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Two ways to integrate.</h2>
            <p style={{ marginTop: 14, fontSize: 16, color: t.muted, maxWidth: 480, lineHeight: 1.7 }}>Write code for full control. Paste one line into your agent for an integration that takes under a minute.</p>
          </div>
        </FadeUp>
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <FadeUp delay={0.04}>
            <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, height: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: t.bg3, border: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 4h12M4 8h8M6 12h4"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 16 }}>Write code</div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>REST API · any language</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.7 }}>Call <code style={{ fontFamily: 'monospace', fontSize: 12, color: t.text2, background: t.bg3, padding: '1px 5px', borderRadius: 3 }}>POST /v1/pay</code> or <code style={{ fontFamily: 'monospace', fontSize: 12, color: t.text2, background: t.bg3, padding: '1px 5px', borderRadius: 3 }}>/v1/marketplace/call</code> directly from TypeScript, Python, or anything that can make an HTTP request. No SDK required.</p>
              <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 7, padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                <div style={{ color: t.faint, marginBottom: 6, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Quick start</div>
                <div style={{ color: t.text2 }}>
                  <span style={{ color: t.accent }}>const</span> result = <span style={{ color: t.accent }}>await</span> <span style={{ color: '#A08BC8' }}>fetch</span>(<span style={{ color: '#7DB88A' }}>&apos;/v1/pay&apos;</span>, {'{ body: … }'})<br/>
                  <span style={{ color: t.faint }}>// → 200 CONFIRMED · hash: abc…xyz</span>
                </div>
              </div>
              <a href="/docs" style={{ fontSize: 13, color: t.accent, textDecoration: 'none', marginTop: 'auto' }}>View API docs →</a>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div style={{ background: t.bg2, border: `1px solid ${t.accentMid}`, borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '60%', height: '100%', background: 'radial-gradient(ellipse at 80% 20%, rgba(197,162,83,0.07) 0%, transparent 70%)', pointerEvents: 'none' }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.accent }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zM5 8h6M8 5l3 3-3 3"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 16 }}>Prompt your agent</div>
                  <div style={{ fontSize: 12, color: t.accent, marginTop: 2, fontFamily: 'monospace' }}>SKILL.md · zero install · zero SDK</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.7 }}>Paste one line into any AI agent. It fetches <code style={{ fontFamily: 'monospace', fontSize: 12, color: t.text2, background: t.bg3, padding: '1px 5px', borderRadius: 3 }}>SKILL.md</code>, reads the full API surface, asks for your API key, and starts transacting. Works with Claude, ChatGPT, LangChain, CrewAI — anything that reads a URL.</p>
              <div style={{ position: 'relative' }}>
                <div style={{ background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 7, padding: '14px 44px 14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: t.text2, lineHeight: 1.6, wordBreak: 'break-all' as const }}>{SKILL_PROMPT}</div>
                <button onClick={copy} style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: copied ? 'rgba(77,155,106,0.12)' : t.bg2, color: copied ? t.success : t.muted, fontFamily: 'monospace', fontSize: 10, transition: 'all 0.15s' }}>{copied ? '✓ copied' : 'copy'}</button>
              </div>
              <div style={{ fontSize: 12, color: t.accent, fontFamily: 'monospace', marginTop: 'auto' }}>← The fastest path to a live payment agent.</div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ─── Policies ─────────────────────────────────────────────────────────────────
function Policies() {
  const cards = [
    {
      icon: '◈',
      title: 'Monthly Allowance',
      rule: 'allowance_limit: $500 / mo',
      desc: 'Cap the total USDC your agent can spend in a period. Every payment is checked against the running total. When the limit is reached, further payments are rejected instantly — before they touch Stellar.',
      demo: (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: t.muted }}>spent this month</span>
            <span style={{ color: t.text2 }}>$312.40</span>
          </div>
          <div style={{ height: 5, background: t.bg3, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ width: '62%', height: '100%', background: `linear-gradient(to right, ${t.accent}, #E8C98A)`, borderRadius: 3 }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: t.faint, fontSize: 11 }}>$0</span>
            <span style={{ color: t.muted, fontSize: 11 }}>$187.60 remaining</span>
            <span style={{ color: t.faint, fontSize: 11 }}>$500</span>
          </div>
        </div>
      ),
    },
    {
      icon: '◇',
      title: 'Max Transaction',
      rule: 'max_transaction_limit: $50',
      desc: 'No single payment can exceed this amount, regardless of what the agent decides. A runaway agent cannot drain your wallet in a single call. This rule runs first — before allowance is even checked.',
      demo: (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: t.muted }}>$12.50 payment</span>
            <span style={{ background: t.successLow, color: t.success, padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>● allowed</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: t.muted }}>$75.00 payment</span>
            <span style={{ background: t.errorLow, color: t.error, padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>● blocked</span>
          </div>
          <div style={{ fontSize: 10, color: t.faint, marginTop: 2 }}>max_tx exceeded — no Stellar tx created</div>
        </div>
      ),
    },
    {
      icon: '◉',
      title: 'Approval Threshold',
      rule: 'approval_threshold: $100',
      desc: 'Payments above the threshold pause and wait. Argens emails you a link to a confirmation page — your agent holds, you review the transaction detail, and approve or reject with one click.',
      demo: (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.pending, flexShrink: 0, animation: 'dotPulse 1.5s infinite' }}/>
            <span style={{ background: t.pendingLow, color: t.pending, padding: '2px 7px', borderRadius: 4, fontSize: 10 }}>PENDING_APPROVAL</span>
          </div>
          <div style={{ color: t.muted, fontSize: 11, lineHeight: 1.5 }}>$250.00 to GXXX…<br/>awaiting your approval</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: 6, background: t.successLow, border: `1px solid rgba(77,158,106,0.3)`, borderRadius: 4, color: t.success, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Approve</button>
            <button style={{ flex: 1, padding: 6, background: t.errorLow, border: `1px solid rgba(160,72,72,0.3)`, borderRadius: 4, color: t.error, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Reject</button>
          </div>
        </div>
      ),
    },
  ]

  const gridRef = useRef<HTMLDivElement>(null)
  const [gridVisible, setGridVisible] = useState(false)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setGridVisible(true); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="lp-section-lg" style={{ padding: '96px 0', borderTop: `1px solid ${t.border}` }} id="policies">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <FadeUp>
          <div style={{ marginBottom: 56 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Policies</span>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(26px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, maxWidth: 520 }}>
              Guardrails that run automatically,<br/>not on good intentions.
            </h2>
            <p style={{ marginTop: 16, fontSize: 16, color: t.muted, maxWidth: 500, lineHeight: 1.7 }}>
              Three rules. Every payment — direct or marketplace — passes through all three before a single byte hits Stellar.
            </p>
          </div>
        </FadeUp>
        <div ref={gridRef} className="lp-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {cards.map((card, i) => (
            <div key={card.title} style={{
              background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 12, padding: 26,
              display: 'flex', flexDirection: 'column', gap: 16,
              opacity: gridVisible ? 1 : 0,
              transform: gridVisible ? 'translateY(0)' : 'translateY(24px)',
              transition: `opacity 0.65s ${i * 0.1}s cubic-bezier(0.16,1,0.3,1), transform 0.65s ${i * 0.1}s cubic-bezier(0.16,1,0.3,1)`,
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: t.accent }}>{card.icon}</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, marginBottom: 10, opacity: 0.85 }}>{card.rule}</div>
                <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.65 }}>{card.desc}</p>
              </div>
              <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '14px', marginTop: 'auto' }}>{card.demo}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Chain Logos (inline SVG) ─────────────────────────────────────────────────
function StellarSVG({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="28" fill="#000"/>
      <line x1="28" y1="11" x2="28" y2="45" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="12.8" y1="19.5" x2="43.2" y2="36.5" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="43.2" y1="19.5" x2="12.8" y2="36.5" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  )
}

function UsdcSVG({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="28" fill="#2775CA"/>
      <circle cx="28" cy="28" r="15" stroke="white" strokeWidth="2.5" fill="none"/>
      <text x="28" y="34" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="Inter, Arial, sans-serif">$</text>
    </svg>
  )
}

function BaseSVG({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="28" fill="#0052FF"/>
      <path d="M38 18 A 14 14 0 1 0 38 38" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Cross-Chain ──────────────────────────────────────────────────────────────
function CrossChain() {
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setAnimated(true); obs.disconnect() }
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const feats = [
    { icon: '◈', title: 'No bridges', desc: 'Circle CCTP V2 burns on Stellar and mints on Base. Native USDC only — no synthetic assets, no wrapped tokens.' },
    { icon: '⌘', title: 'Zero config', desc: 'Pass any 0x... address to POST /pay. Chain detection is automatic — no extra params needed.' },
    { icon: '◇', title: '~8–20 seconds', desc: 'Fast Transfer on CCTP V2. Argens uses Fast Transfer by default for near-instant cross-chain settlement.' },
    { icon: '◎', title: '0.5% fee · capped', desc: 'Cross-chain fee is 0.5% of amount, min $0.05, max $2.00 USDC. Direct Stellar payments remain $0 fee.' },
  ]

  const nodeCss = (delay: number, glow?: string): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 16,
    padding: '22px 20px', minWidth: 130, textAlign: 'center',
    opacity: animated ? 1 : 0,
    transform: animated ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.7s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.7s ${delay}s cubic-bezier(0.16,1,0.3,1)`,
    boxShadow: (glow && animated) ? `0 0 32px ${glow}` : undefined,
  })

  const arrowCss = (delay: number): React.CSSProperties => ({
    opacity: animated ? 1 : 0,
    transition: `opacity 0.6s ${delay}s ease`,
    padding: '0 8px', display: 'flex', alignItems: 'center', flexShrink: 0,
  })

  return (
    <section style={{ padding: '96px 0', borderTop: `1px solid ${t.border}`, background: t.bg, position: 'relative', overflow: 'hidden' }} id="cross-chain">
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,82,255,0.04) 0%, transparent 70%)', pointerEvents: 'none' }}/>

      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <FadeUp>
          <div style={{ textAlign: 'center', maxWidth: 580, margin: '0 auto 64px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0052FF', display: 'inline-block', animation: 'glow 2s infinite alternate' }}/>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5B8EFF', background: 'rgba(0,82,255,0.08)', border: '1px solid rgba(0,82,255,0.2)', padding: '4px 12px', borderRadius: 20, letterSpacing: '0.04em' }}>CCTP V2 · LIVE ON MAINNET</span>
            </div>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(28px,4vw,52px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 16, color: t.text }}>
              Pay any Base address.<br/>From Stellar, in one call.
            </h2>
            <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.75, maxWidth: 480, margin: '0 auto' }}>
              Argens auto-routes <code style={{ fontFamily: 'monospace', color: t.text2 }}>0x...</code> recipients via Circle CCTP V2. Burn on Stellar, mint natively on Base — no bridge, no wrapping, one API call. <span style={{ color: t.text2 }}>0.5% fee · min $0.05 · max $2.</span>
            </p>
          </div>
        </FadeUp>

        {/* Flow diagram */}
        <div ref={ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 72 }} className="lp-cctp-flow">

          <div style={nodeCss(0)}>
            <div style={{ width: 64, height: 64, borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <StellarSVG size={64} />
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, color: t.text }}>Stellar</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted }}>Burn USDC</div>
          </div>

          <div style={arrowCss(0.2)} className="lp-cctp-arrow">
            <svg width="52" height="20" viewBox="0 0 52 20" fill="none">
              <line x1="0" y1="10" x2="42" y2="10" stroke={t.border2} strokeWidth="1.5" strokeDasharray="3 3"/>
              <path d="M42 5 L52 10 L42 15" stroke={t.border2} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={nodeCss(0.2, 'rgba(39,117,202,0.15)')}>
            <div style={{ width: 64, height: 64, borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <UsdcSVG size={64} />
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, color: t.text }}>Circle CCTP V2</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted }}>Iris Attestation</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: t.accent }}>~8–20 seconds</div>
          </div>

          <div style={arrowCss(0.4)} className="lp-cctp-arrow">
            <svg width="52" height="20" viewBox="0 0 52 20" fill="none">
              <line x1="0" y1="10" x2="42" y2="10" stroke={t.border2} strokeWidth="1.5" strokeDasharray="3 3"/>
              <path d="M42 5 L52 10 L42 15" stroke={t.border2} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={nodeCss(0.4, 'rgba(0,82,255,0.12)')}>
            <div style={{ width: 64, height: 64, borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,82,255,0.3)' }}>
              <BaseSVG size={64} />
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, color: t.text }}>Base</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted }}>Mint USDC</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5B8EFF' }}>native USDC</div>
          </div>

        </div>

        {/* Code + Features */}
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 52, alignItems: 'start' }}>

          <FadeUp delay={0.06}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, marginBottom: 14, color: t.text }}>One request. Argens handles the rest.</div>
              <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.bg, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3A3733' }}/>)}
                  <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, color: t.muted }}>POST /v1/pay → Base via CCTP</span>
                </div>
                <div style={{ padding: '16px 20px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.9 }}>
                  <pre style={{ margin: 0 }}><code>
{SYN.cmt('// G... = Stellar  ·  0x... = Base (auto)')}{'\n'}
{SYN.kw('await')} {SYN.fn('fetch')}({SYN.str("'/v1/pay'")}, {'{'}{'\n'}
{'  '}body: {SYN.fn('JSON.stringify')}({'{'}{'\n'}
{'    '}recipient: {SYN.str('"0xABC...Base"')},{'\n'}
{'    '}amount:    {SYN.str('"25.0000000"')},{'\n'}
{'  }'}{')'}
{'\n'}{'}'}{');'}
                  </code></pre>
                </div>
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.border}`, background: t.bg, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.muted, lineHeight: 1.7 }}>
                  <span style={{ color: t.success }}>200</span>{' { status: '}<span style={{ color: '#7DB88A' }}>&quot;cross_chain_pending&quot;</span>,{'\n'}
                  {'     stellar_tx_hash: '}<span style={{ color: '#7DB88A' }}>&quot;a3f9...&quot;</span>,{'\n'}
                  {'     poll_url: '}<span style={{ color: '#7DB88A' }}>&quot;/v1/transactions/...&quot;</span>{' }'}
                </div>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.14}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {feats.map((f) => (
                <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(0,82,255,0.08)',
                    border: '1px solid rgba(0,82,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#5B8EFF', fontSize: 15,
                  }}>{f.icon}</div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, marginBottom: 4, color: t.text }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.65 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>

        </div>

      </div>
    </section>
  )
}

// ─── CTA + Footer ─────────────────────────────────────────────────────────────
function CtaFooter() {
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background mesh */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 520, background: 'radial-gradient(ellipse at 50% 0%, rgba(197,162,83,0.12) 0%, transparent 70%)', borderRadius: '50%' }}/>
        <div style={{ position: 'absolute', bottom: 0, left: '-5%', width: 500, height: 300, background: 'radial-gradient(ellipse at 0% 100%, rgba(77,155,106,0.06) 0%, transparent 70%)' }}/>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${t.border2} 1px, transparent 1px)`, backgroundSize: '32px 32px', opacity: 0.5, maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 100%)' }}/>
      </div>

      <section id="pricing" style={{ position: 'relative', zIndex: 1, padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,40px) 80px', textAlign: 'center' }}>
        <FadeUp>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.accent, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, display: 'inline-block', animation: 'glow 2s infinite alternate' }}/>
              Early access — mainnet live
            </div>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(32px,5vw,60px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 20, color: t.text }}>
              Your agent is waiting<br/>to pay its first bill.
            </h2>
            <p style={{ fontSize: 17, color: t.muted, lineHeight: 1.75, marginBottom: 40, maxWidth: 460, margin: '0 auto 40px' }}>
              A wallet, a policy engine, and a marketplace of 40+ AI services — all behind one API key. Get early access and put your agent to work.
            </p>
            <div className="lp-cta-btns" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' as const }}>
              <WaitlistButton size="lg" label="Get early access" />
            </div>
            <p style={{ marginTop: 24, fontSize: 12, color: t.faint, fontFamily: 'JetBrains Mono, monospace' }}>
              Or paste <span style={{ color: t.text2 }}>SKILL.md</span> into any agent and it onboards itself in under a minute.
            </p>
          </div>
        </FadeUp>
      </section>

      <footer style={{ position: 'relative', zIndex: 1, padding: '0 clamp(20px,4vw,40px) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="lp-footer-inner" style={{ borderTop: `1px solid ${t.border}`, paddingTop: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 24 }}>
            <Logo />
            <div className="lp-footer-links" style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' as const }}>
              {([['Services', '/services'], ['Docs', '/docs'], ['GitHub', '#'], ['Twitter / X', '#'], ['Privacy', '#'], ['Terms', '#']] as [string, string][]).map(([l, href]) => (
                <a key={l} href={href} style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
            <div style={{ fontSize: 12, color: t.faint, fontFamily: 'JetBrains Mono, monospace' }}>© 2026 Argens Inc.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function LandingPage() {
  return (
    <>
      <style>{`
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes glow      { from{opacity:0.5;box-shadow:none} to{opacity:1;box-shadow:0 0 8px currentColor} }
        @keyframes dotPulse  { 0%,100%{opacity:0.25;transform:scale(0.85)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeInUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ticker-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        a:hover { opacity: 0.82; }

        /* Ticker */
        .lp-ticker-track { animation: ticker-scroll 50s linear infinite; }
        .lp-ticker-track:hover { animation-play-state: paused; }

        /* CCTP flow diagram */
        .lp-cctp-flow  { flex-wrap: nowrap; }
        .lp-cctp-arrow { flex-shrink: 0; }

        /* Tablet: 3-col → 2-col */
        @media (max-width: 1023px) {
          .lp-3col    { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-svc-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* Mobile */
        @media (max-width: 767px) {
          .lp-cctp-flow  { flex-direction: column !important; align-items: center !important; gap: 12px !important; }
          .lp-cctp-arrow { transform: rotate(90deg); padding: 4px 0 !important; }
          .lp-pad         { padding-left: 20px !important; padding-right: 20px !important; }
          .lp-hero        { padding-top: 96px !important; padding-bottom: 52px !important; }
          .lp-hero-grid   { grid-template-columns: 1fr !important; gap: 40px !important; }
          .lp-hero-stats  { gap: 18px !important; flex-wrap: wrap !important; }
          .lp-stat-div    { display: none !important; }
          .lp-how-row     { grid-template-columns: 40px 1fr !important; gap: 12px !important; padding: 24px 0 !important; }
          .lp-how-code    { grid-column: 1 / -1 !important; }
          .lp-2col        { grid-template-columns: 1fr !important; gap: 20px !important; }
          .lp-3col        { grid-template-columns: 1fr !important; }
          .lp-svc-grid    { grid-template-columns: 1fr !important; }
          .lp-section-lg  { padding-top: 64px !important; padding-bottom: 64px !important; }
          .lp-mkt-snippet { white-space: pre-wrap !important; word-break: break-word !important; }
          .lp-cta-btns    { flex-direction: column !important; align-items: stretch !important; }
          .lp-footer-inner { flex-direction: column !important; align-items: flex-start !important; gap: 20px !important; }
          .lp-footer-links { gap: 12px 20px !important; }
          .lp-pricing-row { flex-direction: column !important; align-items: flex-start !important; gap: 3px !important; }
          .lp-hero-cta    { gap: 10px !important; }
        }
      `}</style>
      <Nav />
      <main>
        <Hero />
        <LiveTicker />
        <Problem />
        <HowItWorks />
        <Marketplace />
        <CrossChain />
        <TwoWays />
        <Policies />
        <CtaFooter />
      </main>
    </>
  )
}
