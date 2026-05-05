'use client'
import Link from 'next/link'

export function Logo({ size = 'md', href = '/' }: { size?: 'sm' | 'md' | 'lg'; href?: string }) {
  const fs = size === 'lg' ? 22 : size === 'sm' ? 14 : 18
  const iconSize = size === 'lg' ? 22 : size === 'sm' ? 16 : 20
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 20 20" fill="none">
        <polygon points="10,1 19,10 10,19 1,10" fill="var(--accent)" />
        <polygon points="10,6 14,10 10,14 6,10" fill="var(--bg)" />
      </svg>
      <span style={{ fontFamily: 'var(--font-head, "Space Grotesk", sans-serif)', fontSize: fs, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)' }}>
        Argens
      </span>
    </Link>
  )
}
