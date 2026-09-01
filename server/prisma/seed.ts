import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedCategories() {
  const categories = [
    'Account and Access',
    'Hardware',
    'Software',
    'Network',
  ]

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log(`Seeded ${categories.length} categories.`)
}

async function seedRelatedSystems() {
  const relatedSystems = [
    'Payroll Portal',
    'VPN',
    'Employee Email (Outlook)',
    'HR Information System',
    'Ticketing Platform',
    'Wi-Fi / Network Infrastructure',
    'Shared Drive / File Server',
    'Video Conferencing (Zoom/Teams)',
  ]

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log(`Seeded ${relatedSystems.length} related systems.`)
}

async function seedRequesters() {
  const requesters = [
    { name: 'Anong Srisuk', email: 'anong.srisuk@toktikit.com', isActive: true },
    { name: 'Weerapong Chaiyaporn', email: 'weerapong.chaiyaporn@toktikit.com', isActive: true },
    { name: 'Kanya Boonmee', email: 'kanya.boonmee@toktikit.com', isActive: true },
    { name: 'Sirichai Thongdee', email: 'sirichai.thongdee@toktikit.com', isActive: true },
    { name: 'Napat Wongsawat', email: 'napat.wongsawat@toktikit.com', isActive: false },
  ]

  for (const requester of requesters) {
    await prisma.requester.upsert({
      where: { email: requester.email },
      update: {},
      create: requester,
    })
  }

  const activeCount = requesters.filter((r) => r.isActive).length
  const inactiveCount = requesters.length - activeCount
  console.log(`Seeded ${requesters.length} requesters (${activeCount} active, ${inactiveCount} inactive).`)
}

async function main() {
  await seedCategories()
  await seedRelatedSystems()
  await seedRequesters()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })