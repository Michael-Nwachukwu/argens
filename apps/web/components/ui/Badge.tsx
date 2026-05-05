'use client'
import { type TxStatus } from '@/lib/api'

const BADGE_MAP: Record<string, { cls: string; label: string }> = {
  SUCCESS:          { cls: 'badge--success', label: 'SUCCESS' },
  CONFIRMED:        { cls: 'badge--success', label: 'CONFIRMED' },
  BLOCKED:          { cls: 'badge--error',   label: 'BLOCKED' },
  PENDING_APPROVAL: { cls: 'badge--pending', label: 'PENDING' },
  APPROVED:         { cls: 'badge--success', label: 'APPROVED' },
  REJECTED:         { cls: 'badge--error',   label: 'REJECTED' },
  FAILED:           { cls: 'badge--error',   label: 'FAILED' },
}

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  'badge--success': { background: 'var(--success-low)', color: 'var(--success)' },
  'badge--error':   { background: 'var(--error-low)',   color: 'var(--error)'   },
  'badge--warning': { background: 'var(--warning-low)', color: 'var(--warning)' },
  'badge--pending': { background: 'var(--pending-low)', color: 'var(--pending)' },
}

export function StatusBadge({ status }: { status: TxStatus | string }) {
  const b = BADGE_MAP[status] ?? { cls: 'badge--warning', label: status }
  const style = BADGE_STYLES[b.cls] ?? {}
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono, monospace)', fontSize: 10, fontWeight: 500,
      padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {b.label}
    </span>
  )
}
