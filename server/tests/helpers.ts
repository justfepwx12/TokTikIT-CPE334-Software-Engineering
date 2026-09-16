import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../src/App.js";

// Must match prisma/seed.ts DEMO_PASSWORD (AD-09 documented initial password).
// Duplicated here intentionally — tests must log in with the same known
// password the seed uses; changing the seed password requires updating this.
export const DEMO_PASSWORD = "TokTickDemo123!";

/** A bcrypt hash suitable for creating test users that can log in. */
// Cost 10 (not production 12) to keep test setup fast; salt is random per
// process but consistent within a run since it's computed once at import.
export const TEST_PASSWORD = "TestPass123!";
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);

/**
 * Log in as the given email and return a supertest agent that carries the
 * session cookie for subsequent requests.
 */
export async function loginAs(
  email: string,
  password = DEMO_PASSWORD,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(
      `loginAs: login failed for ${email} (status ${res.status}): ${JSON.stringify(res.body)}`,
    );
  }
  return agent;
}
