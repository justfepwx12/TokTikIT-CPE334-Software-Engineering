/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import * as api from "../../src/api";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return {
    UserCheck: stub,
    UserPlus: stub,
    Flag: stub,
    Activity: stub,
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

const TICKET: api.StaffTicketDetail = {
  id: 42,
  ticketNo: "TK-20260914-0042",
  title: "VPN drops every five minutes",
  description: "Cannot stay connected to the corporate VPN.",
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  status: "NEW",
  createdAt: "2026-09-14T04:18:20.000Z",
  updatedAt: "2026-09-14T05:02:00.000Z",
  category: { id: 3, name: "Network" },
  system: { id: 3, name: "VPN Service" },
  requester: { id: 6, name: "Jane Doe" },
  owner: null,
  attachments: [],
};

function mockSession() {
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: STAFF_USER });
}

function renderDetail() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/tickets/42"]}>
        <Routes>
          <Route path="/tickets/:id" element={<StaffTicketDetail />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("StaffTicketDetail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSession();
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(TICKET);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("splits read-only requester fields from editable blocks", async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("staff-ticket-detail")).toBeDefined());

    expect(screen.getByTestId("staff-ticket-title").textContent).toContain("VPN drops");
    // Requested priority is tagged read-only; IT priority is a control.
    expect(screen.getByText("HIGH (read-only)")).toBeDefined();
    expect(screen.getByTestId("staff-it-priority")).toBeDefined();
    expect(screen.getByTestId("staff-claim")).toBeDefined();
  });

  it("claims an unassigned ticket (AC-15)", async () => {
    const claimMock = vi.spyOn(api, "claimTicket").mockResolvedValue({
      id: 42,
      ownerId: 9,
      owner: { id: 9, name: "Somchai Jaidee" },
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("staff-claim")).toBeDefined());

    fireEvent.click(screen.getByTestId("staff-claim"));
    await waitFor(() => expect(claimMock).toHaveBeenCalledWith(42));
    await waitFor(() => expect(screen.getByTestId("staff-owner").textContent).toContain("Somchai Jaidee"));
  });

  it("reassigns with a validated staff id (AC-16)", async () => {
    const assignMock = vi.spyOn(api, "assignTicket").mockResolvedValue({
      id: 42,
      ownerId: 10,
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("staff-assign")).toBeDefined());

    // Non-numeric id is rejected client-side without calling the API.
    fireEvent.change(screen.getByTestId("staff-assignee"), { target: { value: "abc" } });
    fireEvent.click(screen.getByTestId("staff-assign"));
    await waitFor(() => expect(screen.getByTestId("staff-op-error")).toBeDefined());
    expect(assignMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("staff-assignee"), { target: { value: "10" } });
    fireEvent.click(screen.getByTestId("staff-assign"));
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith(42, 10));
  });

  it("offers only legal matrix edges as status buttons (AC-18/19)", async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("staff-ticket-detail")).toBeDefined());

    // NEW → OPEN / IN_PROGRESS / CANCELLED / RESOLVED only.
    expect(screen.getByTestId("staff-status-OPEN")).toBeDefined();
    expect(screen.getByTestId("staff-status-IN_PROGRESS")).toBeDefined();
    expect(screen.getByTestId("staff-status-CANCELLED")).toBeDefined();
    expect(screen.getByTestId("staff-status-RESOLVED")).toBeDefined();
    expect(screen.queryByTestId("staff-status-CLOSED")).toBeNull();
    expect(screen.queryByTestId("staff-status-REOPENED")).toBeNull();
    expect(screen.queryByTestId("staff-status-NEW")).toBeNull();
  });

  it("posts the chosen legal transition on click", async () => {
    const statusMock = vi.spyOn(api, "setTicketStatus").mockResolvedValue({
      id: 42,
      status: "IN_PROGRESS",
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("staff-status-IN_PROGRESS")).toBeDefined());

    fireEvent.click(screen.getByTestId("staff-status-IN_PROGRESS"));
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith(42, "IN_PROGRESS"));
  });

  it("saves the IT priority without touching requested priority", async () => {
    const priorityMock = vi.spyOn(api, "setItPriority").mockResolvedValue({
      id: 42,
      requestedPriority: "HIGH",
      itPriority: "URGENT",
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("staff-it-priority")).toBeDefined());

    fireEvent.change(screen.getByTestId("staff-it-priority"), { target: { value: "URGENT" } });
    fireEvent.click(screen.getByTestId("staff-priority-save"));
    await waitFor(() => expect(priorityMock).toHaveBeenCalledWith(42, "URGENT"));
  });
});
