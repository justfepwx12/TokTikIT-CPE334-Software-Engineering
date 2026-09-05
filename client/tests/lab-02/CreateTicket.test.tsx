/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import CreateTicket from "../../src/pages/CreateTicket";
import { RequesterProvider } from "../../src/context/RequesterContext";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockJsonResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => data,
  } as Response);

describe("CreateTicket Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  const renderWithContext = () => {
    window.localStorage.setItem(
      "toktickit.selectedRequester",
      JSON.stringify({ id: 1, name: "Jane Doe" })
    );
    return render(
      <BrowserRouter>
        <RequesterProvider>
          <CreateTicket />
        </RequesterProvider>
      </BrowserRouter>
    );
  };

  it("dynamically loads Categories and Related Systems into dropdowns", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse([
          { id: 1, name: "Account and Access" },
          { id: 2, name: "Hardware" },
          { id: 3, name: "Software" },
          { id: 4, name: "Network" },
        ])
      )
      .mockResolvedValueOnce(
        mockJsonResponse([
          { id: 1, name: "HR System" },
          { id: 2, name: "Payroll System" },
        ])
      );

    renderWithContext();

    await waitFor(() => {
      expect(screen.getByTestId("create-ticket-form")).toBeDefined();
    });

    const categorySelect = screen.getByTestId("field-category") as HTMLSelectElement;
    expect(categorySelect.querySelectorAll("option").length).toBe(5);
    expect(categorySelect.querySelector('option[value="2"]')?.textContent).toBe("Hardware");

    const systemSelect = screen.getByTestId("field-system") as HTMLSelectElement;
    expect(systemSelect.querySelectorAll("option").length).toBe(3);
    expect(systemSelect.querySelector('option[value="2"]')?.textContent).toBe("Payroll System");
  });

  it("shows field validation errors with red asterisks when submitting empty form", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse([
          { id: 1, name: "Account and Access" },
          { id: 2, name: "Hardware" },
        ])
      )
      .mockResolvedValueOnce(
        mockJsonResponse([
          { id: 1, name: "HR System" },
          { id: 2, name: "Payroll System" },
        ])
      );

    renderWithContext();

    await waitFor(() => {
      expect(screen.getByTestId("create-ticket-form")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/Title is required/i)).toBeDefined();
      expect(screen.getByText(/Please select a Category/i)).toBeDefined();
      expect(screen.getByText(/Please select a Related System/i)).toBeDefined();
      expect(screen.getByText(/Please select a Priority/i)).toBeDefined();
      expect(screen.getByText(/Description is required/i)).toBeDefined();
    });

    // Red asterisks for required fields (title via TextInput + 3 select labels)
    expect(screen.getAllByTestId("required-asterisk").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("*").length).toBeGreaterThanOrEqual(4);
  });

  it("shows a busy state on the Submit button during API processing", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse([
          { id: 1, name: "Account and Access" },
          { id: 2, name: "Hardware" },
        ])
      )
      .mockResolvedValueOnce(
        mockJsonResponse([
          { id: 1, name: "HR System" },
          { id: 2, name: "Payroll System" },
        ])
      );

    // POST /api/tickets — delayed promise so busy state is observable
    let resolveTicket!: (value: unknown) => void;
    mockFetch.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolveTicket = resolve;
      });
    });

    renderWithContext();

    await waitFor(() => {
      expect(screen.getByTestId("create-ticket-form")).toBeDefined();
    });

    fireEvent.change(screen.getByTestId("field-title"), {
      target: { value: "VPN Connection Fails on macOS" },
    });
    fireEvent.change(screen.getByTestId("field-category"), { target: { value: "1" } });
    fireEvent.change(screen.getByTestId("field-system"), { target: { value: "1" } });
    fireEvent.change(screen.getByTestId("field-priority"), { target: { value: "MEDIUM" } });
    fireEvent.change(screen.getByTestId("field-description"), {
      target: { value: "Unable to establish VPN connection after the latest OS update." },
    });

    const submitButton = screen.getByRole("button", { name: /submit ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const busyButton = screen.getByRole("button", { name: /submitting\.\.\./i });
      expect((busyButton as HTMLButtonElement).disabled).toBe(true);
      expect(busyButton.getAttribute("aria-disabled")).toBe("true");
    });

    resolveTicket({
      ok: true,
      json: async () => ({
        id: 1,
        ticketNo: "TK-20260906-0001",
        title: "VPN Connection Fails on macOS",
      }),
    });
  });
});