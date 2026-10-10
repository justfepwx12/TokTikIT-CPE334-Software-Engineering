import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";

const prisma = getPrisma();
const NON_TERMINAL: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

const REQ_A_EMAIL = "l4-dash-reqa@toktikit.com";
const REQ_B_EMAIL = "l4-dash-reqb@toktikit.com";
const STAFF_EMAIL = "l4-dash-staff@toktikit.com";

let reqAId = 0;
let reqBId = 0;
let staffId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TK-${date}-${String(randomInt(100000, 999999)).padStart(6, "0")}`;
}

async function makeTicket(opts: {
  requesterId: number;
  status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED";
  ownerId?: number | null;
}): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `Dash fixture ${randomInt(100000, 999999)}`,
      description: "Ticket used to verify dashboard summaries.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status: opts.status,
      requesterId: opts.requesterId,
      ownerId: opts.ownerId ?? null,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

async function addAction(ticketId: number, performerId: number, followUpRequired: boolean): Promise<void> {
  await prisma.actionTaken.create({
    data: {
      ticketId,
      actionAt: new Date("2026-09-10T02:00:00.000Z"),
      description: "Seeded work.",
      result: "Done.",
      performedById: performerId,
      followUpRequired,
      followUpNote: followUpRequired ? "Follow up." : null,
    },
  });
}

describe("Lab 4 Dashboard summaries API (AC-42–AC-47)", () => {
  // A-let: OPEN (owned by staff, follow-up flagged) + RESOLVED (owned by staff).
  // B: zero tickets. Staff: owns A-OPEN; one extra unassigned NEW ticket.
  let aOpenId = 0;

  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const mkUser = (name: string, email: string, role: "REQUESTER" | "IT_STAFF") =>
      prisma.user.create({
        data: { name, email, isActive: true, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
      });
    const [a, b, s] = await Promise.all([
      mkUser("Dash ReqA", REQ_A_EMAIL, "REQUESTER"),
      mkUser("Dash ReqB", REQ_B_EMAIL, "REQUESTER"),
      mkUser("Dash Staff", STAFF_EMAIL, "IT_STAFF"),
    ]);
    reqAId = a.id;
    reqBId = b.id;
    staffId = s.id;

    aOpenId = await makeTicket({ requesterId: reqAId, status: "OPEN", ownerId: staffId });
    await makeTicket({ requesterId: reqAId, status: "RESOLVED", ownerId: staffId });
    await makeTicket({ requesterId: reqAId, status: "NEW", ownerId: null });
    await addAction(aOpenId, staffId, true);
  });

  afterAll(async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL, STAFF_EMAIL] } } });
    await prisma.$disconnect();
  });

  it("requester A sees own counts; B sees all zeros; staff sees only own requested (AC-42, AC-45)", async () => {
    const a = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    const resA = await a.get("/api/dashboard/requester/summary");
    expect(resA.status).toBe(200);
    expect(resA.body.scope).toEqual({ requesterId: reqAId });
    expect(resA.body.metrics).toMatchObject({
      myOpen: 2, // OPEN + NEW
      myWaiting: 0,
      myResolved: 1,
      myClosed: 0,
      myReopened: 0,
      myCancelled: 0,
      myFollowUpOpen: 1,
    });

    const b = await loginAs(REQ_B_EMAIL, TEST_PASSWORD);
    const resB = await b.get("/api/dashboard/requester/summary");
    expect(resB.status).toBe(200);
    expect(Object.values(resB.body.metrics).every((v) => v === 0)).toBe(true);

    // Staff callers are scoped to tickets they requested themselves (none).
    const s = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const resS = await s.get("/api/dashboard/requester/summary");
    expect(resS.status).toBe(200);
    expect(Object.values(resS.body.metrics).every((v) => v === 0)).toBe(true);
  });

  it("staff summary equals direct DB counts (AC-43)", async () => {
    const s = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const res = await s.get("/api/dashboard/staff/summary");
    expect(res.status).toBe(200);
    expect(res.body.scope).toEqual({ viewerId: staffId });

    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const [unassigned, mine, inProgress, waiting, resolvedToday] = await Promise.all([
      prisma.ticket.count({ where: { ownerId: null, status: { in: NON_TERMINAL } } }),
      prisma.ticket.count({ where: { ownerId: staffId, status: { in: NON_TERMINAL } } }),
      prisma.ticket.count({ where: { ownerId: staffId, status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { status: "RESOLVED", updatedAt: { gte: midnight } } }),
    ]);
    // Follow-up metric recomputed with the AD-18 latest-action rule.
    const groups = await prisma.actionTaken.groupBy({ by: ["ticketId"], _max: { id: true } });
    const latest = await prisma.actionTaken.findMany({
      where: { id: { in: groups.map((g) => g._max.id).filter((id): id is number => id !== null) } },
      select: { ticketId: true, followUpRequired: true },
    });
    const dueIds = latest.filter((r) => r.followUpRequired).map((r) => r.ticketId);
    const followUpDue = await prisma.ticket.count({
      where: { id: { in: dueIds }, status: { in: NON_TERMINAL } },
    });

    expect(res.body.metrics).toEqual({
      unassignedCount: unassigned,
      myAssignedCount: mine,
      myInProgressCount: inProgress,
      waitingForRequesterCount: waiting,
      followUpDueCount: followUpDue,
      resolvedTodayCount: resolvedToday,
    });
    expect(mine).toBeGreaterThanOrEqual(1);
  });

  it("requester on staff summary → 403; no session → 401 (AC-44)", async () => {
    const a = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    const denied = await a.get("/api/dashboard/staff/summary");
    expect(denied.status).toBe(403);

    const anon = request(app);
    expect((await anon.get("/api/dashboard/staff/summary")).status).toBe(401);
    expect((await anon.get("/api/dashboard/requester/summary")).status).toBe(401);
  });

  it("every drillDown descriptor resolves to the counted set (AC-46)", async () => {
    const a = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    const summary = (await a.get("/api/dashboard/requester/summary")).body;
    for (const [metric, link] of Object.entries<{ endpoint: string; query: string }>(summary.drillDown)) {
      const list = await a.get(`${link.endpoint}?${link.query}&limit=50`);
      expect(list.status).toBe(200);
      expect(list.body.pagination.total).toBe(summary.metrics[metric]);
    }

    const s = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const staffSummary = (await s.get("/api/dashboard/staff/summary")).body;
    for (const [metric, link] of Object.entries<{ endpoint: string; query: string }>(staffSummary.drillDown)) {
      // ownerId=me placeholders use the literal viewer id from the contract
      // example shape; here descriptors already carry real ids.
      const list = await s.get(`${link.endpoint}?${link.query}&limit=50`);
      expect(list.status).toBe(200);
      expect(list.body.pagination.total).toBe(staffSummary.metrics[metric]);
    }

    // myFollowUpOpen drill-down contains exactly the flagged OPEN ticket.
    const follow = await a.get(
      `${summary.drillDown.myFollowUpOpen.endpoint}?${summary.drillDown.myFollowUpOpen.query}`,
    );
    expect(follow.body.tickets.map((t: { id: number }) => t.id)).toEqual([aOpenId]);
  });

  it("list filters reject unknown values; followUp=false complements true (api-spec §3)", async () => {
    const a = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    expect((await a.get("/api/tickets?status=BOGUS")).status).toBe(400);
    expect((await a.get("/api/tickets?followUp=maybe")).status).toBe(400);

    const s = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    expect((await s.get("/api/staff/tickets?status=OPEN,BOGUS")).status).toBe(400);
    expect((await s.get("/api/staff/tickets?resolvedToday=false")).status).toBe(400);

    // followUp=false returns the complement within the caller's scope.
    const scopedTrue = await a.get("/api/tickets?followUp=true&limit=50");
    const scopedFalse = await a.get("/api/tickets?followUp=false&limit=50");
    expect(scopedTrue.status).toBe(200);
    expect(scopedFalse.status).toBe(200);
    const trueIds = new Set(scopedTrue.body.tickets.map((t: { id: number }) => t.id));
    for (const t of scopedFalse.body.tickets as { id: number }[]) {
      expect(trueIds.has(t.id)).toBe(false);
    }

    const staffTrue = await s.get("/api/staff/tickets?followUp=true&limit=50");
    const staffFalse = await s.get("/api/staff/tickets?followUp=false&limit=50");
    expect(staffTrue.status).toBe(200);
    expect(staffFalse.status).toBe(200);
    // Multi-status keeps working as Lab 3 single values did.
    const single = await s.get("/api/staff/tickets?status=OPEN&limit=50");
    expect(single.status).toBe(200);

    // resolvedToday intersects (not overwrites) a supplied status filter.
    const conflict = await s.get("/api/staff/tickets?status=OPEN&resolvedToday=true&limit=50");
    expect(conflict.status).toBe(200);
    expect(conflict.body.pagination.total).toBe(0);
    const narrow = await s.get("/api/staff/tickets?status=RESOLVED&resolvedToday=true&limit=50");
    const plain = await s.get("/api/staff/tickets?resolvedToday=true&limit=50");
    expect(narrow.status).toBe(200);
    expect(narrow.body.pagination.total).toBe(plain.body.pagination.total);
  });

  it("summaries aggregate in-DB: no ticket-row fetch, no N+1 (AC-47)", async () => {
    // Prisma's own middleware API records every operation (vi.spyOn breaks
    // delegate `this` binding, so spies cannot be used on the client).
    const ops: string[] = [];
    prisma.$use(async (params, next) => {
      ops.push(`${params.model}.${params.action}`);
      return next(params);
    });
    const a = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    const s = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    ops.length = 0; // exclude login/session queries from the assertion window

    expect((await a.get("/api/dashboard/requester/summary")).status).toBe(200);
    expect((await s.get("/api/dashboard/staff/summary")).status).toBe(200);

    expect(ops).toContain("Ticket.groupBy");
    expect(ops).toContain("Ticket.count");
    // No ticket-row reads anywhere in either summary path.
    expect(ops.filter((op) => op.startsWith("Ticket.") && op !== "Ticket.groupBy" && op !== "Ticket.count")).toEqual([]);
    // Follow-up metrics are database-computed: the raw aggregation runs
    // in-DB, and no unbounded id-list/action-row fetch may occur.
    expect(ops.some((op) => op.includes("queryRaw"))).toBe(true);
    expect(ops).not.toContain("ActionTaken.findMany");
    // Bounded operation count: requester = session + groupBy + raw,
    // staff = session + 5 counts + raw (10 total). N+1 would grow with the
    // ticket/action rows instead of staying flat.
    expect(ops.length).toBeLessThanOrEqual(16);
  });
});
