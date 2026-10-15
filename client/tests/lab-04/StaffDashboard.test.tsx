/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import * as api from "../../src/api";
import StaffDashboard from "../../src/pages/StaffDashboard";
import App from "../../src/App.js";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return {
    ClipboardList: stub,
    Inbox: stub,
    UserCheck: stub,
    Clock: stub,
    FileText: stub,
    PlusCircle: stub,
    UserCircle: stub,
    Menu: stub,
    X: stub,
    ChevronDown: stub,
    LogOut: stub,
    LayoutDashboard: stub,
  };
});

const STAFF_USER: api.AuthUser = {
  id: 8,
  name: "Weerapong Chaiyaporn",
  email: "weerapong@toktikit.com",
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

const NON_TERMINAL = "NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED";

function summaryWith(metrics: api.StaffSummary["metrics"]): api.StaffSummary {
  return {
    scope: { viewerId: 8 },
    metrics,
    drillDown: {
      unassignedCount: { endpoint: "/api/staff/tickets", query: `ownerId=0&status=${NON_TERMINAL}` },
      myAssignedCount: { endpoint: "/api/staff/tickets", query: `ownerId=8&status=${NON_TERMINAL}` },
      myInProgressCount: { endpoint: "/api/staff/tickets", query: "ownerId=8&status=IN_PROGRESS" },
      waitingForRequesterCount: { endpoint: "/api/staff/tickets", query: "status=WAITING_FOR_REQUESTER" },
      followUpDueCount: { endpoint: "/api/staff/tickets", query: `status=${NON_TERMINAL}&followUp=true` },
      resolvedTodayCount: { endpoint: "/api/staff/tickets", query: "status=RESOLVED&resolvedToday=true" },
    },
  };
}

const FULL_SUMMARY = summaryWith({
  unassignedCount: 5,
  myAssignedCount: 3,
  myInProgressCount: 2,
  waitingForRequesterCount: 4,
  followUpDueCount: 2,
  resolvedTodayCount: 1,
});

const getStaffSummaryMock = vi.fn();

function mockStaffSession(summary: api.StaffSummary = FULL_SUMMARY) {
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: STAFF_USER });
  getStaffSummaryMock.mockResolvedValue(summary);
  vi.spyOn(api, "getStaffSummary").mockImplementation(getStaffSummaryMock);
}

describe("StaffDashboard (AC-48)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockStaffSession();
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AuthProvider>
          <StaffDashboard />
        </AuthProvider>
      </BrowserRouter>
    );

  it("renders all six cards plus shortcuts with server counts", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId("staff-dashboard-cards")).toBeDefined());

    expect(screen.getByTestId("staff-card-unassigned-count").textContent).toBe("5");
    expect(screen.getByTestId("staff-card-my-assigned-count").textContent).toBe("3");
    expect(screen.getByTestId("staff-card-my-in-progress-count").textContent).toBe("2");
    expect(screen.getByTestId("staff-card-waiting-count").textContent).toBe("4");
    expect(screen.getByTestId("staff-card-followup-count").textContent).toBe("2");
    expect(screen.getByTestId("staff-card-resolved-today-count").textContent).toBe("1");

    expect(screen.getByTestId("staff-shortcut-record-action")).toBeDefined();
    expect(screen.getByTestId("staff-shortcut-open-queue")).toBeDefined();
    expect(screen.getByTestId("staff-shortcut-my-work")).toBeDefined();
  });

  it("drill-down cards and shortcuts resolve to the filtered queue (no broken links)", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("staff-dashboard-cards")).toBeDefined());

    const attr = (testid: string) => screen.getByTestId(testid).getAttribute("href");
    expect(attr("staff-card-unassigned")).toContain("/queue?");
    expect(attr("staff-card-unassigned")).toContain("ownerId=0");
    expect(attr("staff-card-my-assigned")).toContain("ownerId=8");
    expect(attr("staff-card-my-in-progress")).toContain("status=IN_PROGRESS");
    expect(attr("staff-card-followup")).toContain("followUp=true");
    expect(attr("staff-card-resolved-today")).toContain("resolvedToday=true");
    expect(attr("staff-shortcut-open-queue")).toBe("/queue");
    expect(attr("staff-shortcut-my-work")).toBe("/queue?ownerId=8");
  });

  it("shows skeleton loading state before the summary resolves", async () => {
    let resolve!: (v: api.StaffSummary) => void;
    getStaffSummaryMock.mockImplementation(() => new Promise<api.StaffSummary>((r) => (resolve = r)));
    renderPage();

    expect(screen.getByTestId("staff-dashboard-loading")).toBeDefined();

    await waitFor(() => expect(getStaffSummaryMock).toHaveBeenCalled());
    resolve(FULL_SUMMARY);
    await waitFor(() => expect(screen.getByTestId("staff-dashboard-cards")).toBeDefined());
  });

  it("renders zeros (never blanks) plus the calm empty state when the queue is clear", async () => {
    vi.restoreAllMocks();
    mockStaffSession(
      summaryWith({
        unassignedCount: 0,
        myAssignedCount: 0,
        myInProgressCount: 0,
        waitingForRequesterCount: 0,
        followUpDueCount: 0,
        resolvedTodayCount: 0,
      })
    );
    renderPage();

    await waitFor(() => expect(screen.getByTestId("staff-dashboard-empty")).toBeDefined());
    expect(screen.getByTestId("staff-dashboard-empty").textContent).toMatch(/Queue is clear/);
    // Zero metrics render "0".
    expect(screen.getByTestId("staff-card-unassigned-count").textContent).toBe("0");
    // Empty CTA resolves to a real route.
    expect(screen.getByTestId("staff-dashboard-empty").querySelector("a")?.getAttribute("href")).toBe("/queue");
  });

  it("shows a safe error banner with Retry that refetches", async () => {
    getStaffSummaryMock.mockRejectedValueOnce(new Error("boom"));
    renderPage();

    await waitFor(() => expect(screen.getByTestId("staff-dashboard-error")).toBeDefined());
    expect(screen.getByTestId("staff-dashboard-error").textContent).toMatch(/Something went wrong/);

    getStaffSummaryMock.mockResolvedValue(FULL_SUMMARY);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByTestId("staff-dashboard-cards")).toBeDefined());
  });

  it("renders a 403 screen for a Requester on /dashboard/staff (visual role guard)", async () => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: REQUESTER_USER });

    render(
      <MemoryRouter initialEntries={["/dashboard/staff"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("role-forbidden")).toBeDefined());
    expect(screen.getByText(/403/)).toBeDefined();
  });
});
