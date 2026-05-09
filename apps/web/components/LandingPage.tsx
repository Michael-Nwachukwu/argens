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

// ─── Tally (waitlist) ─────────────────────────────────────────────────────────
const TALLY_FORM_ID = 'xX9AxG'

function useTally() {
  useEffect(() => {
    if (document.querySelector('script[src*="tally.so"]')) return
    const s = document.createElement('script')
    s.src = 'https://tally.so/widgets/embed.js'
    s.async = true
    document.head.appendChild(s)
  }, [])
}

// ─── Mobile breakpoint hook ───────────────────────────────────────────────────
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

function WaitlistButton({ size = 'sm', label = 'Join the waitlist', full }: { size?: 'sm' | 'lg'; label?: string; full?: boolean }) {
  const pad  = size === 'lg' ? '13px 26px' : '7px 14px'
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
        fontFamily: 'Space Grotesk, sans-serif', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center',
        width: full ? '100%' : undefined,
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

  // Close menu on resize to desktop
  useEffect(() => { if (!isMobile) setMenuOpen(false) }, [isMobile])

  const navLinks: [string, string][] = [
    ['#how', 'How it works'],
    ['#marketplace', 'Marketplace'],
    ['#policies', 'Policies'],
    ['#pricing', 'Pricing'],
  ]

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 40px)', height: 58,
        background: 'rgba(12,11,10,0.90)',
        backdropFilter: 'blur(16px) saturate(120%)',
        borderBottom: `1px solid ${scrolled || menuOpen ? t.border : 'transparent'}`,
        transition: 'border-color 0.2s',
      }}>
        <Logo />

        {!isMobile && (
          <>
            <ul style={{ display: 'flex', alignItems: 'center', gap: 28, listStyle: 'none', margin: 0, padding: 0 }}>
              {navLinks.map(([href, label]) => (
                <li key={href}><a href={href} style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>{label}</a></li>
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
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.muted,
              borderRadius: 6,
              padding: '7px 9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {menuOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 4h12M2 8h12M2 12h12"/>
              </svg>
            )}
          </button>
        )}
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 58, left: 0, right: 0, zIndex: 199,
          background: 'rgba(12,11,10,0.97)',
          backdropFilter: 'blur(20px)',
          borderBottom: menuOpen ? `1px solid ${t.border}` : 'none',
          overflow: 'hidden',
          maxHeight: menuOpen ? 400 : 0,
          transition: 'max-height 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {navLinks.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontSize: 16, color: t.text2, textDecoration: 'none',
                  padding: '14px 4px',
                  borderBottom: `1px solid ${t.border}`,
                  display: 'block',
                }}
              >
                {label}
              </a>
            ))}
            <div style={{ marginTop: 20 }}>
              <WaitlistButton size="lg" label="Join the waitlist" full />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Hero Code Widget ─────────────────────────────────────────────────────────
function HeroCodeWidget() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const cycle = () => {
      setPhase(0)
      const t1 = setTimeout(() => setPhase(1), 2000)
      const t2 = setTimeout(() => setPhase(2), 3400)
      const t3 = setTimeout(cycle, 6500)
      return [t1, t2, t3]
    }
    const timers = cycle()
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div>
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
        <div style={{ padding: '20px 22px', fontSize: 12.5, lineHeight: 1.8, fontFamily: 'JetBrains Mono, monospace', overflowX: 'auto' }}>
          <pre style={{ margin: 0 }}><code>
            {SYN.cmt('// POST https://api.argens.io/v1/pay')}{'\n\n'}
            {SYN.kw('const')} result = {SYN.kw('await')} {SYN.fn('fetch')}({SYN.str("'https://api.argens.io/v1/pay'")}, {'{'}
            {'\n  '}method: {SYN.str("'POST'")},{'\n  '}
            headers: {'{'} Authorization: {SYN.str('`Bearer ${process.env.ARGENS_KEY}`')} {'}'},{'\n  '}
            body: {SYN.fn('JSON.stringify')}({'{'}{'\n    '}
            recipient: {SYN.str("'GXXX...STELLAR'")},{'\n    '}
            amount: {SYN.str("'25.0000000'")}, memo: {SYN.str("'OpenAI API usage'")},{'\n  '}
            {'}'}),{'\n'}
            {'}'});{phase === 0 && <span style={{ animation: 'blink 1s step-end infinite', color: t.accent }}>▋</span>}
          </code></pre>
        </div>
      </div>
      <div style={{
        marginTop: 10, padding: '11px 16px',
        background: t.bg2, border: `1px solid ${t.border}`,
        borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 42,
      }}>
        {phase === 0 && <span style={{ color: t.faint }}>awaiting call…</span>}
        {phase === 1 && <>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.warning, display: 'inline-block', animation: 'glow 0.8s infinite alternate' }}/>
          <span style={{ color: t.muted }}>policy.check() — evaluating rules</span>
        </>}
        {phase === 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', animation: 'fadeInUp 0.2s ease-out' }}>
            <span style={{ background: t.successLow, color: t.success, fontFamily: 'monospace', fontSize: 10, padding: '2px 7px', borderRadius: 4 }}>● CONFIRMED</span>
            <span style={{ color: t.muted }}>txHash: <span style={{ color: t.text2 }}>3afc9…d2e1</span></span>
            <span style={{ marginLeft: 'auto', color: t.success, fontWeight: 500 }}>−25.00 USDC</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Hero Prompt Widget ───────────────────────────────────────────────────────
const CHAT_SEQ = [
  { delay: 400,  type: 'msg',      role: 'user',  text: SKILL_PROMPT },
  { delay: 1100, type: 'thinking' },
  { delay: 2000, type: 'msg',      role: 'agent', text: 'Got it — reading SKILL.md…', dim: true },
  { delay: 2700, type: 'thinking' },
  { delay: 3700, type: 'msg',      role: 'agent', text: "What's your Argens API key? Paste it and I'll confirm it's active." },
  { delay: 5100, type: 'msg',      role: 'user',  text: 'argns_live_7xK2mNpQ9rL…', mono: true },
  { delay: 5800, type: 'thinking' },
  { delay: 6600, type: 'msg',      role: 'agent', text: '✓ Key confirmed. Wallet is live. Your agent can now pay.', accent: true },
] as const

type ChatMsgItem = Extract<typeof CHAT_SEQ[number], { type: 'msg' }>

function HeroPromptWidget({ active }: { active: boolean }) {
  const [messages, setMessages] = useState<ChatMsgItem[]>([])
  const [thinking, setThinking] = useState(false)

  useEffect(() => {
    setMessages([]); setThinking(false)
    if (!active) return
    const timers = CHAT_SEQ.map(item => setTimeout(() => {
      if (item.type === 'thinking') { setThinking(true) }
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
function Hero() {
  const [view, setView] = useState<'REST'|'Prompt'>('REST')
  const [pinned, setPinned] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DWELLS = { REST: 5000, Prompt: 8500 }
  const isMobile = useIsMobile()

  useEffect(() => {
    if (pinned) return
    timerRef.current = setTimeout(() => setView(v => v === 'REST' ? 'Prompt' : 'REST'), DWELLS[view])
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [view, pinned])

  const switchTo = (v: 'REST'|'Prompt') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPinned(true); setView(v)
  }

  return (
    <section className="lp-hero" style={{ padding: '148px 0 88px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', background: 'radial-gradient(ellipse at 80% 20%, rgba(197,162,83,0.05) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }}/>
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px', position: 'relative', zIndex: 1 }}>
        <div className="lp-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, background: t.accentLow, border: `1px solid ${t.accentMid}`, padding: '5px 12px', borderRadius: 20, marginBottom: 28, letterSpacing: '0.04em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, display: 'inline-block' }}/>
              Now on Stellar testnet
            </div>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(38px,5.5vw,72px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 20 }}>
              Give your AI agent the ability to pay.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: t.text2, marginBottom: 32, maxWidth: 400 }}>
              An API key that authorizes autonomous USDC spending on Stellar — within policies you define.
            </p>
            <div className="lp-hero-cta" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <WaitlistButton size="lg" label="Join the waitlist" />
              <a href="#how" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 26px', borderRadius: 7, fontSize: 15, color: t.text2, border: `1px solid ${t.border2}`, textDecoration: 'none' }}>See how it works →</a>
            </div>
            <div className="lp-hero-stats" style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 28 }}>
              {[
                { v: '$0',          l: 'on direct USDC transfers' },
                { v: '<50ms',       l: 'policy check latency' },
                { v: '~$0.000001', l: 'Stellar network fee' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  {i > 0 && <div className="lp-stat-div" style={{ width: 1, height: 30, background: t.border }}/>}
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, color: t.text }}>{s.v}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{s.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — widget area */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {(['REST','Prompt'] as const).map(v => (
                <button key={v} onClick={() => switchTo(v)} style={{
                  padding: '4px 14px', borderRadius: 20, border: '1px solid',
                  borderColor: view===v ? t.accentMid : t.border,
                  background: view===v ? t.accentLow : 'transparent',
                  color: view===v ? t.accent : t.muted,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, cursor: 'pointer',
                  transition: 'all 0.15s', letterSpacing: '0.05em',
                }}>{v}</button>
              ))}
              {pinned && (
                <button onClick={() => setPinned(false)} style={{
                  padding: '3px 8px', borderRadius: 20, border: `1px solid ${t.border}`,
                  background: 'transparent', color: t.faint, fontFamily: 'monospace',
                  fontSize: 10, cursor: 'pointer', marginLeft: 2,
                }}>auto ↺</button>
              )}
            </div>
            {isMobile ? (
              /* On mobile: just show the active widget without fixed height */
              <div>
                {view === 'REST' ? <HeroCodeWidget /> : <HeroPromptWidget active={view === 'Prompt'} />}
              </div>
            ) : (
              <div style={{ position: 'relative', height: 310 }}>
                <div style={{ position: 'absolute', inset: 0, opacity: view==='REST'?1:0, transition: 'opacity 0.45s ease', pointerEvents: view==='REST'?'auto':'none' }}>
                  <HeroCodeWidget />
                </div>
                <div style={{ position: 'absolute', inset: 0, opacity: view==='Prompt'?1:0, transition: 'opacity 0.45s ease', pointerEvents: view==='Prompt'?'auto':'none' }}>
                  <HeroPromptWidget active={view==='Prompt'} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Problem ──────────────────────────────────────────────────────────────────
function Problem() {
  return (
    <section style={{ padding: '72px 0', borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, background: t.bg2 }}>
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(20px,3vw,32px)', fontWeight: 500, lineHeight: 1.45, letterSpacing: '-0.02em', color: t.text }}>
            AI agents can browse, decide, and act.{' '}
            <span style={{ color: t.muted }}>But when they hit a paywall, the workflow breaks. A human has to step in.</span>
          </p>
          <p style={{ marginTop: 28, fontSize: 18, color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: t.accent }}>Argens</span> is the fix.
          </p>
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
      title: 'Spin up a smart wallet',
      desc: 'One API call creates an agent-custodial USDC wallet on Stellar. Keys are yours — exportable anytime. Argens funds the initial XLM reserve so your agent is ready to transact immediately.',
      snippet: "GET /v1/wallet/balance",
      result: '// { balance: "0.0000000", address: "GXXX..." }',
    },
    {
      num: '02',
      title: 'Set spending policies',
      desc: 'Define a monthly cap, a per-transaction max, and an approval threshold. Payments that exceed your rules are blocked or paused — automatically, before any USDC moves.',
      snippet: '{ max_tx: 50, allowance: 500, threshold: 100 }',
      result: '// Policy active — agent constrained',
    },
    {
      num: '03',
      title: 'Drop in the API key',
      desc: 'One environment variable. Your agent can now pay for APIs, compute, services, or other agents — autonomously, within your rules, with a full audit trail and your approval inbox in the loop.',
      snippet: 'ARGENS_KEY=argns_live_…',
      result: '// Agent payments unlocked',
    },
  ]
  return (
    <section className="lp-section-lg" style={{ padding: '96px 0' }} id="how">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ marginBottom: 64 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>How it works</span>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(26px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, maxWidth: 500 }}>From zero to agent payments in three steps.</h2>
        </div>
        {steps.map((s, i) => (
          <div key={i} className="lp-how-row" style={{ display: 'grid', gridTemplateColumns: '64px 1fr minmax(0,360px)', gap: 40, alignItems: 'start', padding: '36px 0', borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.accent, paddingTop: 3, letterSpacing: '0.04em' }}>{s.num}</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 10 }}>{s.title}</div>
              <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.65, maxWidth: 400 }}>{s.desc}</p>
            </div>
            <div className="lp-how-code" style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: t.faint }}>$</span>
                <span style={{ color: t.text2 }}>{s.snippet}</span>
              </div>
              <div style={{ padding: '10px 16px', color: t.success, opacity: 0.8 }}>{s.result}</div>
            </div>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${t.border}` }}/>
      </div>
    </section>
  )
}

// ─── Marketplace ──────────────────────────────────────────────────────────────
function Marketplace() {
  const [activeService, setActiveService] = useState(0)

  const services = [
    {
      name: 'Image generation',
      provider: 'flux-schnell',
      cost: '0.0030000',
      tag: 'compute',
      tagColor: t.pending,
      tagBg: t.pendingLow,
      snippet: `POST /v1/marketplace/call\n{ service: "flux-schnell",\n  payload: { prompt: "..." } }`,
    },
    {
      name: 'Web search',
      provider: 'exa-search',
      cost: '0.0010000',
      tag: 'data',
      tagColor: t.success,
      tagBg: t.successLow,
      snippet: `POST /v1/marketplace/call\n{ service: "exa-search",\n  payload: { query: "..." } }`,
    },
    {
      name: 'Code execution',
      provider: 'e2b-sandbox',
      cost: '0.0050000',
      tag: 'compute',
      tagColor: t.pending,
      tagBg: t.pendingLow,
      snippet: `POST /v1/marketplace/call\n{ service: "e2b-sandbox",\n  payload: { code: "..." } }`,
    },
  ]

  return (
    <section className="lp-section-lg" style={{ padding: '96px 0', borderTop: `1px solid ${t.border}`, background: t.bg2 }} id="marketplace">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>

          {/* Left — copy */}
          <div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Marketplace</span>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(26px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 20 }}>
              One key.<br/>Every AI service.
            </h2>
            <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.75, marginBottom: 28, maxWidth: 420 }}>
              Your agent shouldn&apos;t need a separate API key for every tool it uses. Argens provides a curated marketplace of AI services — image generation, web search, code execution, embeddings — all accessible with a single Argens key and a single API call.
            </p>
            <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.75, marginBottom: 36, maxWidth: 420 }}>
              Each call is an autonomous micropayment. Your policy engine guards the spend. Your wallet settles on Stellar in seconds. No billing relationships, no rate limit negotiations, no keys to rotate.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { step: '→', label: 'Agent discovers services', desc: 'GET /v1/marketplace/services returns a live catalogue with pricing.' },
                { step: '→', label: 'Agent calls a service', desc: 'POST /v1/marketplace/call — one request, one payment, one response.' },
                { step: '→', label: 'Policy engine guards spend', desc: 'Marketplace calls go through the same allowance and approval rules as any payment.' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingTop: i > 0 ? 16 : 0, borderTop: i > 0 ? `1px solid ${t.border}` : 'none' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: t.accent, flexShrink: 0, marginTop: 2 }}>{row.step}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 3, fontFamily: 'Space Grotesk, sans-serif' }}>{row.label}</div>
                    <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>{row.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — interactive service picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.faint, letterSpacing: '0.04em' }}>GET /v1/marketplace/services</span>
                <span style={{ marginLeft: 'auto', background: t.successLow, color: t.success, fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', borderRadius: 3 }}>200 OK</span>
              </div>
              {services.map((svc, i) => (
                <div
                  key={i}
                  onClick={() => setActiveService(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderBottom: i < services.length - 1 ? `1px solid ${t.border}` : 'none',
                    cursor: 'pointer',
                    background: activeService === i ? t.bg2 : 'transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{svc.name}</div>
                    <div style={{ fontSize: 11, color: t.muted, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{svc.provider}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: svc.tagBg, color: svc.tagColor, fontFamily: 'monospace', flexShrink: 0 }}>{svc.tag}</span>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.text2, flexShrink: 0, textAlign: 'right' as const }}>
                    <div>{svc.cost}</div>
                    <div style={{ fontSize: 10, color: t.faint }}>USDC / call</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', transition: 'all 0.2s' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.faint }}>agent call</span>
              </div>
              <div className="lp-mkt-snippet" style={{ padding: '14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.text2, lineHeight: 1.7, whiteSpace: 'pre', animation: 'fadeInUp 0.18s ease-out' }}>
                {services[activeService].snippet}
              </div>
              <div style={{ padding: '10px 14px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: t.successLow, color: t.success, fontSize: 10, padding: '2px 7px', borderRadius: 3, fontFamily: 'monospace' }}>● paid</span>
                <span style={{ color: t.faint, fontSize: 11, fontFamily: 'monospace' }}>−{services[activeService].cost} USDC · policy: passed</span>
              </div>
            </div>

            <div style={{ fontSize: 12, color: t.faint, fontFamily: 'JetBrains Mono, monospace', padding: '0 4px' }}>
              ← click a service to see the call
            </div>
          </div>
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
        <div style={{ marginBottom: 56 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Integration</span>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(26px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Two ways to integrate.</h2>
          <p style={{ marginTop: 12, fontSize: 16, color: t.muted, maxWidth: 480, lineHeight: 1.7 }}>Write code if you want full control. Prompt your agent if you want it running in under a minute.</p>
        </div>
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* REST card */}
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: t.bg3, border: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 4h12M4 8h8M6 12h4"/></svg>
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 16 }}>Write code</div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>REST API · any language</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.65 }}>Call <code style={{ fontFamily: 'monospace', fontSize: 12, color: t.text2, background: t.bg3, padding: '1px 5px', borderRadius: 3 }}>POST /v1/pay</code> directly from your code. TypeScript, Python, cURL — anything that can make an HTTP request.</p>
            <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 7, padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              <div style={{ color: t.faint, marginBottom: 6, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Quick start</div>
              <div><span style={{ color: t.accent }}>const</span> result = <span style={{ color: t.accent }}>await</span> <span style={{ color: '#A08BC8' }}>fetch</span>(<span style={{ color: '#7DB88A' }}>&apos;https://api.argens.io/v1/pay&apos;</span>, …)</div>
            </div>
            <a href="#" style={{ fontSize: 13, color: t.accent, textDecoration: 'none', marginTop: 'auto' }}>View API docs →</a>
          </div>
          {/* Prompt card */}
          <div style={{ background: t.bg2, border: `1px solid ${t.accentMid}`, borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '60%', height: '100%', background: 'radial-gradient(ellipse at 80% 20%, rgba(197,162,83,0.06) 0%, transparent 70%)', pointerEvents: 'none' }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: t.accentLow, border: `1px solid ${t.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.accent }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zM5 8h6M8 5l3 3-3 3"/></svg>
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 16 }}>Prompt your agent</div>
                <div style={{ fontSize: 12, color: t.accent, marginTop: 2, fontFamily: 'monospace' }}>zero install · zero SDK</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.65 }}>Paste one line into any AI agent. It fetches the Argens skill file, asks for your API key, and starts transacting. Works with Claude, ChatGPT, LangChain, CrewAI — anything that can read a URL.</p>
            <div style={{ position: 'relative' }}>
              <div style={{ background: t.bg, border: `1px solid ${t.border2}`, borderRadius: 7, padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: t.text2, lineHeight: 1.6, wordBreak: 'break-all' as const }}>{SKILL_PROMPT}</div>
              <button onClick={copy} style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: copied ? 'rgba(77,155,106,0.12)' : t.bg2, color: copied ? t.success : t.muted, fontFamily: 'monospace', fontSize: 10, transition: 'all 0.15s' }}>{copied ? '✓ copied' : 'copy'}</button>
            </div>
            <div style={{ fontSize: 12, color: t.accent, fontFamily: 'monospace', marginTop: 'auto' }}>← The fastest onboarding path we have.</div>
          </div>
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
      title: 'Allowance',
      rule: 'monthly_cap: $500',
      desc: 'Cap total spend for a given period. Any payment that would exceed the limit is rejected before it reaches the Stellar network.',
      demo: <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: t.muted }}>spent this month</span><span style={{ color: t.text2 }}>$312.40</span></div>
        <div style={{ height: 4, background: t.bg3, borderRadius: 2, overflow: 'hidden' }}><div style={{ width: '62%', height: '100%', background: t.accent, borderRadius: 2 }}/></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span style={{ color: t.faint }}>$0</span><span style={{ color: t.faint }}>$500 cap</span></div>
      </div>,
    },
    {
      icon: '◇',
      title: 'Max Transaction',
      rule: 'max_tx: $50',
      desc: 'No single payment can exceed this amount. Prevents a runaway agent from draining your wallet in one call — no matter what the agent decides.',
      demo: <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: t.muted }}>allowed</span><span style={{ background: t.successLow, color: t.success, padding: '2px 7px', borderRadius: 4, fontSize: 10 }}>● $12.50</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: t.muted }}>blocked</span><span style={{ background: t.errorLow, color: t.error, padding: '2px 7px', borderRadius: 4, fontSize: 10 }}>● $75.00</span></div>
      </div>,
    },
    {
      icon: '◉',
      title: 'Approval Threshold',
      rule: 'approval_above: $100',
      desc: 'Payments over a threshold pause and send you an email before executing. You approve or reject — the agent waits.',
      demo: <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
        <span style={{ background: t.pendingLow, color: t.pending, padding: '2px 7px', borderRadius: 4, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>PENDING_APPROVAL</span>
        <div style={{ color: t.muted, fontSize: 11 }}>$250.00 — awaiting your approval</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ flex: 1, padding: 5, background: t.successLow, border: `1px solid rgba(77,158,106,0.3)`, borderRadius: 4, color: t.success, cursor: 'pointer', fontSize: 11 }}>Approve</button>
          <button style={{ flex: 1, padding: 5, background: t.errorLow, border: `1px solid rgba(160,72,72,0.3)`, borderRadius: 4, color: t.error, cursor: 'pointer', fontSize: 11 }}>Reject</button>
        </div>
      </div>,
    },
  ]
  return (
    <section className="lp-section-lg" style={{ padding: '96px 0', borderTop: `1px solid ${t.border}` }} id="policies">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ marginBottom: 56 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Policies</span>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(26px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, maxWidth: 520 }}>Guardrails that run automatically, not on good intentions.</h2>
        </div>
        <div className="lp-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {cards.map(card => (
            <div key={card.title} style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: t.accentLow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: t.accent }}>{card.icon}</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.accent, marginBottom: 10 }}>{card.rule}</div>
                <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.6 }}>{card.desc}</p>
              </div>
              <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, padding: '12px 14px', marginTop: 'auto' }}>{card.demo}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ─────────────────────────────────────────────────────────────────
function Pricing() {
  return (
    <section className="lp-section-lg" style={{ padding: '96px 0', borderTop: `1px solid ${t.border}`, background: t.bg2 }} id="pricing">
      <div className="lp-pad" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Pricing</span>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(64px,12vw,120px)', fontWeight: 700, letterSpacing: '-0.04em', color: t.accent, lineHeight: 1, margin: '24px 0 8px' }}>$0</div>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 500, color: t.text, marginBottom: 12, letterSpacing: '-0.01em' }}>on direct USDC transfers.</p>
          <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.7, marginBottom: 36 }}>Send USDC from your agent to any Stellar address and keep every cent. No percentage cut. No flat fee. Nothing hidden.</p>
          <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { send: '$0.50', recv: '$0.50' },
              { send: '$25.00', recv: '$25.00' },
              { send: '$1,000.00', recv: '$1,000.00' },
            ].map((row, i) => (
              <div key={i} className="lp-pricing-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '6px 0', borderBottom: i < 2 ? `1px solid ${t.border}` : 'none' }}>
                <span style={{ color: t.muted }}>agent sends {row.send}</span>
                <span style={{ color: t.success }}>→ recipient gets {row.recv}</span>
              </div>
            ))}
            <div style={{ marginTop: 4, fontSize: 11, color: t.faint, fontFamily: 'JetBrains Mono, monospace' }}>
              Only Stellar network fee applies (~$0.000001 per tx)
            </div>
          </div>
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
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 520, background: 'radial-gradient(ellipse at 50% 0%, rgba(197,162,83,0.13) 0%, transparent 70%)', borderRadius: '50%' }}/>
        <div style={{ position: 'absolute', bottom: 0, left: '-5%', width: 500, height: 300, background: 'radial-gradient(ellipse at 0% 100%, rgba(77,155,106,0.07) 0%, transparent 70%)' }}/>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, ${t.border2} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.55,
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 100%)',
        }}/>
      </div>

      {/* CTA content */}
      <section style={{ position: 'relative', zIndex: 1, padding: '112px 40px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.accent, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, display: 'inline-block' }}/>
            Early access
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(32px,5vw,60px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 20, color: t.text }}>
            Your agent is waiting<br/>to pay its first bill.
          </h2>
          <p style={{ fontSize: 17, color: t.muted, lineHeight: 1.75, marginBottom: 40, maxWidth: 420, margin: '0 auto 40px' }}>
            Get early access to Argens — a wallet, a policy engine, and a marketplace, all through a single API key.
          </p>
          <div className="lp-cta-btns" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' as const }}>
            <WaitlistButton size="lg" label="Join the waitlist" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '0 clamp(20px, 4vw, 40px) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="lp-footer-inner" style={{ borderTop: `1px solid ${t.border}`, paddingTop: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 24 }}>
            <Logo />
            <div className="lp-footer-links" style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' as const }}>
              {['Docs','GitHub','Twitter / X','Privacy','Terms'].map(l => (
                <a key={l} href="#" style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>{l}</a>
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
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes glow { from{opacity:0.5} to{opacity:1;box-shadow:0 0 6px #B8832A} }
        @keyframes dotPulse { 0%,100%{opacity:0.25;transform:scale(0.85)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        a:hover { opacity: 0.85; }

        /* ── Responsive ─────────────────────────────────────────────────────── */

        /* Tablet: 3-col → 2-col */
        @media (max-width: 1023px) {
          .lp-3col { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* Mobile */
        @media (max-width: 767px) {
          .lp-pad { padding-left: 20px !important; padding-right: 20px !important; }
          .lp-hero { padding-top: 96px !important; padding-bottom: 52px !important; }
          .lp-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .lp-hero-stats { gap: 20px !important; flex-wrap: wrap !important; }
          .lp-stat-div { display: none !important; }
          .lp-how-row {
            grid-template-columns: 40px 1fr !important;
            gap: 12px !important;
            padding: 24px 0 !important;
          }
          .lp-how-code { grid-column: 1 / -1 !important; }
          .lp-2col { grid-template-columns: 1fr !important; gap: 20px !important; }
          .lp-3col { grid-template-columns: 1fr !important; }
          .lp-section-lg { padding-top: 64px !important; padding-bottom: 64px !important; }
          .lp-mkt-snippet { white-space: pre-wrap !important; word-break: break-word !important; }
          .lp-cta-btns { flex-direction: column !important; align-items: stretch !important; }
          .lp-footer-inner {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 20px !important;
          }
          .lp-footer-links { gap: 12px 20px !important; }
          .lp-pricing-row { flex-direction: column !important; align-items: flex-start !important; gap: 4px !important; }
        }
      `}</style>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Marketplace />
        <TwoWays />
        <Policies />
        <Pricing />
        <CtaFooter />
      </main>
    </>
  )
}
