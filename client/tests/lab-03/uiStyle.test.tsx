/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Badge from "../../src/components/Badge";
import { StatusBadge, PriorityBadge } from "../../src/components/TicketBadges";
import { STATUS_COLOR, PRIORITY_COLOR } from "../../src/utils/badgeColors";
import type { TicketStatus, TicketPriority } from "../../src/api";
import InternalNotes from "../../src/components/InternalNotes";
import * as api from "../../src/api";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return { Lock: stub };
});

const ALL_STATUSES: TicketStatus[] = [
  "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER",
  "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
];
const ALL_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

describe("Lab 3 uiStyle tokens & badges (ui-spec §1/§9, BR-21)", () => {
  it("maps every status and priority to a badge color (single source of truth)", () => {
    for (const s of ALL_STATUSES) expect(STATUS_COLOR[s]).toBeDefined();
    for (const p of ALL_PRIORITIES) expect(PRIORITY_COLOR[p]).toBeDefined();
    expect(Object.keys(STATUS_COLOR)).toHaveLength(8);
    expect(Object.keys(PRIORITY_COLOR)).toHaveLength(4);
  });

  it("always renders a text label with the badge (never color alone)", () => {
    for (const s of ALL_STATUSES) {
      const { unmount } = render(<StatusBadge status={s} />);
      expect(screen.getByText(s)).toBeDefined();
      unmount();
    }
    for (const p of ALL_PRIORITIES) {
      const { unmount } = render(<PriorityBadge priority={p} />);
      expect(screen.getByText(p)).toBeDefined();
      unmount();
    }
    cleanup();
  });

  it("gives distinct colors across severities", () => {
    const { container, unmount } = render(<Badge color="red">URGENT</Badge>);
    const redClass = container.firstElementChild?.getAttribute("class") ?? "";
    unmount();
    const { container: container2 } = render(<Badge color="green">LOW</Badge>);
    const greenClass = container2.firstElementChild?.getAttribute("class") ?? "";
    expect(redClass).not.toBe(greenClass);
    cleanup();
  });

  it("keeps internal notes visually distinct (yellow surface + staff-only label)", async () => {
    vi.spyOn(api, "getSessionUser").mockResolvedValue({
      user: { id: 9, name: "S", email: "s@t.com", role: "IT_STAFF", isActive: true, mustChangePassword: false },
    });
    vi.spyOn(api, "getNotes").mockResolvedValue({ notes: [] });
    render(<InternalNotes ticketId={1} />);
    const section = await screen.findByTestId("internal-notes");
    // jsdom normalizes #FFFBEB to rgb(255, 251, 235).
    expect(section.getAttribute("style") ?? "").toContain("rgb(255, 251, 235)");
    expect(screen.getByText("Internal — IT Staff only")).toBeDefined();
    cleanup();
    vi.restoreAllMocks();
  });
});
