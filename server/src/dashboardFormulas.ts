import { NON_TERMINAL_STATUSES } from './followUpScope.js';

// Lab 4 BR-25 / AD-18 / AD-19 — pure, in-memory dashboard formula helpers.
// Executable reference for tests.md §3 (rows 4, 15, 35) and specification.md
// §11 AC-42/43/45.
//
// The production summaries (controllers/dashboard.controller.ts) compute the
// SAME predicates in-DB with groupBy/count + $queryRaw (BR-26, AC-47) and
// must never fetch ticket rows. These helpers mirror those predicates over
// plain arrays so Unit tests can pin the math (terminal exclusion, UTC-day
// boundary, latest-action-wins) without a database. If the SQL and these
// helpers ever disagree, the SQL + tests.md §3 pseudo-SQL win — fix here,
// never the contract.
//
// Latest-action rule (AD-18): only each ticket's greatest-`id` action decides
// follow-up. Recording a newer action with followUpRequired=false clears the
// ticket from follow-up results; history is never deleted.

export const NON_TERMINAL = [...NON_TERMINAL_STATUSES] as string[];

export function isNonTerminal(status: string): boolean {
  return (NON_TERMINAL as readonly string[]).includes(status);
}

/** Start of the current UTC calendar day (AD-19). Injectable `now` for tests. */
export function startOfTodayUtc(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** AD-19 predicate: RESOLVED + updatedAt within the current UTC day. */
export function isResolvedToday(
  status: string,
  updatedAt: Date,
  now: Date = new Date(),
): boolean {
  return status === 'RESOLVED' && updatedAt >= startOfTodayUtc(now);
}

export type FollowUpAction = {
  ticketId: number;
  id: number;
  followUpRequired: boolean;
};

export type FormulaTicket = {
  id: number;
  status: string;
  requesterId: number;
  ownerId: number | null;
  updatedAt: Date;
};

/**
 * Collapse an action history to latest-flag-per-ticket. Later writes
 * overwrite earlier ones in `id` order (same as SQL MAX(id) in
 * followUpScope.countFollowUpDue). Ties impossible — ids unique.
 */
export function latestFollowUpByTicket(actions: FollowUpAction[]): Map<number, boolean> {
  const byId = [...actions].sort((a, b) => a.id - b.id);
  const latest = new Map<number, boolean>();
  for (const a of byId) latest.set(a.ticketId, a.followUpRequired);
  return latest;
}

export const isFollowUpDue = (ticketId: number, latest: Map<number, boolean>): boolean =>
  latest.get(ticketId) === true;

export type RequesterMetrics = {
  tickets: number;
  myOpen: number;
  myWaiting: number;
  myResolved: number;
  myClosed: number;
  myReopened: number;
  myCancelled: number;
  myFollowUpOpen: number;
};

/** BR-25 requester scope: every predicate includes requesterId = me. */
export function computeRequesterMetrics(
  tickets: FormulaTicket[],
  requesterId: number,
  latest: Map<number, boolean>,
): RequesterMetrics {
  const mine = tickets.filter((t) => t.requesterId === requesterId);
  const inStatus = (...s: string[]) => mine.filter((t) => s.includes(t.status)).length;
  return {
    tickets: mine.length,
    myOpen: mine.filter((t) => ['NEW', 'OPEN', 'IN_PROGRESS'].includes(t.status)).length,
    myWaiting: inStatus('WAITING_FOR_REQUESTER'),
    myResolved: inStatus('RESOLVED'),
    myClosed: inStatus('CLOSED'),
    myReopened: inStatus('REOPENED'),
    myCancelled: inStatus('CANCELLED'),
    // AD-18: non-terminal + latest action flags follow-up.
    myFollowUpOpen: mine.filter((t) => isNonTerminal(t.status) && isFollowUpDue(t.id, latest)).length,
  };
}

export type StaffMetrics = {
  unassignedCount: number;
  myAssignedCount: number;
  myInProgressCount: number;
  waitingForRequesterCount: number;
  followUpDueCount: number;
  resolvedTodayCount: number;
};

/** BR-25 staff scope: whole queue; terminal CLOSED/CANCELLED never in attention buckets. */
export function computeStaffMetrics(
  tickets: FormulaTicket[],
  viewerId: number,
  latest: Map<number, boolean>,
  now: Date = new Date(),
): StaffMetrics {
  return {
    unassignedCount: tickets.filter((t) => t.ownerId === null && isNonTerminal(t.status)).length,
    myAssignedCount: tickets.filter((t) => t.ownerId === viewerId && isNonTerminal(t.status)).length,
    myInProgressCount: tickets.filter((t) => t.ownerId === viewerId && t.status === 'IN_PROGRESS').length,
    waitingForRequesterCount: tickets.filter((t) => t.status === 'WAITING_FOR_REQUESTER').length,
    followUpDueCount: tickets.filter((t) => isNonTerminal(t.status) && isFollowUpDue(t.id, latest)).length,
    resolvedTodayCount: tickets.filter((t) => isResolvedToday(t.status, t.updatedAt, now)).length,
  };
}

/** BR-29: empty scope surfaces 0, never null. */
export function zeroRequesterMetrics(): RequesterMetrics {
  return {
    tickets: 0,
    myOpen: 0,
    myWaiting: 0,
    myResolved: 0,
    myClosed: 0,
    myReopened: 0,
    myCancelled: 0,
    myFollowUpOpen: 0,
  };
}

export function zeroStaffMetrics(): StaffMetrics {
  return {
    unassignedCount: 0,
    myAssignedCount: 0,
    myInProgressCount: 0,
    waitingForRequesterCount: 0,
    followUpDueCount: 0,
    resolvedTodayCount: 0,
  };
}
