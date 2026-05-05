'use client'

import { useState } from 'react'
import { TopBar } from '@/components/dashboard/TopBar'
import { Icon, Icons } from '@/components/dashboard/Icon'
import { apiKeys as apiKeysApi, isError } from '@/lib/api'

export default function ApiKeysPage() {
  const [revealed, setRevealed]   = useState(false)
  const [copied, setCopied]       = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [newKey, setNewKey]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const displayKey = newKey
    ? newKey
    : revealed
      ? 'argns_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      : 'argns_live_••••••••••••••••••••••••••••••••'

  const copy = () => {
    const val = newKey ?? displayKey
    navigator.clipboard?.writeText(val).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const confirmRegen = async () => {
    setLoading(true)
    setError('')
    const r = await apiKeysApi.generate()
    setLoading(false)
    if (isError(r)) {
      setError(r.error)
    } else {
      setNewKey(r.data.key)
      setRevealed(true)
      setRegenOpen(false)
    }
  }

  return (
    <div style={{ overflowY: 'auto' }}>
      <TopBar title="API Keys" subtitle="Keys authorize agent payments — treat them like passwords." />
      <div style={{ padding: '24px 32px', maxWidth: 620 }}>

        {/* Current key card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Live API key</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Use this in your agent&apos;s environment as <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg3)', padding: '1px 5px', borderRadius: 3 }}>ARGENS_KEY</code>.</div>

          {/* Key display */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ flex: 1, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', letterSpacing: revealed || newKey ? '0' : '0.05em' }}>
              {displayKey}
            </div>
            <button
              onClick={() => setRevealed(r => !r)}
              style={{ padding: '10px 12px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
            >
              <Icon d={revealed ? Icons.eyeoff : Icons.eye} size={14} />
            </button>
            <button
              onClick={copy}
              style={{ padding: '10px 12px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', color: copied ? 'var(--success)' : 'var(--muted)', cursor: 'pointer', transition: 'color 0.15s', fontSize: 12, fontFamily: 'var(--font-mono)' }}
            >
              {copied ? '✓' : 'copy'}
            </button>
          </div>

          {newKey && (
            <div style={{ padding: '10px 14px', background: 'var(--accent-low)', border: '1px solid var(--accent-mid)', borderRadius: 7, fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
              <span style={{ color: 'var(--accent)', marginRight: 8 }}>◈</span>
              Save this key now — it won&apos;t be shown again.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
            <span style={{ color: 'var(--success)' }}>● Active</span>
            {newKey && <span>Just generated</span>}
          </div>

          <button
            onClick={() => setRegenOpen(true)}
            style={{ padding: '7px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 6, color: 'var(--error)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
          >
            Regenerate key…
          </button>
          {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>{error}</div>}
        </div>

        {/* Agent onboarding hint */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Onboard your agent</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: '1.6' }}>
            Paste this one-liner into any AI agent to teach it how to use Argens:
          </div>
          <SkillPromptBox />
        </div>

        {/* Integration guide */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 22 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Quick integration</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '14px 16px', lineHeight: '1.9' }}>
            <span style={{ color: 'var(--faint)' }}># Set in your agent&apos;s environment:</span><br />
            <span style={{ color: 'var(--accent)' }}>ARGENS_KEY</span>=your_key_here<br /><br />
            <span style={{ color: 'var(--faint)' }}># Call the payments API:</span><br />
            <span style={{ color: 'var(--success)' }}>POST</span> https://api.argens.io/v1/pay<br />
            <span style={{ color: 'var(--faint)' }}>Authorization: Bearer $ARGENS_KEY</span>
          </div>
        </div>
      </div>

      {/* Regenerate confirm modal */}
      {regenOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setRegenOpen(false)}
        >
          <div
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Regenerate API key?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.6', marginBottom: 20 }}>
              Your current key will be immediately invalidated. Any agents using it will fail until you update their environment variables.
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, fontSize: 13, color: 'var(--error)', marginBottom: 20 }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRegenOpen(false)} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                Cancel
              </button>
              <button
                onClick={confirmRegen}
                disabled={loading}
                style={{ flex: 1, padding: '9px', background: 'var(--error-low)', border: '1px solid rgba(160,72,72,0.3)', borderRadius: 7, color: 'var(--error)', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500 }}
              >
                {loading ? 'Regenerating…' : 'Yes, regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SkillPromptBox() {
  const [copied, setCopied] = useState(false)
  const prompt = 'Hi, read https://argens.xyz/SKILL.md and continue with the onboarding steps.'
  const copy = () => {
    navigator.clipboard?.writeText(prompt).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, overflow: 'hidden' }}>
      <div style={{ flex: 1, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', lineHeight: '1.5' }}>
        {prompt}
      </div>
      <button
        onClick={copy}
        style={{ padding: '10px 14px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', color: copied ? 'var(--success)' : 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)', flexShrink: 0, transition: 'color 0.15s' }}
      >
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  )
}
