import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/App.js";
import { getPrisma } from "../../src/prisma.js";
import { DEMO_PASSWORD, TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "../helpers.js";

const SEED_REQUESTER_EMAIL = "anong.srisuk@toktikit.com";
const INACTIVE_EMAIL = "napat.wongsawat@toktikit.com";

describe("Lab 3 Issue 3 — Auth API (AC-01 to AC-08, AC-11)", () => {
  // ------------------------------------------------------------------
  // AC-01: successful login returns user payload + session cookie
  // ------------------------------------------------------------------
  it("AC-01: login returns 200 with user payload (no passwordHash), sets session cookie", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/login")
      .send({ email: SEED_REQUESTER_EMAIL, password: DEMO_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(SEED_REQUESTER_EMAIL);
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.name).toBeDefined();
    expect(res.body.user.role).toBeDefined();
    expect(typeof res.body.user.isActive).toBe("boolean");
    expect(typeof res.body.user.mustChangePassword).toBe("boolean");
    // BR-01: passwordHash must never be returned
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
    // Session cookie should have been set
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  // ------------------------------------------------------------------
  // AC-02: wrong password / unknown email → safe 401 (no enumeration)
  // ------------------------------------------------------------------
  it("AC-02: wrong password returns 401 INVALID_CREDENTIALS", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_REQUESTER_EMAIL, password: "DefinitelyWrong1!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("AC-02: unknown email returns the same 401 as wrong password", async () => {
    const wrongPass = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_REQUESTER_EMAIL, password: "DefinitelyWrong1!" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@toktikit.com", password: DEMO_PASSWORD });

    expect(wrongPass.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPass.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknownEmail.body.error.code).toBe("INVALID_CREDENTIALS");
    // Both must return the identical message to prevent enumeration
    expect(wrongPass.body.error.message).toBe(unknownEmail.body.error.message);
  });

  // ------------------------------------------------------------------
  // AC-03: inactive account → same safe 401
  // ------------------------------------------------------------------
  it("AC-03: inactive account returns 401 INVALID_CREDENTIALS (same as wrong password)", async () => {
    const wrongPass = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_REQUESTER_EMAIL, password: "DefinitelyWrong1!" });
    const inactive = await request(app)
      .post("/api/auth/login")
      .send({ email: INACTIVE_EMAIL, password: DEMO_PASSWORD });

    expect(wrongPass.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect(wrongPass.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(inactive.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPass.body.error.message).toBe(inactive.body.error.message);
  });

  // ------------------------------------------------------------------
  // AC-04: GET /me — session restore (200) / 401 when no session
  // ------------------------------------------------------------------
  it("AC-04: /me without a session returns 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("AC-04: /me with a valid session returns the signed-in user", async () => {
    const agent = await loginAs(SEED_REQUESTER_EMAIL);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(SEED_REQUESTER_EMAIL);
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  // ------------------------------------------------------------------
  // AC-05: POST /logout invalidates session; /me → 401
  // ------------------------------------------------------------------
  it("AC-05: logout returns 200 with message; subsequent /me returns 401", async () => {
    const agent = await loginAs(SEED_REQUESTER_EMAIL);

    const out = await agent.post("/api/auth/logout");
    expect(out.status).toBe(200);
    expect(out.body.message).toBe("Logged out.");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });

  it("AC-05: logout without session returns 401", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });

  // ------------------------------------------------------------------
  // AC-06: mustChangePassword gate — normal routes 403; only auth routes
  //         (me, logout, change-password) are accessible
  // ------------------------------------------------------------------
  it("AC-06: mustChangePassword gate blocks /api/categories (403), allows /me", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        name: "Gate Test User",
        email: "gate-test@toktikit.com",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
      },
    });
    try {
      const agent = await loginAs(user.email, TEST_PASSWORD);

      // /me is exempt from the gate
      const me = await agent.get("/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.user.mustChangePassword).toBe(true);

      // A normal protected route is blocked by the gate
      const cats = await agent.get("/api/categories");
      expect(cats.status).toBe(403);
      expect(cats.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("AC-06: gate blocks /api/tickets, /api/systems, /api/requesters; allows logout", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        name: "Gate Test User 2",
        email: "gate-test2@toktikit.com",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
      },
    });
    try {
      const agent = await loginAs(user.email, TEST_PASSWORD);

      const blocked = [
        agent.get("/api/tickets"),
        agent.get("/api/systems"),
        agent.get("/api/requesters"),
        agent.post("/api/tickets").send({ title: "test" }),
      ];
      for (const req of blocked) {
        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
      }

      // Logout is exempt
      const out = await agent.post("/api/auth/logout");
      expect(out.status).toBe(200);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  // ------------------------------------------------------------------
  // AC-07: first-login change clears mustChangePassword + grants access
  // ------------------------------------------------------------------
  it("AC-07: change-password on mustChangePassword user clears the flag", async () => {
    const prisma = getPrisma();
    const created = await prisma.user.create({
      data: {
        name: "Auth API Temp",
        email: "auth-api-temp@toktikit.com",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
      },
    });

    try {
      const agent = await loginAs(created.email, TEST_PASSWORD);
      const login = await agent.get("/api/auth/me");
      expect(login.status).toBe(200);
      expect(login.body.user.mustChangePassword).toBe(true);

      const NEW = "NewPassword123!";
      const changed = await agent
        .post("/api/auth/change-password")
        .send({ currentPassword: TEST_PASSWORD, newPassword: NEW });
      expect(changed.status).toBe(200);
      expect(changed.body.message).toBe("Password changed.");

      // Session should still be valid
      const me = await agent.get("/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.user.mustChangePassword).toBe(false);

      // Now the gate no longer blocks
      const cats = await agent.get("/api/categories");
      expect(cats.status).toBe(200);

      // Clean up: change back so the user row doesn't leak state
      // (delete below handles it)
    } finally {
      await prisma.user.delete({ where: { id: created.id } });
    }
  });

  // ------------------------------------------------------------------
  // AC-08: wrong current password → 401; weak new → 400; user unchanged
  // ------------------------------------------------------------------
  it("AC-08: wrong current password returns 401 and user is unchanged", async () => {
    const prisma = getPrisma();
    const created = await prisma.user.create({
      data: {
        name: "AC08 Wrong Current",
        email: "ac08-wrong@toktikit.com",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    try {
      const agent = await loginAs(created.email, TEST_PASSWORD);
      const res = await agent
        .post("/api/auth/change-password")
        .send({ currentPassword: "WrongCurrent1!", newPassword: "NewPassword123!" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("WRONG_PASSWORD");

      // User is unchanged
      const after = await prisma.user.findUnique({ where: { id: created.id } });
      expect(after?.passwordHash).toBe(TEST_PASSWORD_HASH);
      expect(after?.mustChangePassword).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: created.id } });
    }
  });

  it("AC-08: new password shorter than 8 chars returns 400", async () => {
    const prisma = getPrisma();
    const created = await prisma.user.create({
      data: {
        name: "AC08 Weak New",
        email: "ac08-weak@toktikit.com",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    try {
      const agent = await loginAs(created.email, TEST_PASSWORD);
      const res = await agent
        .post("/api/auth/change-password")
        .send({ currentPassword: TEST_PASSWORD, newPassword: "Short1!" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    } finally {
      await prisma.user.delete({ where: { id: created.id } });
    }
  });

  it("AC-08: new password equal to current password returns 400", async () => {
    const prisma = getPrisma();
    const created = await prisma.user.create({
      data: {
        name: "AC08 Same Password",
        email: "ac08-same@toktikit.com",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    try {
      const agent = await loginAs(created.email, TEST_PASSWORD);
      const res = await agent
        .post("/api/auth/change-password")
        .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    } finally {
      await prisma.user.delete({ where: { id: created.id } });
    }
  });

  it("AC-08: missing fields returns 400", async () => {
    const agent = await loginAs(SEED_REQUESTER_EMAIL);
    const res = await agent
      .post("/api/auth/change-password")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // ------------------------------------------------------------------
  // AC-11: protected endpoints without session → 401
  // ------------------------------------------------------------------
  it("AC-11: protected endpoints return 401 without a session", async () => {
    const endpoints = [
      { method: "GET" as const, path: "/api/categories" },
      { method: "GET" as const, path: "/api/requesters" },
      { method: "GET" as const, path: "/api/systems" },
      { method: "GET" as const, path: "/api/tickets" },
      { method: "POST" as const, path: "/api/tickets" },
      { method: "GET" as const, path: "/api/auth/me" },
      { method: "POST" as const, path: "/api/auth/change-password" },
      { method: "POST" as const, path: "/api/auth/logout" },
    ];

    for (const { method, path } of endpoints) {
      const req = request(app);
      const res =
        method === "GET" ? await req.get(path) : await req.post(path);
      expect(res.status).toBe(401);
    }
  });

  // ------------------------------------------------------------------
  // BR-01: passwordHash never present in any user response
  // ------------------------------------------------------------------
  it("BR-01: passwordHash is never returned in login or /me responses", async () => {
    const agent = await loginAs(SEED_REQUESTER_EMAIL);

    const login = await agent
      .post("/api/auth/login")
      .send({ email: SEED_REQUESTER_EMAIL, password: DEMO_PASSWORD });
    expect(login.body.user?.passwordHash).toBeUndefined();

    const me = await agent.get("/api/auth/me");
    expect(me.body.user?.passwordHash).toBeUndefined();
  });

  // ------------------------------------------------------------------
  // Login field validation → 400
  // ------------------------------------------------------------------
  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "something" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@test.com" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
