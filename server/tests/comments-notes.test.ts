import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "./helpers.js";

const prisma = getPrisma();

const OWNER_EMAIL = "comm-owner@toktikit.com";
const OTHER_EMAIL = "comm-other@toktikit.com";
const STAFF_EMAIL = "comm-staff@toktikit.com";
const ADMIN_EMAIL = "comm-admin@toktikit.com";

let ownerId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(1000, 10000);
  return `TK-${date}-${String(nonce).padStart(4, "0")}`;
}

async function makeTicket(): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title: `Comms fixture ${randomInt(100000, 999999)}`,
      description: "A ticket used to verify comments/notes behavior.",
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

describe("Public Comments & Internal Notes API (AC-22–AC-25)", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const mkUser = (name: string, email: string, role: "REQUESTER" | "IT_STAFF" | "ADMIN") =>
      prisma.user.create({
        data: { name, email, isActive: true, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
      });
    const [owner] = await Promise.all([
      mkUser("Comms Owner", OWNER_EMAIL, "REQUESTER"),
      mkUser("Comms Other", OTHER_EMAIL, "REQUESTER"),
      mkUser("Comms Staff", STAFF_EMAIL, "IT_STAFF"),
      mkUser("Comms Admin", ADMIN_EMAIL, "ADMIN"),
    ]);
    ownerId = owner.id;
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({
      where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL, STAFF_EMAIL, ADMIN_EMAIL] } },
    });
    await prisma.$disconnect();
  });

  it("owner posts and lists public comments (AC-22)", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    const post = await agent.post(`/api/tickets/${id}/comments`).send({ body: "The issue started this morning." });
    expect(post.status).toBe(201);
    expect(post.body.body).toBe("The issue started this morning.");
    expect(post.body.author.name).toBe("Comms Owner");

    const list = await agent.get(`/api/tickets/${id}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].body).toBe("The issue started this morning.");
  });

  it("staff and admin can post/list comments on any ticket", async () => {
    const id = await makeTicket();
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const post = await staff.post(`/api/tickets/${id}/comments`).send({ body: "We are investigating." });
    expect(post.status).toBe(201);

    const admin = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const list = await admin.get(`/api/tickets/${id}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.comments.length).toBeGreaterThanOrEqual(1);
  });

  it("another requester gets 403 with no comment content (AC-12/BR-06)", async () => {
    const id = await makeTicket();
    const other = await loginAs(OTHER_EMAIL, TEST_PASSWORD);
    const list = await other.get(`/api/tickets/${id}/comments`);
    expect(list.status).toBe(403);
    expect(list.body.comments).toBeUndefined();

    const post = await other.post(`/api/tickets/${id}/comments`).send({ body: "Snooping." });
    expect(post.status).toBe(403);
  });

  it("rejects empty, whitespace-only and over-limit comment bodies (AC-24)", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    for (const bad of ["", "   ", "\n\t "]) {
      const res = await agent.post(`/api/tickets/${id}/comments`).send({ body: bad });
      expect(res.status).toBe(400);
    }
    const long = await agent.post(`/api/tickets/${id}/comments`).send({ body: "x".repeat(2001) });
    expect(long.status).toBe(400);
    const missing = await agent.post(`/api/tickets/${id}/comments`).send({});
    expect(missing.status).toBe(400);
  });

  it("stores the trimmed body and never leaks author secrets", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    const post = await agent.post(`/api/tickets/${id}/comments`).send({ body: "  padded hello  " });
    expect(post.status).toBe(201);
    expect(post.body.body).toBe("padded hello");
    expect(post.body.author.passwordHash).toBeUndefined();
    expect(post.body.author.email).toBeUndefined();
    expect(post.body.author).toMatchObject({ name: "Comms Owner", role: "REQUESTER" });
  });

  it("lists comments newest-first", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    await agent.post(`/api/tickets/${id}/comments`).send({ body: "first" });
    await agent.post(`/api/tickets/${id}/comments`).send({ body: "second" });
    const list = await agent.get(`/api/tickets/${id}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.comments.map((c: { body: string }) => c.body)).toEqual(["second", "first"]);
  });

  it("staff posts and lists internal notes; admin can read them", async () => {
    const id = await makeTicket();
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const post = await staff.post(`/api/tickets/${id}/notes`).send({ body: "Check the VPN logs first." });
    expect(post.status).toBe(201);
    expect(post.body.author.role).toBe("IT_STAFF");

    const admin = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const list = await admin.get(`/api/tickets/${id}/notes`);
    expect(list.status).toBe(200);
    expect(list.body.notes).toHaveLength(1);
  });

  it("requester gets 403 with no note content on their own ticket (AC-23)", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    const list = await agent.get(`/api/tickets/${id}/notes`);
    expect(list.status).toBe(403);
    expect(list.body.notes).toBeUndefined();

    const post = await agent.post(`/api/tickets/${id}/notes`).send({ body: "Trying to peek." });
    expect(post.status).toBe(403);
    expect(post.body.notes).toBeUndefined();
  });

  it("rejects empty, whitespace-only and over-limit note bodies", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    const empty = await staff.post(`/api/tickets/${id}/notes`).send({ body: "" });
    expect(empty.status).toBe(400);
    const blank = await staff.post(`/api/tickets/${id}/notes`).send({ body: "   " });
    expect(blank.status).toBe(400);
    const long = await staff.post(`/api/tickets/${id}/notes`).send({ body: "y".repeat(2001) });
    expect(long.status).toBe(400);
  });

  it("has no edit/delete endpoints for comments or notes (AC-25)", async () => {
    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const id = await makeTicket();
    const put = await agent.put(`/api/tickets/${id}/comments`).send({ body: "edit" });
    expect([404, 405]).toContain(put.status);
    const del = await agent.delete(`/api/tickets/${id}/notes`);
    expect([404, 405]).toContain(del.status);
  });

  it("returns 401 without a session, 404 for missing tickets, 400 for bad ids", async () => {
    const anon = await request(app).get("/api/tickets/1/comments");
    expect(anon.status).toBe(401);

    const agent = await loginAs(OWNER_EMAIL, TEST_PASSWORD);
    const missing = await agent.get("/api/tickets/99999999/comments");
    expect(missing.status).toBe(404);

    // Notes routes are role-guarded before the id parser: a Requester gets
    // 403 even for a malformed id; staff reaches the parser and gets 400.
    const badIdOwner = await agent.get("/api/tickets/abc/notes");
    expect(badIdOwner.status).toBe(403);
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const badIdStaff = await staff.get("/api/tickets/abc/notes");
    expect(badIdStaff.status).toBe(400);
  });
});
