/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import * as api from "../../src/api";
import MyTickets from "../../src/pages/MyTickets";
import { RequesterProvider } from "../../src/context/RequesterContext";

vi.mock("lucide-react", () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Search: () => null,
  FilterX: () => null,
}));

const CATEGORIES = [
  { id: 1, name: "Account and Access" },
  { id: 3, name: "Network" },
];
const SYSTEMS = [
  { id: 1, name: "Email Client" },
  { id: 3, name: "VPN Service" },
];

const TICKETS: api.TicketSummary[] = [
  {
    id: 1,
    ticketNo: "TK-20260906-0001",
    title: "VPN drops every 5 minutes",
    description: "Cannot stay connected",
    priority: "HIGH",
    status: "PENDING",
    createdAt: "2026-09-06T04:18:20.000Z",
    category: { id: 3, name: "Network" },
    system: { id: 3, name: "VPN Service" },
  },
  {
    id: 2,
    ticketNo: "TK-20260906-0002",
    title: "Printer jams on third floor",
    description: "Paper stuck",
    priority: "LOW",
    status: "IN_PROGRESS",
    createdAt: "2026-09-05T09:10:00.000Z",
    category: { id: 3, name: "Network" },
    system: { id: 1, name: "Email Client" },
  },
];

const PAGINATION: api.Pagination = { total: 25, page: 1, limit: 10, totalPages: 3 };

const getTicketsMock = vi.fn();

describe("MyTickets Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getTicketsMock.mockResolvedValue({ tickets: TICKETS, pagination: PAGINATION });
    vi.spyOn(api, "getCategories").mockResolvedValue(CATEGORIES);
    vi.spyOn(api, "getSystems").mockResolvedValue(SYSTEMS);
    vi.spyOn(api, "getTickets").mockImplementation(getTicketsMock);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = () => {
    window.localStorage.setItem(
      "toktickit.selectedRequester",
      JSON.stringify({ id: 2, name: "Weerapong Chaiyaporn" })
    );
    return render(
      <BrowserRouter>
        <RequesterProvider>
          <MyTickets />
        </RequesterProvider>
      </BrowserRouter>
    );
  };

  it("renders desktop table rows and mobile cards with ticket data", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("ticket-row")).toHaveLength(2);
    });
    expect(screen.getAllByTestId("ticket-card")).toHaveLength(2);
    expect(screen.getAllByText("VPN drops every 5 minutes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("TK-20260906-0001").length).toBeGreaterThanOrEqual(1);
  });

  it("passes the selected requester id as the ownership scope", async () => {
    renderPage();

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenCalled();
    });
    const [, requesterId] = getTicketsMock.mock.calls[getTicketsMock.mock.calls.length - 1];
    expect(requesterId).toBe(2);
  });

  it("shows the empty state when there are no tickets and no filters", async () => {
    getTicketsMock.mockResolvedValue({
      tickets: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeDefined();
    });
    expect(screen.queryByTestId("no-results")).toBeNull();
  });

  it("shows the no-results state with Clear Filters when a search matches nothing", async () => {
    getTicketsMock.mockResolvedValue({
      tickets: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("ticket-search")).toBeDefined();
    });

    fireEvent.change(screen.getByTestId("ticket-search"), { target: { value: "zzzz" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(screen.getByTestId("no-results")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeDefined();
    });
  });

  it("sends search and filter parameters to the API", async () => {
    renderPage();

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId("ticket-search"), { target: { value: "VPN" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    fireEvent.change(screen.getByTestId("filter-status"), { target: { value: "PENDING" } });

    await waitFor(() => {
      const last = getTicketsMock.mock.calls[getTicketsMock.mock.calls.length - 1];
      expect(last[0]).toEqual(expect.objectContaining({ search: "VPN", status: "PENDING" }));
    });
  });

  it("sorts by priority when the sort control is activated", async () => {
    renderPage();

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId("sort-priority"));

    await waitFor(() => {
      const last = getTicketsMock.mock.calls[getTicketsMock.mock.calls.length - 1];
      expect(last[0]).toEqual(expect.objectContaining({ sort: "priority", order: "desc" }));
    });
  });

  it("paginates: clicking page 2 refetches with page=2", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("page-number")).toHaveLength(3);
    });

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => {
      const last = getTicketsMock.mock.calls[getTicketsMock.mock.calls.length - 1];
      expect(last[0]).toEqual(expect.objectContaining({ page: 2 }));
    });
  });

  it("shows an error state with a Retry that refetches", async () => {
    getTicketsMock.mockRejectedValue(new Error("boom"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("tickets-error")).toBeDefined();
    });

    getTicketsMock.mockResolvedValue({ tickets: TICKETS, pagination: PAGINATION });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getAllByTestId("ticket-row")).toHaveLength(2);
    });
  });
});