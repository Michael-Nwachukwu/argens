/**
 * Type shims for the x402 client packages.
 *
 * The project uses `moduleResolution: "node"` (node10), which does not read the
 * `exports` map in @x402/core and @x402/stellar, so their bundled .d.ts files
 * can't be resolved for the subpath imports we use. These declarations cover only
 * the surface services/mpp-client.ts depends on. Runtime resolution works because
 * Node honours the `exports` map for `require()`/dynamic `import()`.
 */

declare module '@x402/core/client' {
  export interface PaymentRequirements {
    scheme: string
    network: string
    asset: string
    amount: string
    payTo: string
    maxTimeoutSeconds: number
    extra?: Record<string, unknown>
  }

  export interface PaymentRequired {
    x402Version: number
    error?: string
    resource: { url: string }
    accepts: PaymentRequirements[]
    extensions?: Record<string, unknown>
  }

  export interface PaymentPayload {
    x402Version: number
    accepted: PaymentRequirements
    payload: Record<string, unknown>
  }

  export interface SettleResponse {
    success: boolean
    errorReason?: string
    errorMessage?: string
    payer?: string
    transaction: string
    network: string
    amount?: string
  }

  export interface SchemeRegistration {
    network: string
    client: unknown
    x402Version?: number
  }

  export class x402Client {
    static fromConfig(config: { schemes: SchemeRegistration[] }): x402Client
  }

  export class x402HTTPClient {
    constructor(client: x402Client)
    getPaymentRequiredResponse(
      getHeader: (name: string) => string | null | undefined,
      body?: unknown,
    ): PaymentRequired
    createPaymentPayload(paymentRequired: PaymentRequired): Promise<PaymentPayload>
    encodePaymentSignatureHeader(payload: PaymentPayload): Record<string, string>
    getPaymentSettleResponse(
      getHeader: (name: string) => string | null | undefined,
    ): SettleResponse
  }
}

declare module '@x402/stellar' {
  export function createEd25519Signer(privateKey: string, defaultNetwork?: string): unknown

  export class ExactStellarScheme {
    constructor(signer: unknown, rpcConfig?: { url?: string })
    readonly scheme: string
  }
}
