import { describe, it, expect } from "vitest";
import {
  computeRequesterMetrics,
  computeStaffMetrics,
  isNonTerminal,
  isResolvedToday,
  latestFollowUpByTicket,
  startOfTodayUtc,
  zeroRequesterMetrics,
  zeroStaffMetrics,
} from "../../src/dashboardFormulas.js";

// Lab 4 tests.md row 4 (AC-43) — pure Unit, no database.
// Hand-computed fixtures pin tests.md §3 pseudo-SQL: terminal exclusion,
// UTC-day boundary, latest-action-wins (AD-18), and the zero-case rule
// (BR-29). The DB summaries must equal these helpers on the same fixture.

const NOW = new Date("2026-09-20T12:00:00.000Z");
const TODAY_0100 = new Date("2026-09-20T01:00:00.000Z");
const YESTERDAY_2300 = new Date("2026-09-19T23:00:00.000Z");

describe("Lab 4 dashboard formulas unit (AC-43, tests.md §3)", () => {
  it("classifies non-terminal statuses and excludes CLOSED/CANCELLED", () => {
    for (const s of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]) {
      expect(isNonTerminal(s)).toBe(true);
    }
    for (const s of ["RESOLVED", "CLOSED", "CANCELLED"]) {
      expect(isNonTerminal(s)).toBe(false);
    }
  });

  it("resolves today on the UTC calendar day only (AD-19)", () => {
    expect(startOfTodayUtc(NOW).toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(isResolvedToday("RESOLVED", TODAY_0100, NOW)).toBe(true);
    // Same instant next UTC day is not today.
    expect(isResolvedToday("RESOLVED", TODAY_0100, new Date("2026-09-21T00:00:01.000Z"))).toBe(false);
    // Yesterday 23:00 UTC is not today even though wall-clock is close.
    expect(isResolvedToday("RESOLVED", YESTERDAY_2300, NOW)).toBe(false);
    // Non-RESOLVED never counts even when updated today (documented approximation).
    expect(isResolvedToday("CLOSED", TODAY_0100, NOW)).toBe(false);
    expect(isResolvedToday("OPEN", TODAY_0100, NOW)).toBe(false);
  });

  it("latest action wins: newer false clears follow-up (AD-18)", () => {
    const latest = latestFollowUpByTicket([
      { ticketId: 1, id: 10, followUpRequired: true },
      { ticketId: 1, id: 11, followUpRequired: false },
      { ticketId: 2, id: 20, followUpRequired: false },
      { ticketId: 2, id: 21, followUpRequired: true },
      { ticketId: 2, id: 22, followUpRequired: true },
    ]);
    expect(latest.get(1)).toBe(false);
    expect(latest.get(2)).toBe(true);
    // Out-of-order input still resolves by greatest id.
    const shuffled = latestFollowUpByTicket([
      { ticketId: 7, id: 31, followUpRequired: false },
      { ticketId: 7, id: 30, followUpRequired: true },
    ]);
    expect(shuffled.get(7)).toBe(false);
  });

  it("requester metrics scope to requesterId=me with terminal split (AC-42)", () => {
    const tickets = [
      { id: 1, status: "NEW", requesterId: 6, ownerId: null, updatedAt: TODAY_0100 },
      { id: 2, status: "OPEN", requesterId: 6, ownerId: 9, updatedAt: TODAY_0100 },
      { id: 3, status: "IN_PROGRESS", requesterId: 6, ownerId: 9, updatedAt: TODAY_0100 },
      { id: 4, status: "WAITING_FOR_REQUESTER", requesterId: 6, ownerId: 9, updatedAt: TODAY_0100 },
      { id: 5, status: "RESOLVED", requesterId: 6, ownerId: 9, updatedAt: TODAY_0100 },
      { id: 6, status: "CLOSED", requesterId: 6, ownerId: 9, updatedAt: TODAY_0100 },
      { id: 7, status: "REOPENED", requesterId: 6, ownerId: null, updatedAt: TODAY_0100 },
      { id: 8, status: "CANCELLED", requesterId: 6, ownerId: null, updatedAt: TODAY_0100 },
      // Foreign tickets never bleed into my counts.
      { id: 9, status: "OPEN", requesterId: 777, ownerId: null, updatedAt: TODAY_0100 },
    ];
    const latest = latestFollowUpByTicket([
      { ticketId: 2, id: 1, followUpRequired: true },
      // Terminal follow-up never surfaces in myFollowUpOpen.
      { ticketId: 6, id: 2, followUpRequired: true },
    ]);
    const m = computeRequesterMetrics(tickets, 6, latest);
    expect(m).toMatchObject({
      tickets: 8,
      myOpen: 3,
      myWaiting: 1,
      myResolved: 1,
      myClosed: 1,
      myReopened: 1,
      myCancelled: 1,
      myFollowUpOpen: 1,
    });
  });

  it("staff metrics exclude terminals and intersect resolvedToday (AC-43)", () => {
    const tickets = [
      { id: 1, status: "NEW", requesterId: 6, ownerId: null, updatedAt: TODAY_0100 },
      { id: 2, status: "OPEN", requesterId: 6, ownerId: 8, updatedAt: TODAY_0100 },
      { id: 3, status: "IN_PROGRESS", requesterId: 6, ownerId: 8, updatedAt: TODAY_0100 },
      { id: 4, status: "WAITING_FOR_REQUESTER", requesterId: 7, ownerId: 9, updatedAt: TODAY_0100 },
      { id: 5, status: "RESOLVED", requesterId: 6, ownerId: 8, updatedAt: TODAY_0100 },
      { id: 6, status: "RESOLVED", requesterId: 6, ownerId: 8, updatedAt: YESTERDAY_2300 },
      { id: 7, status: "CLOSED", requesterId: 6, ownerId: null, updatedAt: TODAY_0100 },
      { id: 8, status: "CANCELLED", requesterId: 6, ownerId: 8, updatedAt: TODAY_0100 },
    ];
    const latest = latestFollowUpByTicket([{ ticketId: 2, id: 1, followUpRequired: true }]);
    const m = computeStaffMetrics(tickets, 8, latest, NOW);
    expect(m).toEqual({
      unassignedCount: 1,
      myAssignedCount: 2,
      myInProgressCount: 1,
      waitingForRequesterCount: 1,
      followUpDueCount: 1,
      resolvedTodayCount: 1,
    });
  });

  it("empty scope returns all-zero metrics, never null (AC-45, BR-29)", () => {
    expect(computeRequesterMetrics([], 6, new Map())).toEqual({
      ...zeroRequesterMetrics(),
      tickets: 0,
    });
    expect(computeStaffMetrics([], 8, new Map(), NOW)).toEqual(zeroStaffMetrics());
    for (const v of Object.values(zeroRequesterMetrics())) expect(v).toBe(0);
    for (const v of Object.values(zeroStaffMetrics())) expect(v).toBe(0);
  });
});
