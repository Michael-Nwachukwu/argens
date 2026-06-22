import 'dotenv/config'
import { listMppRouterServices, providerKey } from '../src/services/mpp-router.js'

const NEED_EXAMPLES = new Set(['alchemy','allium','autoexchange','browserbase','buildwithlocus','conduit','doma','exa','fal','gemini','judge0','kicksdb','mapbox','martin-estate','megapot','modal','moltycash','nansen','openrouter','oxylabs','papercut','parallel','pinata','postalform','quicknode','replicate','rozo-agent-api','stablephone','stablesocial','stablestudio','stableupload','storage','suno','tako','tempo','twocaptcha'])

async function main() {
  const svcs = await listMppRouterServices()
  for (const s of svcs) {
    const p = providerKey(s)
    if (NEED_EXAMPLES.has(p)) {
      console.log(`\n[${p}] ${s.id}`)
      console.log(`  path: ${s.public_path}`)
      console.log(`  name: ${s.name}`)
      console.log(`  desc: ${(s.description ?? '').slice(0, 150)}`)
      console.log(`  price: ${s.price}`)
    }
  }
}
main().catch(console.error)
