import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/App.js";

describe("GET /api/categories", () => {
  it("returns HTTP 200 and a predictable list of categories", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);

    expect(response.body[0]).toHaveProperty("id");
    expect(response.body[0]).toHaveProperty("name");
  });
});