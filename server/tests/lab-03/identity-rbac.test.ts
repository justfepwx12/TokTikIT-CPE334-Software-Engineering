import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";

const prisma = getPrisma();

const OWNER_EMAIL = "l3-rbac-owner@toktikit.com";
const OTHER_EMAIL = "l3-rbac-other@toktikit.com";
const STAFF_EMAIL = "l3-rbac-staff@toktikit.com";
const INACTIVE_EMAIL = "l3-rbac-inactive@toktikit.com";
const FIXTURE_EMAILS = [OWNER_EMAIL, OTHER_EMAIL, STAFF_EMAIL, INACTIVE_EMAIL];

let ownerId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(100000, 999999);
  return `TK-${date}-${String(nonce).padStart(6, "0")}`;
}

async function makeTicket(): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `RBAC fixture ${randomInt(100000, 999999)}`,
      description: "A ticket used to verify identity and RBAC enforcement.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status: "NEW",
      requesterId: ownerId,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  ticketIds.push(row.id);
  return row.id;
}

describe("Lab 3 Identity ownership & cross-role RBAC (AC-09/10/12/13, BR-01)", () => {
  beforeAll(async () => {
    // Defensive pre-cleanup: a previously interrupted run may have left
    // fixture rows behind (unique emails would P2002 the setup below).
    const staleUsers = await prisma.user.findMany({
      where: { email: { in: FIXTURE_EMAILS } },
      select: { id: true },
    });
    if (staleUsers.length > 0) {
      const staleIds = staleUsers.map((u) => u.id);
      const staleTickets = await prisma.ticket.findMany({
        where: { requesterId: { in: staleIds } },
        select: { id: true },
      });
      const staleTids = staleTickets.map((t) => t.id);
      if (staleTids.length > 0) {
        await prisma.comment.deleteMany({ where: { ticketId: { in: staleTids } } });
        await prisma.internalNote.deleteMany({ where: { ticketId: { in: staleTids } } });
        await prisma.attachment.deleteMany({ where: { ticketId: { in: staleTids } } });
        await prisma.ticket.deleteMany({ where: { id: { in: staleTids } } });
      }
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const mkUser = (name: string, email: string, role: "REQUESTER" | "IT_STAFF", isActive = true) =>
      prisma.user.create({
        data: { name, email, isActive, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
      });
    const [owner, other, staff, inactive] = await Promise.all([
      mkUser("Rbac Owner", OWNER_EMAIL, "REQUESTER"),
      mkUser("Rbac Other", OTHER_EMAIL, "REQUESTER"),
      mkUser("Rbac Staff", STAFF_EMAIL, "IT_STAFF"),
      mkUser("Rbac Inactive", INACTIVE_EMAIL, "REQUESTER", false),
    ]);
    ownerId = owner.id;
    void other;
    void staff;
    void inactive;
  });

  afterAll(async () => {
    // Comments/notes/attachments restrict ticket deletion — clear children first.
    if (ticketIds.length > 0) {
      await prisma.comment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });
    await prisma.$disconnect();
  });

  it("ignores client-supplied requesterId on create; identity comes from session (AC-09)", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const res = await agent.post("/api/tickets").send({
      title: "Spoofed identity ticket",
      description: "Tries to file as someone else.",
      categoryId: testCategoryId,
      systemId: testSystemId,
      priority: "LOW",
      requesterId: 999999,
    });
    expect(res.status).toBe(201);
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    ticketIds.push(row.id);
    expect(row.requesterId).toBe(ownerId);
    expect(row.requesterId).not.toBe(999999);
  });

  it("rejects requesters on every staff-only endpoint with 403 (AC-10)", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    expect((await agent.get("/api/staff/tickets")).status).toBe(403);
    expect((await agent.post(`/api/tickets/${id}/claim`)).status).toBe(403);
    expect((await agent.post(`/api/tickets/${id}/assign`).send({ ownerId: 1 })).status).toBe(403);
    expect((await agent.patch(`/api/tickets/${id}/it-priority`).send({ itPriority: "URGENT" })).status).toBe(403);
    expect((await agent.patch(`/api/tickets/${id}/status`).send({ status: "OPEN" })).status).toBe(403);
    expect((await agent.get(`/api/tickets/${id}/notes`)).status).toBe(403);
  });

  it("hides foreign tickets from other requesters (AC-12)", async () => {
    const other = await loginAs(OTHER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    expect((await other.get(`/api/tickets/${id}`)).status).toBe(403);
    expect((await other.get(`/api/tickets/${id}/comments`)).status).toBe(403);
  });

  it("rejects deactivated users even with a valid password (AC-13)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: INACTIVE_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("never exposes passwordHash in any user-bearing response (BR-01)", async () => {
    const owner = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const login = await request(app).post("/api/auth/login").send({
      email: OWNER_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await owner.get("/api/auth/me");
    expect(me.body.user.passwordHash).toBeUndefined();

    const id = await makeTicket();
    await owner.post(`/api/tickets/${id}/comments`).send({ body: "Hello." });
    const comments = await owner.get(`/api/tickets/${id}/comments`);
    expect(comments.status).toBe(200);
    for (const c of comments.body.comments) {
      expect(c.author.passwordHash).toBeUndefined();
    }
  });
});
