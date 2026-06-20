/**
 * services/mpp-router.ts
 *
 * Thin client for MPP Router's Stellar-payable service catalog.
 */

import { AppError } from '../lib/errors.js'

export const MPP_ROUTER_BASE_URL = process.env['MPP_ROUTER_BASE_URL'] ?? 'https://apiserver.mpprouter.dev'

export interface MppRouterService {
  id: string
  name: string
  category?: string
  categories?: string[]
  description: string
  public_path: string
  method: 'POST'
  price: string
  payment_method: string
  network: string
  asset: string
  status: 'active' | 'limited'
  status_note?: string
  verified_mode?: string  // e.g. "charge" — operator-tested payment mode
  docs_url?: string
  methods?: {
    stellar?: { intents?: string[] }
    stellar_x402?: {
      scheme?: string
      network?: string
      pay_to?: string
      asset?: string
    }
    tempo?: { intents?: string[]; role?: string }
  }
  payment_hints?: {
    network?: string
    intent?: string
    dialect?: string
    pay_to?: string
    amount_usdc?: string
    asset_sac?: string
    requires_classic_usdc_trustline?: boolean
  }
  docs?: {
    homepage?: string
    llms_txt?: string
    api_reference?: string
  }
}

interface CatalogResponse {
  services: MppRouterService[]
}

let catalogCache: { services: MppRouterService[]; expiresAt: number } | null = null

export async function listMppRouterServices(): Promise<MppRouterService[]> {
  if (catalogCache && Date.now() < catalogCache.expiresAt) return catalogCache.services

  const res = await fetch(`${MPP_ROUTER_BASE_URL}/v1/services/catalog`)
  if (!res.ok) {
    throw new AppError('Failed to fetch marketplace catalog.', 'MARKETPLACE_CATALOG_UNAVAILABLE', 502, {
      status: res.status,
      body: await res.text().catch(() => null),
    })
  }

  const json = await res.json() as CatalogResponse
  const services = json.services
    .filter((service) => service.payment_method === 'stellar')
    .filter((service) => service.network === 'stellar-mainnet')
    .filter((service) => service.methods?.stellar?.intents?.includes('charge'))
    .filter((service) => service.method === 'POST')

  catalogCache = { services, expiresAt: Date.now() + 60_000 }
  return services
}

export async function findMppRouterService(serviceId: string): Promise<MppRouterService | null> {
  const services = await listMppRouterServices()
  return services.find((service) => service.id === serviceId) ?? null
}

/**
 * Provider key for grouping operations into one card/toggle.
 * The MPP catalog flattens ~493 POST operations across ~86 providers; each operation is
 * its own catalog entry. The {provider} segment of `/v1/services/{provider}/{operation}`
 * (equivalently the part of the service id before the first underscore) is the group key.
 */
export function providerKey(service: MppRouterService): string {
  const m = String(service.public_path || '').match(/^\/v1\/services\/([^/]+)\//)
  if (m && m[1]) return m[1]
  return providerKeyFromServiceId(service.id)
}

/** Provider key derived from an operation id alone (when the catalog entry isn't in hand). */
export function providerKeyFromServiceId(serviceId: string): string {
  const head = String(serviceId || '').split('_')[0]
  return head || serviceId
}

/** Human-friendly provider name — most catalog names are "Provider – Operation". */
export function providerDisplayName(service: MppRouterService): string {
  const head = String(service.name || '').split(/\s+[–—-]\s+/)[0]?.trim()
  return head || providerKey(service)
}

/** The operation label (the part after "Provider – "), falling back to the full name. */
export function operationLabel(service: MppRouterService): string {
  const parts = String(service.name || '').split(/\s+[–—-]\s+/)
  if (parts.length > 1) return parts.slice(1).join(' – ').trim()
  return String(service.name || service.id)
}

export function buildMppRouterUrl(
  service: MppRouterService,
  query?: Record<string, string | number | boolean>,
): string {
  const url = new URL(service.public_path, MPP_ROUTER_BASE_URL)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}
