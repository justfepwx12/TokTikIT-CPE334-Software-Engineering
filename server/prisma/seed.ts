import { PrismaClient, Role, TicketPriority, TicketStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// AD-09: the single documented known initial/demo password used by the
// migration (migrated Requesters) and by seeded demo accounts. Never used
// for production; bcrypt cost >= 10 (AD-05).
const DEMO_PASSWORD = 'TokTickDemo123!'
const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10)

// ---- reference data -------------------------------------------------------

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
    'Email Client',
    'ERP Portal',
    'VPN Service',
    'HR Management System',
    'Database Cluster',
    'Shared Storage',
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

// ---- users ----------------------------------------------------------------

type SeedUser = {
  name: string
  email: string
  role: Role
  isActive: boolean
  // AD-09: intermediate demo accounts (IT Staff/Admin) can skip the first
  // login password change; Requesters keep mustChangePassword = true so they
  // always set their own password at first login (BR-03, AD-04).
  mustChangePassword: boolean
}

const SEED_USERS: SeedUser[] = [
  // >= 4 active Requesters (existing Lab 2 names retained) + >= 1 inactive.
  { name: 'Anong Srisuk', email: 'anong.srisuk@toktikit.com', role: 'REQUESTER', isActive: true, mustChangePassword: true },
  { name: 'Weerapong Chaiyaporn', email: 'weerapong.chaiyaporn@toktikit.com', role: 'REQUESTER', isActive: true, mustChangePassword: true },
  { name: 'Kanya Boonmee', email: 'kanya.boonmee@toktikit.com', role: 'REQUESTER', isActive: true, mustChangePassword: true },
  { name: 'Sirichai Thongdee', email: 'sirichai.thongdee@toktikit.com', role: 'REQUESTER', isActive: true, mustChangePassword: true },
  { name: 'Napat Wongsawat', email: 'napat.wongsawat@toktikit.com', role: 'REQUESTER', isActive: false, mustChangePassword: true },

  // >= 3 active IT Staff + >= 1 inactive.
  { name: 'Somchai Jaidee', email: 'somchai.jaidee@toktikit.com', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { name: 'Pimchanok Saelim', email: 'pimchanok.saelim@toktikit.com', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { name: 'Thanawat Ruangtham', email: 'thanawat.ruangtham@toktikit.com', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { name: 'Malee Khumdee', email: 'malee.khumdee@toktikit.com', role: 'IT_STAFF', isActive: false, mustChangePassword: false },

  // >= 1 active Administrator.
  { name: 'Admin One', email: 'admin@toktikit.com', role: 'ADMIN', isActive: true, mustChangePassword: false },
]

async function seedUsers() {
  const users: Record<string, number> = {}

  for (const user of SEED_USERS) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      // Idempotent: never overwrite an existing hash/flag on re-run.
      update: {},
      create: {
        name: user.name,
        email: user.email,
        passwordHash: DEMO_PASSWORD_HASH,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
    })
    users[user.email] = row.id
  }

  const counts = SEED_USERS.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1
      if (u.isActive) acc[`${u.role}_ACTIVE`] = (acc[`${u.role}_ACTIVE`] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  console.log(`Seeded ${SEED_USERS.length} users:`, counts)

  return users
}

// ---- sample tickets + comments + notes ------------------------------------

type SampleComment = { body: string; authorEmail: string }
type SampleTicket = {
  ticketNo: string
  title: string
  description: string
  requesterEmail: string
  categoryName: string
  systemName: string
  requestedPriority: TicketPriority
  itPriority: TicketPriority
  status: TicketStatus
  ownerEmail?: string
  comments?: SampleComment[]
  notes?: SampleComment[]
}

// Fixed, past-dated ticket numbers so they never collide with the live
// TK-<today>-XXXX sequence (BR-01). Upserted on ticketNo -> idempotent.
const SAMPLE_TICKETS: SampleTicket[] = [
  {
    ticketNo: 'TK-20260820-0001',
    title: 'VPN drops every five minutes',
    description: 'Unable to hold a stable VPN connection after the latest update.',
    requesterEmail: 'anong.srisuk@toktikit.com',
    categoryName: 'Network',
    systemName: 'VPN Service',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    status: 'NEW',
  },
  {
    ticketNo: 'TK-20260820-0002',
    title: 'Cannot sign in to the ERP portal',
    description: 'Credentials are accepted but the portal always shows a timeout.',
    requesterEmail: 'weerapong.chaiyaporn@toktikit.com',
    categoryName: 'Account and Access',
    systemName: 'ERP Portal',
    requestedPriority: 'URGENT',
    itPriority: 'URGENT',
    status: 'OPEN',
    ownerEmail: 'somchai.jaidee@toktikit.com',
    comments: [
      { body: 'Hi, I can still log in through the mobile app.', authorEmail: 'weerapong.chaiyaporn@toktikit.com' },
    ],
    notes: [
      { body: 'Portal team reported an incident window last night — confirmed.', authorEmail: 'somchai.jaidee@toktikit.com' },
    ],
  },
  {
    ticketNo: 'TK-20260821-0003',
    title: 'Printer jams on the third floor',
    description: 'The shared printer keeps jamming on double-sided jobs.',
    requesterEmail: 'kanya.boonmee@toktikit.com',
    categoryName: 'Hardware',
    systemName: 'Shared Storage',
    requestedPriority: 'LOW',
    itPriority: 'MEDIUM',
    status: 'IN_PROGRESS',
    ownerEmail: 'pimchanok.saelim@toktikit.com',
    comments: [
      { body: 'Maintenance ticket opened with the vendor.', authorEmail: 'pimchanok.saelim@toktikit.com' },
    ],
    notes: [
      { body: 'Spare feeding roller ordered, ETA 2 days.', authorEmail: 'pimchanok.saelim@toktikit.com' },
    ],
  },
  {
    ticketNo: 'TK-20260822-0004',
    title: 'Shared drive access request',
    description: 'Requesting write access to the marketing shared folder.',
    requesterEmail: 'sirichai.thongdee@toktikit.com',
    categoryName: 'Account and Access',
    systemName: 'Shared Storage',
    requestedPriority: 'MEDIUM',
    itPriority: 'HIGH',
    status: 'WAITING_FOR_REQUESTER',
    ownerEmail: 'thanawat.ruangtham@toktikit.com',
    comments: [
      { body: 'Who is the department approver for this folder?', authorEmail: 'thanawat.ruangtham@toktikit.com' },
    ],
    notes: [
      { body: 'Waiting on the marketing lead sign-off before granting.', authorEmail: 'thanawat.ruangtham@toktikit.com' },
    ],
  },
  {
    ticketNo: 'TK-20260823-0005',
    title: 'Email signature broken',
    description: 'Signature images do not attach to outgoing messages.',
    requesterEmail: 'anong.srisuk@toktikit.com',
    categoryName: 'Software',
    systemName: 'Email Client',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    status: 'RESOLVED',
    ownerEmail: 'somchai.jaidee@toktikit.com',
    comments: [
      { body: 'Thanks, the signature is back to normal now.', authorEmail: 'anong.srisuk@toktikit.com' },
      { body: 'Confirmed resolved from our side.', authorEmail: 'somchai.jaidee@toktikit.com' },
    ],
    notes: [
      { body: 'Reset the signature cache and verified on a test message.', authorEmail: 'somchai.jaidee@toktikit.com' },
    ],
  },
  {
    ticketNo: 'TK-20260825-0006',
    title: 'Old machine cannot open new PDFs',
    description: 'The finance laptop fails to render the new report files.',
    requesterEmail: 'weerapong.chaiyaporn@toktikit.com',
    categoryName: 'Hardware',
    systemName: 'HR Management System',
    requestedPriority: 'HIGH',
    itPriority: 'LOW',
    status: 'CLOSED',
    ownerEmail: 'pimchanok.saelim@toktikit.com',
    comments: [
      { body: 'Handled during the upgrade window.', authorEmail: 'pimchanok.saelim@toktikit.com' },
    ],
  },
  {
    ticketNo: 'TK-20260826-0007',
    title: 'Database heap usage alert',
    description: 'Monitoring flagged high heap usage on the analytics replica.',
    requesterEmail: 'kanya.boonmee@toktikit.com',
    categoryName: 'Network',
    systemName: 'Database Cluster',
    requestedPriority: 'URGENT',
    itPriority: 'URGENT',
    status: 'REOPENED',
    ownerEmail: 'thanawat.ruangtham@toktikit.com',
    comments: [
      { body: 'The metric is spiking again after the vacuum.', authorEmail: 'kanya.boonmee@toktikit.com' },
    ],
    notes: [
      { body: 'Vacuum completed but the spike returned — escalated to the DBA.', authorEmail: 'thanawat.ruangtham@toktikit.com' },
    ],
  },
  {
    ticketNo: 'TK-20260827-0008',
    title: 'Duplicate request — own equipment ticket',
    description: 'Filed twice by mistake; this one can be cancelled.',
    requesterEmail: 'sirichai.thongdee@toktikit.com',
    categoryName: 'Hardware',
    systemName: 'Shared Storage',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    status: 'CANCELLED',
    ownerEmail: 'somchai.jaidee@toktikit.com',
  },
]

async function seedSampleTickets(userIds: Record<string, number>) {
  const ticketIds: number[] = []
  const seedAuthors = new Set(SEED_USERS.map((u) => u.email))

  for (const t of SAMPLE_TICKETS) {
    const category = await prisma.category.findUnique({ where: { name: t.categoryName } })
    const system = await prisma.relatedSystem.findUnique({ where: { name: t.systemName } })
    const requesterId = userIds[t.requesterEmail]
    if (!category || !system || !requesterId) {
      throw new Error(`Sample ticket ${t.ticketNo} references missing seed data`)
    }

    const row = await prisma.ticket.upsert({
      where: { ticketNo: t.ticketNo },
      update: {},
      create: {
        ticketNo: t.ticketNo,
        title: t.title,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        status: t.status,
        requesterId,
        ownerId: t.ownerEmail ? userIds[t.ownerEmail] : null,
        categoryId: category.id,
        systemId: system.id,
      },
    })
    ticketIds.push(row.id)
  }

  // Comments/notes have no unique business key. To stay idempotent (AC-33),
  // remove only the previously seeded rows on these demo tickets (identified
  // by author in the seed set) and re-create the canonical set.
  await prisma.comment.deleteMany({
    where: { ticketId: { in: ticketIds }, author: { email: { in: [...seedAuthors] } } },
  })
  await prisma.internalNote.deleteMany({
    where: { ticketId: { in: ticketIds }, author: { email: { in: [...seedAuthors] } } },
  })

  const rowByTicketNo = new Map(
    await Promise.all(
      SAMPLE_TICKETS.map(async (t) => [
        t.ticketNo,
        await prisma.ticket.findUnique({ where: { ticketNo: t.ticketNo } }),
      ] as const),
    ),
  )

  let commentCount = 0
  let noteCount = 0
  for (const t of SAMPLE_TICKETS) {
    const row = rowByTicketNo.get(t.ticketNo)
    if (!row) continue
    for (const c of t.comments ?? []) {
      await prisma.comment.create({
        data: { body: c.body, authorId: userIds[c.authorEmail], ticketId: row.id },
      })
      commentCount++
    }
    for (const n of t.notes ?? []) {
      await prisma.internalNote.create({
        data: { body: n.body, authorId: userIds[n.authorEmail], ticketId: row.id },
      })
      noteCount++
    }
  }

  const statuses = [...new Set(SAMPLE_TICKETS.map((t) => t.status))]
  console.log(
    `Seeded ${SAMPLE_TICKETS.length} sample tickets across ${statuses.length} statuses ` +
      `(${commentCount} public comments, ${noteCount} internal notes).`,
  )
}

async function main() {
  await seedCategories()
  await seedRelatedSystems()
  const userIds = await seedUsers()
  await seedSampleTickets(userIds)
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