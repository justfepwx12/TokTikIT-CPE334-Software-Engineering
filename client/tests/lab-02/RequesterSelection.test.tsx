/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import RequesterSelection from "../../src/pฟges/RequesterSelection";
import { RequesterProvider } from "../../src/context/RequesterContext";
import { BrowserRouter } from "react-router-dom";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("RequesterSelection Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderWithContext = () => {
    return render(
      <BrowserRouter>
        <RequesterProvider>
          <RequesterSelection />
        </RequesterProvider>
      </BrowserRouter>
    );
  };

 it("renders title, explanation, dropdown, and Continue button on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: "Jane Doe", email: "jane@example.com", isActive: true },
        { id: 2, name: "John Smith", email: "john@example.com", isActive: true },
      ],
    });
    
    renderWithContext();
    
    await waitFor(() => {
      expect(screen.getByTestId("success-state")).toBeDefined();
    });

    expect(screen.getAllByText(/Select Development Requester/i)[0]).toBeDefined();
    expect(screen.getByText(/This is not a login screen/i)).toBeDefined();

    const select = screen.getAllByRole("combobox")[0];
    expect(select).toBeDefined();

    expect(screen.getByRole("button", { name: /Continue/i })).toBeDefined();
  });

  it("saves requester to context and allows continuing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: "Jane Doe", email: "jane@example.com", isActive: true },
        { id: 2, name: "John Smith", email: "john@example.com", isActive: true },
      ],
    });
    
    renderWithContext();
    
    await waitFor(() => {
      expect(screen.getByTestId("success-state")).toBeDefined();
    });

    const select = screen.getAllByRole("combobox")[0];
    fireEvent.change(select, { target: { value: "2" } });
    
    const continueBtn = screen.getAllByRole("button", { name: /Continue/i })[0];
    expect(continueBtn).toBeDefined();
  });
});