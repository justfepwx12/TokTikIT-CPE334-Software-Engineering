/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import * as api from "../../src/api";
import RequesterDashboard from "../../src/pages/RequesterDashboard";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return {
    PlusCircle: stub,
    Clock: stub,
    FileText: stub,
    Inbox: stub,
    UserCircle: stub,
    Menu: stub,
    X: stub,
    ChevronDown: stub,
    LogOut: stub,
    LayoutDashboard: stub,
  };
});

const REQUESTER_USER: api.AuthUser = {
  id: 6,
  name: "Jane Doe",
  email: "jane@toktikit.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

const STAFF_USER: api.AuthUser = {
  id: 8,
  name: "Weerapong Chaiyaporn",
  email: "weerapong@toktikit.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

function summaryWith(metrics: api.RequesterSummary["metrics"]): api.RequesterSummary {
  return {
    scope: { requesterId: 6 },
    metrics,
    drillDown: {
      myOpen: { endpoint: "/api/tickets", query: "status=NEW,OPEN,IN_PROGRESS" },
      myWaiting: { endpoint: "/api/tickets", query: "status=WAITING_FOR_REQUESTER" },
      myResolved: { endpoint: "/api/tickets", query: "status=RESOLVED" },
      myClosed: { endpoint: "/api/tickets", query: "status=CLOSED" },
      myReopened: { endpoint: "/api/tickets", query: "status=REOPENED" },
      myCancelled: { endpoint: "/api/tickets", query: "status=CANCELLED" },
      myFollowUpOpen: {
        endpoint: "/api/tickets",
        query: "status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED&followUp=true",
      },
    },
  };
}

const FULL_SUMMARY = summaryWith({
  myOpen: 2,
  myWaiting: 1,
  myResolved: 1,
  myClosed: 4,
  myReopened: 0,
  myCancelled: 0,
  myFollowUpOpen: 1,
});

const getRequesterSummaryMock = vi.fn();

function mockSession(user: api.AuthUser, summary: api.RequesterSummary = FULL_SUMMARY) {
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user });
  getRequesterSummaryMock.mockResolvedValue(summary);
  vi.spyOn(api, "getRequesterSummary").mockImplementation(getRequesterSummaryMock);
}

describe("RequesterDashboard (AC-49)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSession(REQUESTER_USER);
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AuthProvider>
          <RequesterDashboard />
        </AuthProvider>
      </BrowserRouter>
    );

  it("renders own-ticket cards with server counts and no staff-only metrics", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("requester-dashboard-cards")).toBeDefined());

    expect(screen.getByTestId("requester-card-open-count").textContent).toBe("2");
    expect(screen.getByTestId("requester-card-waiting-count").textContent).toBe("1");
    expect(screen.getByTestId("requester-card-resolved-count").textContent).toBe("1");
    expect(screen.getByTestId("requester-card-closed-count").textContent).toBe("4");

    // Staff-only vocabulary never renders here.
    expect(screen.queryByText(/Unassigned/i)).toBeNull();
    expect(screen.queryByText(/My Assigned/i)).toBeNull();
    expect(screen.queryByText(/Resolved Today/i)).toBeNull();
  });

  it("drill-down cards resolve to the own-ticket list (no broken links)", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("requester-dashboard-cards")).toBeDefined());

    const attr = (testid: string) => screen.getByTestId(testid).getAttribute("href");
    expect(attr("requester-card-open")).toContain("/my-tickets?");
    expect(attr("requester-card-open")).toContain("status=NEW,OPEN,IN_PROGRESS");
    expect(attr("requester-card-waiting")).toContain("status=WAITING_FOR_REQUESTER");
    expect(attr("requester-followup-link")).toContain("followUp=true");
  });

  it("shows the follow-up attention strip only when flagged tickets exist", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("requester-dashboard-cards")).toBeDefined());
    expect(screen.getByTestId("requester-followup-strip").textContent).toMatch(/flagged 1 of your ticket/);

    vi.restoreAllMocks();
    mockSession(REQUESTER_USER, summaryWith({
      myOpen: 1, myWaiting: 0, myResolved: 0, myClosed: 0,
      myReopened: 0, myCancelled: 0, myFollowUpOpen: 0,
    }));
    cleanup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId("requester-dashboard-cards")).toBeDefined());
    expect(screen.queryByTestId("requester-followup-strip")).toBeNull();
  });

  it("renders zeros plus a create-ticket CTA when the requester has no tickets", async () => {
    vi.restoreAllMocks();
    mockSession(REQUESTER_USER, summaryWith({
      myOpen: 0, myWaiting: 0, myResolved: 0, myClosed: 0,
      myReopened: 0, myCancelled: 0, myFollowUpOpen: 0,
    }));
    renderPage();

    await waitFor(() => expect(screen.getByTestId("requester-dashboard-empty")).toBeDefined());
    expect(screen.getByTestId("requester-dashboard-empty").textContent).toMatch(/no tickets yet/i);
    expect(screen.getByTestId("requester-card-open-count").textContent).toBe("0");
    expect(screen.getByTestId("requester-empty-cta").getAttribute("href")).toBe("/create-ticket");
  });

  it("shows a safe error banner with Retry that refetches", async () => {
    getRequesterSummaryMock.mockRejectedValueOnce(new Error("boom"));
    renderPage();

    await waitFor(() => expect(screen.getByTestId("requester-dashboard-error")).toBeDefined());

    getRequesterSummaryMock.mockResolvedValue(FULL_SUMMARY);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByTestId("requester-dashboard-cards")).toBeDefined());
  });

  it("staff visitors see counts only with no drill-down links", async () => {
    vi.restoreAllMocks();
    mockSession(STAFF_USER);
    renderPage();

    await waitFor(() => expect(screen.getByTestId("requester-dashboard-cards")).toBeDefined());
    expect(screen.getByTestId("requester-counts-only-note")).toBeDefined();
    // Cards render as static blocks, not links.
    expect(screen.getByTestId("requester-card-open").tagName.toLowerCase()).toBe("div");
    expect(screen.queryByTestId("requester-followup-link")).toBeNull();
  });
});
