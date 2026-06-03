'use client'

import { SUPPORT_WHATSAPP_URL } from '@/lib/constants'

export function FundingHelpCard() {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 6, lineHeight: 1.5 }}>
        Having trouble funding? Not sure how to fund?
      </div>
      <a
        href={SUPPORT_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}
      >
        Reach out on WhatsApp →
      </a>
    </div>
  )
}
