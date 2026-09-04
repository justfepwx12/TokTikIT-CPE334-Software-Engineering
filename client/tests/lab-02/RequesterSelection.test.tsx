import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import RequesterSelection from "../../src/pages/RequesterSelection";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("RequesterSelection Component", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders loading state initially", async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Hangs forever to test loading
    render(<RequesterSelection onSelect={mockOnSelect} />);
    
    expect(screen.getByTestId("loading-state")).toBeDefined();
  });

  it("renders safe API-failure state with distinct messaging", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network Error"));
    render(<RequesterSelection onSelect={mockOnSelect} />);
    
    await waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeDefined();
      expect(screen.getByText(/Unable to load Development Requesters/i)).toBeDefined();
    });
  });

  it("renders empty state if no active requesters are returned", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    render(<RequesterSelection onSelect={mockOnSelect} />);
    
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeDefined();
      expect(screen.getByText(/No Active Requesters/i)).toBeDefined();
    });
  });

  it("renders title, explanation, dropdown, and Continue button on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: "Jane Doe", email: "jane@example.com", isActive: true },
        { id: 2, name: "John Smith", email: "john@example.com", isActive: true },
      ],
    });
    
    render(<RequesterSelection onSelect={mockOnSelect} />);
    
    await waitFor(() => {
      expect(screen.getByTestId("success-state")).toBeDefined();
    });

    // Validates texts required by spec
    expect(screen.getByText(/Select Development Requester/i)).toBeDefined();
    expect(screen.getByText(/This is not a login screen/i)).toBeDefined();
    expect(screen.getByText(/Only active development requesters are shown/i)).toBeDefined();
    expect(screen.getByText(/Authentication coming in Lab 3/i)).toBeDefined();

    // Validates Dropdown & options
    const select = screen.getByRole("combobox");
    expect(select).toBeDefined();
    expect(screen.getByText("Jane Doe")).toBeDefined();
    expect(screen.getByText("John Smith")).toBeDefined();

    // Validates Button
    expect(screen.getByRole("button", { name: /Continue/i })).toBeDefined();
  });

  it("calls onSelect with the correct requester ID when Continue is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: "Jane Doe", email: "jane@example.com", isActive: true },
        { id: 2, name: "John Smith", email: "john@example.com", isActive: true },
      ],
    });
    
    render(<RequesterSelection onSelect={mockOnSelect} />);
    
    await waitFor(() => {
      expect(screen.getByTestId("success-state")).toBeDefined();
    });

    const select = screen.getByRole("combobox");
    // Change selection to "John Smith" (id 2)
    fireEvent.change(select, { target: { value: "2" } });
    
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(continueBtn);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(2);
  });
});