import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
const ids = [
  'cmqii2n8f007fta2vn1ccguci',
  'cmqii2tp9007hta2vnidlkhmv',
  'cmqii3bxe007lta2v1el9kyfv',
  'cmqii3ky4007nta2vkstn7yip',
  'cmql8kepx000dx0o72fgqp74w',
  'cmqii5wfd007tta2vjpvui1sd',
  'cmqii6b7p007xta2v3ljh8i19',
  'cmqii89y0008ita2veo0j0twz',
  'cmqii8s19008mta2vtwdum79c',
  'cmqii8z9i008ota2vyq19iy4a',
  'cmqii413t007pta2v4s052dyr',
  'cmqii32tt007jta2v0wlhbtrf',
]

const rows = await prisma.transaction.findMany({
  where: { id: { in: ids } },
  select: { id: true, stellarTxHash: true, serviceId: true, amount: true, metadata: true },
})

console.log(`Found ${rows.length} transactions\n`)
rows.forEach((r) => {
  const m = r.metadata as Record<string, any> | null
  const receipt = m?.mpp_router?.receipt ?? null
  const challengeRef = m?.mpp_router?.challenge?.reference ?? null
  console.log(`Service:  ${r.serviceId}`)
  console.log(`Amount:   ${r.amount}`)
  console.log(`StellarHash: ${r.stellarTxHash ?? 'NULL'}`)
  console.log(`MPP receipt: ${JSON.stringify(receipt)}`)
  console.log(`MPP challenge.reference: ${challengeRef ?? 'NULL'}`)
  console.log('---')
})

await prisma.$disconnect()
}

main().catch(console.error)
