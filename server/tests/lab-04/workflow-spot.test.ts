import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";
import type { TicketStatus } from "@prisma/client";
import request from "supertest";

const prisma = getPrisma();

// Lab 4 tests.md row 33 (AC-59) — Workflow spot-check + BR-24 guard.
// The Lab 3 eight-status matrix is referenced, not revised (spec §6): legal
// edges 200, illegal edges 400 with status unchanged. Recording or editing
// an Action Taken never transitions status — a status move needs its own
// Lab 3 endpoint call.

const STAFF_EMAIL = "l4-wf-staff@toktikit.com";
const REQ_EMAIL = "l4-wf-req@toktikit.com";

let requesterId = 0;
let categoryId = 0;
let systemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TK-${date}-${String(randomInt(100000, 999999)).padStart(6, "0")}`;
}

async function makeTicket(status: TicketStatus): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `WF spot ${status} ${randomInt(100000, 999999)}`,
      description: "Ticket used to verify the Lab 3 matrix still holds in Lab 4.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status,
      requesterId,
      ownerId: null,
      categoryId,
      systemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

const VALID_ACTION = {
  actionAt: "2026-09-10T02:00:00.000Z",
  description: "Checked the logs.",
  result: "No anomaly found.",
  followUpRequired: false,
};

// Representative legal edges across the §6 matrix (full matrix lives in
// lab-03/priority-status-api.test.ts — this is the Lab 4 spot-check).
const LEGAL_SPOT: Array<[TicketStatus, TicketStatus]> = [
  ["NEW", "OPEN"],
  ["OPEN", "IN_PROGRESS"],
  ["IN_PROGRESS", "WAITING_FOR_REQUESTER"],
  ["WAITING_FOR_REQUESTER", "RESOLVED"],
  ["RESOLVED", "CLOSED"],
  ["CLOSED", "REOPENED"],
  ["REOPENED", "IN_PROGRESS"],
  ["NEW", "CANCELLED"],
];

const ILLEGAL_SPOT: Array<[TicketStatus, TicketStatus]> = [
  ["NEW", "CLOSED"],
  ["OPEN", "CLOSED"],
  ["RESOLVED", "OPEN"],
  ["CLOSED", "OPEN"],
  ["CANCELLED", "REOPENED"],
  ["REOPENED", "CLOSED"],
];

describe("Lab 4 workflow spot-check (AC-59, BR-24)", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    categoryId = category!.id;
    systemId = system!.id;

    const [staff, req] = await Promise.all([
      prisma.user.create({
        data: {
          name: "WF Staff",
          email: STAFF_EMAIL,
          isActive: true,
          role: "IT_STAFF",
          passwordHash: TEST_PASSWORD_HASH,
          mustChangePassword: false,
        },
      }),
      prisma.user.create({
        data: {
          name: "WF Req",
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
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [STAFF_EMAIL, REQ_EMAIL] } } });
    await prisma.$disconnect();
  });

  it("legal matrix edges still 200 with the new status (AC-59)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    for (const [from, to] of LEGAL_SPOT) {
      const id = await makeTicket(from);
      const res = await staff.patch(`/api/tickets/${id}/status`).send({ status: to });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, status: to });
    }
  });

  it("illegal edges still 400 with status unchanged (AC-59)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    for (const [from, to] of ILLEGAL_SPOT) {
      const id = await makeTicket(from);
      const res = await staff.patch(`/api/tickets/${id}/status`).send({ status: to });
      expect(res.status).toBe(400);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });
      expect(after.status).toBe(from);
    }
  });

  it("recording an action never drives status (BR-24)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("OPEN");
    const created = await staff.post(`/api/tickets/${id}/actions`).send(VALID_ACTION);
    expect(created.status).toBe(201);
    const afterCreate = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(afterCreate.status).toBe("OPEN");

    // Even a follow-up-flagged action leaves status alone.
    const flagged = await staff
      .post(`/api/tickets/${id}/actions`)
      .send({ ...VALID_ACTION, followUpRequired: true, followUpNote: "Watch it." });
    expect(flagged.status).toBe(201);
    const afterFlagged = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(afterFlagged.status).toBe("OPEN");
  });

  it("editing an action never drives status (BR-24)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("IN_PROGRESS");
    const created = await staff.post(`/api/tickets/${id}/actions`).send(VALID_ACTION);
    expect(created.status).toBe(201);

    const patched = await staff
      .patch(`/api/actions/${created.body.id}`)
      .set("If-Match", "1")
      .send({ result: "Updated result." });
    expect(patched.status).toBe(200);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("IN_PROGRESS");
  });

  it("resolve-intent still owns requester moves; direct set stays 403", async () => {
    const req = await loginAs(REQ_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("NEW");
    // Requester cannot set status directly even after Lab 4.
    const direct = await req.patch(`/api/tickets/${id}/status`).send({ status: "RESOLVED" });
    expect(direct.status).toBe(403);

    // Anonymous stays 401 on the workflow endpoints.
    const anon = request(app);
    expect((await anon.patch(`/api/tickets/${id}/status`).send({ status: "OPEN" })).status).toBe(401);
  });
});
