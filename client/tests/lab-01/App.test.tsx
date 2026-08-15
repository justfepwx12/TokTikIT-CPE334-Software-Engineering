// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the TokTickIT heading", () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [],
    });

    render(<App />);
    expect(screen.getByText(/TokT.*kIT/i)).toBeDefined();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    render(<App />);

    const button = await screen.findByRole("button", { name: /check system/i });
    fireEvent.click(button);

    expect(await screen.findByText(/System Status: Online/i)).toBeDefined();
    expect(await screen.findByText(/Supported Request Categories/i)).toBeDefined();
    for (const name of ["Account and Access", "Hardware", "Software", "Network"]) {
      expect(screen.getByText(name)).toBeDefined();
    }
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("unavailable"));

    render(<App />);

    const button = await screen.findByRole("button", { name: /check system/i });
    fireEvent.click(button);

    expect(await screen.findByText(/System Status: Offline/i)).toBeDefined();
    expect(await screen.findByText(/Unable to connect to TokT.*kIT API/i)).toBeDefined();
  });
});