import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/App.js";
import { loginAs } from "./helpers.js";

const IT_STAFF_EMAIL = "somchai.jaidee@toktikit.com";

describe("GET /api/categories", () => {
  let agent: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    agent = await loginAs(IT_STAFF_EMAIL);
  });

  it("returns HTTP 200 and all seeded categories in predictable id order", async () => {
    const response = await agent.get("/api/categories");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(4);

    response.body.forEach((item: Record<string, unknown>) => {
      expect(Object.keys(item).sort()).toEqual(["id", "name"]);
    });

    const ids = response.body.map((item: { id: number }) => item.id);
    const sortedIds = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sortedIds);

    const names = response.body.map((item: { name: string }) => item.name);
    expect(names).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });
});
