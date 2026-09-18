// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // No session in these tests — AuthProvider restores to signed-out.
    vi.spyOn(api, "getSessionUser").mockRejectedValue(new Error("Not signed in."));
  });

  afterEach(() => {
    cleanup();
  });

it("renders the TokTickIT heading", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [],
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    // Signed out: no nav chrome renders, so `/` bounces to the login card,
    // which carries the product heading once the session check settles.
    const heading = await screen.findByText(/Log in to TokTikIT/i);
    expect(heading).toBeDefined();
  });

  it("shows Online and the seeded categories on success", async () => {
    // `/` is protected (Lab 3 BR-03): mock an authenticated session so the
    // system-status home renders instead of redirecting to /login.
    vi.spyOn(api, "getSessionUser").mockResolvedValue({
      user: {
        id: 1,
        name: "Test Requester",
        email: "test@toktikit.com",
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    const button = await screen.findByRole("button", { name: /check system/i });
    fireEvent.click(button);

    expect(await screen.findByText(/System Status: Online/i)).toBeDefined();
    expect(await screen.findByText(/Supported Request Categories/i)).toBeDefined();
    for (const name of ["Account and Access", "Hardware", "Software", "Network"]) {
      expect(screen.getByText(name)).toBeDefined();
    }
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "getSessionUser").mockResolvedValue({
      user: {
        id: 1,
        name: "Test Requester",
        email: "test@toktikit.com",
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("unavailable"));

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    const button = await screen.findByRole("button", { name: /check system/i });
    fireEvent.click(button);

    expect(await screen.findByText(/System Status: Offline/i)).toBeDefined();
    expect(await screen.findByText(/Unable to connect to TokT.*kIT API/i)).toBeDefined();
  });
});