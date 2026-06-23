import { NextResponse } from 'next/server'

const MPP_ROUTER_BASE = 'https://apiserver.mpprouter.dev'

interface RawService {
  id: string
  name: string
  category?: string
  categories?: string[]
  description: string
  public_path: string
  method: string
  price: string
  payment_method: string
  network: string
  status: 'active' | 'limited'
  status_note?: string
  payment_status?: 'verified' | 'available' | 'unavailable'
  docs_url?: string
  docs?: { homepage?: string; llms_txt?: string; api_reference?: string }
  methods?: { stellar?: { intents?: string[] } }
}

function providerKey(svc: RawService): string {
  const m = String(svc.public_path || '').match(/^\/v1\/services\/([^/]+)\//)
  if (m?.[1]) return m[1]
  return String(svc.id || '').split('_')[0] || svc.id
}

function providerDisplayName(svc: RawService): string {
  const head = String(svc.name || '').split(/\s+[–—-]\s+/)[0]?.trim()
  return head || providerKey(svc)
}

function operationLabel(svc: RawService): string {
  const parts = String(svc.name || '').split(/\s+[–—-]\s+/)
  if (parts.length > 1) return parts.slice(1).join(' – ').trim()
  return String(svc.name || svc.id)
}

function parsePrice(p: string): number | null {
  if (/free/i.test(p)) return 0
  const m = String(p).match(/\$\s*([0-9]*\.?[0-9]+)/)
  return m ? parseFloat(m[1]!) : null
}

function priceRangeLabel(prices: string[]): string {
  const nums = prices.map(parsePrice).filter((n): n is number => n != null)
  if (nums.length === 0) return prices[0] ?? 'see endpoints'
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const fmt = (n: number) => (n === 0 ? 'free' : `$${n}`)
  if (min === max) return `${fmt(min)}/request`
  if (min === 0) return `free – ${fmt(max)}/request`
  return `${fmt(min)} – ${fmt(max)}/request`
}

function normalizeCategories(svc: RawService): string[] {
  // Always normalize to our standard taxonomy — never return MPP Router's raw categories
  // directly, because their labels don't match our pill filters.
  const raw = svc.categories ?? (svc.category ? [svc.category] : [])
  const corpus = (svc.description + ' ' + svc.name + ' ' + raw.join(' ')).toLowerCase()

  if (/browser|headless|scrape|scraping|apify|browserbase|steel|zenrows|firecrawl|proxy.?resid/.test(corpus)) return ['Tools']
  if (/search|web.?search|serp|tavily|exa\b|jina|crawl(?!er)|perplexity/.test(corpus)) return ['Search']
  if (/image|vision|photo|flux|stable.?diff|dall|midjourney|fal\.ai|replicate|generat.*image|image.*generat/.test(corpus)) return ['Vision']
  if (/code.?execut|sandbox|e2b\b|daytona|morph\b|modal\b|run.*code|execut.*code/.test(corpus)) return ['Compute']
  if (/email|inbox|agentmail|resend\b|loops\b|courier\b|notification|sms|smtp/.test(corpus)) return ['Comms']
  if (/blockchain|on.?chain|defi|nft|crypto|market.?cap|coinmarket|twelvedata|stock|financial|codex\b|alchemy\b/.test(corpus)) return ['Data']
  if (/llm|openai|anthropic|gpt.?|claude\b|gemini|mistral|openrouter|chat.?complet|complet.*model|model.*complet/.test(corpus)) return ['AI Models']
  if (/code|sandbox|execut|run/.test(corpus)) return ['Compute']
  if (/data|graph|analytics/.test(corpus)) return ['Data']
  if (/model|chat|ai\b/.test(corpus)) return ['AI Models']
  return ['Tools']
}

// Curated example payloads by provider key
const PROVIDER_EXAMPLES: Record<string, Record<string, Record<string, unknown>>> = {
  exa: {
    default: { query: 'AI agent payment infrastructure 2025', numResults: 5, useAutoprompt: true },
    search: { query: 'autonomous AI agents use cases', numResults: 5, useAutoprompt: true, type: 'neural' },
    findSimilar: { url: 'https://anthropic.com', numResults: 5 },
    getContents: { ids: ['https://example.com'] },
  },
  agentmail: {
    default: { username: 'my-research-agent', displayName: 'Research Agent' },
    create: { username: 'research-agent-01', displayName: 'Research Agent' },
    send: { to: 'user@example.com', subject: 'Agent update', body: 'Task complete.' },
    list: {},
  },
  e2b: {
    default: { template: 'base', metadata: { agentId: 'coder-agent-01' } },
    create: { template: 'base', timeout: 30000 },
    run: { cmd: 'python3 -c "print(1+1)"' },
  },
  daytona: {
    default: { id: 'my-workspace', image: 'debian:12' },
  },
  perplexity: {
    default: { model: 'sonar', messages: [{ role: 'user', content: 'What is CCTP V2?' }] },
    search: { model: 'sonar-pro', messages: [{ role: 'user', content: 'Latest developments in AI agent frameworks' }] },
  },
  tavily: {
    default: { query: 'Stellar blockchain payment infrastructure', search_depth: 'advanced', max_results: 5 },
  },
  openai: {
    default: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Summarize the latest AI news' }], max_tokens: 200 },
  },
  anthropic: {
    default: { model: 'claude-3-haiku-20240307', max_tokens: 200, messages: [{ role: 'user', content: 'Write a haiku about autonomous agents.' }] },
  },
  firecrawl: {
    default: { url: 'https://stellar.org', formats: ['markdown'], onlyMainContent: true },
    scrape: { url: 'https://stellar.org', formats: ['markdown'] },
    crawl: { url: 'https://stellar.org', limit: 10 },
  },
  jina: {
    default: { url: 'https://stellar.org' },
  },
  fal: {
    default: { prompt: 'futuristic city skyline at golden hour, cinematic lighting, 8k', image_size: 'landscape_4_3', num_inference_steps: 28 },
  },
  stabilityai: {
    default: { prompt: 'isometric blockchain node network, digital art', model: 'sd3', output_format: 'jpeg' },
  },
  replicate: {
    default: { prompt: 'aerial view of blockchain network visualization, neon on dark background', num_outputs: 1 },
  },
  browserbase: {
    default: { projectId: 'your-project-id', fingerprint: { screen: { width: 1920, height: 1080 } } },
  },
  steel: {
    default: { proxyCountry: 'US', sessionTimeout: 900000 },
  },
  apify: {
    default: { startUrls: [{ url: 'https://news.ycombinator.com' }], maxCrawlPages: 5 },
  },
  zenrows: {
    default: { url: 'https://httpbin.org/get', js_render: true, premium_proxy: false },
  },
  twelvedata: {
    default: { symbol: 'BTC/USD', interval: '1h', outputsize: 30 },
  },
  'coinmarketcap': {
    default: { symbol: 'XLM,ETH,USDC', convert: 'USD' },
  },
  morph: {
    default: { language: 'python', code: 'def fibonacci(n):\n    if n <= 1: return n\n    return fibonacci(n-1) + fibonacci(n-2)' },
  },
  modal: {
    default: { function_name: 'my_function', args: [], kwargs: {} },
  },
  resend: {
    default: { from: 'agent@yourdomain.com', to: ['user@example.com'], subject: 'Agent notification', text: 'Your task is complete.' },
  },
  loops: {
    default: { email: 'user@example.com', eventName: 'agent-task-complete', eventProperties: { taskId: 'task-001' } },
  },
  courier: {
    default: { message: { to: { email: 'user@example.com' }, content: { title: 'Agent Update', body: 'Your agent completed the task.' } } },
  },
  codex: {
    default: { query: '{ ethereum { blocks(limit: 5, order: { number: DESC }) { number timestamp transactions { count } } } }' },
  },
}

function getExamplePayload(providerId: string, endpointLabel: string): Record<string, unknown> | null {
  const p = PROVIDER_EXAMPLES[providerId]
  if (!p) return null
  const labelLower = endpointLabel.toLowerCase()
  for (const [key, val] of Object.entries(p)) {
    if (key !== 'default' && labelLower.includes(key)) return val
  }
  return p['default'] ?? null
}

export const revalidate = 300

export async function GET() {
  try {
    const res = await fetch(`${MPP_ROUTER_BASE}/v1/services/catalog`, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Catalog unavailable' }, { status: 502 })
    }

    const json = await res.json() as { services: RawService[] }

    const filtered = json.services
      .filter((s) => s.payment_method === 'stellar')
      .filter((s) => s.network === 'stellar-mainnet')
      .filter((s) => s.method === 'POST')
      .filter((s) => s.payment_status !== 'unavailable')

    const groups = new Map<string, RawService[]>()
    for (const svc of filtered) {
      const key = providerKey(svc)
      const arr = groups.get(key)
      if (arr) arr.push(svc)
      else groups.set(key, [svc])
    }

    const providers = [...groups.entries()].map(([id, ops]) => {
      const name = providerDisplayName(ops[0]!)
      const descs = ops.map((o) => o.description).filter(Boolean).sort((a, b) => a.length - b.length)
      const description = descs[0] ?? `${name} API access`
      const allCategories = new Set<string>()
      ops.forEach((o) => normalizeCategories(o).forEach((c) => allCategories.add(c)))
      const limited = ops.some((o) => o.status === 'limited')
      const docsUrl = ops.find((o) => o.docs?.homepage)?.docs?.homepage ?? ops.find((o) => o.docs_url)?.docs_url ?? null

      return {
        id,
        name,
        description,
        categories: [...allCategories],
        display_price: priceRangeLabel(ops.map((o) => o.price)),
        status: limited ? 'limited' : 'active',
        docs_url: docsUrl,
        endpoint_count: ops.length,
        endpoints: ops
          .map((o) => {
            const label = operationLabel(o)
            return {
              id: o.id,
              label,
              method: o.method,
              path: o.public_path,
              description: o.description,
              price: o.price,
              example_payload: getExamplePayload(id, label),
            }
          })
          .sort((a, b) => a.label.localeCompare(b.label)),
      }
    })

    const sorted = providers.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ providers: sorted, total: sorted.length })
  } catch {
    return NextResponse.json({ error: 'Failed to load marketplace' }, { status: 502 })
  }
}
