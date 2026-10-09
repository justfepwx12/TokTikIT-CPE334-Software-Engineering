import { Prisma, type PrismaClient, type TicketStatus } from '@prisma/client';

// Lab 4 AD-18 latest-action rule + BR-26 aggregated-only dashboards.
// Resolves the ticket-id set whose LATEST recorded action (greatest `id`)
// has `followUpRequired = <want>`, intersected with a caller-supplied ticket
// scope. Used ONLY by paginated list endpoints, where rows are the point and
// the id set feeds a bounded `id: { in }` predicate — never by dashboard
// summaries (those must return database-computed counts; see
// countFollowUpDue below).
export const NON_TERMINAL_STATUSES: TicketStatus[] = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'REOPENED',
];

export async function resolveFollowUpTicketIds(
  prisma: PrismaClient,
  scope: Prisma.TicketWhereInput,
  want: boolean,
): Promise<number[]> {
  // In-DB aggregation: every ticket id inside the scope (no rows fetched).
  const scoped = await prisma.ticket.groupBy({ by: ['id'], where: scope });
  const scopedIds = scoped.map((g) => g.id);
  if (scopedIds.length === 0) return [];

  // In-DB aggregation: greatest action id per ticket (the "latest recorded"
  // action of AD-18).
  const latest = await prisma.actionTaken.groupBy({
    by: ['ticketId'],
    where: { ticketId: { in: scopedIds } },
    _max: { id: true },
  });
  const latestIds = latest.map((g) => g._max.id).filter((id): id is number => id !== null);
  if (latestIds.length === 0) return want ? [] : scopedIds;

  // PK lookups only: the follow-up flag of each latest action.
  const flags = await prisma.actionTaken.findMany({
    where: { id: { in: latestIds } },
    select: { ticketId: true, followUpRequired: true },
  });
  const trueIds = new Set(flags.filter((f) => f.followUpRequired).map((f) => f.ticketId));
  return want ? [...trueIds] : scopedIds.filter((id) => !trueIds.has(id));
}

/**
 * Database-computed follow-up-due COUNT for dashboard summaries (AC-47).
 * One aggregated query: non-terminal tickets in scope whose latest recorded
 * action flags follow-up. Only the count crosses the wire — no id lists, no
 * rows. `requesterId` pins the requester summary; omit it for the staff
 * (queue-wide) scope.
 */
export async function countFollowUpDue(
  prisma: PrismaClient,
  scope: { requesterId?: number },
): Promise<number> {
  // Parameterized enum list (cast to the Postgres enum type — a bare text
  // parameter would not compare against the enum column).
  const statuses = Prisma.join(NON_TERMINAL_STATUSES.map((s) => Prisma.sql`${s}::"TicketStatus"`));
  const rows =
    scope.requesterId === undefined
      ? await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS "count" FROM "Ticket" t
          WHERE t."status" IN (${statuses})
          AND EXISTS (
            SELECT 1 FROM "ActionTaken" a
            WHERE a."ticketId" = t."id" AND a."followUpRequired" IS TRUE
            AND a."id" = (SELECT MAX(a2."id") FROM "ActionTaken" a2 WHERE a2."ticketId" = t."id")
          )`
      : await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS "count" FROM "Ticket" t
          WHERE t."status" IN (${statuses})
          AND t."requesterId" = ${scope.requesterId}
          AND EXISTS (
            SELECT 1 FROM "ActionTaken" a
            WHERE a."ticketId" = t."id" AND a."followUpRequired" IS TRUE
            AND a."id" = (SELECT MAX(a2."id") FROM "ActionTaken" a2 WHERE a2."ticketId" = t."id")
          )`;
  return rows[0]?.count ?? 0;
}
