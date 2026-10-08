import { Request, Response } from 'express';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';
import { NON_TERMINAL_STATUSES, resolveFollowUpTicketIds } from '../src/followUpScope.js';

// Dashboard summaries (Lab 4 api-spec §2, BR-25–BR-26, BR-29).
// Aggregated-only: every metric is computed in-DB with groupBy/count and no
// ticket row is ever fetched here (AC-47). Follow-up metrics share the exact
// predicate of the `followUp` list filter (AD-18), so each drillDown
// descriptor resolves to precisely the counted set (AC-46).

const NON_TERMINAL = [...NON_TERMINAL_STATUSES];

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function statusCounts(
  prisma: ReturnType<typeof getPrisma>,
  scope: Record<string, unknown>,
): Promise<Record<string, number>> {
  const groups = await prisma.ticket.groupBy({ by: ['status'], where: scope, _count: true });
  const counts: Record<string, number> = {};
  for (const g of groups) counts[g.status] = g._count;
  return counts;
}

// GET /api/dashboard/requester/summary — own-ticket counts for the caller
// (FR-29, BR-25). Any authenticated role; scope is always requesterId = me,
// so Staff/Admin callers see only tickets they requested themselves.
export const requesterSummary = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as AuthRequest).user;
    if (!sessionUser) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
      });
    }

    const prisma = getPrisma();
    const scope = { requesterId: sessionUser.id };
    const counts = await statusCounts(prisma, scope);
    const at = (s: string) => counts[s] ?? 0;

    const followUpIds = await resolveFollowUpTicketIds(
      prisma,
      { requesterId: sessionUser.id, status: { in: NON_TERMINAL } },
      true,
    );

    return res.status(200).json({
      scope: { requesterId: sessionUser.id },
      metrics: {
        myOpen: at('NEW') + at('OPEN') + at('IN_PROGRESS'),
        myWaiting: at('WAITING_FOR_REQUESTER'),
        myResolved: at('RESOLVED'),
        myClosed: at('CLOSED'),
        myReopened: at('REOPENED'),
        myCancelled: at('CANCELLED'),
        myFollowUpOpen: followUpIds.length,
      },
      drillDown: {
        myOpen: { endpoint: '/api/tickets', query: 'status=NEW,OPEN,IN_PROGRESS' },
        myWaiting: { endpoint: '/api/tickets', query: 'status=WAITING_FOR_REQUESTER' },
        myResolved: { endpoint: '/api/tickets', query: 'status=RESOLVED' },
        myClosed: { endpoint: '/api/tickets', query: 'status=CLOSED' },
        myReopened: { endpoint: '/api/tickets', query: 'status=REOPENED' },
        myCancelled: { endpoint: '/api/tickets', query: 'status=CANCELLED' },
        myFollowUpOpen: {
          endpoint: '/api/tickets',
          query: `status=${NON_TERMINAL.join(',')}&followUp=true`,
        },
      },
    });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// GET /api/dashboard/staff/summary — operational counts (FR-30, BR-25).
// IT Staff/Admin only (requireRole in App.ts; Requester → 403).
export const staffSummary = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as AuthRequest).user;
    if (!sessionUser) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
      });
    }

    const prisma = getPrisma();
    const nonTerminal = { status: { in: NON_TERMINAL } };
    const [unassignedCount, myAssignedCount, myInProgressCount, waitingForRequesterCount, resolvedTodayCount] =
      await Promise.all([
        prisma.ticket.count({ where: { ownerId: null, ...nonTerminal } }),
        prisma.ticket.count({ where: { ownerId: sessionUser.id, ...nonTerminal } }),
        prisma.ticket.count({ where: { ownerId: sessionUser.id, status: 'IN_PROGRESS' } }),
        prisma.ticket.count({ where: { status: 'WAITING_FOR_REQUESTER' } }),
        prisma.ticket.count({ where: { status: 'RESOLVED', updatedAt: { gte: startOfTodayUtc() } } }),
      ]);
    // Viewer-visible scope for staff = the whole queue (Lab 3 BR-17: staff
    // see all tickets), intersected with the AD-18 latest-action predicate.
    const followUpIds = await resolveFollowUpTicketIds(prisma, { ...nonTerminal }, true);

    return res.status(200).json({
      scope: { viewerId: sessionUser.id },
      metrics: {
        unassignedCount,
        myAssignedCount,
        myInProgressCount,
        waitingForRequesterCount,
        followUpDueCount: followUpIds.length,
        resolvedTodayCount,
      },
      drillDown: {
        unassignedCount: {
          endpoint: '/api/staff/tickets',
          query: `ownerId=0&status=${NON_TERMINAL.join(',')}`,
        },
        myAssignedCount: {
          endpoint: '/api/staff/tickets',
          query: `ownerId=${sessionUser.id}&status=${NON_TERMINAL.join(',')}`,
        },
        myInProgressCount: {
          endpoint: '/api/staff/tickets',
          query: `ownerId=${sessionUser.id}&status=IN_PROGRESS`,
        },
        waitingForRequesterCount: {
          endpoint: '/api/staff/tickets',
          query: 'status=WAITING_FOR_REQUESTER',
        },
        followUpDueCount: {
          endpoint: '/api/staff/tickets',
          query: `status=${NON_TERMINAL.join(',')}&followUp=true`,
        },
        resolvedTodayCount: {
          endpoint: '/api/staff/tickets',
          query: 'status=RESOLVED&resolvedToday=true',
        },
      },
    });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};
