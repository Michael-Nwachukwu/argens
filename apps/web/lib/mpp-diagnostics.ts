/**
 * Helpers for rendering marketplace failure diagnostics from
 * Transaction.metadata.mpp_router (written by markMarketplaceFailed).
 *
 * upstream_body may be a JSON object, a plain string, or an HTML error page.
 * Do not assume object shape.
 */

export interface MppReceipt {
  method?: string
  reference?: string
  status?: string
  timestamp?: string
  externalId?: string
}

export interface MppRouterMeta {
  receipt: MppReceipt | null
  progress: Array<Record<string, unknown>>
  upstream_status: number | null
  upstream_body: unknown
}

const HTML_BODY_DISPLAY_CAP = 2000

export function asMppRouter(metadata: unknown): MppRouterMeta | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>)['mpp_router']
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const m = raw as Record<string, unknown>
  const progress = Array.isArray(m['progress'])
    ? (m['progress'] as Array<Record<string, unknown>>)
    : []
  const receiptRaw = m['receipt']
  const receipt =
    receiptRaw && typeof receiptRaw === 'object' && !Array.isArray(receiptRaw)
      ? (receiptRaw as MppReceipt)
      : null
  const status = m['upstream_status']
  return {
    receipt,
    progress,
    upstream_status: typeof status === 'number' ? status : status == null ? null : Number(status) || null,
    upstream_body: m['upstream_body'] ?? null,
  }
}

export function formatUpstreamBody(body: unknown): {
  text: string
  kind: 'json' | 'text' | 'html' | 'empty'
  truncated: boolean
} {
  if (body == null) return { text: '—', kind: 'empty', truncated: false }

  if (typeof body === 'string') {
    const trimmed = body.trimStart()
    const looksHtml =
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<html') ||
      trimmed.startsWith('<HTML')
    if (looksHtml) {
      const truncated = body.length > HTML_BODY_DISPLAY_CAP
      return {
        text: truncated ? `${body.slice(0, HTML_BODY_DISPLAY_CAP)}\n… [HTML truncated]` : body,
        kind: 'html',
        truncated,
      }
    }
    return { text: body, kind: 'text', truncated: false }
  }

  try {
    return { text: JSON.stringify(body, null, 2), kind: 'json', truncated: false }
  } catch {
    return { text: String(body), kind: 'text', truncated: false }
  }
}

/** Stable short signature for grouping identical upstream failures in ops triage. */
export function upstreamSignature(mpp: MppRouterMeta): string {
  const formatted = formatUpstreamBody(mpp.upstream_body)
  if (formatted.kind === 'empty') return `(status ${mpp.upstream_status ?? '?'})`
  const key = formatted.text.replace(/\s+/g, ' ').trim()
  return key.length > 120 ? `${key.slice(0, 120)}…` : key
}

export function paymentSettledLabel(receipt: MppReceipt | null): {
  charged: boolean
  label: string
  reference: string | null
} {
  if (receipt == null) {
    return {
      charged: false,
      label: 'No — you were not charged',
      reference: null,
    }
  }
  const reference = typeof receipt.reference === 'string' && receipt.reference.length > 0
    ? receipt.reference
    : null
  return {
    charged: true,
    label: reference
      ? `Yes — settled (receipt ${reference})`
      : 'Yes — settled (receipt present)',
    reference,
  }
}

export function buildDiagnosticBlob(params: {
  transaction_id: string
  service_id: string | null | undefined
  created_at: string
  mpp_router: MppRouterMeta
}): string {
  return JSON.stringify(
    {
      transaction_id: params.transaction_id,
      service_id: params.service_id ?? null,
      created_at: params.created_at,
      mpp_router: params.mpp_router,
    },
    null,
    2,
  )
}

export function progressStepLabel(event: Record<string, unknown>): string {
  const type = typeof event['type'] === 'string' ? event['type'] : 'step'
  return type
}
