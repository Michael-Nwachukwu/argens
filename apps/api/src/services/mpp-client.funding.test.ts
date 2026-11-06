import { afterEach, describe, it, expect, vi } from 'vitest'

const signedWith: string[] = []

vi.mock('@x402/stellar', () => ({
  createEd25519Signer: (secret: string) => ({ secret }),
  ExactStellarScheme: class {
    scheme = 'exact'
    constructor(private signer: { secret: string }) {}
    async createPaymentPayload(x402Version: number) {
      signedWith.push(this.signer.secret)
      return { x402Version, payload: { transaction: 'signed-xdr' } }
    }
  },
}))

import { performMppRequest } from './mpp-client.js'

const URL_ = 'https://apiserver.mpprouter.dev/v1/services/deepseek/chat'

// An x402 v2 challenge in MPP Router's shape.
const challenge = {
  x402Version: 2,
  error: 'Payment required',
  resource: { url: URL_ },
  accepts: [{
    scheme: 'exact',
    network: 'stellar:testnet', // tests run with STELLAR_NETWORK unset → testnet
    amount: '421488',
    asset: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    payTo: 'GDK3AVW3YE6UL3J4WLNKBMP65KSY32YPUKIOC6PXW65XJ3LEG3YIDXXB',
    maxTimeoutSeconds: 300,
    extra: { areFeesSponsored: true },
  }],
}

function stubFetch() {
  const fn = vi.fn()
    .mockResolvedValueOnce(new Response('{}', {
      status: 402,
      headers: { 'payment-required': Buffer.from(JSON.stringify(challenge)).toString('base64') },
    }))
    .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  signedWith.length = 0
})

describe('performMppRequest — choosing the funding wallet at challenge time', () => {
  it('signs with the default secretKey when onChallenge returns nothing', async () => {
    stubFetch()
    await performMppRequest({ secretKey: 'USER_SECRET', url: URL_, method: 'POST', body: '{}', onChallenge: async () => {} })
    expect(signedWith).toEqual(['USER_SECRET'])
  })

  it('signs with the key onChallenge returns (e.g. the credit pool)', async () => {
    stubFetch()
    await performMppRequest({
      secretKey: 'USER_SECRET',
      url: URL_,
      method: 'POST',
      body: '{}',
      onChallenge: async () => ({ secretKey: 'POOL_SECRET' }),
    })
    expect(signedWith).toEqual(['POOL_SECRET'])
  })
})
