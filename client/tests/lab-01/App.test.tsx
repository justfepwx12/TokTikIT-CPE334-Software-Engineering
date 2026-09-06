// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext"; // เพิ่ม Import นี้

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

    render(
      <MemoryRouter>
        <RequesterProvider>
          <App />
        </RequesterProvider>
      </MemoryRouter>
    );
    
    const elements = screen.getAllByText(/TokT.*kIT/i);
    expect(elements.length).toBeGreaterThan(0);
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

    render(
      <MemoryRouter>
        <RequesterProvider>
          <App />
        </RequesterProvider>
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
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("unavailable"));

    render(
      <MemoryRouter>
        <RequesterProvider>
          <App />
        </RequesterProvider>
      </MemoryRouter>
    );

    const button = await screen.findByRole("button", { name: /check system/i });
    fireEvent.click(button);

    expect(await screen.findByText(/System Status: Offline/i)).toBeDefined();
    expect(await screen.findByText(/Unable to connect to TokT.*kIT API/i)).toBeDefined();
  });
});