import type { PrismaClient, Prisma, TicketStatus } from '@prisma/client';

// Lab 4 AD-18 latest-action rule + BR-26 aggregated-only dashboards.
// Resolves the ticket-id set whose LATEST recorded action (greatest `id`)
// has `followUpRequired = <want>`, intersected with a caller-supplied ticket
// scope. Transfer is bounded to id lists and booleans: ticket rows are never
// fetched here, and every step is a fixed (non-growing) number of queries —
// no N+1. Callers combine the result with their own `where` via `id: { in }`.
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
