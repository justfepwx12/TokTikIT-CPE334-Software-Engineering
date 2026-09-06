import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/App.js";

describe("GET /api/requesters", () => {
  it("returns HTTP 200 with only active requesters, shaped { id, name }", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(4); 

    response.body.forEach((item: Record<string, unknown>) => {
      expect(Object.keys(item).sort()).toEqual(["email", "id", "isActive", "name"]);
    });
  });

  it("returns requesters in ascending alphabetical order by name", async () => {
    const response = await request(app).get("/api/requesters");

    const names = response.body.map((item: { name: string }) => item.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

});

