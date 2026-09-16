import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomInt } from "node:crypto";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { TEST_PASSWORD_HASH, loginAs } from "./helpers.js";

const prisma = getPrisma();

const REQ_A_EMAIL = "detail-test-a@toktikit.com";
const REQ_B_EMAIL = "detail-test-b@toktikit.com";

let requesterA: { id: number };
let requesterB: { id: number };
let testCategoryId: number;
let testSystemId: number;
let ownedTicketId: number;
let otherTicketId: number;

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(1000, 10000);
  return `TK-${date}-${String(nonce).padStart(4, "0")}`;
}

async function createTicket(requesterId: number, title: string): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title,
      description: "Detail endpoint regression fixture",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status: "NEW",
      requesterId,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  return row.id;
}

describe("GET /api/tickets/:id", () => {
  beforeAll(async () => {
    await prisma.ticket.deleteMany({
      where: { requester: { is: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } },
    });

    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    requesterA = await prisma.user.create({
      data: {
        name: "Detail Test A",
        email: REQ_A_EMAIL,
        isActive: true,
        role: "REQUESTER",
        passwordHash: TEST_PASSWORD_HASH,
        mustChangePassword: false,
      },
    });
    requesterB = await prisma.user.create({
      data: {
        name: "Detail Test B",
        email: REQ_B_EMAIL,
        isActive: true,
        role: "REQUESTER",
        passwordHash: TEST_PASSWORD_HASH,
        mustChangePassword: false,
      },
    });

    ownedTicketId = await createTicket(requesterA.id, "Owned Detail Ticket");
    otherTicketId = await createTicket(requesterB.id, "Other Users Ticket");
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({
      where: { id: { in: [ownedTicketId, otherTicketId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } },
    });
  });

  it("returns HTTP 200 with full owned ticket shape incl. category/system/requester/attachments", async () => {
    const agent = await loginAs(REQ_A_EMAIL);
    const res = await agent
      .get(`/api/tickets/${ownedTicketId}`)
      .set("x-requester-id", String(requesterA.id));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ownedTicketId);
    expect(res.body.ticketNo).toMatch(/^TK-\d{8}-\d{4}$/);
    expect(res.body.title).toBe("Owned Detail Ticket");
    expect(res.body.requestedPriority).toBe("MEDIUM");
    expect(res.body.itPriority).toBe("MEDIUM");
    expect(res.body.status).toBe("NEW");
    expect(res.body.category).toMatchObject({ id: testCategoryId });
    expect(res.body.system).toMatchObject({ id: testSystemId });
    expect(res.body.requester).toMatchObject({ id: requesterA.id });
    expect(Array.isArray(res.body.attachments)).toBe(true);
  });

  it("returns HTTP 401 when session is missing", async () => {
    const res = await request(app).get(`/api/tickets/${ownedTicketId}`);
    expect(res.status).toBe(401);
  });

  it("returns HTTP 404 when the ticket does not exist", async () => {
    const agent = await loginAs(REQ_A_EMAIL);
    const res = await agent
      .get("/api/tickets/99999999")
      .set("x-requester-id", String(requesterA.id));
    expect(res.status).toBe(404);
  });

  it("returns HTTP 403 when accessing another requester's ticket", async () => {
    const agent = await loginAs(REQ_A_EMAIL);
    const res = await agent
      .get(`/api/tickets/${otherTicketId}`)
      .set("x-requester-id", String(requesterA.id));
    expect(res.status).toBe(403);
  });

  it("returns HTTP 400 for a non-numeric ticket id", async () => {
    const agent = await loginAs(REQ_A_EMAIL);
    const res = await agent
      .get("/api/tickets/abc")
      .set("x-requester-id", String(requesterA.id));
    expect(res.status).toBe(400);
  });
});
