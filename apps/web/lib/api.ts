/**
 * lib/api.ts — Typed fetch wrapper for the Argens REST API.
 *
 * JWT is stored in an httpOnly cookie set by Next.js middleware.
 * Agent API key calls go directly from the API; this client is for dashboard (JWT) flows.
 */

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1'

// ─── Response envelope ────────────────────────────────────────────────────────

export interface ApiSuccess<T> { data: T; meta?: { page: number; total: number; pages: number } }
export interface ApiError { error: string; code: string; details?: unknown }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export function isError<T>(r: ApiResponse<T>): r is ApiError {
  return 'error' in r
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<ApiResponse<T>> {
  const { token, ...rest } = opts
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${BASE}${path}`, { ...rest, headers, credentials: 'include' })
    const json = await res.json() as ApiResponse<T>
    return json
  } catch {
    return { error: 'Network error', code: 'NETWORK_ERROR' }
  }
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────

/** Stored in memory after login — never persisted to localStorage. */
let _jwt: string | null = null
export function setJwt(t: string | null) { _jwt = t }
export function getJwt() { return _jwt }
export function clearJwt() { _jwt = null }

function authFetch<T>(path: string, opts: RequestInit = {}) {
  return apiFetch<T>(path, { ...opts, token: _jwt ?? undefined })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse { token: string; user: { id: string; email: string; emailVerified: boolean; transferPinSet: boolean } }
export interface SignupResponse { message: string; email: string }

export interface MeResponse {
  id: string
  email: string
  email_verified: boolean
  transfer_pin_set: boolean
  wallet: { address: string; status: string } | null
}

export const auth = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (email: string, password: string) =>
    apiFetch<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verify: (token: string) =>
    apiFetch<{ message: string; walletAddress: string }>(`/auth/verify/${token}`),

  resendVerification: (email: string) =>
    apiFetch<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  me: () => authFetch<MeResponse>('/auth/me'),
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface WalletBalance {
  balance: string
  currency: string
  xlm_balance: string
  wallet_address: string
  cached_at: string
}

export interface SendResult {
  status: 'success' | 'pending_approval'
  transaction_id: string
  stellar_tx_hash?: string
  amount: string
  recipient: string
  timestamp: string
  message?: string
  poll_url?: string
}

export const wallet = {
  balance: () => authFetch<WalletBalance>('/wallet/balance'),
  send: (data: { recipient: string; amount: string; memo?: string; pin?: string }) =>
    authFetch<SendResult>('/wallet/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export interface Policy {
  allowance_limit: string | null
  max_transaction_limit: string | null
  approval_threshold: string | null
  total_spent: string
}

export const policies = {
  get: () => authFetch<Policy>('/policies'),
  save: (data: { allowance_limit?: string | null; max_transaction_limit?: string | null; approval_threshold?: string | null }) =>
    authFetch<Policy>('/policies', { method: 'POST', body: JSON.stringify(data) }),
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TxStatus = 'SUCCESS' | 'BLOCKED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED'

export interface Transaction {
  id: string
  recipientAddress: string
  amount: string
  currency: string
  status: TxStatus
  memo: string | null
  stellarTxHash: string | null
  blockedReason: string | null
  metadata: Record<string, unknown> | null
  policyResult: Record<string, unknown> | null
  createdAt: string
}

export const transactions = {
  list: (params?: { page?: number; limit?: number; status?: string; from_date?: string; to_date?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))
    return authFetch<Transaction[]>(`/transactions?${qs.toString()}`)
  },
  get: (id: string) => authFetch<Transaction>(`/transactions/${id}`),
}

// ─── Agent status ─────────────────────────────────────────────────────────────

export interface AgentStatus {
  api_key_status: string
  wallet_balance: string
  policies: {
    allowance_limit: string | null
    allowance_remaining: string | null
    max_transaction_limit: string | null
    approval_threshold: string | null
  }
  today_spend: string
  today_transactions: number
}

export const agent = {
  status: () => authFetch<AgentStatus>('/agent/status'),
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKey {
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}
export interface NewApiKey { key: string; prefix: string }

export const apiKeys = {
  generate: () => authFetch<NewApiKey>('/auth/api-keys', { method: 'POST' }),
}

// ─── Approval ─────────────────────────────────────────────────────────────────

export const approval = {
  approve: (token: string) => authFetch<{ status: string; transaction_id: string; stellar_tx_hash: string }>(`/approve/${token}`, { method: 'POST' }),
  reject:  (token: string) => authFetch<{ status: string; transaction_id: string }>(`/reject/${token}`,  { method: 'POST' }),
  getTransaction: (id: string) => authFetch<Transaction>(`/transactions/${id}`),
}

// ─── Spend summary ────────────────────────────────────────────────────────────

export interface SpendSummary {
  period: string
  total_spent: string
  transaction_count: number
  blocked_count: number
  breakdown: Array<{ date: string; amount: string; count: number }>
}

export const spend = {
  summary: (period: 'daily' | 'weekly' | 'monthly' = 'monthly') =>
    authFetch<SpendSummary>(`/spend/summary?period=${period}`),
}

// ─── Transfer PIN ─────────────────────────────────────────────────────────────

export const pin = {
  set: (data: { pin: string; password: string }) =>
    authFetch<{ message: string }>('/auth/transfer-pin', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  remove: (data: { password: string }) =>
    authFetch<{ message: string }>('/auth/transfer-pin', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),
}
