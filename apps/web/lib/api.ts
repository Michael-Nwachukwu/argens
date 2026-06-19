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

  signup: (email: string, password: string, accessCode: string) =>
    apiFetch<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, accessCode }),
    }),

  verify: (token: string) =>
    apiFetch<{ message: string; wallet_address: string; api_key?: string; api_key_prefix?: string; api_key_message?: string }>(`/auth/verify/${token}`),

  resendVerification: (email: string) =>
    apiFetch<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  me: () => authFetch<MeResponse>('/auth/me'),
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface WalletBalance {
  balance: string
  currency: string
  xlm_balance: string
  credits_balance: string
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

export interface ExportKeyResult {
  secret_key: string
  public_key: string
  network: string
  warning: string
}

export const wallet = {
  balance: () => authFetch<WalletBalance>('/wallet/balance'),
  send: (data: { recipient: string; amount: string; memo?: string; pin?: string }) =>
    authFetch<SendResult>('/wallet/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  exportKey: (password: string) =>
    authFetch<ExportKeyResult>('/wallet/export-key', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  bootstrapRetry: () =>
    authFetch<{ status: string; wallet_address?: string; message: string }>('/wallet/bootstrap-retry', {
      method: 'POST',
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
  type?: string
  serviceId?: string | null
  costPaid?: string | null
  memo: string | null
  stellarTxHash: string | null
  blockedReason: string | null
  metadata: Record<string, unknown> | null
  policyResult: Record<string, unknown> | null
  approvalToken?: string | null  // present only while status is PENDING_APPROVAL
  createdAt: string
}

// Returned by GET /approve/:token — public, no auth (the 256-bit single-use token is the bearer).
export interface ApprovalView {
  transaction: {
    id: string
    status: TxStatus
    type: string
    recipient: string
    amount: string
    currency: string
    memo: string | null
    service_id: string | null
    cost_paid: string | null
    created_at: string
  }
  approval: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
    expires_at: string
    acted_at: string | null
  }
}

export const transactions = {
  list: (params?: { page?: number; limit?: number; status?: string; type?: string; from_date?: string; to_date?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))
    return authFetch<Transaction[]>(`/transactions?${qs.toString()}`)
  },
  get: (id: string) => authFetch<Transaction>(`/transactions/${id}`),
  // Reject a pending-approval transaction from the dashboard (works even after the token expires).
  dismiss: (id: string) =>
    authFetch<{ status: string; transaction_id: string; message: string }>(`/transactions/${id}/dismiss`, {
      method: 'POST',
    }),
}

// ─── Marketplace ──────────────────────────────────────────────────────────────
// The catalog is grouped into PROVIDERS (one card/toggle per provider, e.g. "AgentMail",
// "OpenAI"). Each provider has child endpoints; agents call a specific endpoint by its `id`.

export interface MarketplaceEndpoint {
  id: string                    // the MPP operation id — what an agent passes as service_id
  label: string                 // operation label, e.g. "Send message"
  method: 'POST' | 'GET'
  path: string                  // upstream public path, e.g. /v1/services/agentmail/inboxes
  description: string
  price: string                 // e.g. "$0.010/request"
  example_payload: Record<string, unknown> | null
}

// `MarketplaceService` is the PROVIDER (kept this name for continuity).
export interface MarketplaceService {
  id: string                    // provider key, e.g. "agentmail"
  name: string                  // display name, e.g. "AgentMail"
  description: string
  categories: string[]
  display_price: string         // a range, e.g. "$0.001 – $10/request" or "$0.001/request"
  is_enabled: boolean           // provider-level toggle (enables all its endpoints)
  availability_note: string | null
  payment_rail: string
  status: 'active' | 'limited'
  docs_url: string | null
  endpoint_count: number
  endpoints: MarketplaceEndpoint[]
}

export interface MarketplaceCallResult {
  status: 'success'
  transaction_id: string
  stellar_tx_hash: string | null
  service_id: string
  service_name: string
  cost_paid: string
  currency: 'USDC'
  result: unknown
}

export const marketplace = {
  services: () => authFetch<MarketplaceService[]>('/marketplace/services'),
  // `providerId` is the provider key (e.g. "agentmail"); toggling it affects all its endpoints.
  setEnabled: (providerId: string, enabled: boolean) =>
    authFetch<{ provider_id: string; enabled: boolean }>(`/marketplace/services/${providerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  // `service_id` here is the ENDPOINT id (the MPP operation), not the provider key.
  call: (data: { service_id: string; payload?: Record<string, unknown>; query?: Record<string, string | number | boolean> }) =>
    authFetch<MarketplaceCallResult | { status: 'pending_approval'; transaction_id: string; message: string; poll_url: string }>(
      '/marketplace/call',
      { method: 'POST', body: JSON.stringify(data) },
    ),
  skillMarkdown: async (providerId: string): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE}/marketplace/services/${providerId}/skill.md`)
      if (!res.ok) return null
      return res.text()
    } catch { return null }
  },
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
// These are token-authenticated, not session-authenticated — the email confirmation
// page is reached without a JWT. The token (crypto.randomBytes(32), single-use, 24h) is
// the bearer credential, so use the unauthenticated apiFetch, not authFetch.

export const approval = {
  view:    (token: string) => apiFetch<ApprovalView>(`/approve/${token}`),
  approve: (token: string) => apiFetch<{ status: string; transaction_id: string; stellar_tx_hash?: string; amount?: string }>(`/approve/${token}`, { method: 'POST' }),
  reject:  (token: string) => apiFetch<{ status: string; transaction_id: string; message: string }>(`/reject/${token}`,  { method: 'POST' }),
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
