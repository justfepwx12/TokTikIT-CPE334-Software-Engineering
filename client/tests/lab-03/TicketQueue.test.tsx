/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import * as api from "../../src/api";
import TicketQueue from "../../src/pages/TicketQueue";
import App from "../../src/App.js";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return {
    Clock: stub,
    FileText: stub,
    PlusCircle: stub,
    Inbox: stub,
    UserCircle: stub,
    Menu: stub,
    X: stub,
    ChevronDown: stub,
    ChevronLeft: stub,
    ChevronRight: stub,
    Search: stub,
    FilterX: stub,
    ArrowUpDown: stub,
    LogOut: stub,
    LogIn: stub,
    KeyRound: stub,
    Eye: stub,
    EyeOff: stub,
    Home: stub,
    ChevronRightIcon: stub,
  };
});

const STAFF_USER: api.AuthUser = {
  id: 9,
  name: "Somchai Jaidee",
  email: "somchai.jaidee@toktikit.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

const REQUESTER_USER: api.AuthUser = {
  id: 6,
  name: "Jane Doe",
  email: "jane@toktikit.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

const TICKETS: api.StaffTicket[] = [
  {
    id: 1,
    ticketNo: "TK-20260914-0001",
    title: "VPN connection drops every 5 minutes",
    requestedPriority: "HIGH",
    itPriority: "URGENT",
    status: "IN_PROGRESS",
    createdAt: "2026-09-14T04:18:20.000Z",
    updatedAt: "2026-09-14T05:02:00.000Z",
    category: { id: 3, name: "Network" },
    system: { id: 3, name: "VPN Service" },
    requester: { id: 6, name: "Jane Doe" },
    owner: { id: 9, name: "Somchai Jaidee" },
  },
  {
    id: 2,
    ticketNo: "TK-20260914-0002",
    title: "Printer jam on floor 3",
    requestedPriority: "LOW",
    itPriority: "LOW",
    status: "NEW",
    createdAt: "2026-09-14T04:20:00.000Z",
    updatedAt: "2026-09-14T04:21:00.000Z",
    category: { id: 2, name: "Hardware" },
    system: { id: 1, name: "Email Client" },
    requester: { id: 7, name: "John Smith" },
    owner: null,
  },
];

const PAGINATION: api.Pagination = { total: 2, page: 1, limit: 10, totalPages: 1 };
const getStaffTicketsMock = vi.fn();

function mockStaffSession() {
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: STAFF_USER });
  vi.spyOn(api, "getCategories").mockResolvedValue([
    { id: 3, name: "Network" },
    { id: 2, name: "Hardware" },
  ]);
  vi.spyOn(api, "getSystems").mockResolvedValue([
    { id: 3, name: "VPN Service" },
    { id: 1, name: "Email Client" },
  ]);
  getStaffTicketsMock.mockResolvedValue({ tickets: TICKETS, pagination: PAGINATION });
  vi.spyOn(api, "getStaffTickets").mockImplementation(getStaffTicketsMock);
}

describe("TicketQueue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockStaffSession();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AuthProvider>
          <TicketQueue />
        </AuthProvider>
      </BrowserRouter>
    );

  it("renders queue rows with requester, priorities, status and owner", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("queue-row")).toHaveLength(2);
    });
    // Desktop table + mobile cards both render in jsdom (CSS-only hiding).
    expect(screen.getAllByText("VPN connection drops every 5 minutes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Somchai Jaidee").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("URGENT").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IN_PROGRESS").length).toBeGreaterThanOrEqual(1);
  });

  it("sends status and IT priority filters to the API", async () => {
    renderPage();
    await waitFor(() => expect(getStaffTicketsMock).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId("queue-status"), { target: { value: "NEW" } });
    fireEvent.change(screen.getByTestId("queue-priority"), { target: { value: "URGENT" } });

    await waitFor(() => {
      const last = getStaffTicketsMock.mock.calls[getStaffTicketsMock.mock.calls.length - 1][0];
      expect(last).toEqual(expect.objectContaining({ status: "NEW", priority: "URGENT" }));
    });
  });

  it("shows the no-results state when filters match nothing", async () => {
    getStaffTicketsMock.mockResolvedValue({
      tickets: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });
    renderPage();

    // Activate a filter so the empty list renders as no-results (not empty-state).
    fireEvent.change(screen.getByTestId("queue-search"), { target: { value: "zzz-no-match" } });
    await waitFor(() => expect(screen.getByTestId("no-results")).toBeDefined());
  });

  it("shows an error state with Retry that refetches", async () => {
    getStaffTicketsMock.mockRejectedValueOnce(new Error("boom"));
    renderPage();

    await waitFor(() => expect(screen.getByTestId("queue-error")).toBeDefined());

    getStaffTicketsMock.mockResolvedValue({ tickets: TICKETS, pagination: PAGINATION });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getAllByTestId("queue-row")).toHaveLength(2));
  });

  it("renders a 403 screen for a Requester on /queue (visual role guard)", async () => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: REQUESTER_USER });

    render(
      <MemoryRouter initialEntries={["/queue"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("role-forbidden")).toBeDefined());
    expect(screen.getByText(/403/)).toBeDefined();
  });
});
