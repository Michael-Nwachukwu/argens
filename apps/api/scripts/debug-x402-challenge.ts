/**
 * Debug script: print the raw x402 challenge from any MPP Router endpoint.
 * Shows what asset/amount/payTo is in the payment-required header so we can
 * diagnose HostError: Error(Contract, #10) in the Soroban simulation.
 */
import 'dotenv/config'

const MPP_BASE = 'https://apiserver.mpprouter.dev'

// Compare a working vs failing fal endpoint to see if the asset differs.
const ENDPOINTS = [
  '/v1/services/fal/flux_schnell',                   // WORKS
  '/v1/services/fal/stable-diffusion-v35-large',     // FAILS with Contract #10
  '/v1/services/govlaws/mpp_search',                 // FAILS with Contract #10
  '/v1/services/parallel/search',                    // FAILS with Contract #10
]

async function main() {
  for (const path of ENDPOINTS) {
    const url = `${MPP_BASE}${path}`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"prompt":"test","query":"test"}' })
    console.log(`\n=== ${path} ===`)
    console.log('HTTP status:', res.status)

    const paymentRequired = res.headers.get('payment-required')
    if (paymentRequired) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentRequired, 'base64').toString('utf8'))
        console.log('payment-required (decoded):')
        console.log(JSON.stringify(decoded, null, 2))
      } catch {
        console.log('payment-required (raw, not base64):', paymentRequired.slice(0, 500))
      }
    } else {
      // Also check all headers
      const headers: Record<string, string> = {}
      res.headers.forEach((v, k) => { headers[k] = v })
      const relevantHeaders = Object.fromEntries(
        Object.entries(headers).filter(([k]) => k.includes('payment') || k.includes('www') || k.includes('402'))
      )
      console.log('Relevant headers:', JSON.stringify(relevantHeaders, null, 2))
      const body = await res.text()
      console.log('Body:', body.slice(0, 300))
    }
  }
}
main().catch(console.error)
