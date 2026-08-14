import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/App.js";

describe("GET /api/health", () => {
  it("returns HTTP 200 and expected health check payload", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "TokTickIT API",
    });
  });
});