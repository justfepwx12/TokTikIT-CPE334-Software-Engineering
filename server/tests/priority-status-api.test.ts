import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "./helpers.js";
import type { TicketStatus } from "@prisma/client";

const prisma = getPrisma();

const STAFF_EMAIL = "matrix-staff@toktikit.com";
const REQ_EMAIL = "matrix-req@toktikit.com";

let requesterId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(1000, 10000);
  return `TK-${date}-${String(nonce).padStart(4, "0")}`;
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

describe("Status workflow matrix API (AC-18–AC-21)", () => {
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
