/**
 * @vitest-environment jsdom
 */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import * as api from "../../src/api";
import StaffDashboard from "../../src/pages/StaffDashboard";
import ActionsTaken from "../../src/components/ActionsTaken";
import { AuthProvider } from "../../src/context/AuthContext";
import dashboardStyles from "../../src/pages/Dashboard.module.css";

// Stylesheets are not applied by jsdom, so token/hardening rules are asserted
// against the source text (regression net for AC-53/54 prerequisites).
const appCss = readFileSync(join(process.cwd(), "src", "App.css"), "utf8");

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
  id: 8, name: "Weerapong Chaiyaporn", email: "weerapong@toktikit.com",
  role: "IT_STAFF", isActive: true, mustChangePassword: false,
};

describe("Lab 4 UI hardening tokens (ui-spec §1/§6, BR-30)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: STAFF_USER });
  });

  afterEach(() => {
    cleanup();
  });

  it("defines the Zen Green token set and focus/hardening rules in App.css", () => {
    // Single source of truth: Primary/Secondary/Pale tokens exist.
    expect(appCss).toContain("#006B3C");
    expect(appCss).toContain("#0B7A46");
    expect(appCss).toContain("#EAF6EF");
    // Previously-referenced-but-undefined utilities now resolve.
    for (const cls of [".btn-brand", ".text-brand", ".bg-brand", ".alert-backend-success", ".max-w-400", ".max-w-500"]) {
      expect(appCss).toContain(cls);
    }
    // Visible keyboard focus (never outline:none alone) + no page h-scroll.
    expect(appCss).toContain(":focus-visible");
    expect(appCss).toContain("overflow-x");
    expect(appCss).not.toMatch(/\.btn-brand[^}]*outline:\s*none/);
  });

  it("gives the Unassigned card the strongest emphasis (distinct class)", () => {
    expect(dashboardStyles.cardEmphasis).toBeDefined();
    expect(dashboardStyles.cardEmphasis).not.toBe(dashboardStyles.card);

    vi.spyOn(api, "getStaffSummary").mockResolvedValue({
      scope: { viewerId: 8 },
      metrics: {
        unassignedCount: 2, myAssignedCount: 1, myInProgressCount: 0,
        waitingForRequesterCount: 0, followUpDueCount: 0, resolvedTodayCount: 0,
      },
      drillDown: {},
    });
    render(
      <BrowserRouter>
        <AuthProvider>
          <StaffDashboard />
        </AuthProvider>
      </BrowserRouter>
    );
    return waitFor(() => expect(screen.getByTestId("staff-dashboard-cards")).toBeDefined()).then(() => {
      const unassigned = screen.getByTestId("staff-card-unassigned").getAttribute("class") ?? "";
      const assigned = screen.getByTestId("staff-card-my-assigned").getAttribute("class") ?? "";
      expect(unassigned).toContain(dashboardStyles.cardEmphasis);
      expect(assigned).not.toContain(dashboardStyles.cardEmphasis);
    });
  });

  it("pairs the follow-up amber badge with text and shows performer read-only (never color alone)", async () => {
    const flagged = {
      id: 1, ticketId: 101, actionAt: "2026-09-10T02:00:00.000Z",
      description: "Did the work.", result: "It worked.",
      performedBy: { id: 8, name: "Weerapong Chaiyaporn", role: "IT_STAFF" as const },
      followUpRequired: true, followUpNote: "Re-check at end of shift.",
      attachmentNotes: null, version: 1,
      createdAt: "2026-09-10T02:01:00.000Z", updatedAt: "2026-09-10T02:01:00.000Z",
    };
    vi.spyOn(api, "getTicketActions").mockResolvedValue({
      actions: [flagged],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
    render(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={101} />
        </AuthProvider>
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByTestId("actions-list")).toBeDefined());

    // Amber badge always carries its text label.
    expect(screen.getAllByText("Follow-Up").length).toBeGreaterThanOrEqual(1);
    // Performer is a read-only chip: name renders, no editable control exists.
    expect(screen.getByTestId("action-recording-as").textContent).toMatch(/Weerapong Chaiyaporn/);
    expect(screen.queryByRole("textbox", { name: /perform/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /perform/i })).toBeNull();
  });
});
