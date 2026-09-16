/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../src/context/AuthContext";
import TicketDetail from "../../src/pages/TicketDetail";
import * as api from "../../src/api";
import type { TicketDetail as TicketDetailType } from "../../src/api";

vi.mock("lucide-react", () => ({
  ArrowLeft: () => null,
  AlertCircle: () => null,
  FileText: () => null,
  File: () => null,
  Download: () => null,
  X: () => null,
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
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  status: "IN_PROGRESS",
  createdAt: "2026-09-06T04:18:20.000Z",
  updatedAt: "2026-09-06T05:02:00.000Z",
  category: { id: 3, name: "Network" },
  system: { id: 3, name: "VPN Service" },
  requester: { id: 2, name: "Jane Doe" },
  attachments: [
    { id: 1, filename: "screenshot.png", mimeType: "image/png", size: 154200, isRemoved: false },
    { id: 2, filename: "report.pdf", mimeType: "application/pdf", size: 2048, isRemoved: false },
    { id: 3, filename: "revoked.pdf", mimeType: "application/pdf", size: 4096, isRemoved: true },
  ],
};

function renderDetail() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/tickets/42"]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/my-tickets" element={<div>My Tickets Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  // Authenticated session fixture (replaces the Lab 2 simulated selector).
  vi.spyOn(api, "getSessionUser").mockResolvedValue({
    user: {
      id: 2,
      name: "Jane Doe",
      email: "jane@toktikit.com",
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
    },
  });

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

  it("shows an active attachment's Download button and disables it for removed attachments", async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());

    expect(screen.getByTestId("download-1")).toBeDefined();
    expect(screen.getByTestId("remove-1")).toBeDefined();

    // Removed attachment: metadata stays visible but download is hidden/disabled.
    expect(screen.getByText("revoked.pdf")).toBeDefined();
    expect(screen.getByTestId("removed-badge-3")).toBeDefined();
    expect(screen.queryByTestId("download-3")).toBeNull();
    expect(screen.queryByTestId("remove-3")).toBeNull();
  });

  it("downloads an active attachment and triggers the browser download", async () => {
    const blob = new Blob(["fakepdf"], { type: "application/pdf" });
    const downloadMock = vi.spyOn(api, "downloadAttachment").mockResolvedValue({
      blob,
      filename: "report.pdf",
    });
    const triggerMock = vi.spyOn(api, "triggerDownload").mockImplementation(() => {});

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());

    fireEvent.click(screen.getByTestId("download-2"));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith(2, 2));
    expect(triggerMock).toHaveBeenCalledWith(blob, "report.pdf");
    expect(screen.queryByTestId("download-error")).toBeNull();
  });

  it("shows an error message when a download fails", async () => {
    vi.spyOn(api, "downloadAttachment").mockRejectedValue(new Error("410 Gone"));

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());

    fireEvent.click(screen.getByTestId("download-1"));
    await waitFor(() => expect(screen.getByTestId("download-error")).toBeDefined());
    expect(screen.getByText("410 Gone")).toBeDefined();
  });

  it("opens the removal modal and validates the mandatory reason length", async () => {
    const removeAttemptSpy = vi
      .spyOn(api, "removeAttachment")
      .mockResolvedValue({
        id: 1,
        filename: "screenshot.png",
        isRemoved: true,
        removalReason: "short",
        updatedAt: "2026-09-06T06:00:00.000Z",
      });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());

    fireEvent.click(screen.getByTestId("remove-1"));
    await waitFor(() => expect(screen.getByTestId("removal-modal")).toBeDefined());
    expect(screen.getByText("Reason for removal")).toBeDefined();

    // Too-short reason is rejected client-side.
    fireEvent.change(screen.getByTestId("removal-reason"), { target: { value: "ab" } });
    fireEvent.click(screen.getByTestId("confirm-remove"));
    await waitFor(() =>
      expect(screen.getByText(/Reason must be between 3 and 200 characters/i)).toBeDefined()
    );
    expect(removeAttemptSpy).not.toHaveBeenCalled();

    // Escape closes the modal without confirming.
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("removal-modal")).toBeNull());
  });

  it("soft-removes an attachment after a valid reason and flips it to Removed", async () => {
    const removeMock = vi.spyOn(api, "removeAttachment").mockResolvedValue({
      id: 1,
      filename: "screenshot.png",
      isRemoved: true,
      removalReason: "Contains credentials",
      updatedAt: "2026-09-06T06:00:00.000Z",
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());

    fireEvent.click(screen.getByTestId("remove-1"));
    await waitFor(() => expect(screen.getByTestId("removal-modal")).toBeDefined());

    fireEvent.change(screen.getByTestId("removal-reason"), {
      target: { value: "Contains credentials" },
    });
    fireEvent.click(screen.getByTestId("confirm-remove"));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith(1, "Contains credentials", 2));
    await waitFor(() => expect(screen.queryByTestId("removal-modal")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("removed-badge-1")).toBeDefined());
    expect(screen.queryByTestId("download-1")).toBeNull();
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
      <AuthProvider>
        <MemoryRouter initialEntries={["/tickets/abc"]}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("ticket-detail-error")).toBeDefined());
    expect(screen.getByText("Invalid ticket id.")).toBeDefined();
  });
});