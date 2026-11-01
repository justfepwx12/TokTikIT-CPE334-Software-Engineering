import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomInt } from "node:crypto";
import request from "supertest";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";

const prisma = getPrisma();

const OWNER_EMAIL = "l4-act-owner@toktikit.com";
const STAFF_EMAIL = "l4-act-staff@toktikit.com";
const ADMIN_EMAIL = "l4-act-admin@toktikit.com";

let ownerId = 0;
let staffId = 0;
let testCategoryId = 0;
let testSystemId = 0;
let ticketId = 0;

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TK-${date}-${String(randomInt(100000, 999999)).padStart(6, "0")}`;
}

const VALID_ACTION = {
  actionAt: "2026-09-10T02:00:00.000Z",
  description: "Restarted the service.",
  result: "Stable for one hour.",
  followUpRequired: false,
};

describe("Lab 4 Actions Taken API (AC-34–AC-36, AC-41)", () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    const mkUser = (name: string, email: string, role: "REQUESTER" | "IT_STAFF" | "ADMIN") =>
      prisma.user.create({
        data: { name, email, isActive: true, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
      });
    const [owner, staff] = await Promise.all([
      mkUser("Act Owner", OWNER_EMAIL, "REQUESTER"),
      mkUser("Act Staff", STAFF_EMAIL, "IT_STAFF"),
      mkUser("Act Admin", ADMIN_EMAIL, "ADMIN"),
    ]);
    ownerId = owner.id;
    staffId = staff.id;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNo: makeTicketNo(),
        title: "Actions fixture",
        description: "Ticket used to verify the Actions Taken API.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        status: "OPEN",
        requesterId: ownerId,
        categoryId: testCategoryId,
        systemId: testSystemId,
      },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL, ADMIN_EMAIL] } } });
    await prisma.$disconnect();
  });

  it("staff create returns 201 with performedBy=me and version=1, body performer ignored (AC-34)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const res = await staff.post(`/api/tickets/${ticketId}/actions`).send({
      ...VALID_ACTION,
      performedById: 999999,
      performedBy: { id: 999999 },
      version: 99,
      id: 999999,
    });
    expect(res.status).toBe(201);
    expect(res.body.performedBy.id).toBe(staffId);
    expect(res.body.performedBy.role).toBe("IT_STAFF");
    expect(res.body.version).toBe(1);
    expect(res.body.ticketId).toBe(ticketId);
    expect(res.body.followUpNote).toBeNull();
  });

  it("admin create returns 201 with performedBy=admin (AC-34)", async () => {
    const admin = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const res = await admin.post(`/api/tickets/${ticketId}/actions`).send(VALID_ACTION);
    expect(res.status).toBe(201);
    expect(res.body.performedBy.role).toBe("ADMIN");
    expect(res.body.version).toBe(1);
  });

  it("omitted followUpRequired defaults to false (BR-22)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const { followUpRequired: _omit, ...rest } = VALID_ACTION;
    const res = await staff.post(`/api/tickets/${ticketId}/actions`).send(rest);
    expect(res.status).toBe(201);
    expect(res.body.followUpRequired).toBe(false);
  });

  it("missing note / future actionAt / blank fields → 400 and nothing stored (AC-35)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const before = await prisma.actionTaken.count({ where: { ticketId } });
    const bad = [
      { ...VALID_ACTION, followUpRequired: true },
      { ...VALID_ACTION, followUpRequired: true, followUpNote: "   " },
      { ...VALID_ACTION, actionAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
      { ...VALID_ACTION, actionAt: "not-a-date" },
      { ...VALID_ACTION, description: "   " },
      { ...VALID_ACTION, result: "" },
      { ...VALID_ACTION, description: "x".repeat(2001) },
      { ...VALID_ACTION, attachmentNotes: "x".repeat(2001) },
      "not-an-object",
    ];
    for (const body of bad) {
      const res = await staff.post(`/api/tickets/${ticketId}/actions`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    // followUpRequired=true WITH a note is the valid counterpart.
    const ok = await staff
      .post(`/api/tickets/${ticketId}/actions`)
      .send({ ...VALID_ACTION, followUpRequired: true, followUpNote: "Recheck tomorrow." });
    expect(ok.status).toBe(201);
    expect(ok.body.followUpNote).toBe("Recheck tomorrow.");
    const after = await prisma.actionTaken.count({ where: { ticketId } });
    expect(after - before).toBe(1);
  });

  it("PATCH with current If-Match → 200 with version+1; immutables ignored (AC-36)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).send(VALID_ACTION);
    expect(created.status).toBe(201);

    const patched = await staff
      .patch(`/api/actions/${created.body.id}`)
      .set("If-Match", "1")
      .send({
        result: "Stable for two hours.",
        followUpRequired: true,
        followUpNote: "Keep watching.",
        actionAt: "2020-01-01T00:00:00.000Z",
        ticketId: 999999,
        performedById: 999999,
        version: 99,
      });
    expect(patched.status).toBe(200);
    expect(patched.body.version).toBe(2);
    expect(patched.body.result).toBe("Stable for two hours.");
    expect(patched.body.followUpRequired).toBe(true);
    // Immutable fields ignored: actionAt/ticket untouched, body version inert.
    expect(patched.body.actionAt).toBe(VALID_ACTION.actionAt);
    expect(patched.body.ticketId).toBe(ticketId);
    expect(patched.body.performedBy.id).toBe(staffId);

    // true → false clears the follow-up note (AD-18).
    const cleared = await staff
      .patch(`/api/actions/${created.body.id}`)
      .set("If-Match", "2")
      .send({ followUpRequired: false });
    expect(cleared.status).toBe(200);
    expect(cleared.body.version).toBe(3);
    expect(cleared.body.followUpNote).toBeNull();
  });

  it("PATCH without If-Match → 400 (AD-14)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).send(VALID_ACTION);
    const res = await staff.patch(`/api/actions/${created.body.id}`).send({ result: "x" });
    expect(res.status).toBe(400);
    const badHeader = await staff
      .patch(`/api/actions/${created.body.id}`)
      .set("If-Match", "not-a-version")
      .send({ result: "x" });
    expect(badHeader.status).toBe(400);
  });

  it("lists newest-first with working pagination (AC-41)", async () => {
    const staff = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
    await prisma.actionTaken.deleteMany({ where: { ticketId } });
    const stamps = ["2026-09-01T01:00:00.000Z", "2026-09-02T01:00:00.000Z", "2026-09-03T01:00:00.000Z"];
    for (const actionAt of stamps) {
      const res = await staff.post(`/api/tickets/${ticketId}/actions`).send({ ...VALID_ACTION, actionAt });
      expect(res.status).toBe(201);
    }
    const page1 = await staff.get(`/api/tickets/${ticketId}/actions?limit=2`);
    expect(page1.status).toBe(200);
    expect(page1.body.pagination).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(page1.body.actions.map((a: { actionAt: string }) => a.actionAt)).toEqual([
      "2026-09-03T01:00:00.000Z",
      "2026-09-02T01:00:00.000Z",
    ]);
    const page2 = await staff.get(`/api/tickets/${ticketId}/actions?limit=2&page=2`);
    expect(page2.body.actions.map((a: { actionAt: string }) => a.actionAt)).toEqual(["2026-09-01T01:00:00.000Z"]);

    const badPage = await staff.get(`/api/tickets/${ticketId}/actions?page=x`);
    expect(badPage.status).toBe(400);
    const badLimit = await staff.get(`/api/tickets/${ticketId}/actions?limit=51`);
    expect(badLimit.status).toBe(400);
  });
});
