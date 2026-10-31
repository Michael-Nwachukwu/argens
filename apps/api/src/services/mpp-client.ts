/**
 * services/mpp-client.ts
 *
 * Scoped MPP HTTP client for Argens marketplace calls.
 *
 * MPP Router migrated to the x402 v2 payment protocol (2026-06). The legacy
 * Payment-auth / mppx `stellar.charge` scheme is no longer honoured server-side
 * (it returns `502 Invalid base64 JSON header` on the credential). We now speak
 * x402 v2 directly:
 *   1. Issue the request, receive a `402` with an x402 `payment-required` header.
 *   2. Build + sign a Stellar `exact` payment credential (Soroban SEP-41 transfer)
 *      with @x402/stellar, gated behind the caller's `onChallenge` policy check.
 *   3. Retry the request with the credential in the `payment-signature` header.
 *   4. Read the `payment-response` settlement header for the receipt.
 *
 * The PUBLIC interface (MppChallengeSnapshot / MppRequestParams / MppRequestResult
 * / MppReceipt / performMppRequest) is unchanged so services/marketplace.ts needs
 * no changes — the snapshot still carries method=`stellar`, intent=`charge`, the
 * atomic-unit `amount` string, the USDC SAC `currency`, and the `recipient` payTo.
 */

import type {
  PaymentRequired as X402PaymentRequired,
  SettleResponse as X402SettleResponse,
} from '@x402/core/client'

export interface MppChallengeSnapshot {
  method: string
  intent: string
  id: string
  description: string | null
  amount: string | null
  currency: string | null
  recipient: string | null
  raw: Record<string, unknown>
}

export interface MppRequestParams {
  secretKey: string
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
  onChallenge: (challenge: MppChallengeSnapshot) => Promise<void>
}

export interface MppRequestResult {
  ok: boolean
  status: number
  headers: Record<string, string>
  body: unknown
  text: string
  receipt: MppReceipt | null
  refund: MppRefundSignal | null
  progress: Array<Record<string, unknown>>
}

/**
 * MPP Router's automatic-refund signal, read from the `Refund-*` response headers.
 * The router settles BEFORE calling upstream and, on non-delivery (timeout, 5xx,
 * post-payment 4xx, empty body), queues a refund of the full settled amount to the
 * payer. `status` is the raw `Refund-Status` value, e.g. `pending`, `manual-review`,
 * `not-applicable-direct-settlement`. See services/marketplace-refund.ts.
 */
export interface MppRefundSignal {
  status: string
  id: string | null
  status_url: string | null
  mode: string | null
}

export interface MppReceipt {
  method: string
  reference: string
  status: 'success'
  timestamp: string
  externalId?: string
}

const NETWORK = process.env['STELLAR_NETWORK'] === 'mainnet' ? 'mainnet' : 'testnet'

// CAIP-2 network id used by x402 / @x402/stellar.
const X402_NETWORK = NETWORK === 'mainnet' ? 'stellar:pubnet' : 'stellar:testnet'

// Soroban RPC is required by @x402/stellar to simulate + build the SEP-41 transfer.
// Mirrors the resolution used in services/cctp.ts.
const SOROBAN_RPC_URL =
  process.env['SOROBAN_RPC_URL'] ??
  (NETWORK === 'mainnet' ? 'https://mainnet.sorobanrpc.com' : 'https://soroban-testnet.stellar.org')

export async function performMppRequest(params: MppRequestParams): Promise<MppRequestResult> {
  const [{ x402Client, x402HTTPClient }, { ExactStellarScheme, createEd25519Signer }] =
    await Promise.all([import('@x402/core/client'), import('@x402/stellar')])

  const progress: Array<Record<string, unknown>> = []

  // One signer per request — bound to this user's Stellar secret key only.
  const signer = createEd25519Signer(params.secretKey, X402_NETWORK)
  const scheme = new ExactStellarScheme(signer, { url: SOROBAN_RPC_URL })
  const client = x402Client.fromConfig({
    schemes: [{ network: X402_NETWORK, client: scheme, x402Version: 2 }],
  })
  const http = new x402HTTPClient(client)

  const baseHeaders = { ...(params.headers ?? {}) }
  // fetch() throws on a GET/HEAD with a body; MPP's GET routes take query params only.
  const body = params.method === 'GET' || params.method === 'HEAD' ? undefined : params.body

  // 1. Initial request — expect a 402 Payment Required.
  let response = await fetch(params.url, {
    method: params.method,
    headers: baseHeaders,
    body,
  })

  if (response.status === 402) {
    // Parse the 402 body (x402 v1 compatibility) before we read the headers.
    const challengeText = await response.text()
    let challengeBody: unknown
    if (challengeText) {
      try {
        challengeBody = JSON.parse(challengeText)
      } catch {
        challengeBody = undefined
      }
    }

    const paymentRequired = http.getPaymentRequiredResponse(
      (name: string) => response.headers.get(name),
      challengeBody,
    )
    progress.push({ type: 'challenge' })

    // Enforce policy / credits / approval BEFORE signing or paying. Throws to abort
    // with no funds moved (the credential is signed AND submitted only after this).
    await params.onChallenge(toChallengeSnapshot(paymentRequired))

    progress.push({ type: 'signing' })
    const payload = await http.createPaymentPayload(paymentRequired)
    progress.push({ type: 'signed' })

    const paymentHeaders = http.encodePaymentSignatureHeader(payload)

    // 2. Retry with the signed x402 credential — the facilitator settles on submit.
    response = await fetch(params.url, {
      method: params.method,
      headers: { ...baseHeaders, ...paymentHeaders },
      body,
    })
  }

  const text = await response.text()
  const headers = Object.fromEntries(response.headers.entries())

  let responseBody: unknown = text
  const contentType = response.headers.get('content-type') ?? ''
  if (text && contentType.includes('application/json')) {
    try {
      responseBody = JSON.parse(text) as unknown
    } catch {
      responseBody = text
    }
  }

  // 3. Settlement receipt — present ONLY when the payment actually settled. This is
  //    what marketplace.ts uses for `paymentCommitted`, so a failed/rejected call
  //    correctly yields a null receipt (no false "paid" flag).
  let receipt: MppReceipt | null = null
  try {
    const settle: X402SettleResponse | undefined = http.getPaymentSettleResponse(
      (name: string) => response.headers.get(name),
    )
    if (settle && settle.success && settle.transaction) {
      receipt = {
        method: 'stellar',
        reference: settle.transaction,
        status: 'success',
        timestamp: new Date().toISOString(),
        ...(settle.payer ? { externalId: settle.payer } : {}),
      }
      progress.push({ type: 'paid', hash: settle.transaction })
    }
  } catch {
    receipt = null
  }

  // Fallback: MPP Router signals settlement with its own `x-payment-*` headers
  // (`x-payment-tx` = on-chain settlement hash, `x-payment-settle-status: settled`),
  // not the x402-standard PAYMENT-RESPONSE header read above.
  if (!receipt) {
    const settleTx = response.headers.get('x-payment-tx')
    const settleStatus = response.headers.get('x-payment-settle-status')
    if (settleTx && (settleStatus === 'settled' || response.ok)) {
      receipt = {
        method: response.headers.get('x-payment-method') ?? 'stellar',
        reference: settleTx,
        status: 'success',
        timestamp: new Date().toISOString(),
      }
      progress.push({ type: 'paid', hash: settleTx })
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    headers,
    body: responseBody,
    text,
    receipt,
    refund: readRefundSignal(response.headers, params.url),
    progress,
  }
}

function readRefundSignal(headers: Headers, requestUrl: string): MppRefundSignal | null {
  const status = headers.get('refund-status')?.trim()
  if (!status) return null
  const id = headers.get('refund-id')?.trim() || null
  // The x402 path sets Refund-Id without Refund-Status-Url; the receipt lives at
  // GET /v1/refunds/{id} on the router either way.
  let statusUrl = headers.get('refund-status-url')?.trim() || null
  if (!statusUrl && id) {
    statusUrl = `${new URL(requestUrl).origin}/v1/refunds/${encodeURIComponent(id)}`
  }
  return { status, id, status_url: statusUrl, mode: headers.get('refund-mode')?.trim() || null }
}

function toChallengeSnapshot(paymentRequired: X402PaymentRequired): MppChallengeSnapshot {
  const accepted = paymentRequired.accepts?.[0]
  return {
    // MPP Router's x402 `accepts` entry is { scheme: 'exact', network: 'stellar:pubnet' }.
    // marketplace.ts gates on method === 'stellar' && intent === 'charge', so map to those.
    method: 'stellar',
    intent: 'charge',
    id: typeof paymentRequired.resource?.url === 'string' ? paymentRequired.resource.url : '',
    description: null,
    amount: typeof accepted?.amount === 'string' ? accepted.amount : null,
    currency: typeof accepted?.asset === 'string' ? accepted.asset : null,
    recipient: typeof accepted?.payTo === 'string' ? accepted.payTo : null,
    raw: paymentRequired as unknown as Record<string, unknown>,
  }
}
