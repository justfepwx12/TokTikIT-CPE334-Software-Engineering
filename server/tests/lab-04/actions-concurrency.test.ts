import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";

const prisma = getPrisma();

const OWNER_EMAIL = "l4-conc-owner@toktikit.com";
const STAFF_EMAIL = "l4-conc-staff@toktikit.com";

let ownerId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TK-${date}-${String(randomInt(100000, 999999)).padStart(6, "0")}`;
}

async function makeTicket(): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `Concurrency fixture ${randomInt(100000, 999999)}`,
      description: "Ticket used to verify optimistic concurrency and idempotency.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status: "OPEN",
      requesterId: ownerId,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

const VALID_ACTION = {
  actionAt: "2026-09-10T02:00:00.000Z",
  description: "Did the work.",
  result: "It worked.",
  followUpRequired: false,
};

describe("Lab 4 Actions concurrency + idempotency (AC-37, AC-38)", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const mkUser = (name: string, email: string, role: "REQUESTER" | "IT_STAFF") =>
      prisma.user.create({
        data: { name, email, isActive: true, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
      });
    const [owner] = await Promise.all([
      mkUser("Conc Owner", OWNER_EMAIL, "REQUESTER"),
      mkUser("Conc Staff", STAFF_EMAIL, "IT_STAFF"),
    ]);
    ownerId = owner.id;
  });

  afterAll(async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL] } } });
    await prisma.$disconnect();
  });

  it("stale If-Match → 409 STALE_VERSION with currentVersion, row untouched (AC-37)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const ticketId = await makeTicket();
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).send(VALID_ACTION);
    expect(created.status).toBe(201);

    // Fresh write moves version 1 → 2.
    const first = await staff.patch(`/api/actions/${created.body.id}`).set("If-Match", "1").send({ result: "v2" });
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(2);

    // Replaying version 1 is stale: 409 carries the current version and the
    // stored row keeps the winner's data (no silent overwrite).
    const stale = await staff.patch(`/api/actions/${created.body.id}`).set("If-Match", "1").send({ result: "stale" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_VERSION");
    expect(stale.body.error.currentVersion).toBe(2);
    const row = await prisma.actionTaken.findUnique({ where: { id: created.body.id } });
    expect(row?.version).toBe(2);
    expect(row?.result).toBe("v2");
  });

  it("two concurrent PATCHes: exactly one 200 and one 409, no lost update (AC-37)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const ticketId = await makeTicket();
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).send(VALID_ACTION);
    expect(created.status).toBe(201);

    const [a, b] = await Promise.all([
      staff.patch(`/api/actions/${created.body.id}`).set("If-Match", "1").send({ result: "writer-A" }),
      staff.patch(`/api/actions/${created.body.id}`).set("If-Match", "1").send({ result: "writer-B" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = a.status === 200 ? a : b;
    const row = await prisma.actionTaken.findUnique({ where: { id: created.body.id } });
    expect(row?.version).toBe(2);
    expect(row?.result).toBe(winner.body.result);
  });

  it("replayed Idempotency-Key → original 201 with exactly 1 row; reused key + new payload → 422 (AC-38)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const ticketId = await makeTicket();
    const key = `l4-conc-${randomInt(100000, 999999)}`;

    const first = await staff.post(`/api/tickets/${ticketId}/actions`).set("Idempotency-Key", key).send(VALID_ACTION);
    expect(first.status).toBe(201);

    const replay = await staff.post(`/api/tickets/${ticketId}/actions`).set("Idempotency-Key", key).send(VALID_ACTION);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1);

    const conflict = await staff
      .post(`/api/tickets/${ticketId}/actions`)
      .set("Idempotency-Key", key)
      .send({ ...VALID_ACTION, description: "A different payload." });
    expect(conflict.status).toBe(422);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_REUSE");
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1);
  });

  it("simultaneous double-submit with one key creates exactly 1 record (AC-38/52)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const ticketId = await makeTicket();
    const key = `l4-conc-race-${randomInt(100000, 999999)}`;

    const [a, b] = await Promise.all([
      staff.post(`/api/tickets/${ticketId}/actions`).set("Idempotency-Key", key).send(VALID_ACTION),
      staff.post(`/api/tickets/${ticketId}/actions`).set("Idempotency-Key", key).send(VALID_ACTION),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.id).toBe(b.body.id);
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1);
  });

  it("overlong Idempotency-Key → 400", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const ticketId = await makeTicket();
    const res = await staff
      .post(`/api/tickets/${ticketId}/actions`)
      .set("Idempotency-Key", "k".repeat(65))
      .send(VALID_ACTION);
    expect(res.status).toBe(400);
  });
});
