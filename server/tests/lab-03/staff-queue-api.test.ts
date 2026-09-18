import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";

const prisma = getPrisma();

const STAFF_EMAIL = "l3-queue-staff@toktikit.com";
const ADMIN_EMAIL = "l3-queue-admin@toktikit.com";
const REQ_A_EMAIL = "l3-queue-req-a@toktikit.com";
const REQ_B_EMAIL = "l3-queue-req-b@toktikit.com";

let staffId = 0;
let testCategoryId = 0;
let testSystemId = 0;
const ticketIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(100000, 999999);
  return `TK-${date}-${String(nonce).padStart(6, "0")}`;
}

describe("Lab 3 GET /api/staff/tickets (api-spec §2)", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const mkUser = (name: string, email: string, role: "REQUESTER" | "IT_STAFF" | "ADMIN") =>
      prisma.user.create({
        data: { name, email, isActive: true, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
      });
    const [staff, , reqA, reqB] = await Promise.all([
      mkUser("Queue Staff", STAFF_EMAIL, "IT_STAFF"),
      mkUser("Queue Admin", ADMIN_EMAIL, "ADMIN"),
      mkUser("Queue Req A", REQ_A_EMAIL, "REQUESTER"),
      mkUser("Queue Req B", REQ_B_EMAIL, "REQUESTER"),
    ]);
    staffId = staff.id;

    const rows = await prisma.$transaction(
      [
        {
          title: "L3Queue Alpha VPN Down",
          description: "Corporate VPN unreachable since morning",
          requestedPriority: "HIGH" as const,
          itPriority: "URGENT" as const,
          status: "OPEN" as const,
          requesterId: reqA.id,
          ownerId: staff.id,
        },
        {
          title: "L3Queue Beta Printer Jam",
          description: "Third floor printer keeps jamming",
          requestedPriority: "LOW" as const,
          itPriority: "LOW" as const,
          status: "NEW" as const,
          requesterId: reqA.id,
          ownerId: null,
        },
        {
          title: "L3Queue Gamma VPN Flaky",
          description: "VPN drops intermittently in the evening",
          requestedPriority: "MEDIUM" as const,
          itPriority: "HIGH" as const,
          status: "IN_PROGRESS" as const,
          requesterId: reqB.id,
          ownerId: null,
        },
      ].map((r) =>
        prisma.ticket.create({
          data: {
            ticketNo: makeTicketNo(),
            title: r.title,
            description: r.description,
            requestedPriority: r.requestedPriority,
            itPriority: r.itPriority,
            status: r.status,
            requesterId: r.requesterId,
            ownerId: r.ownerId,
            categoryId: testCategoryId,
            systemId: testSystemId,
          },
        })
      )
    );
    ticketIds.push(...rows.map((t) => t.id));
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({
      where: { email: { in: [STAFF_EMAIL, ADMIN_EMAIL, REQ_A_EMAIL, REQ_B_EMAIL] } },
    });
    await prisma.$disconnect();
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).get("/api/staff/tickets");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a Requester (staff-only queue)", async () => {
    const agent = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets IT_STAFF and ADMIN see all requesters' tickets with full shape", async () => {
    for (const email of [STAFF_EMAIL, ADMIN_EMAIL]) {
      const agent = await loginAs(email, TEST_PASSWORD);
      const res = await agent.get("/api/staff/tickets?limit=50");
      expect(res.status).toBe(200);
      const mine = res.body.tickets.filter((t: { title: string }) =>
        String(t.title).startsWith("L3Queue ")
      );
      expect(mine).toHaveLength(3);
      const first = mine[0];
      expect(first).toHaveProperty("ticketNo");
      expect(first.category).toMatchObject({ id: testCategoryId });
      expect(first.system).toMatchObject({ id: testSystemId });
      expect(first.requester).toHaveProperty("name");
      expect(first).toHaveProperty("owner");
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 50 });
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    }
  });

  it("searches case-insensitively across title and description", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const upper = await agent.get("/api/staff/tickets?search=VPN&limit=50");
    expect(upper.status).toBe(200);
    const titles = upper.body.tickets.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(["L3Queue Alpha VPN Down", "L3Queue Gamma VPN Flaky"]));

    const lower = await agent.get("/api/staff/tickets?search=vpn&limit=50");
    expect(lower.body.pagination.total).toBe(upper.body.pagination.total);
  });

  it("filters by status and by IT priority", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const byStatus = await agent.get("/api/staff/tickets?status=OPEN&limit=50");
    expect(byStatus.status).toBe(200);
    expect(
      byStatus.body.tickets.every((t: { status: string }) => t.status === "OPEN")
    ).toBe(true);
      expect(
      byStatus.body.tickets.some((t: { title: string }) => t.title === "L3Queue Alpha VPN Down")
    ).toBe(true);

    const byPriority = await agent.get("/api/staff/tickets?priority=URGENT&limit=50");
    expect(byPriority.status).toBe(200);
    expect(
      byPriority.body.tickets.every((t: { itPriority: string }) => t.itPriority === "URGENT")
    ).toBe(true);
  });

  it("filters by ownerId, with 0 meaning unassigned", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const owned = await agent.get(`/api/staff/tickets?ownerId=${staffId}&limit=50`);
    expect(owned.status).toBe(200);
    expect(
      owned.body.tickets.every((t: { owner: { id: number } | null }) => t.owner?.id === staffId)
    ).toBe(true);

    const unassigned = await agent.get("/api/staff/tickets?ownerId=0&limit=50");
    expect(unassigned.status).toBe(200);
    expect(
      unassigned.body.tickets.every((t: { owner: unknown }) => t.owner === null)
    ).toBe(true);
    expect(unassigned.body.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it("paginates with totalPages", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const res = await agent.get("/api/staff/tickets?limit=2&page=1");
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });

  it("rejects unknown sort, non-numeric page, and out-of-range limit with 400", async () => {
    const agent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const badSort = await agent.get("/api/staff/tickets?sort=nope");
    expect(badSort.status).toBe(400);
    const badPage = await agent.get("/api/staff/tickets?page=abc");
    expect(badPage.status).toBe(400);
    const badLimit = await agent.get("/api/staff/tickets?limit=999");
    expect(badLimit.status).toBe(400);
  });

  it("staff detail: full shape for IT_STAFF, 403 for Requester, 404/400 on bad id", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const ticketId = ticketIds[0];

    const ok = await staff.get(`/api/staff/tickets/${ticketId}`);
    expect(ok.status).toBe(200);
    expect(ok.body.id).toBe(ticketId);
    expect(ok.body).toHaveProperty("description");
    expect(ok.body).toHaveProperty("requestedPriority");
    expect(ok.body.requester).toHaveProperty("name");
    expect(Array.isArray(ok.body.attachments)).toBe(true);

    const reqAgent = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    const forbidden = await reqAgent.get(`/api/staff/tickets/${ticketId}`);
    expect(forbidden.status).toBe(403);

    const missing = await staff.get("/api/staff/tickets/99999999");
    expect(missing.status).toBe(404);

    const badId = await staff.get("/api/staff/tickets/abc");
    expect(badId.status).toBe(400);
  });
});
