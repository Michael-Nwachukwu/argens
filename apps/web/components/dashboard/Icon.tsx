'use client'

import type { CSSProperties } from 'react'

interface IconProps {
  d: string
  size?: number
  style?: CSSProperties
}

export function Icon({ d, size = 16, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={d} />
    </svg>
  )
}

export const Icons = {
  overview:     'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  wallet:       'M1 4h14v9a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm0 3h14M10 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
  policies:     'M8 1l5.5 3v4.5A5.5 5.5 0 018 14.5 5.5 5.5 0 012.5 8.5V4L8 1zM5.5 8l2 2 3-3',
  transactions: 'M1 4h14M1 8h10M1 12h7',
  analytics:    'M1 13l4-5 3 3 3-4.5 4 6.5',
  marketplace:  'M2 5l6-3 6 3-6 3-6-3zm0 3l6 3 6-3M2 11l6 3 6-3',
  apikeys:      'M10 1a5 5 0 010 10 5 5 0 010-10zm-4 5h9M13 4l2 2-2 2',
  settings:     'M8 5a3 3 0 100 6 3 3 0 000-6zM8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4',
  arrow:        'M3 8h10M9 4l4 4-4 4',
  copy:         'M11 1H5a1 1 0 00-1 1v9a1 1 0 001 1h6a1 1 0 001-1V2a1 1 0 00-1-1zM9 14H3a1 1 0 01-1-1V5',
  eye:          'M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zm7-2a2 2 0 100 4 2 2 0 000-4z',
  eyeoff:       'M2 2l12 12M6.7 6.7A2 2 0 0010.3 9.3M9.9 3.2A7 7 0 0115 8s-.8 1.5-2.2 2.8M1 8s1.5-5 7-5',
  refresh:      'M14 8A6 6 0 002.5 4.5M2 2v3h3M2 8a6 6 0 0011.5 3.5M14 14v-3h-3',
  check:        'M2 8l4 4 8-8',
  x:            'M2 2l12 12M14 2L2 14',
  search:       'M7 1a6 6 0 100 12A6 6 0 007 1zm9 9l-3.5-3.5',
  filter:       'M1 2h14M3 6h10M5 10h6M7 14h2',
  chevrondown:  'M4 6l4 4 4-4',
  plus:         'M8 2v12M2 8h12',
  logout:       'M10 3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3M7 10l3-3-3-3M1 8h9',
} as const

export type IconName = keyof typeof Icons
