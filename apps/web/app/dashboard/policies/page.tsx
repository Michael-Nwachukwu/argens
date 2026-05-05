'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/dashboard/TopBar'
import { Icon, Icons } from '@/components/dashboard/Icon'
import { policies as policyApi, isError } from '@/lib/api'
import type { Policy } from '@/lib/api'

interface Field { key: string; label: string; value: string; placeholder: string }

function PolicyCard({
  icon, title, desc, fields, onSave,
}: {
  icon: string
  title: string
  desc: string
  fields: Field[]
  onSave: (vals: Record<string, string>) => Promise<void>
}) {
  const [editing, setEditing]   = useState(false)
  const [vals, setVals]         = useState<Record<string, string>>(Object.fromEntries(fields.map(f => [f.key, f.value])))
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  // Sync vals when props change (after data load)
  useEffect(() => {
    setVals(Object.fromEntries(fields.map(f => [f.key, f.value])))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map(f => f.value).join(',')])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(vals)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: 7, background: 'var(--accent-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 16, flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '1.5' }}>{desc}</div>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}
          >
            Edit
          </button>
        )}
      </div>

      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fields.map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{f.label}</label>
            {editing ? (
              <input
                value={vals[f.key] ?? ''}
                onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{
                  background: 'var(--bg2)', border: '1px solid var(--accent)',
                  borderRadius: 5, padding: '5px 10px',
                  fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)',
                  outline: 'none', width: 160, textAlign: 'right',
                }}
              />
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
                {vals[f.key] || <span style={{ color: 'var(--faint)', fontSize: 12 }}>not set</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setEditing(false); setError('') }}
            style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '7px 14px', background: saving ? 'var(--bg3)' : 'var(--accent)', border: 'none', borderRadius: 6, color: saving ? 'var(--muted)' : '#0C0B0A', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-head)', fontWeight: 600 }}
          >
            {saving ? 'Saving…' : 'Save policy'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>✗ {error}</div>
      )}
      {saved && (
        <div style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon d={Icons.check} size={12} /> Policy saved
        </div>
      )}
    </div>
  )
}

export default function PoliciesPage() {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    policyApi.get()
      .then(r => { if (!isError(r)) setPolicy(r.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fmt = (v: string | null) => v ? `$${parseFloat(v).toFixed(2)}` : ''

  const saveAllowance = async (vals: Record<string, string>) => {
    const limit = vals['cap'] ? vals['cap'].replace('$', '') : null
    const r = await policyApi.save({ allowance_limit: limit })
    if (isError(r)) throw new Error(r.error)
    setPolicy(r.data)
  }

  const saveMaxTx = async (vals: Record<string, string>) => {
    const limit = vals['max'] ? vals['max'].replace('$', '') : null
    const r = await policyApi.save({ max_transaction_limit: limit })
    if (isError(r)) throw new Error(r.error)
    setPolicy(r.data)
  }

  const saveThreshold = async (vals: Record<string, string>) => {
    const limit = vals['threshold'] ? vals['threshold'].replace('$', '') : null
    const r = await policyApi.save({ approval_threshold: limit })
    if (isError(r)) throw new Error(r.error)
    setPolicy(r.data)
  }

  return (
    <div style={{ overflowY: 'auto' }}>
      <TopBar title="Policies" subtitle="Enforced by Soroban smart contracts — not application logic." />
      <div style={{ padding: '24px 32px', maxWidth: 740, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Info banner */}
        <div style={{ padding: '12px 16px', background: 'var(--accent-low)', border: '1px solid var(--accent-mid)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--accent)' }}>◈</span>
          Policy changes are submitted as on-chain transactions and take ~5 seconds to confirm on Stellar.
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading policies…</div>
        ) : (
          <>
            <PolicyCard
              icon="◈"
              title="Monthly Allowance"
              desc="Cap total agent spend per calendar month. Resets automatically on the 1st."
              fields={[{ key: 'cap', label: 'Monthly cap (USDC)', value: fmt(policy?.allowance_limit ?? null), placeholder: '500.00' }]}
              onSave={saveAllowance}
            />
            <PolicyCard
              icon="◇"
              title="Max Transaction Size"
              desc="No single payment can exceed this. Applied per-call, atomically."
              fields={[{ key: 'max', label: 'Maximum per transaction (USDC)', value: fmt(policy?.max_transaction_limit ?? null), placeholder: '50.00' }]}
              onSave={saveMaxTx}
            />
            <PolicyCard
              icon="◉"
              title="Approval Threshold"
              desc="Payments above this amount pause and notify you before executing."
              fields={[{ key: 'threshold', label: 'Approval required above (USDC)', value: fmt(policy?.approval_threshold ?? null), placeholder: '100.00' }]}
              onSave={saveThreshold}
            />

            {policy?.soroban_contract_id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--success)' }}>◈</span>
                Contract: {policy.soroban_contract_id.slice(0, 12)}…{policy.soroban_contract_id.slice(-8)}
                <a href={`https://stellar.expert/explorer/public/contract/${policy.soroban_contract_id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', marginLeft: 4 }}>
                  ↗
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
