const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '')

export async function GET(
  _request: Request,
  { params }: { params: { provider: string } },
) {
  const provider = params.provider?.replace(/\.md$/, '')

  if (!provider) {
    return new Response('Missing provider id.\n', {
      status: 400,
      headers: markdownHeaders('no-store'),
    })
  }

  try {
    const upstream = await fetch(`${API_BASE}/marketplace/services/${encodeURIComponent(provider)}/skill.md`, {
      headers: { Accept: 'text/markdown' },
      next: { revalidate: 300 },
    })

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: markdownHeaders(upstream.ok ? 'public, max-age=300' : 'no-store'),
    })
  } catch {
    return new Response(
      [
        '# Argens Marketplace Skill Unavailable',
        '',
        `Provider id: \`${provider}\``,
        '',
        'The Argens API could not be reached while generating this provider skill file.',
        'Try again shortly, or fetch the marketplace catalog from the Argens API directly.',
        '',
      ].join('\n'),
      {
        status: 502,
        headers: markdownHeaders('no-store'),
      },
    )
  }
}

function markdownHeaders(cacheControl: string) {
  return {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': cacheControl,
  }
}
