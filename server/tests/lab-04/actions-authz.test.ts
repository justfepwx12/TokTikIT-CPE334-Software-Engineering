import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";

const prisma = getPrisma();

const OWNER_EMAIL = "l4-actz-owner@toktikit.com";
const OTHER_EMAIL = "l4-actz-other@toktikit.com";
const STAFF_EMAIL = "l4-actz-staff@toktikit.com";

let ownerId = 0;
let ownTicketId = 0;
let foreignTicketId = 0;
let testCategoryId = 0;
let testSystemId = 0;

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TK-${date}-${String(randomInt(100000, 999999)).padStart(6, "0")}`;
}

const VALID_ACTION = {
  actionAt: "2026-09-10T02:00:00.000Z",
  description: "Did the work.",
  result: "It worked.",
  followUpRequired: false,
};

describe("Lab 4 Actions Taken authorization (AC-39, AC-40)", () => {
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
      mkUser("Actz Owner", OWNER_EMAIL, "REQUESTER"),
      mkUser("Actz Other", OTHER_EMAIL, "REQUESTER"),
      mkUser("Actz Staff", STAFF_EMAIL, "IT_STAFF"),
    ]);
    ownerId = owner.id;

    const mkTicket = (requesterId: number) =>
      prisma.ticket.create({
        data: {
          ticketNo: makeTicketNo(),
          title: "Authz fixture",
          description: "Ticket used to verify actions authorization.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status: "OPEN",
          requesterId,
          categoryId: testCategoryId,
          systemId: testSystemId,
        },
      });
    ownTicketId = (await mkTicket(ownerId)).id;
    const otherRow = await prisma.user.findUnique({ where: { email: OTHER_EMAIL } });
    foreignTicketId = (await mkTicket(otherRow!.id)).id;
  });

  afterAll(async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: [ownTicketId, foreignTicketId] } } });
    await prisma.ticket.deleteMany({ where: { id: { in: [ownTicketId, foreignTicketId] } } });
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL, STAFF_EMAIL] } } });
    await prisma.$disconnect();
  });

  it("requester POST/PATCH → 403 on own and foreign tickets (AC-39)", async () => {
    const owner = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    for (const id of [ownTicketId, foreignTicketId]) {
      const post = await owner.post(`/api/tickets/${id}/actions`).send(VALID_ACTION);
      expect(post.status).toBe(403);
    }

    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const created = await staff.post(`/api/tickets/${ownTicketId}/actions`).send(VALID_ACTION);
    expect(created.status).toBe(201);

    const patch = await owner.patch(`/api/actions/${created.body.id}`).set("If-Match", "1").send({ result: "Nope." });
    expect(patch.status).toBe(403);
    // Staff row untouched by the forbidden attempt.
    const row = await prisma.actionTaken.findUnique({ where: { id: created.body.id } });
    expect(row?.version).toBe(1);
  });

  it("requester GET own → 200; foreign → 403 with no leak; unknown → 404 (AC-40)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    await staff.post(`/api/tickets/${foreignTicketId}/actions`).send(VALID_ACTION);

    const owner = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const own = await owner.get(`/api/tickets/${ownTicketId}/actions`);
    expect(own.status).toBe(200);
    expect(Array.isArray(own.body.actions)).toBe(true);

    const foreign = await owner.get(`/api/tickets/${foreignTicketId}/actions`);
    expect(foreign.status).toBe(403);
    expect(foreign.body.actions).toBeUndefined();

    const missing = await owner.get("/api/tickets/2147483647/actions");
    expect(missing.status).toBe(404);
    const badId = await owner.get("/api/tickets/abc/actions");
    expect(badId.status).toBe(400);
  });

  it("no session → 401 on every actions endpoint", async () => {
    const anon = request(app);
    expect((await anon.get(`/api/tickets/${ownTicketId}/actions`)).status).toBe(401);
    expect((await anon.post(`/api/tickets/${ownTicketId}/actions`).send(VALID_ACTION)).status).toBe(401);
    expect((await anon.patch("/api/actions/1").set("If-Match", "1").send({})).status).toBe(401);
  });

  it("staff POST on unknown ticket → 404 (AC-34 setup)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const res = await staff.post("/api/tickets/2147483647/actions").send(VALID_ACTION);
    expect(res.status).toBe(404);
    const badId = await staff.post("/api/tickets/abc/actions").send(VALID_ACTION);
    expect(badId.status).toBe(400);
  });
});
