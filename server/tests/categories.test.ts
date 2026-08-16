import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/App.js";

describe("GET /api/categories", () => {
  it("returns HTTP 200 and all seeded categories in predictable id order", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(4);

    response.body.forEach((item: Record<string, unknown>) => {
      expect(Object.keys(item).sort()).toEqual(["id", "name"]);
    });

    // Ascending Order
    const ids = response.body.map((item: { id: number }) => item.id);
    const sortedIds = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sortedIds);

    // categories ตรงกับ Seed
    const names = response.body.map((item: { name: string }) => item.name);
    expect(names).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });
});