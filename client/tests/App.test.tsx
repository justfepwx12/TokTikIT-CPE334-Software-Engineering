// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";
import * as api from "../src/api";

describe("App", () => {
  it("renders the TokTikIT heading", () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [],
    });

    render(<App />);
    expect(screen.getByText(/TokTikIT/i)).toBeDefined();
  });

  it.todo("shows Online and the seeded categories on success");
  it.todo("shows an Offline error message when the API is unavailable");
});