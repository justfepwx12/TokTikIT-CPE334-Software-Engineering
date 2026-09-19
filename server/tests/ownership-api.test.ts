import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "./helpers.js";

const prisma = getPrisma();

const STAFF_A_EMAIL = "own-staff-a@toktikit.com";
const STAFF_B_EMAIL = "own-staff-b@toktikit.com";
const STAFF_OFF_EMAIL = "own-staff-off@toktikit.com";
const REQ_EMAIL = "own-req@toktikit.com";

let staffAId = 0;
let staffBId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(1000, 10000);
  return `TK-${date}-${String(nonce).padStart(4, "0")}`;
}

async function makeTicket(requesterId: number, ownerId: number | null = null): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `Ownership fixture ${randomInt(100000, 999999)}`,
      description: "A ticket used to verify claim/assign behavior.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status: "NEW",
      requesterId,
      ownerId,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

describe("Ownership & IT Priority API (AC-15–AC-17)", () => {
  let requesterId = 0;

  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const mkUser = (
      name: string,
      email: string,
      role: "REQUESTER" | "IT_STAFF",
      isActive = true
    ) =>
      prisma.user.create({
        data: { name, email, isActive, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
      });
    const [a, b, off, req] = await Promise.all([
      mkUser("Own Staff A", STAFF_A_EMAIL, "IT_STAFF"),
      mkUser("Own Staff B", STAFF_B_EMAIL, "IT_STAFF"),
      mkUser("Own Staff Off", STAFF_OFF_EMAIL, "IT_STAFF", false),
      mkUser("Own Req", REQ_EMAIL, "REQUESTER"),
    ]);
    staffAId = a.id;
    staffBId = b.id;
    requesterId = req.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({
      where: { email: { in: [STAFF_A_EMAIL, STAFF_B_EMAIL, STAFF_OFF_EMAIL, REQ_EMAIL] } },
    });
    await prisma.$disconnect();
  });

  it("claim: unassigned ticket → current user becomes owner (AC-15)", async () => {
    const agent = await loginAs(STAFF_A_EMAIL, TEST_PASSWORD);
    const id = await makeTicket(requesterId, null);
    const res = await agent.post(`/api/tickets/${id}/claim`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.ownerId).toBe(staffAId);
    expect(res.body.owner).toMatchObject({ id: staffAId });
  });

  it("claim: already-owned ticket → 400", async () => {
    const agent = await loginAs(STAFF_B_EMAIL, TEST_PASSWORD);
    const id = await makeTicket(requesterId, staffAId);
    const res = await agent.post(`/api/tickets/${id}/claim`);
    expect(res.status).toBe(400);
  });

  it("claim: requester → 403; no session → 401; missing ticket → 404", async () => {
    const reqAgent = await loginAs(REQ_EMAIL, TEST_PASSWORD);
    const id = await makeTicket(requesterId, null);

    const forbidden = await reqAgent.post(`/api/tickets/${id}/claim`);
    expect(forbidden.status).toBe(403);

    const anon = await request(app).post(`/api/tickets/${id}/claim`);
    expect(anon.status).toBe(401);

    const staff = await loginAs(STAFF_A_EMAIL, TEST_PASSWORD);
    const missing = await staff.post("/api/tickets/99999999/claim");
    expect(missing.status).toBe(404);
  });

  it("assign: to active IT staff → 200 with new owner (AC-16)", async () => {
    const agent = await loginAs(STAFF_A_EMAIL, TEST_PASSWORD);
    const id = await makeTicket(requesterId, null);
    const res = await agent.post(`/api/tickets/${id}/assign`).send({ ownerId: staffBId });
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(staffBId);
    expect(res.body.owner).toMatchObject({ id: staffBId });
  });

  it("assign: inactive / requester / unknown target → 400", async () => {
    const agent = await loginAs(STAFF_A_EMAIL, TEST_PASSWORD);
    const off = await prisma.user.findFirstOrThrow({ where: { email: STAFF_OFF_EMAIL } });

    for (const ownerId of [off.id, requesterId, 99999999]) {
      const id = await makeTicket(requesterId, null);
      const res = await agent.post(`/api/tickets/${id}/assign`).send({ ownerId });
      expect(res.status).toBe(400);
    }
  });

  it("it-priority: persists independently, requestedPriority immutable (AC-17)", async () => {
    const agent = await loginAs(STAFF_A_EMAIL, TEST_PASSWORD);
    const id = await makeTicket(requesterId, null);
    const res = await agent
      .patch(`/api/tickets/${id}/it-priority`)
      .send({ itPriority: "URGENT" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      requestedPriority: "MEDIUM",
      itPriority: "URGENT",
    });
  });

  it("it-priority: requester → 403; bad value → 400", async () => {
    const reqAgent = await loginAs(REQ_EMAIL, TEST_PASSWORD);
    const id = await makeTicket(requesterId, null);

    const forbidden = await reqAgent
      .patch(`/api/tickets/${id}/it-priority`)
      .send({ itPriority: "URGENT" });
    expect(forbidden.status).toBe(403);

    const staff = await loginAs(STAFF_A_EMAIL, TEST_PASSWORD);
    const bad = await staff
      .patch(`/api/tickets/${id}/it-priority`)
      .send({ itPriority: "CRITICAL" });
    expect(bad.status).toBe(400);
  });
});
