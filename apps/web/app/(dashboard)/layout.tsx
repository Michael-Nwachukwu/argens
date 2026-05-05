import type { ReactNode } from 'react'

// Transparent passthrough — actual dashboard layout lives in app/dashboard/layout.tsx
export default function GroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
