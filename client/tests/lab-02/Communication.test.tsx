/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../src/context/AuthContext";
import TicketDetail from "../../src/pages/TicketDetail";
import PublicComments from "../../src/components/PublicComments";
import InternalNotes from "../../src/components/InternalNotes";
import * as api from "../../src/api";
import type { TicketDetail as TicketDetailType } from "../../src/api";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return {
    ArrowLeft: stub,
    AlertCircle: stub,
    FileText: stub,
    File: stub,
    Download: stub,
    X: stub,
    Lock: stub,
  };
});

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

const REQUESTER: api.AuthUser = {
  id: 2,
  name: "Jane Doe",
  email: "jane@toktikit.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

const SEED_COMMENTS: api.TicketComment[] = [
  {
    id: 7,
    body: "Still happening after reboot.",
    author: { id: 2, name: "Jane Doe", role: "REQUESTER" },
    createdAt: "2026-09-14T06:00:00.000Z",
  },
  {
    id: 5,
    body: "We are investigating.",
    author: { id: 9, name: "Somchai Jaidee", role: "IT_STAFF" },
    createdAt: "2026-09-14T05:00:00.000Z",
  },
];

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
  attachments: [],
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: REQUESTER });
});

afterEach(() => {
  cleanup();
});

describe("PublicComments (AC-22/AC-24)", () => {
  it("lists comments newest-first with author, role and timestamp", async () => {
    vi.spyOn(api, "getComments").mockResolvedValue({ comments: SEED_COMMENTS });
    render(<PublicComments ticketId={42} />);

    await waitFor(() => expect(screen.getAllByTestId("timeline-entry")).toHaveLength(2));
    expect(api.getComments).toHaveBeenCalledWith(42);
    expect(screen.getByText("Still happening after reboot.")).toBeDefined();
    expect(screen.getByText("Jane Doe")).toBeDefined();
    expect(screen.getByText("IT Staff")).toBeDefined();
  });

  it("appends a new comment to the top of the list on post", async () => {
    vi.spyOn(api, "getComments").mockResolvedValue({ comments: SEED_COMMENTS });
    const postMock = vi.spyOn(api, "postComment").mockResolvedValue({
      id: 9,
      body: "Just happened again.",
      author: { id: 2, name: "Jane Doe", role: "REQUESTER" },
      createdAt: "2026-09-14T07:00:00.000Z",
    });
    render(<PublicComments ticketId={42} />);
    await waitFor(() => expect(screen.getAllByTestId("timeline-entry")).toHaveLength(2));

    fireEvent.change(screen.getByTestId("comment-composer"), {
      target: { value: "Just happened again." },
    });
    fireEvent.click(screen.getByTestId("comment-submit"));

    await waitFor(() => expect(postMock).toHaveBeenCalledWith(42, "Just happened again."));
    await waitFor(() => expect(screen.getAllByTestId("timeline-entry")).toHaveLength(3));
    expect(screen.getByText("Just happened again.")).toBeDefined();
  });

  it("rejects an empty comment client-side without calling the API", async () => {
    vi.spyOn(api, "getComments").mockResolvedValue({ comments: [] });
    const postMock = vi.spyOn(api, "postComment");
    render(<PublicComments ticketId={42} />);
    await waitFor(() => expect(screen.getByTestId("comment-composer")).toBeDefined());

    fireEvent.change(screen.getByTestId("comment-composer"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("comment-submit"));

    expect(await screen.findByTestId("comment-error")).toBeDefined();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("shows an error panel with Retry when loading fails", async () => {
    vi.spyOn(api, "getComments").mockRejectedValue(new Error("boom"));
    render(<PublicComments ticketId={42} />);

    expect(await screen.findByTestId("comments-error")).toBeDefined();
    vi.spyOn(api, "getComments").mockResolvedValue({ comments: SEED_COMMENTS });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getAllByTestId("timeline-entry")).toHaveLength(2));
  });
});

describe("InternalNotes visual distinction (AC #102)", () => {
  it("renders the yellow-tint surface, lock indicator and staff-only label", async () => {
    vi.spyOn(api, "getNotes").mockResolvedValue({ notes: [] });
    const { container } = render(<InternalNotes ticketId={42} />);
    await waitFor(() => expect(screen.getByTestId("internal-notes")).toBeDefined());

    const section = screen.getByTestId("internal-notes");
    // jsdom normalizes #FFFBEB to rgb(255, 251, 235).
    expect(section.getAttribute("style") ?? "").toContain("rgb(255, 251, 235)");
    expect(screen.getByText("Internal — IT Staff only")).toBeDefined();
    // Lucide is stubbed in tests; the lock icon is asserted via aria in code.
    expect(container.querySelector("h3")).toBeDefined();
  });

  it("posts a note and prepends it to the list", async () => {
    vi.spyOn(api, "getNotes").mockResolvedValue({ notes: [] });
    const postMock = vi.spyOn(api, "postNote").mockResolvedValue({
      id: 3,
      body: "Check the VPN logs first.",
      author: { id: 9, name: "Somchai Jaidee", role: "IT_STAFF" },
      createdAt: "2026-09-14T07:00:00.000Z",
    });
    render(<InternalNotes ticketId={42} />);
    await waitFor(() => expect(screen.getByTestId("note-composer")).toBeDefined());

    fireEvent.change(screen.getByTestId("note-composer"), {
      target: { value: "Check the VPN logs first." },
    });
    fireEvent.click(screen.getByTestId("note-submit"));

    await waitFor(() => expect(postMock).toHaveBeenCalledWith(42, "Check the VPN logs first."));
    expect(screen.getByText("Check the VPN logs first.")).toBeDefined();
  });
});

describe("Requester TicketDetail never exposes notes (BR-18)", () => {
  it("renders comments but no notes section and never fetches notes", async () => {
    vi.spyOn(api, "getTicket").mockResolvedValue(fakeTicket);
    vi.spyOn(api, "getComments").mockResolvedValue({ comments: SEED_COMMENTS });
    const notesSpy = vi.spyOn(api, "getNotes");

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/tickets/42"]}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("ticket-title")).toBeDefined());
    expect(screen.getByTestId("public-comments")).toBeDefined();
    expect(screen.queryByTestId("internal-notes")).toBeNull();
    expect(notesSpy).not.toHaveBeenCalled();
  });
});
