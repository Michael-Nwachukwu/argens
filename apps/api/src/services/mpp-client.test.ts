import { afterEach, describe, it, expect, vi } from 'vitest'
import { Keypair } from '@stellar/stellar-sdk'
import { performMppRequest } from './mpp-client.js'

const URL_ = 'https://apiserver.mpprouter.dev/v1/services/openai/chat'

function mockFetch(response: Response) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => response)
  vi.stubGlobal('fetch', fn)
  return fn
}

function call(method = 'POST') {
  return performMppRequest({
    secretKey: Keypair.random().secret(),
    url: URL_,
    method,
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    onChallenge: async () => {},
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('performMppRequest — refund signal', () => {
  it('reads Refund-Status / Refund-Id / Refund-Status-Url', async () => {
    mockFetch(
      new Response('{"error":"upstream"}', {
        status: 502,
        headers: {
          'content-type': 'application/json',
          'refund-status': 'pending',
          'refund-id': 'r-1',
          'refund-status-url': 'https://apiserver.mpprouter.dev/v1/refunds/r-1',
          'x-payment-tx': 'abc',
          'x-payment-settle-status': 'settled',
        },
      }),
    )
    const res = await call()
    expect(res.refund).toEqual({
      status: 'pending',
      id: 'r-1',
      status_url: 'https://apiserver.mpprouter.dev/v1/refunds/r-1',
      mode: null,
    })
    expect(res.receipt?.reference).toBe('abc')
  })

  it('derives the status URL from Refund-Id when the router omits it (x402 path)', async () => {
    mockFetch(new Response('{}', { status: 502, headers: { 'refund-status': 'pending', 'refund-id': 'r 2' } }))
    const res = await call()
    expect(res.refund?.status_url).toBe('https://apiserver.mpprouter.dev/v1/refunds/r%202')
  })

  it('is null when no Refund-Status header is present', async () => {
    mockFetch(new Response('{}', { status: 502 }))
    expect((await call()).refund).toBeNull()
  })
})

describe('performMppRequest — GET', () => {
  it('never sends a body on GET', async () => {
    const fn = mockFetch(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    await call('GET')
    expect(fn.mock.calls[0]![1]!.body).toBeUndefined()
  })

  it('sends the body on POST', async () => {
    const fn = mockFetch(new Response('{}', { status: 200 }))
    await call('POST')
    expect(fn.mock.calls[0]![1]!.body).toBe('{}')
  })
})
