export interface ShowcaseProject {
  name: string
  description: string
  thumbnail: string  // URL to a 16:9 preview image
  logo: string       // URL to square logo (empty = first-letter fallback)
  url: string
  tag: string        // e.g. "AI Agent", "Dev Tool", "Finance"
}

// ─── Add projects here ────────────────────────────────────────────────────────
// thumbnail: ideally 1200×675 (16:9). Use any CDN or /public/showcase/...
// logo:      ideally 128×128 or SVG. Leave empty to show first letter of name.

export const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  {
    name: 'Ophunt',
    description: 'OpHunt agent fixes the front end of the founder pipeline. Paste any URL, a Reddit thread where people are venting, a Product Hunt launch with frustrated comments, a blog post about a niche problem, and OpHunt reads it, extracts the unmet need hiding inside it, and hands you a structured brief: the gap, the target user, the MVP scope, and a path to your first 100 customers. OpHunt also runs a live idea feed, monitoring Reddit, HN, Product Hunt, and tech news 24/7',
    thumbnail: '/showcase/ophunt/ophunt-thumb.png',
    logo: '/showcase/ophunt/ophunt-icon.svg',
    url: 'https://ophunt.xyz',
    tag: 'AI Agent',
  },
]
