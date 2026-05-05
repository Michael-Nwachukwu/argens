'use client'

import type { ReactNode } from 'react'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 32px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div>
        <h1 style={{
          fontFamily: 'var(--font-head)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: 'var(--text)',
          margin: 0,
        }}>{title}</h1>
        {subtitle && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>
      )}
    </div>
  )
}
