import 'dotenv/config'
import { Horizon } from '@stellar/stellar-sdk'

const HORIZON_URL = 'https://horizon.stellar.org'
const WALLET = 'GDCO2AKYBSLN34OFHAVUKCN3WIF6YEPMQOTEXM672HE7R3HD6LB67K4H'
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

async function main() {
  const server = new Horizon.Server(HORIZON_URL)
  const acct = await server.loadAccount(WALLET)
  const usdcBal = acct.balances.find((b: any) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER)
  const xlmBal = acct.balances.find((b: any) => b.asset_type === 'native')
  console.log('USDC balance:', usdcBal?.balance ?? 'no trustline')
  console.log('XLM balance:', xlmBal?.balance ?? 'not found')
}
main().catch(console.error)
