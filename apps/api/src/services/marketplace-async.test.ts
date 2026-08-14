import { describe, it, expect } from 'vitest'
import { ASYNC_SYNC_ALTERNATIVES, isAsyncOnlyEndpoint } from './marketplace-async.js'

/** Known async-only ids that require x402 session (must be blocked). */
const ASYNC_IDS = [
  'firecrawl_crawl',
  'firecrawl_extract',
  'browserbase_fetch',
  'stablestudio_generate_flux-2-pro_generate',
  'stablestudio_generate_flux-2-pro_edit',
  'stablestudio_generate_gpt-image-1_generate',
  'stablestudio_generate_gpt-image-1_edit',
  'stablestudio_generate_gpt-image-1_5_generate',
  'stablestudio_generate_grok_generate',
  'stablestudio_generate_grok_edit',
  'stablestudio_generate_grok-video_generate',
  'stablestudio_generate_nano-banana_generate',
  'stablestudio_generate_nano-banana_edit',
  'stablestudio_generate_nano-banana-pro_generate',
  'stablestudio_generate_seedance_t2v',
  'stablestudio_generate_seedance_i2v',
  'stablestudio_generate_seedance-fast_t2v',
  'stablestudio_generate_sora-2_generate',
  'stablestudio_generate_sora-2-pro_generate',
  'stablestudio_generate_veo-3_1_generate',
  'stablestudio_generate_veo-3_1-fast_generate',
  'stablestudio_generate_wan-2_6_t2v',
  'stablestudio_generate_wan-2_6_i2v',
] as const

/** Synchronous siblings that must remain callable (exact/charge path). */
const SYNC_SIBLINGS = [
  'firecrawl_scrape',
  'firecrawl_map',
  'firecrawl_search',
  'stablestudio_upload',
  // browserbase_fetch is async-only, but its siblings answer inline (both probed SUCCESS).
  'browserbase_search',
  'browserbase_browser_session_create',
] as const

describe('isAsyncOnlyEndpoint', () => {
  it('blocks every known async-only endpoint id', () => {
    for (const id of ASYNC_IDS) {
      expect(isAsyncOnlyEndpoint(id), id).toBe(true)
    }
  })

  it('passes every synchronous sibling', () => {
    for (const id of SYNC_SIBLINGS) {
      expect(isAsyncOnlyEndpoint(id), id).toBe(false)
    }
  })

  it('does not treat unrelated marketplace ids as async-only', () => {
    expect(isAsyncOnlyEndpoint('deepseek_chat')).toBe(false)
    expect(isAsyncOnlyEndpoint('openai_chat')).toBe(false)
    expect(isAsyncOnlyEndpoint('exa_search')).toBe(false)
    expect(isAsyncOnlyEndpoint('stablestudio')).toBe(false)
    // Prefix requires the trailing underscore after generate
    expect(isAsyncOnlyEndpoint('stablestudio_generate')).toBe(false)
  })

  it('maps firecrawl async endpoints to firecrawl_scrape', () => {
    expect(ASYNC_SYNC_ALTERNATIVES['firecrawl_crawl']).toBe('firecrawl_scrape')
    expect(ASYNC_SYNC_ALTERNATIVES['firecrawl_extract']).toBe('firecrawl_scrape')
    expect(ASYNC_SYNC_ALTERNATIVES['stablestudio_generate_flux-2-pro_generate']).toBeUndefined()
  })

  it('offers no alternative for browserbase_fetch', () => {
    // Deliberate: browserbase has no synchronous URL-fetch sibling, and pointing at
    // another provider (firecrawl_scrape) would 403 unless the user enabled it too.
    expect(ASYNC_SYNC_ALTERNATIVES['browserbase_fetch']).toBeUndefined()
  })
})
