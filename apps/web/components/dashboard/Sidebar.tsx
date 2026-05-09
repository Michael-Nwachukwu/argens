'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/ui/Logo'
import { Icon, Icons } from './Icon'
import { useAuth } from '@/lib/auth-context'
import { wallet as walletApi, isError } from '@/lib/api'

const NAV_ITEMS = [
  { id: 'overview',     label: 'Overview',      icon: 'overview'     as const, href: '/dashboard'              },
  { id: 'wallet',       label: 'Wallet',         icon: 'wallet'       as const, href: '/dashboard/wallet'       },
  { id: 'policies',     label: 'Policies',       icon: 'policies'     as const, href: '/dashboard/policies'     },
  { id: 'transactions', label: 'Transactions',   icon: 'transactions' as const, href: '/dashboard/transactions' },
  { id: 'analytics',    label: 'Analytics',      icon: 'analytics'    as const, href: '/dashboard/analytics'    },
  { id: 'marketplace',  label: 'Marketplace',    icon: 'marketplace'  as const, href: '/dashboard/marketplace'  },
  { id: 'apikeys',      label: 'API Keys',       icon: 'apikeys'      as const, href: '/dashboard/api-keys'     },
  { id: 'settings',     label: 'Settings',       icon: 'settings'     as const, href: '/dashboard/settings'     },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuth()

  const [balance, setBalance] = useState<string | null>(null)

  useEffect(() => {
    walletApi.balance().then(r => {
      if (!isError(r)) setBalance(r.data.balance)
    }).catch(() => { /* balance stays null */ })
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'AG'

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Logo + balance */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <Logo size="md" href="/dashboard" />
        <div style={{
          marginTop: 16,
          padding: '10px 12px',
          background: 'var(--bg3)',
          borderRadius: 7,
          border: '1px solid var(--border)',
        }}>
          <div style={{
            fontSize: 10,
            color: 'var(--muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 2,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>Wallet Balance</div>
          <div style={{
            fontFamily: 'var(--font-head)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}>
            {balance ? `$${parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {balance ? `${parseFloat(balance).toFixed(2)} USDC on Stellar` : 'Loading…'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 6,
                background: active ? 'var(--bg3)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--muted)',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                fontWeight: active ? 500 : 400,
                textDecoration: 'none',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: 2,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ color: active ? 'var(--accent)' : 'var(--faint)', flexShrink: 0 }}>
                <Icon d={Icons[item.icon]} size={14} />
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? 'Agent'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--faint)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              transition: 'color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--faint)'}
          >
            <Icon d={Icons.logout} size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
