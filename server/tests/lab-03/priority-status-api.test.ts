import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";
import type { TicketStatus } from "@prisma/client";

const prisma = getPrisma();

const STAFF_EMAIL = "l3-matrix-staff@toktikit.com";
const REQ_EMAIL = "l3-matrix-req@toktikit.com";

let requesterId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(100000, 999999);
  return `TK-${date}-${String(nonce).padStart(6, "0")}`;
}

async function makeTicket(status: TicketStatus): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `Matrix fixture ${status} ${randomInt(100000, 999999)}`,
      description: "A ticket used to verify the status transition matrix.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status,
      requesterId,
      ownerId: null,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

// Legal IT/Admin edges (spec §6) — each must 200 and persist.
const LEGAL: Array<[TicketStatus, TicketStatus]> = [
  ["NEW", "OPEN"],
  ["NEW", "IN_PROGRESS"],
  ["NEW", "CANCELLED"],
  ["NEW", "RESOLVED"],
  ["OPEN", "WAITING_FOR_REQUESTER"],
  ["IN_PROGRESS", "RESOLVED"],
  ["WAITING_FOR_REQUESTER", "CANCELLED"],
  ["RESOLVED", "CLOSED"],
  ["RESOLVED", "REOPENED"],
  ["CLOSED", "REOPENED"],
  ["REOPENED", "IN_PROGRESS"],
];

// Illegal edges — each must 400 INVALID_STATUS_TRANSITION with status unchanged.
const ILLEGAL: Array<[TicketStatus, TicketStatus]> = [
  ["NEW", "CLOSED"],
  ["OPEN", "CLOSED"],
  ["IN_PROGRESS", "CLOSED"],
  ["RESOLVED", "OPEN"],
  ["CLOSED", "OPEN"],
  ["CANCELLED", "REOPENED"],
  ["REOPENED", "CLOSED"],
];

describe("Lab 3 Status workflow matrix API (AC-18–AC-21)", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const [staff, req] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Matrix Staff",
          email: STAFF_EMAIL,
          isActive: true,
          role: "IT_STAFF",
          passwordHash: TEST_PASSWORD_HASH,
          mustChangePassword: false,
        },
      }),
      prisma.user.create({
        data: {
          name: "Matrix Req",
          email: REQ_EMAIL,
          isActive: true,
          role: "REQUESTER",
          passwordHash: TEST_PASSWORD_HASH,
          mustChangePassword: false,
        },
      }),
    ]);
    requesterId = req.id;
    void staff;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [STAFF_EMAIL, REQ_EMAIL] } } });
    await prisma.$disconnect();
  });

  it("legal matrix edges → 200 with the new status (AC-18)", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    for (const [from, to] of LEGAL) {
      const id = await makeTicket(from);
      const res = await agent.patch(`/api/tickets/${id}/status`).send({ status: to });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, status: to });
    }
  });

  it("illegal edges → 400 INVALID_STATUS_TRANSITION, status unchanged (AC-19)", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    for (const [from, to] of ILLEGAL) {
      const id = await makeTicket(from);
      const res = await agent.patch(`/api/tickets/${id}/status`).send({ status: to });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
      expect(res.body.error.message).toBe(`Cannot move a ticket from ${from} to ${to}.`);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });
      expect(after.status).toBe(from);
    }
  });

  it("requester direct status set (even RESOLVED/CLOSED) → 403 (AC-21)", async () => {
    const agent = await loginAs(REQ_EMAIL, TEST_PASSWORD);
    for (const status of ["IN_PROGRESS", "RESOLVED", "CLOSED"] as const) {
      const id = await makeTicket("NEW");
      const res = await agent.patch(`/api/tickets/${id}/status`).send({ status });
      expect(res.status).toBe(403);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });
      expect(after.status).toBe("NEW");
    }
  });

  it("unknown status value → 400; missing ticket → 404; bad id → 400", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("NEW");

    const badValue = await agent.patch(`/api/tickets/${id}/status`).send({ status: "DONE" });
    expect(badValue.status).toBe(400);

    const missing = await agent.patch("/api/tickets/99999999/status").send({ status: "OPEN" });
    expect(missing.status).toBe(404);

    const badId = await agent.patch("/api/tickets/abc/status").send({ status: "OPEN" });
    expect(badId.status).toBe(400);
  });
});

// ------------------------------------------------------------------
// Requester resolve-intent (AC-20/AC-21, BR-16, tests.md rows 26–28):
// NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER → RESOLVED,
// RESOLVED/CLOSED → REOPENED, CANCELLED → 400, foreign user → 403.
// ------------------------------------------------------------------

const RI_OWNER_EMAIL = "l3-resolve-owner@toktikit.com";
const RI_OTHER_EMAIL = "l3-resolve-other@toktikit.com";
const RI_STAFF_EMAIL = "l3-resolve-staff@toktikit.com";

let riOwnerId = 0;
let riOtherId = 0;
let riStaffId = 0;

async function makeResolveTicket(status: TicketStatus): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `L3 Resolve intent ${status} ${randomInt(100000, 999999)}`,
      description: "A ticket used to verify the resolve-intent transition.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status,
      requesterId: riOwnerId,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

describe("Lab 3 POST /api/tickets/:id/resolve-intent (AC-20/21, BR-16)", () => {
  beforeAll(async () => {
    const mkResolveUser = (
      name: string,
      email: string,
      role: "REQUESTER" | "IT_STAFF",
    ) =>
      prisma.user.create({
        data: {
          name,
          email,
          isActive: true,
          role,
          passwordHash: TEST_PASSWORD_HASH,
          mustChangePassword: false,
        },
      });
    const [riOwner, riOther, riStaff] = await Promise.all([
      mkResolveUser("L3 Resolve Owner", RI_OWNER_EMAIL, "REQUESTER"),
      mkResolveUser("L3 Resolve Other", RI_OTHER_EMAIL, "REQUESTER"),
      mkResolveUser("L3 Resolve Staff", RI_STAFF_EMAIL, "IT_STAFF"),
    ]);
    riOwnerId = riOwner.id;
    riOtherId = riOther.id;
    riStaffId = riStaff.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: [riOwnerId, riOtherId, riStaffId] } },
    });
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).post("/api/tickets/1/resolve-intent");
    expect(res.status).toBe(401);
  });

  it("moves NEW → RESOLVED with { id, status } (AC-20)", async () => {
    const agent = await loginAs(RI_OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeResolveTicket("NEW");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: "RESOLVED" });
  });

  it("moves IN_PROGRESS → RESOLVED (AC-20)", async () => {
    const agent = await loginAs(RI_OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeResolveTicket("IN_PROGRESS");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RESOLVED");
  });

  it("moves RESOLVED → REOPENED on a second signal (AC-20)", async () => {
    const agent = await loginAs(RI_OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeResolveTicket("RESOLVED");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REOPENED");
  });

  it("moves CLOSED → REOPENED (AC-20)", async () => {
    const agent = await loginAs(RI_OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeResolveTicket("CLOSED");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REOPENED");
  });

  it("returns 400 for CANCELLED and leaves the ticket unchanged", async () => {
    const agent = await loginAs(RI_OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeResolveTicket("CANCELLED");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("CANCELLED");
  });

  it("returns 403 for another requester's ticket", async () => {
    const agent = await loginAs(RI_OTHER_EMAIL, TEST_PASSWORD);
    const id = await makeResolveTicket("OPEN");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a non-requester role (AC-21)", async () => {
    const agent = await loginAs(RI_STAFF_EMAIL, TEST_PASSWORD);
    const id = await makeResolveTicket("OPEN");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent ticket", async () => {
    const agent = await loginAs(RI_OWNER_EMAIL, TEST_PASSWORD);
    const res = await agent.post("/api/tickets/99999999/resolve-intent");
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric ticket id", async () => {
    const agent = await loginAs(RI_OWNER_EMAIL, TEST_PASSWORD);
    const res = await agent.post("/api/tickets/abc/resolve-intent");
    expect(res.status).toBe(400);
  });
});
