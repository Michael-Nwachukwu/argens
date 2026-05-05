'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Logo } from './ui/Logo'

// ─── Design tokens (inline — keeps LP self-contained) ─────────────────────────
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

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav() {
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
      padding: '0 40px', height: 58,
      background: 'rgba(12,11,10,0.80)',
      backdropFilter: 'blur(16px) saturate(120%)',
      borderBottom: `1px solid ${scrolled ? t.border : 'transparent'}`,
      transition: 'border-color 0.2s',
    }}>
      <Logo />
      <ul style={{ display: 'flex', alignItems: 'center', gap: 28, listStyle: 'none' }}>
        {[['#how','How it works'],['#twoways','Integration'],['#policies','Policies'],['#pricing','Pricing']].map(([href, label]) => (
          <li key={href}><a href={href} style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>{label}</a></li>
        ))}
      </ul>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/login" style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, color: t.muted, textDecoration: 'none' }}>Log in</Link>
        <Link href="/signup" style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: t.accent, color: t.bg, textDecoration: 'none' }}>Start building</Link>
      </div>
    </nav>
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
    <section style={{ padding: '148px 0 88px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', background: 'radial-gradient(ellipse at 80% 20%, rgba(197,162,83,0.05) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }}/>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.accent, background: t.accentLow, border: `1px solid ${t.accentMid}`, padding: '5px 12px', borderRadius: 20, marginBottom: 28, letterSpacing: '0.04em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, display: 'inline-block' }}/>
              Now on Stellar mainnet
            </div>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(44px,5.5vw,72px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 20 }}>
              Give your AI agent the ability to pay.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: t.text2, marginBottom: 32, maxWidth: 400 }}>
              An API key that authorizes autonomous USDC spending on Stellar — within policies you define, enforced on-chain.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 26px', borderRadius: 7, fontSize: 15, fontWeight: 600, background: t.accent, color: t.bg, textDecoration: 'none' }}>Start building</Link>
              <a href="#twoways" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 26px', borderRadius: 7, fontSize: 15, color: t.text2, border: `1px solid ${t.border2}`, textDecoration: 'none' }}>Read the docs →</a>
            </div>
            <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 28 }}>
              {[{v:'~$0.000001',l:'tx fee on Stellar'},{v:'<50ms',l:'policy check latency'},{v:'0.5%',l:'per payment, nothing else'}].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  {i > 0 && <div style={{ width: 1, height: 30, background: t.border }}/>}
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, color: t.text }}>{s.v}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{s.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
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
            <div style={{ position: 'relative', height: 310 }}>
              <div style={{ position: 'absolute', inset: 0, opacity: view==='REST'?1:0, transition: 'opacity 0.45s ease', pointerEvents: view==='REST'?'auto':'none' }}>
                <HeroCodeWidget />
              </div>
              <div style={{ position: 'absolute', inset: 0, opacity: view==='Prompt'?1:0, transition: 'opacity 0.45s ease', pointerEvents: view==='Prompt'?'auto':'none' }}>
                <HeroPromptWidget active={view==='Prompt'} />
              </div>
            </div>
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
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 500, lineHeight: 1.45, letterSpacing: '-0.02em', color: t.text }}>
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
    { num: '01', title: 'Create a smart wallet', desc: 'One API call spins up an agent-custodial wallet on Stellar. Keys are yours — exportable anytime. No forms, no KYC for testing.', snippet: "await argens.wallet.create()", result: "// { address: 'GXXX...', balance: '0.00' }" },
    { num: '02', title: 'Set spending policies', desc: 'Define max per transaction, monthly allowance, and approval thresholds. Enforced by Soroban smart contracts — not application logic you can forget to ship.', snippet: '{ maxTx: 50, monthly: 500, threshold: 100 }', result: '// Policy deployed on-chain' },
    { num: '03', title: 'Drop in the API key', desc: 'One environment variable. Your agent can now pay for APIs, compute, services, or other agents — autonomously, within your rules, with a full audit trail.', snippet: 'ARGENS_KEY=argns_live_…', result: '// Agent payments unlocked' },
  ]
  return (
    <section style={{ padding: '96px 0' }} id="how">
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ marginBottom: 64 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>How it works</span>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, maxWidth: 500 }}>From zero to agent payments in three steps.</h2>
        </div>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr minmax(0,360px)', gap: 40, alignItems: 'start', padding: '36px 0', borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: t.accent, paddingTop: 3, letterSpacing: '0.04em' }}>{s.num}</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 10 }}>{s.title}</div>
              <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.65, maxWidth: 400 }}>{s.desc}</p>
            </div>
            <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
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

// ─── Two Ways ────────────────────────────────────────────────────────────────
function TwoWays() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(SKILL_PROMPT).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <section style={{ padding: '96px 0', borderTop: `1px solid ${t.border}` }} id="twoways">
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ marginBottom: 56 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Integration</span>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Two ways to integrate.</h2>
          <p style={{ marginTop: 12, fontSize: 16, color: t.muted, maxWidth: 480, lineHeight: 1.7 }}>Write code if you want full control. Prompt your agent if you want it running in under a minute.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
              <div><span style={{ color: t.accent }}>const</span> result = <span style={{ color: t.accent }}>await</span> <span style={{ color: '#A08BC8' }}>fetch</span>(<span style={{ color: '#7DB88A' }}>'https://api.argens.io/v1/pay'</span>, …)</div>
            </div>
            <a href="#integration" style={{ fontSize: 13, color: t.accent, textDecoration: 'none', marginTop: 'auto' }}>View integration docs →</a>
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
    { icon: '◈', title: 'Allowance', rule: 'monthly_cap: $500', desc: 'Cap total spend for a given period. The smart contract rejects any payment that would exceed the limit — automatically.',
      demo: <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: t.muted }}>spent this month</span><span style={{ color: t.text2 }}>$312.40</span></div>
        <div style={{ height: 4, background: t.bg3, borderRadius: 2, overflow: 'hidden' }}><div style={{ width: '62%', height: '100%', background: t.accent, borderRadius: 2 }}/></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span style={{ color: t.faint }}>$0</span><span style={{ color: t.faint }}>$500 cap</span></div>
      </div> },
    { icon: '◇', title: 'Max Transaction', rule: 'max_tx: $50', desc: "No single payment can exceed this amount. Prevents a runaway agent from draining your wallet in one call.",
      demo: <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: t.muted }}>allowed</span><span style={{ background: t.successLow, color: t.success, padding: '2px 7px', borderRadius: 4, fontSize: 10 }}>● $12.50</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: t.muted }}>blocked</span><span style={{ background: t.errorLow, color: t.error, padding: '2px 7px', borderRadius: 4, fontSize: 10 }}>● $75.00</span></div>
      </div> },
    { icon: '◉', title: 'Approval Threshold', rule: 'approval_above: $100', desc: 'Payments over a certain amount pause and request human approval via email before executing.',
      demo: <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
        <span style={{ background: t.pendingLow, color: t.pending, padding: '2px 7px', borderRadius: 4, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>PENDING_APPROVAL</span>
        <div style={{ color: t.muted, fontSize: 11 }}>$250.00 — awaiting your approval</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ flex: 1, padding: 5, background: t.successLow, border: `1px solid rgba(77,158,106,0.3)`, borderRadius: 4, color: t.success, cursor: 'pointer', fontSize: 11 }}>Approve</button>
          <button style={{ flex: 1, padding: 5, background: t.errorLow, border: `1px solid rgba(160,72,72,0.3)`, borderRadius: 4, color: t.error, cursor: 'pointer', fontSize: 11 }}>Reject</button>
        </div>
      </div> },
  ]
  return (
    <section style={{ padding: '96px 0' }} id="policies">
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ marginBottom: 56 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Policies</span>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, maxWidth: 520 }}>Guardrails that run on-chain, not in your head.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
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
    <section style={{ padding: '96px 0' }} id="pricing">
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: t.muted, marginBottom: 16, display: 'block' }}>Pricing</span>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(72px,12vw,120px)', fontWeight: 700, letterSpacing: '-0.04em', color: t.accent, lineHeight: 1, margin: '24px 0 8px' }}>0.5%</div>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 500, color: t.text, marginBottom: 12, letterSpacing: '-0.01em' }}>per transaction. Nothing else.</p>
          <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.7, marginBottom: 36 }}>No monthly fees. No seat charges. No setup costs. Free to start — you pay when your agent pays.</p>
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 10, padding: 24, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['$1,000 in payments','$5.00'],['$10,000 in payments','$50.00'],['$100,000 in payments','$500.00']].map(([vol,fee]) => (
              <div key={vol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, padding: '4px 0' }}>
                <span style={{ color: t.muted }}>{vol}</span>
                <span style={{ color: t.text2 }}>{fee} <span style={{ color: t.faint }}>to Argens</span></span>
              </div>
            ))}
          </div>
          <Link href="/signup" style={{ display: 'block', padding: '13px 26px', borderRadius: 7, fontSize: 15, fontWeight: 600, background: t.accent, color: t.bg, textDecoration: 'none', textAlign: 'center' }}>Start building for free</Link>
          <p style={{ marginTop: 16, fontSize: 13, color: t.faint }}>No credit card required to start.</p>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${t.border}`, padding: '48px 0' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 24 }}>
          <Logo />
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            {['Docs','GitHub','Twitter / X','Privacy','Terms'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: t.muted, textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
          <div style={{ fontSize: 12, color: t.faint, fontFamily: 'JetBrains Mono, monospace' }}>© 2026 Argens Inc.</div>
        </div>
      </div>
    </footer>
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
      `}</style>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <TwoWays />
        <Policies />
        <Pricing />
        <Footer />
      </main>
    </>
  )
}
