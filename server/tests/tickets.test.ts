import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { TEST_PASSWORD_HASH, loginAs } from "./helpers.js";

const prisma = getPrisma();

const TEST_REQUESTER_EMAIL = "ticket-create-test@toktikit.com";

describe("Create Ticket API Tests (tickets.test.ts)", () => {
  let activeRequesterId: number;
  let testCategoryId: number;
  let testSystemId: number;
  let agent: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    const [category, system] = await Promise.all([
      prisma.category.findFirst({ orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } }),
    ]);
    if (!category || !system) {
      throw new Error("Seed data incomplete. Please run seed script first.");
    }
    testCategoryId = category.id;
    testSystemId = system.id;

    const requester = await prisma.user.upsert({
      where: { email: TEST_REQUESTER_EMAIL },
      update: { mustChangePassword: false, isActive: true },
      create: {
        name: "Ticket Create Test",
        email: TEST_REQUESTER_EMAIL,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
        passwordHash: TEST_PASSWORD_HASH,
      },
    });
    activeRequesterId = requester.id;
    agent = await loginAs(TEST_REQUESTER_EMAIL);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_REQUESTER_EMAIL } });
    await prisma.$disconnect();
  });

  describe("POST /api/tickets", () => {
    it("should create a ticket and return 201 with generated ticketNo", async () => {
      const payload = {
        categoryId: testCategoryId,
        systemId: testSystemId,
        priority: "MEDIUM",
        title: "VPN Connection Fails on macOS",
        description: "Unable to establish VPN connection after latest OS update.",
      };

      const response = await agent
        .post("/api/tickets")
        .set("x-requester-id", String(activeRequesterId))
        .send(payload)
        .expect("Content-Type", /json/)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("ticketNo");
      expect(response.body.title).toBe(payload.title);
      expect(response.body.status).toBe("NEW");
      expect(response.body.requestedPriority).toBe("MEDIUM");
      expect(response.body.itPriority).toBe("MEDIUM");
      expect(response.body.requesterId).toBe(activeRequesterId);
    });

    it("should return 401 when session is missing", async () => {
      const payload = {
        categoryId: testCategoryId,
        systemId: testSystemId,
        priority: "HIGH",
        title: "Missing Session Test",
        description: "Testing request without a valid session.",
      };

      await request(app).post("/api/tickets").send(payload).expect(401);
    });

    it("should return 400 Bad Request when required fields are invalid/missing", async () => {
      const invalidPayload = {
        categoryId: testCategoryId,
        systemId: testSystemId,
        priority: "HIGH",
        title: "Short",
        description: "Short",
      };

      await agent
        .post("/api/tickets")
        .set("x-requester-id", String(activeRequesterId))
        .send(invalidPayload)
        .expect(400);
    });

    it("should return 400 Bad Request when categoryId does not reference an existing Category", async () => {
      const payload = {
        categoryId: 999999,
        systemId: testSystemId,
        priority: "MEDIUM",
        title: "Nonexistent Category Test",
        description: "Testing request with a categoryId that does not exist.",
      };

      await agent
        .post("/api/tickets")
        .set("x-requester-id", String(activeRequesterId))
        .send(payload)
        .expect(400);
    });

    it("should return 400 Bad Request when systemId does not reference an existing Related System", async () => {
      const payload = {
        categoryId: testCategoryId,
        systemId: 999999,
        priority: "MEDIUM",
        title: "Nonexistent System Test",
        description: "Testing request with a systemId that does not exist.",
      };

      await agent
        .post("/api/tickets")
        .set("x-requester-id", String(activeRequesterId))
        .send(payload)
        .expect(400);
    });

    it("should return 403 Forbidden when the Requester is inactive", async () => {
      const inactiveRequester = await prisma.user.findFirst({
        where: { role: "REQUESTER", isActive: false },
      });
      if (!inactiveRequester) {
        throw new Error("Seed data missing an inactive requester.");
      }

      const payload = {
        categoryId: testCategoryId,
        systemId: testSystemId,
        priority: "MEDIUM",
        title: "Inactive Requester Test",
        description: "Testing request from an inactive requester.",
      };

      await agent
        .post("/api/tickets")
        .set("x-requester-id", String(inactiveRequester.id))
        .send(payload)
        .expect(403);
    });
  });
});
