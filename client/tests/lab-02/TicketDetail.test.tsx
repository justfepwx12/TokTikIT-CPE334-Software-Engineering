/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequesterProvider } from "../../src/context/RequesterContext";
import TicketDetail from "../../src/pages/TicketDetail";
import * as api from "../../src/api";
import type { TicketDetail as TicketDetailType } from "../../src/api";

vi.mock("lucide-react", () => ({
  ArrowLeft: () => null,
  AlertCircle: () => null,
  FileText: () => null,
  Download: () => null,
  File: () => null,
}));

vi.mock("../../src/components/Badge", () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("../../src/components/Button", () => ({
  default: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

const fakeTicket: TicketDetailType = {
  id: 42,
  ticketNo: "TK-20260906-0042",
  title: "VPN drops every five minutes",
  description: "Cannot stay connected to the corporate VPN.",
  priority: "HIGH",
  status: "IN_PROGRESS",
  createdAt: "2026-09-06T04:18:20.000Z",
  updatedAt: "2026-09-06T05:02:00.000Z",
  category: { id: 3, name: "Network" },
  system: { id: 3, name: "VPN Service" },
  requester: { id: 2, name: "Jane Doe" },
  attachments: [
    { id: 1, filename: "screenshot.png", mimeType: "image/png", size: 154200, isRemoved: false },
    { id: 2, filename: "report.pdf", mimeType: "application/pdf", size: 2048, isRemoved: false },
  ],
};

function renderDetail() {
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={["/tickets/42"]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/my-tickets" element={<div>My Tickets Page</div>} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  localStorage.clear();
  localStorage.setItem(
    "toktickit.selectedRequester",
    JSON.stringify({ id: 2, name: "Jane Doe" })
  );

  vi.spyOn(api, "getTicket").mockResolvedValue(fakeTicket);
});

describe("TicketDetail", () => {
  it("fetches and renders owned ticket metadata read-only with badges and attachments", async () => {
    renderDetail();

    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());

    expect(screen.getByText("VPN drops every five minutes")).toBeDefined();
    expect(screen.getByTestId("ticket-ticket-no").textContent).toContain("TK-20260906-0042");
    expect(screen.getByText("Network")).toBeDefined();
    expect(screen.getByText("VPN Service")).toBeDefined();
    expect(screen.getByText(/Cannot stay connected/)).toBeDefined();
    expect(screen.getByText("Jane Doe")).toBeDefined();

    expect(screen.getByText("HIGH")).toBeDefined();
    expect(screen.getByText("IN_PROGRESS")).toBeDefined();

    expect(api.getTicket).toHaveBeenCalledWith(42, 2);

    expect(screen.getByTestId("attachment-list")).toBeDefined();
    expect(screen.getByText("screenshot.png")).toBeDefined();
    expect(screen.getByText("report.pdf")).toBeDefined();
  });

  it("passes the active requester id as the ownership scope", async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());
    expect(api.getTicket).toHaveBeenCalledWith(42, 2);
  });

  it("shows the no-attachments message when the ticket has none", async () => {
    vi.spyOn(api, "getTicket").mockResolvedValue({ ...fakeTicket, attachments: [] });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("no-attachments")).toBeDefined());
    expect(screen.getByText("No attachments.")).toBeDefined();
  });

  it("shows an error state with a Retry that refetches", async () => {
    const getTicketMock = vi.spyOn(api, "getTicket");
    getTicketMock.mockRejectedValueOnce(new Error("Ticket not found"));
    getTicketMock.mockResolvedValueOnce(fakeTicket);

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("ticket-detail-error")).toBeDefined());
    expect(screen.getByText("Ticket not found")).toBeDefined();

    fireEvent.click(screen.getByTestId("ticket-detail-retry"));
    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());
    expect(getTicketMock).toHaveBeenCalledTimes(2);
  });

  it("shows an error for an invalid ticket id", async () => {
    render(
      <RequesterProvider>
        <MemoryRouter initialEntries={["/tickets/abc"]}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Routes>
        </MemoryRouter>
      </RequesterProvider>
    );
    await waitFor(() => expect(screen.getByTestId("ticket-detail-error")).toBeDefined());
    expect(screen.getByText("Invalid ticket id.")).toBeDefined();
  });
});