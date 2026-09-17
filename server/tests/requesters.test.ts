import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../src/App.js";
import { loginAs } from "./helpers.js";

const IT_STAFF_EMAIL = "somchai.jaidee@toktikit.com";

describe("GET /api/requesters", () => {
  let agent: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    agent = await loginAs(IT_STAFF_EMAIL);
  });

  it("returns HTTP 200 with only active requesters, shaped { id, name, email, isActive }", async () => {
    const response = await agent.get("/api/requesters");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(4);

    response.body.forEach((item: Record<string, unknown>) => {
      expect(Object.keys(item).sort()).toEqual(["email", "id", "isActive", "name"]);
    });
  });

  it("returns requesters in ascending alphabetical order by name", async () => {
    const response = await agent.get("/api/requesters");

    const names = response.body.map((item: { name: string }) => item.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });
});
