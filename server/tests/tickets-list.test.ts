import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";

const prisma = getPrisma();

const REQ_A_EMAIL = "list-test-a@toktikit.com";
const REQ_B_EMAIL = "list-test-b@toktikit.com";

let requesterA: { id: number };
let requesterB: { id: number };
let testCategoryId: number;
let testSystemId: number;
let ticketIds: number[] = [];

let ticketNoSeq = 1;
function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TK-${date}-${String(ticketNoSeq++).padStart(4, "0")}`;
}

describe("GET /api/tickets", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    requesterA = await prisma.requester.create({
      data: { name: "List Test A", email: REQ_A_EMAIL, isActive: true },
    });
    requesterB = await prisma.requester.create({
      data: { name: "List Test B", email: REQ_B_EMAIL, isActive: true },
    });

    const rows = await prisma.$transaction(
      [
        { title: "Alpha Login Failure", description: "Cannot sign in to the portal", priority: "HIGH", status: "PENDING" },
        { title: "Beta Printer Jam", description: "Printer jams on the third floor", priority: "LOW", status: "IN_PROGRESS" },
        { title: "Gamma VPN Dropping", description: "VPN drops every five minutes", priority: "URGENT", status: "RESOLVED" },
      ].map((r) =>
        prisma.ticket.create({
          data: {
            ticketNo: makeTicketNo(),
            title: r.title,
            description: r.description,
            priority: r.priority,
            status: r.status,
            requesterId: requesterA.id,
            categoryId: testCategoryId,
            systemId: testSystemId,
          },
        })
      )
    );
    ticketIds = rows.map((t) => t.id);

    await prisma.ticket.create({
      data: {
        ticketNo: makeTicketNo(),
        title: "B Ticket Never Shown",
        description: "This ticket belongs to requester B only",
        priority: "MEDIUM",
        status: "PENDING",
        requesterId: requesterB.id,
        categoryId: testCategoryId,
        systemId: testSystemId,
      },
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { requesterId: requesterB.id } });
    await prisma.requester.deleteMany({ where: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } } });
  });

  it("returns HTTP 401 when the x-requester-id header is missing", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(401);
  });

  it("returns HTTP 401 for numeric-yet-invalid headers (permissive parseInt bypass)", async () => {
    for (const bad of ["12abc", "1.5", "abc", "", "0", "-5"]) {
      const res = await request(app)
        .get("/api/tickets")
        .set("x-requester-id", bad as string);
      expect(res.status).toBe(401);
    }
  });

  it("returns HTTP 403 for an inactive or unknown requester", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", "999999");
    expect(res.status).toBe(403);
  });

  it("owns the list: requester A sees only their tickets", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", String(requesterA.id));

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(3);
    const titles = res.body.tickets.map((t: { title: string }) => t.title);
    expect(titles).toContain("Alpha Login Failure");
    expect(titles).not.toContain("B Ticket Never Shown");
    expect(res.body.pagination.total).toBe(3);
  });

  it("returns a stable response shape including category and system", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", String(requesterA.id));

    const ticket = res.body.tickets[0];
    expect(Object.keys(ticket).sort()).toEqual(
      ["category", "createdAt", "description", "id", "priority", "status", "system", "ticketNo", "title"].sort()
    );
    expect(typeof ticket.category.id).toBe("number");
    expect(typeof ticket.category.name).toBe("string");
    expect(typeof ticket.system.id).toBe("number");
    expect(typeof ticket.system.name).toBe("string");
  });

  it("paginates: limit + page + totalPages", async () => {
    const res = await request(app)
      .get("/api/tickets?limit=2&page=2")
      .set("x-requester-id", String(requesterA.id));

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.pagination).toEqual({
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
  });

  it("searches case-insensitively on title and description", async () => {
    const res = await request(app)
      .get("/api/tickets?search=VPN")
      .set("x-requester-id", String(requesterA.id));

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.tickets[0].title).toBe("Gamma VPN Dropping");

    const resLower = await request(app)
      .get("/api/tickets?search=vpn")
      .set("x-requester-id", String(requesterA.id));
    expect(resLower.body.pagination.total).toBe(1);
  });

  it("filters by status and priority", async () => {
    const statusRes = await request(app)
      .get("/api/tickets?status=RESOLVED")
      .set("x-requester-id", String(requesterA.id));
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.pagination.total).toBe(1);
    expect(statusRes.body.tickets[0].title).toBe("Gamma VPN Dropping");

    const priorityRes = await request(app)
      .get("/api/tickets?priority=HIGH")
      .set("x-requester-id", String(requesterA.id));
    expect(priorityRes.body.pagination.total).toBe(1);
    expect(priorityRes.body.tickets[0].title).toBe("Alpha Login Failure");
  });

  it("sorts by priority descending (heaviest first) and ascending", async () => {
    const resDesc = await request(app)
      .get("/api/tickets?sort=priority&order=desc")
      .set("x-requester-id", String(requesterA.id));

    expect(resDesc.status).toBe(200);
    const descPriorities = resDesc.body.tickets.map((t: { priority: string }) => t.priority);
    // Postgres enum definition order: LOW < MEDIUM < HIGH < URGENT (heaviness).
    expect(descPriorities).toEqual(["URGENT", "HIGH", "LOW"]);

    const resAsc = await request(app)
      .get("/api/tickets?sort=priority&order=asc")
      .set("x-requester-id", String(requesterA.id));
    const ascPriorities = resAsc.body.tickets.map((t: { priority: string }) => t.priority);
    expect(ascPriorities).toEqual(["LOW", "HIGH", "URGENT"]);
  });

  it("rejects invalid sort, page, and limit with HTTP 400", async () => {
    const badSort = await request(app)
      .get("/api/tickets?sort=unknown")
      .set("x-requester-id", String(requesterA.id));
    expect(badSort.status).toBe(400);

    const badPage = await request(app)
      .get("/api/tickets?page=abc")
      .set("x-requester-id", String(requesterA.id));
    expect(badPage.status).toBe(400);

    const badLimit = await request(app)
      .get("/api/tickets?limit=999")
      .set("x-requester-id", String(requesterA.id));
    expect(badLimit.status).toBe(400);
  });
});