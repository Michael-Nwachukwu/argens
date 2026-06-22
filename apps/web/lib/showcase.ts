export interface ShowcaseProject {
  name: string
  description: string
  thumbnail: string  // URL to a 16:9 preview image
  logo: string       // URL to square logo (empty = first-letter fallback)
  url: string
  tag: string        // e.g. "AI Agent", "Dev Tool", "Finance"
  howUsed?: string[] // bullet points describing how the project uses Argens
}

// ─── Add projects here ────────────────────────────────────────────────────────
// thumbnail: ideally 1200×675 (16:9). Use any CDN or /public/showcase/...
// logo:      ideally 128×128 or SVG. Leave empty to show first letter of name.
// howUsed:   optional bullet points — shown in a collapsible "How we used Argens" panel.

export const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  {
    name: 'Ophunt',
    description: 'OpHunt agent fixes the front end of the founder pipeline. Paste any URL, a Reddit thread where people are venting, a Product Hunt launch with frustrated comments, a blog post about a niche problem, and OpHunt reads it, extracts the unmet need hiding inside it, and hands you a structured brief: the gap, the target user, the MVP scope, and a path to your first 100 customers. OpHunt also runs a live idea feed, monitoring Reddit, HN, Product Hunt, and tech news 24/7',
    thumbnail: '/showcase/ophunt/ophunt-thumb.png',
    logo: '/showcase/ophunt/ophunt-icon.svg',
    url: 'https://ophunt.xyz',
    tag: 'AI Agent',
    howUsed: [
      'Web scraping via firecrawl_scrape.', 
      'LLM analysis via DeepSeek endpoint.', 
      'structured idea extraction from any URL or topic.', 
      'automated feed pipeline scoring ideas from HN, Reddit, and Product Hunt.', 
      'runtime service discovery via /marketplace/services.', 
      'pay-per-call AI spend across all analysis workloads.'
    ],
  },
  {
    name: 'Camob Residences',
    description: 'Camob Residence is a Next.js short-let booking site for a two-maisonette property in Lekki. Lagos It features four on-site AI agents, powered through Argens: a guest concierge that answers stay and neighbourhood questions; a pre-arrival itinerary generator that writes a personalised day-by-day plan after payment confirms; an admin operations co-pilot that drafts daily digests (pending bank transfers, refund candidates, guest replies); and a weekly market-positioning brief that pulls real Lagos events and drafts outreach plans and ad-copy starters for the owner\'s inbox',
    thumbnail: '/showcase/camob/camob-thumb.svg',
    logo: '/showcase/camob/camob-icon.svg',
    url: 'https://camobresidences.com',
    tag: 'Real Estate',

    howUsed: [
      'Chat completions via deepseek_deepseek_chat.',
      'web search via brave_brave_web-search for the weekly events brief.',
      'agent mail via stableemail_send for outbound delivery.',
      'all routed through one shared client with spending caps and per-call AgentRun audit rows'
    ],
  },
  {
    name: 'Radiant',
    description: "Radiant isn't a chatbot, a DeFi app, or a no-code builder — it's all of that in one personal agent that acts, remembers, builds, trades, and earns on your behalf. Talk to it in plain language. It researches, automates, and moves onchain when you need to. When a task repeats, Radiant builds you a personal app — private tools for yourself, or fan apps and mini apps you can share on Radiant. Every app exposes an API, so other users and other agents can call it. List what you build in the explorer, set a fee, and earn. Radiant is your agent — and the start of an agent economy.",
    thumbnail: '/showcase/radiant/radiant-thumb.png',
    logo: '/showcase/radiant/radiant-icon.png',
    url: 'https://useradiant.xyz/',
    tag: 'AI Agent',
    howUsed: [
      'AI-powered web search via marketplace endpoints.',
      'Autonomous onchain payments for agent tasks and API calls.',
    ],
  },
]
