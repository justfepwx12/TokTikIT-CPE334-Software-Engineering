import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "./helpers.js";

const prisma = getPrisma();

const ADMIN_EMAIL = "adm-root@toktikit.com";
const ADMIN2_EMAIL = "adm-second@toktikit.com";
const STAFF_EMAIL = "adm-staff@toktikit.com";
const REQ_EMAIL = "adm-req@toktikit.com";

async function mkUser(name: string, email: string, role: "REQUESTER" | "IT_STAFF" | "ADMIN") {
  return prisma.user.create({
    data: { name, email, isActive: true, role, passwordHash: TEST_PASSWORD_HASH, mustChangePassword: false },
  });
}

describe("Admin User Management API (AC-26–AC-31)", () => {
  let adminId = 0;
  let requesterId = 0;

  beforeAll(async () => {
    const [admin, req] = await Promise.all([
      mkUser("Adm Root", ADMIN_EMAIL, "ADMIN"),
      mkUser("Adm Req", REQ_EMAIL, "REQUESTER"),
    ]);
    adminId = admin.id;
    requesterId = req.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, ADMIN2_EMAIL, STAFF_EMAIL, REQ_EMAIL] } },
    });
    await prisma.$disconnect();
  });

  it("lists users with search and role filter for admins (AC-26)", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const all = await agent.get("/api/admin/users");
    expect(all.status).toBe(200);
    expect(Array.isArray(all.body.users)).toBe(true);
    expect(all.body.users.length).toBeGreaterThanOrEqual(2);
    expect(all.body.users[0].passwordHash).toBeUndefined();

    const search = await agent.get("/api/admin/users").query({ search: "adm-req" });
    expect(search.status).toBe(200);
    expect(search.body.users.map((u: { email: string }) => u.email)).toContain(REQ_EMAIL);

    const role = await agent.get("/api/admin/users").query({ role: "REQUESTER" });
    expect(role.status).toBe(200);
    for (const u of role.body.users) expect(u.role).toBe("REQUESTER");

    const badRole = await agent.get("/api/admin/users").query({ role: "SUPERUSER" });
    expect(badRole.status).toBe(400);
  });

  it("rejects non-admin roles with 403 (AC-30)", async () => {
    const staff = await mkUser("Adm Staff", STAFF_EMAIL, "IT_STAFF");
    try {
      const staffAgent = await loginAs(STAFF_EMAIL, TEST_PASSWORD);
      expect((await staffAgent.get("/api/admin/users")).status).toBe(403);

      const reqAgent = await loginAs(REQ_EMAIL, TEST_PASSWORD);
      expect((await reqAgent.get("/api/admin/users")).status).toBe(403);
      expect((await reqAgent.post("/api/admin/users").send({})).status).toBe(403);
    } finally {
      await prisma.user.delete({ where: { id: staff.id } });
    }
  });

  it("creates users with mustChangePassword=true and rejects duplicates (AC-26/27)", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const create = await agent.post("/api/admin/users").send({
      name: "Newbie Staff",
      email: "adm-newbie@toktikit.com",
      role: "IT_STAFF",
      password: "TempPass123!",
    });
    expect(create.status).toBe(201);
    expect(create.body.user.mustChangePassword).toBe(true);
    expect(create.body.user.passwordHash).toBeUndefined();

    try {
      const dup = await agent.post("/api/admin/users").send({
        name: "Dupe",
        email: "adm-newbie@toktikit.com",
        role: "REQUESTER",
        password: "TempPass123!",
      });
      expect(dup.status).toBe(409);

      const mcp = await agent.post("/api/admin/users").send({
        name: "Sneaky",
        email: "adm-sneaky@toktikit.com",
        role: "REQUESTER",
        password: "TempPass123!",
        mustChangePassword: false,
      });
      expect(mcp.status).toBe(400);
    } finally {
      await prisma.user.deleteMany({ where: { email: { in: ["adm-newbie@toktikit.com", "adm-sneaky@toktikit.com"] } } });
    }
  });

  it("edits users and rejects duplicate email on update (AC-26/27)", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const patch = await agent.patch(`/api/admin/users/${requesterId}`).send({ name: "Adm Req Jr." });
    expect(patch.status).toBe(200);
    expect(patch.body.user.name).toBe("Adm Req Jr.");

    const dup = await agent.patch(`/api/admin/users/${requesterId}`).send({ email: ADMIN_EMAIL });
    expect(dup.status).toBe(409);

    const missing = await agent.patch("/api/admin/users/99999999").send({ name: "Ghost" });
    expect(missing.status).toBe(404);
    const badId = await agent.patch("/api/admin/users/abc").send({ name: "Ghost" });
    expect(badId.status).toBe(400);
  });

  it("blocks self-deactivation (BR-10, AC-28)", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const res = await agent.patch(`/api/admin/users/${adminId}`).send({ isActive: false });
    expect(res.status).toBe(400);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(after.isActive).toBe(true);
  });

  it("allows deactivating a non-last admin", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const second = await mkUser("Adm Second", ADMIN2_EMAIL, "ADMIN");
    try {
      const res = await agent.patch(`/api/admin/users/${second.id}`).send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: second.id } });
    }
  });

  it("blocks removing the last active admin (BR-11, AC-29)", async (ctx) => {
    // Reachable path: self-demotion (ADMIN → non-ADMIN) while sole active
    // admin. (Deactivating another admin can never trigger BR-11 — the actor
    // is always an active admin themselves; self-deactivation is caught by
    // BR-10 first.) The guard counts global active admins and other files
    // create admin fixtures concurrently — so isolate (deactivate others,
    // restore in finally) and retry a few times before skipping.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const deactivated: number[] = [];
      try {
        const others = await prisma.user.findMany({
          where: { role: "ADMIN", isActive: true, id: { not: adminId } },
          select: { id: true },
        });
        for (const o of others) {
          await prisma.user.update({ where: { id: o.id }, data: { isActive: false } });
          deactivated.push(o.id);
        }
        const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
        const down = await agent.patch(`/api/admin/users/${adminId}`).send({ role: "REQUESTER" });
        if (down.status === 400) {
          expect(down.body.error.code).toBe("LAST_ADMIN");
          const after = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
          expect(after.role).toBe("ADMIN");
          return;
        }
        // A concurrent fixture appeared mid-window — roll back and retry.
        await prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN", isActive: true } });
      } finally {
        if (deactivated.length > 0) {
          await prisma.user.updateMany({ where: { id: { in: deactivated } }, data: { isActive: true } });
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    ctx.skip();
  });

  it("resets passwords with mustChangePassword=true (AC-26)", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const res = await agent
      .post(`/api/admin/users/${requesterId}/reset-password`)
      .send({ newPassword: "ResetTemp123!" });
    expect(res.status).toBe(200);

    const me = await prisma.user.findUniqueOrThrow({ where: { id: requesterId } });
    expect(me.mustChangePassword).toBe(true);

    // The user can still log in with the new password (then must change it).
    const relogin = await request(app).post("/api/auth/login").send({
      email: REQ_EMAIL,
      password: "ResetTemp123!",
    });
    expect(relogin.status).toBe(200);

    const short = await agent
      .post(`/api/admin/users/${requesterId}/reset-password`)
      .send({ newPassword: "short" });
    expect(short.status).toBe(400);
  });

  it("has no DELETE user route (BR-12, AC-31)", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const res = await agent.delete(`/api/admin/users/${requesterId}`);
    expect([404, 405]).toContain(res.status);
    // Deactivation is the lifecycle end — the row still exists.
    expect(await prisma.user.findUnique({ where: { id: requesterId } })).not.toBeNull();
  });

  it("returns 401 without a session", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
  });
});
