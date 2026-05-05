'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { auth, setJwt, clearJwt } from './api'

interface User {
  id: string
  email: string
  emailVerified: boolean
  transferPinSet: boolean
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'argens_token'
const USER_KEY = 'argens_user'
const EMAIL_KEY = 'argens_last_email'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const t = sessionStorage.getItem(STORAGE_KEY)
      const u = sessionStorage.getItem(USER_KEY)
      if (t && u) {
        setToken(t)
        setJwt(t)
        setUser(JSON.parse(u) as User)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  // Tab visibility: logout after 5 minutes of being away
  const handleLogout = useCallback(() => {
    setToken(null)
    setUser(null)
    clearJwt()
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(USER_KEY)
  }, [])

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>
    const IDLE_MS = 5 * 60 * 1000 // 5 minutes

    const onVisibility = () => {
      if (document.hidden) {
        // Tab hidden — start countdown
        idleTimer = setTimeout(() => {
          handleLogout()
        }, IDLE_MS)
      } else {
        // Tab visible again — cancel countdown
        clearTimeout(idleTimer)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(idleTimer)
    }
  }, [handleLogout])

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    const res = await auth.login(email, password)
    if ('error' in res) return { error: res.error }
    const { token: t, user: u } = res.data
    setToken(t)
    setUser(u as User)
    setJwt(t)
    sessionStorage.setItem(STORAGE_KEY, t)
    sessionStorage.setItem(USER_KEY, JSON.stringify(u))
    localStorage.setItem(EMAIL_KEY, email)
    return {}
  }

  const refreshUser = async () => {
    const res = await auth.me()
    if (!('error' in res)) {
      const { id, email, email_verified, transfer_pin_set } = res.data
      setUser({ id, email, emailVerified: email_verified, transferPinSet: transfer_pin_set })
    }
  }

  const logout = handleLogout

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
