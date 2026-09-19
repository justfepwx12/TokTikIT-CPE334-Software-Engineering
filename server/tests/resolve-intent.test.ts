import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import type { TicketStatus } from "@prisma/client";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "./helpers.js";

const prisma = getPrisma();

const OWNER_EMAIL = "resolve-owner@toktikit.com";
const OTHER_EMAIL = "resolve-other@toktikit.com";
const STAFF_EMAIL = "resolve-staff@toktikit.com";

let ownerId = 0;
let otherId = 0;
let staffId = 0;
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
      title: `Resolve intent ${status} ${randomInt(100000, 999999)}`,
      description: "A ticket used to verify the resolve-intent transition.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status,
      requesterId: ownerId,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

describe("POST /api/tickets/:id/resolve-intent (BR-05/BR-16)", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const owner = await prisma.user.create({
      data: {
        name: "Resolve Owner",
        email: OWNER_EMAIL,
        isActive: true,
        role: "REQUESTER",
        passwordHash: TEST_PASSWORD_HASH,
        mustChangePassword: false,
      },
    });
    const other = await prisma.user.create({
      data: {
        name: "Resolve Other",
        email: OTHER_EMAIL,
        isActive: true,
        role: "REQUESTER",
        passwordHash: TEST_PASSWORD_HASH,
        mustChangePassword: false,
      },
    });
    const staff = await prisma.user.create({
      data: {
        name: "Resolve Staff",
        email: STAFF_EMAIL,
        isActive: true,
        role: "IT_STAFF",
        passwordHash: TEST_PASSWORD_HASH,
        mustChangePassword: false,
      },
    });
    ownerId = owner.id;
    otherId = other.id;
    staffId = staff.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId, staffId] } } });
    await prisma.$disconnect();
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).post("/api/tickets/1/resolve-intent");
    expect(res.status).toBe(401);
  });

  it("moves NEW → RESOLVED with { id, status }", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("NEW");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: "RESOLVED" });
  });

  it("moves IN_PROGRESS → RESOLVED", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("IN_PROGRESS");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RESOLVED");
  });

  it("moves RESOLVED → REOPENED on a second signal", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("RESOLVED");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REOPENED");
  });

  it("moves CLOSED → REOPENED", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("CLOSED");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REOPENED");
  });

  it("returns 400 for CANCELLED and leaves the ticket unchanged", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("CANCELLED");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("CANCELLED");
  });

  it("returns 403 for another requester's ticket", async () => {
    const agent = await loginAs(OTHER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("OPEN");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a non-requester role (IT_STAFF)", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const id = await makeTicket("OPEN");
    const res = await agent.post(`/api/tickets/${id}/resolve-intent`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent ticket", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const res = await agent.post("/api/tickets/99999999/resolve-intent");
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric ticket id", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const res = await agent.post("/api/tickets/abc/resolve-intent");
    expect(res.status).toBe(400);
  });
});
