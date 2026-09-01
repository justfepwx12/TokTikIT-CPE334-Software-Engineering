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

async function main() {
  await seedCategories()
  await seedRelatedSystems()
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