/**
 * services/mpp-client.ts
 *
 * Scoped MPP HTTP client for Argens marketplace calls.
 * Important: we use Mppx with `polyfill: false` so one user's Stellar keypair
 * never mutates global fetch for another concurrent Express request.
 */

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
  progress: Array<Record<string, unknown>>
}

export interface MppReceipt {
  method: string
  reference: string
  status: 'success'
  timestamp: string
  externalId?: string
}

export async function performMppRequest(params: MppRequestParams): Promise<MppRequestResult> {
  const [{ Mppx, stellar }, { Receipt }] = await Promise.all([
    import('@stellar/mpp/charge/client'),
    import('mppx'),
  ])

  const progress: Array<Record<string, unknown>> = []

  const mppx = Mppx.create({
    polyfill: false,
    methods: [
      stellar.charge({
        secretKey: params.secretKey,
        mode: 'pull',
        onProgress: (event: Record<string, unknown>) => {
          progress.push(event)
        },
      }),
    ],
    onChallenge: async (challenge: Record<string, unknown>, helpers: { createCredential: () => Promise<string> }) => {
      await params.onChallenge(toChallengeSnapshot(challenge))
      return helpers.createCredential()
    },
  })

  const response = await mppx.fetch(params.url, {
    method: params.method,
    headers: params.headers,
    body: params.body,
  })

  const text = await response.text()
  const headers = Object.fromEntries(response.headers.entries())

  let body: unknown = text
  const contentType = response.headers.get('content-type') ?? ''
  if (text && contentType.includes('application/json')) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = text
    }
  }

  let receipt: MppReceipt | null = null
  try {
    receipt = Receipt.fromResponse(response) as MppReceipt
  } catch {
    receipt = null
  }

  return {
    ok: response.ok,
    status: response.status,
    headers,
    body,
    text,
    receipt,
    progress,
  }
}

function toChallengeSnapshot(challenge: Record<string, unknown>): MppChallengeSnapshot {
  const request = challenge['request'] as Record<string, unknown>
  return {
    method: String(challenge['method'] ?? ''),
    intent: String(challenge['intent'] ?? ''),
    id: String(challenge['id'] ?? ''),
    description: typeof challenge['description'] === 'string' ? challenge['description'] : null,
    amount: typeof request['amount'] === 'string' ? request['amount'] : null,
    currency: typeof request['currency'] === 'string' ? request['currency'] : null,
    recipient: typeof request['recipient'] === 'string' ? request['recipient'] : null,
    raw: challenge,
  }
}
