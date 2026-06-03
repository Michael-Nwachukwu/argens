'use client'

import type { CSSProperties, KeyboardEvent } from 'react'
import { Icon, Icons } from '@/components/dashboard/Icon'
import { useState } from 'react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
  required?: boolean
  maxLength?: number
  inputMode?: 'text' | 'numeric'
  fontFamily?: string
  fontSize?: number
  textAlign?: CSSProperties['textAlign']
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  autoFocus,
  required,
  maxLength,
  inputMode,
  fontFamily = 'var(--font-mono)',
  fontSize = 13,
  textAlign = 'left',
  onKeyDown,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      width: '100%',
      background: 'var(--bg)',
      border: '1px solid var(--border2)',
      borderRadius: 7,
      overflow: 'hidden',
      boxSizing: 'border-box',
      transition: 'border-color 0.15s',
    }}>
      <input
        type={visible ? 'text' : 'password'}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode}
        onKeyDown={onKeyDown}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          padding: '10px 12px',
          fontFamily,
          fontSize,
          color: 'var(--text)',
          outline: 'none',
          boxSizing: 'border-box',
          textAlign,
        }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          width: 42,
          border: 'none',
          borderLeft: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Icon d={visible ? Icons.eyeoff : Icons.eye} size={14} />
      </button>
    </div>
  )
}
