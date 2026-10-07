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
  // Lab 4 AC-57 — dashboard-zero case: an active Requester who owns zero
  // tickets, so the requester summary can be verified as all-zeros.
  { name: 'Busaba Jitdee', email: 'busaba.jitdee@toktikit.com', role: 'REQUESTER', isActive: true, mustChangePassword: true },

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
type SampleAction = {
  actionAt: string
  description: string
  result: string
  performerEmail: string
  followUpRequired: boolean
  followUpNote?: string
  attachmentNotes?: string
}
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
  // Lab 4 AC-57 — deterministic fixtures giving 0/1/N action coverage plus
  // followUpRequired true and false cases. Seed key pattern (spec §9.3):
  // `seed:<ticketNo>:action:<index>`.
  actions?: SampleAction[]
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
    // N-action case: latest action has followUpRequired=false, so this
    // ticket is cleared from follow-up results under the AD-18
    // latest-action rule (even though an older action flagged follow-up).
    // Performer pimchanok differs from owner somchai (BR-23).
    actions: [
      {
        actionAt: '2026-09-12T02:00:00.000Z',
        description: 'Restarted the portal application pool.',
        result: 'Login page loads again, monitoring for timeouts.',
        performerEmail: 'somchai.jaidee@toktikit.com',
        followUpRequired: true,
        followUpNote: 'Re-check login success rate at end of shift.',
        attachmentNotes: 'portal-pool-recycle-2026-09-12.log in /srv/logs',
      },
      {
        actionAt: '2026-09-12T06:30:00.000Z',
        description: 'Verified login success rate back above 99%.',
        result: 'Timeouts gone for 4 hours straight.',
        performerEmail: 'pimchanok.saelim@toktikit.com',
        followUpRequired: false,
      },
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
    // N-action case: latest action still flags follow-up, so this ticket
    // stays in follow-up results (AD-18). Performer thanawat differs from
    // owner pimchanok (BR-23).
    actions: [
      {
        actionAt: '2026-09-14T03:00:00.000Z',
        description: 'Cleaned the paper path and reseated the tray.',
        result: 'Single-sided jobs print fine again.',
        performerEmail: 'pimchanok.saelim@toktikit.com',
        followUpRequired: false,
      },
      {
        actionAt: '2026-09-15T04:00:00.000Z',
        description: 'Replaced the feeding roller with the spare part.',
        result: 'Double-sided jobs jam less often but still occur.',
        performerEmail: 'pimchanok.saelim@toktikit.com',
        followUpRequired: true,
        followUpNote: 'Escalate to vendor if jams persist tomorrow.',
      },
      {
        actionAt: '2026-09-16T05:00:00.000Z',
        description: 'Vendor remote session: adjusted roller pressure.',
        result: 'No jams in the last 50 test pages.',
        performerEmail: 'thanawat.ruangtham@toktikit.com',
        followUpRequired: true,
        followUpNote: 'Watch the morning print batch before closing.',
        attachmentNotes: 'vendor-session-2026-09-16.txt in /srv/logs',
      },
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
    // 1-action case with follow-up flagged: requester sirichai sees
    // myFollowUpOpen = 1 (non-zero dashboard demo).
    actions: [
      {
        actionAt: '2026-09-18T07:00:00.000Z',
        description: 'Emailed the marketing lead for folder approval.',
        result: 'No reply yet; access still pending.',
        performerEmail: 'thanawat.ruangtham@toktikit.com',
        followUpRequired: true,
        followUpNote: 'Chase the approver again in two days.',
      },
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
    // 1-action case without follow-up: requester anong sees
    // myFollowUpOpen = 0 (zero follow-up demo on a non-zero ticket set).
    actions: [
      {
        actionAt: '2026-09-20T08:00:00.000Z',
        description: 'Pushed the fixed signature template to the mail client.',
        result: 'Images attach correctly on test messages.',
        performerEmail: 'somchai.jaidee@toktikit.com',
        followUpRequired: false,
      },
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
  }

  // Comments/notes have no user-facing unique business key. Seeded demo rows
  // carry a deterministic, ticket-scoped seedKey (`seed:<ticketNo>:<comment|note>:<index>`)
  // and are upserted on (ticketId, seedKey) — inserting only missing canonical
  // rows and never deleting user-authored comments/notes on re-run (AC-33).
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
    for (const [i, c] of (t.comments ?? []).entries()) {
      const seedKey = `seed:${t.ticketNo}:comment:${i}`
      await prisma.comment.upsert({
        where: { ticketId_seedKey: { ticketId: row.id, seedKey } },
        update: {},
        create: { body: c.body, authorId: userIds[c.authorEmail], ticketId: row.id, seedKey },
      })
      commentCount++
    }
    for (const [i, n] of (t.notes ?? []).entries()) {
      const seedKey = `seed:${t.ticketNo}:note:${i}`
      await prisma.internalNote.upsert({
        where: { ticketId_seedKey: { ticketId: row.id, seedKey } },
        update: {},
        create: { body: n.body, authorId: userIds[n.authorEmail], ticketId: row.id, seedKey },
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

// ---- Lab 4 actions taken ----------------------------------------------------

// Non-terminal statuses per tests.md §3 (dashboard attention buckets).
const NON_TERMINAL = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] as const

async function seedSampleActions(userIds: Record<string, number>) {
  let actionCount = 0
  for (const t of SAMPLE_TICKETS) {
    const row = await prisma.ticket.findUnique({ where: { ticketNo: t.ticketNo } })
    if (!row || !t.actions?.length) continue
    for (const [i, a] of t.actions.entries()) {
      const seedKey = `seed:${t.ticketNo}:action:${i}`
      await prisma.actionTaken.upsert({
        where: { ticketId_seedKey: { ticketId: row.id, seedKey } },
        // Idempotent: never overwrite on re-run (AC-57) — same convention
        // as seeded comments/notes. BR-23 performer identity is fixed at
        // seed time; followUpNote obeys the BR-22 conditional rule.
        update: {},
        create: {
          ticketId: row.id,
          actionAt: new Date(a.actionAt),
          description: a.description,
          result: a.result,
          performedById: userIds[a.performerEmail],
          followUpRequired: a.followUpRequired,
          followUpNote: a.followUpRequired ? a.followUpNote : null,
          attachmentNotes: a.attachmentNotes ?? null,
          seedKey,
        },
      })
      actionCount++
    }
  }

  const perTicket = await prisma.actionTaken.groupBy({ by: ['ticketId'], _count: true })
  const buckets = { zero: SAMPLE_TICKETS.length - perTicket.length, one: 0, many: 0 }
  for (const g of perTicket) {
    if (g._count === 1) buckets.one++
    else buckets.many++
  }
  console.log(
    `Processed ${actionCount} sample action upserts across ${perTicket.length} tickets ` +
      `(0-action: ${buckets.zero}, 1-action: ${buckets.one}, N-action: ${buckets.many}).`,
  )
}

// ---- Lab 4 verification log ---------------------------------------------------

// Prints per-status counts plus both dashboard cases (zero + non-zero) so a
// human re-running the seed can eyeball AC-57 without extra tooling. Uses the
// same predicates as docs/lab-04 (BR-25, AD-18, AD-19).
async function printVerificationSummary(userIds: Record<string, number>) {
  const byStatus = await prisma.ticket.groupBy({ by: ['status'], _count: true })
  const statusCounts = Object.fromEntries(byStatus.map((g) => [g.status, g._count]))

  const tickets = await prisma.ticket.findMany({
    select: { id: true, status: true, requesterId: true, ownerId: true, updatedAt: true },
  })
  const actions = await prisma.actionTaken.findMany({
    select: { ticketId: true, id: true, followUpRequired: true },
    orderBy: { id: 'asc' },
  })
  // AD-18 latest-action rule: only each ticket's greatest-id action decides
  // (later writes overwrite earlier ones in id order).
  const latestByTicket = new Map<number, boolean>()
  for (const a of actions) latestByTicket.set(a.ticketId, a.followUpRequired)
  const isFollowUpDue = (ticketId: number) => latestByTicket.get(ticketId) === true
  const isNonTerminal = (status: string) => (NON_TERMINAL as readonly string[]).includes(status)

  const requesterMetrics = (requesterId: number | undefined) => {
    const mine = tickets.filter((t) => t.requesterId === requesterId)
    const inStatus = (...s: string[]) => mine.filter((t) => s.includes(t.status)).length
    return {
      tickets: mine.length,
      myOpen: mine.filter((t) => ['NEW', 'OPEN', 'IN_PROGRESS'].includes(t.status)).length,
      myWaiting: inStatus('WAITING_FOR_REQUESTER'),
      myResolved: inStatus('RESOLVED'),
      myClosed: inStatus('CLOSED'),
      myReopened: inStatus('REOPENED'),
      myCancelled: inStatus('CANCELLED'),
      myFollowUpOpen: mine.filter((t) => isNonTerminal(t.status) && isFollowUpDue(t.id)).length,
    }
  }

  // AD-19: same UTC-calendar-day predicate as the staff summary.
  const startOfTodayUtc = new Date()
  startOfTodayUtc.setUTCHours(0, 0, 0, 0)
  const staffMetrics = (viewerId: number) => ({
    unassignedCount: tickets.filter((t) => t.ownerId === null && isNonTerminal(t.status)).length,
    myAssignedCount: tickets.filter((t) => t.ownerId === viewerId && isNonTerminal(t.status)).length,
    followUpDueCount: tickets.filter((t) => isNonTerminal(t.status) && isFollowUpDue(t.id)).length,
    resolvedTodayCount: tickets.filter((t) => t.status === 'RESOLVED' && t.updatedAt >= startOfTodayUtc).length,
  })

  console.log('Verify per-status ticket counts:', statusCounts)
  console.log('Verify requester summary (non-zero, sirichai):', requesterMetrics(userIds['sirichai.thongdee@toktikit.com']))
  console.log('Verify requester summary (zero, busaba):', requesterMetrics(userIds['busaba.jitdee@toktikit.com']))
  console.log('Verify staff summary (somchai):', staffMetrics(userIds['somchai.jaidee@toktikit.com']))
}

async function main() {
  // #134 — seeds are environment-scoped (dev/staging) and must never run
  // against production data.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in NODE_ENV=production (Lab 4 #134).')
  }
  await seedCategories()
  await seedRelatedSystems()
  const userIds = await seedUsers()
  await seedSampleTickets(userIds)
  await seedSampleActions(userIds)
  await printVerificationSummary(userIds)
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